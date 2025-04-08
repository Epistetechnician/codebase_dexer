import ast
from typing import Dict, List, Optional, Tuple
from pathlib import Path

from ..database.models import ASTNode, NodeType, Position

class PythonParser:
    """Parser for Python source code that generates an AST representation"""
    
    @staticmethod
    def parse_file(file_path: Path) -> Optional[ASTNode]:
        """Parse a Python file and return its AST representation"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                source = f.read()
            
            tree = ast.parse(source)
            return PythonParser._process_node(tree, source, str(file_path))
        except Exception as e:
            print(f"Error parsing {file_path}: {e}")
            return None
    
    @staticmethod
    def _get_node_position(node: ast.AST) -> Position:
        """Extract position information from an AST node"""
        return Position(
            start_line=getattr(node, 'lineno', 0),
            end_line=getattr(node, 'end_lineno', 0) or getattr(node, 'lineno', 0),
            start_col=getattr(node, 'col_offset', None),
            end_col=getattr(node, 'end_col_offset', None)
        )
    
    @staticmethod
    def _process_node(node: ast.AST, source: str, file_path: str) -> Optional[ASTNode]:
        """Process an AST node and its children recursively"""
        if isinstance(node, ast.Module):
            return PythonParser._process_module(node, source, file_path)
        elif isinstance(node, ast.ClassDef):
            return PythonParser._process_class(node, source, file_path)
        elif isinstance(node, ast.FunctionDef):
            return PythonParser._process_function(node, source, file_path)
        elif isinstance(node, ast.Import):
            return PythonParser._process_import(node, source, file_path)
        elif isinstance(node, ast.ImportFrom):
            return PythonParser._process_import_from(node, source, file_path)
        return None
    
    @staticmethod
    def _process_module(node: ast.Module, source: str, file_path: str) -> ASTNode:
        """Process a module node"""
        children = []
        for child in ast.iter_child_nodes(node):
            if processed := PythonParser._process_node(child, source, file_path):
                children.append(processed)
        
        return ASTNode(
            type=NodeType.MODULE,
            name=Path(file_path).name,
            position=Position(start_line=1, end_line=len(source.splitlines())),
            children=children,
            properties={"file_path": file_path}
        )
    
    @staticmethod
    def _process_class(node: ast.ClassDef, source: str, file_path: str) -> ASTNode:
        """Process a class definition node"""
        children = []
        for child in node.body:
            if processed := PythonParser._process_node(child, source, file_path):
                children.append(processed)
        
        bases = [base.id for base in node.bases if isinstance(base, ast.Name)]
        
        return ASTNode(
            type=NodeType.CLASS,
            name=node.name,
            position=PythonParser._get_node_position(node),
            children=children,
            properties={
                "bases": bases,
                "decorators": [d.id for d in node.decorator_list if isinstance(d, ast.Name)]
            }
        )
    
    @staticmethod
    def _process_function(node: ast.FunctionDef, source: str, file_path: str) -> ASTNode:
        """Process a function definition node"""
        # Determine if this is a method (inside a class) or standalone function
        node_type = NodeType.METHOD if isinstance(node.parent, ast.ClassDef) else NodeType.FUNCTION
        
        return ASTNode(
            type=node_type,
            name=node.name,
            position=PythonParser._get_node_position(node),
            properties={
                "args": [arg.arg for arg in node.args.args],
                "decorators": [d.id for d in node.decorator_list if isinstance(d, ast.Name)],
                "returns": getattr(node.returns, 'id', None) if node.returns else None
            }
        )
    
    @staticmethod
    def _process_import(node: ast.Import, source: str, file_path: str) -> ASTNode:
        """Process an import node"""
        return ASTNode(
            type=NodeType.IMPORT,
            name=", ".join(alias.name for alias in node.names),
            position=PythonParser._get_node_position(node),
            properties={
                "aliases": {
                    alias.name: alias.asname for alias in node.names if alias.asname
                }
            }
        )
    
    @staticmethod
    def _process_import_from(node: ast.ImportFrom, source: str, file_path: str) -> ASTNode:
        """Process an import from node"""
        return ASTNode(
            type=NodeType.IMPORT,
            name=f"from {node.module or '.'} import {', '.join(alias.name for alias in node.names)}",
            position=PythonParser._get_node_position(node),
            properties={
                "module": node.module,
                "level": node.level,
                "aliases": {
                    alias.name: alias.asname for alias in node.names if alias.asname
                }
            }
        ) 