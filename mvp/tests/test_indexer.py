import os
import tempfile
from pathlib import Path
import pytest

from app.indexer.indexer import CodeIndexer
from app.database.neo4j_client import Neo4jClient
from app.config import settings

@pytest.fixture
def temp_repo():
    """Create a temporary repository with some Python files"""
    with tempfile.TemporaryDirectory() as temp_dir:
        # Create a simple Python file
        with open(os.path.join(temp_dir, "main.py"), "w") as f:
            f.write("""
class MyClass:
    def my_method(self, arg1: str) -> None:
        print(arg1)
        
def my_function():
    return 42

from typing import List
import os
            """)
            
        # Create a .gitignore file
        with open(os.path.join(temp_dir, ".gitignore"), "w") as f:
            f.write("*.pyc\n__pycache__\n")
            
        yield temp_dir

@pytest.fixture
def indexer(temp_repo):
    """Create an indexer instance connected to Neo4j"""
    client = Neo4jClient()
    client.connect()
    indexer = CodeIndexer()
    yield indexer
    client.clear_database()
    client.close()

def test_index_repository(indexer, temp_repo):
    """Test basic repository indexing"""
    result = indexer.index_repository(temp_repo)
    
    assert result["repository"] == str(Path(temp_repo))
    assert result["indexed_files"] == 1  # main.py
    assert result["skipped_files"] == 0
    assert not result["errors"]
    assert result["root_node_id"]

def test_index_file_structure(indexer, temp_repo):
    """Test that file structure is correctly indexed"""
    result = indexer.index_repository(temp_repo)
    root_id = result["root_node_id"]
    
    # Get the subgraph from root
    from app.database.neo4j_client import db_client
    graph = db_client.get_subgraph(root_id, depth=3)
    
    # Verify nodes exist
    nodes = graph["nodes"]
    relationships = graph["relationships"]
    
    # Find nodes by their properties
    def find_node(nodes, name=None, type=None):
        for node in nodes:
            props = node["properties"]
            if name and props.get("name") != name:
                continue
            if type and "type" in props and props["type"] != type:
                continue
            return node
        return None
    
    # Check for main components
    assert find_node(nodes, name="MyClass", type="class")
    assert find_node(nodes, name="my_method", type="method")
    assert find_node(nodes, name="my_function", type="function")
    
    # Check relationships
    contains_rels = [r for r in relationships if r["type"] == "CONTAINS"]
    assert len(contains_rels) >= 3  # At least file -> class -> method

def test_gitignore_respect(indexer, temp_repo):
    """Test that .gitignore rules are respected"""
    # Create a file that should be ignored
    with open(os.path.join(temp_repo, "ignored.pyc"), "w") as f:
        f.write("This should be ignored")
    
    result = indexer.index_repository(temp_repo)
    assert result["indexed_files"] == 1  # Only main.py
    
def test_file_size_limit(indexer, temp_repo):
    """Test that large files are skipped"""
    # Create a file larger than the limit
    large_file = os.path.join(temp_repo, "large.py")
    size_mb = settings.max_file_size_mb + 1
    
    with open(large_file, "w") as f:
        f.write("x" * (size_mb * 1024 * 1024))
    
    result = indexer.index_repository(temp_repo)
    assert result["indexed_files"] == 1  # Only main.py
    assert result["skipped_files"] == 1  # large.py 