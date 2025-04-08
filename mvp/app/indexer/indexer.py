import os
import hashlib
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple, Generator, Any
import gitignore_parser

from ..config import settings
from ..database.models import ASTNode, CodeNode, CodeRelation, NodeType, RelationType, Position
from ..database.neo4j_client import db_client
from .parser import PythonParser
from .js_parser import JavaScriptParser

class CodeIndexer:
    def __init__(self):
        self.parsers = {
            ".py": PythonParser,
            ".js": JavaScriptParser,
            ".ts": JavaScriptParser,
            ".jsx": JavaScriptParser,
            ".tsx": JavaScriptParser,
        }
        self._current_repo_path: Optional[Path] = None
        self._gitignore_matcher = None
        self._file_hashes: Dict[str, str] = {}
    
    def _compute_file_hash(self, file_path: Path) -> str:
        """Compute SHA-256 hash of a file"""
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()
    
    def _get_changed_files(self, repo_path: Path) -> Tuple[Set[Path], Set[Path], Set[Path]]:
        """
        Get lists of modified, added, and deleted files by comparing with stored hashes
        Returns: (modified_files, added_files, deleted_files)
        """
        current_files = set()
        modified_files = set()
        added_files = set()
        
        # Check for modified and added files
        for file_path in self._walk_repository(repo_path):
            rel_path = str(file_path.relative_to(repo_path))
            current_files.add(rel_path)
            
            if not self._should_index_file(file_path):
                continue
            
            current_hash = self._compute_file_hash(file_path)
            if rel_path in self._file_hashes:
                if current_hash != self._file_hashes[rel_path]:
                    modified_files.add(file_path)
            else:
                added_files.add(file_path)
            
            self._file_hashes[rel_path] = current_hash
        
        # Check for deleted files
        deleted_files = {
            repo_path / rel_path
            for rel_path in self._file_hashes.keys()
            if rel_path not in current_files
        }
        
        # Remove deleted files from hash cache
        for file_path in deleted_files:
            rel_path = str(file_path.relative_to(repo_path))
            del self._file_hashes[rel_path]
        
        return modified_files, added_files, deleted_files
    
    def index_repository(self, repo_path: str, incremental: bool = True) -> Dict[str, any]:
        """Index a repository and store its structure in the graph database"""
        repo_path = Path(repo_path).resolve()
        if not repo_path.is_dir():
            raise ValueError(f"Repository path does not exist: {repo_path}")
        
        self._current_repo_path = repo_path
        self._setup_gitignore(repo_path)
        
        # Check repository size if needed
        if settings.skip_repositories_larger_than_gb > 0:
            repo_size_gb = sum(f.stat().st_size for f in repo_path.glob('**/*') if f.is_file()) / (1024**3)
            if repo_size_gb > settings.skip_repositories_larger_than_gb:
                return {
                    "repository": str(repo_path),
                    "indexed_files": 0,
                    "skipped_files": 0,
                    "errors": [f"Repository exceeds maximum size limit of {settings.skip_repositories_larger_than_gb}GB"],
                    "status": "skipped",
                    "root_node_id": None
                }
        
        indexed_files = 0
        skipped_files = 0
        errors = []
        
        # Get or create repository root node
        root_node = CodeNode(
            name=repo_path.name,
            type=NodeType.MODULE,
            file_path=str(repo_path),
            position=Position(start_line=0, end_line=0),
            properties={"is_root": True}
        )
        root_id = db_client.get_or_create_root_node(root_node)
        
        if incremental:
            # Get lists of changed files
            modified_files, added_files, deleted_files = self._get_changed_files(repo_path)
            
            # Remove deleted files from the graph
            for file_path in deleted_files:
                db_client.delete_file_nodes(str(file_path.relative_to(repo_path)))
                skipped_files += 1
            
            # Update modified files
            for file_path in modified_files:
                db_client.delete_file_nodes(str(file_path.relative_to(repo_path)))
                if self._index_file(file_path, root_id):
                    indexed_files += 1
                else:
                    skipped_files += 1
            
            # Add new files
            for file_path in added_files:
                if self._index_file(file_path, root_id):
                    indexed_files += 1
                else:
                    skipped_files += 1
        else:
            # Clear existing data and do a full index
            db_client.clear_database()
            self._file_hashes.clear()
            
            for file_path in self._walk_repository(repo_path):
                try:
                    if self._should_index_file(file_path):
                        # Compute and store file hash
                        rel_path = str(file_path.relative_to(repo_path))
                        self._file_hashes[rel_path] = self._compute_file_hash(file_path)
                        
                        if self._index_file(file_path, root_id):
                            indexed_files += 1
                        else:
                            skipped_files += 1
                    else:
                        skipped_files += 1
                except Exception as e:
                    errors.append(f"Error indexing {file_path}: {str(e)}")
                    skipped_files += 1
        
        return {
            "repository": str(repo_path),
            "indexed_files": indexed_files,
            "skipped_files": skipped_files,
            "errors": errors,
            "root_node_id": root_id
        }
    
    def _setup_gitignore(self, repo_path: Path) -> None:
        """Set up gitignore matcher for the repository"""
        gitignore_path = repo_path / ".gitignore"
        if gitignore_path.exists():
            self._gitignore_matcher = gitignore_parser.parse_gitignore(gitignore_path)
        else:
            self._gitignore_matcher = None
    
    def _walk_repository(self, repo_path: Path) -> Generator[Path, None, None]:
        """Walk through repository and yield file paths"""
        for root, dirs, files in os.walk(repo_path):
            # Skip common directories we don't want to index
            dirs[:] = [d for d in dirs if not self._should_skip_directory(d)]
            
            for file in files:
                yield Path(root) / file
    
    def _should_skip_directory(self, dirname: str) -> bool:
        """Check if a directory should be skipped"""
        # Check if the directory is in the skip list
        if dirname in settings.skip_directories:
            return True
        
        # Check if it starts with a dot (hidden directory)
        if dirname.startswith("."):
            return True
        
        # Get repository-specific settings if available
        repo_path_str = str(self._current_repo_path) if self._current_repo_path else None
        if repo_path_str and repo_path_str in settings.repository_settings:
            repo_settings = settings.repository_settings[repo_path_str]
            # Check custom include/exclude directories
            if 'include_dirs' in repo_settings and dirname not in repo_settings['include_dirs']:
                return True
            if 'exclude_dirs' in repo_settings and dirname in repo_settings['exclude_dirs']:
                return True
        
        return False
    
    def _should_index_file(self, file_path: Path) -> bool:
        """Check if a file should be indexed"""
        # Skip files that are too large
        try:
            file_size_mb = file_path.stat().st_size / (1024 * 1024)
            max_size = settings.skip_files_larger_than_mb
            
            # Check repository-specific settings
            repo_path_str = str(self._current_repo_path) if self._current_repo_path else None
            if repo_path_str and repo_path_str in settings.repository_settings:
                repo_settings = settings.repository_settings[repo_path_str]
                if 'max_file_size_mb' in repo_settings:
                    max_size = repo_settings['max_file_size_mb']
            
            if file_size_mb > max_size:
                return False
        except OSError:
            return False
        
        # Check gitignore
        if self._gitignore_matcher and self._gitignore_matcher(str(file_path)):
            return False
        
        # Check file extension against supported languages
        if file_path.suffix not in self.parsers:
            return False
        
        # Check against ignore patterns
        for pattern in settings.ignore_patterns:
            if file_path.match(pattern):
                return False
        
        # Check repository-specific patterns
        if repo_path_str and repo_path_str in settings.repository_settings:
            repo_settings = settings.repository_settings[repo_path_str]
            if 'ignore_patterns' in repo_settings:
                for pattern in repo_settings['ignore_patterns']:
                    if file_path.match(pattern):
                        return False
        
        return True
    
    def _index_file(self, file_path: Path, root_id: str) -> bool:
        """Index a single file and store its AST in the graph database"""
        parser_class = self.parsers.get(file_path.suffix)
        if not parser_class:
            return False
        
        try:
            # Parse the file
            ast_node = parser_class.parse_file(file_path)
            if not ast_node:
                return False
            
            # Convert AST to graph nodes and relationships
            nodes_to_create: List[CodeNode] = []
            relationships_to_create: List[CodeRelation] = []
            
            def process_ast_node(node: ASTNode, parent_id: Optional[str] = None) -> str:
                # Create CodeNode from ASTNode
                code_node = CodeNode(
                    name=node.name,
                    type=node.type,
                    file_path=str(file_path.relative_to(self._current_repo_path)),
                    position=node.position,
                    properties=node.properties
                )
                
                # Store node
                node_id = db_client.create_node(code_node)
                
                # Create relationship to parent if exists
                if parent_id:
                    relationships_to_create.append(
                        CodeRelation(
                            source_id=parent_id,
                            target_id=node_id,
                            type=RelationType.CONTAINS
                        )
                    )
                
                # Process children
                for child in node.children:
                    process_ast_node(child, node_id)
                
                return node_id
            
            # Start processing from root AST node
            file_node_id = process_ast_node(ast_node)
            
            # Create relationship to repository root
            db_client.create_relationship(
                CodeRelation(
                    source_id=root_id,
                    target_id=file_node_id,
                    type=RelationType.CONTAINS
                )
            )
            
            # Create all relationships
            for rel in relationships_to_create:
                db_client.create_relationship(rel)
            
            return True
            
        except Exception as e:
            print(f"Error indexing file {file_path}: {e}")
            return False

# Create global indexer instance
indexer = CodeIndexer() 