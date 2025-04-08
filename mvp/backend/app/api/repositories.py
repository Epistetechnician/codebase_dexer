from fastapi import APIRouter, Query, HTTPException, Body
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
import os
import json
from datetime import datetime
from ..services.neo4j_service import neo4j_service
from ..services.indexer import file_history

router = APIRouter()

# Repository storage path
REPO_CONFIG_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'data', 'repositories.json')

# Ensure directory exists
os.makedirs(os.path.dirname(REPO_CONFIG_PATH), exist_ok=True)

class RepositoryCreate(BaseModel):
    repo_path: str
    display_name: Optional[str] = None

class Repository(BaseModel):
    repo_path: str
    display_name: str
    last_indexed: Optional[str] = None
    file_count: int = 0
    node_count: int = 0
    link_count: int = 0
    snapshots: int = 0

def load_repositories() -> List[Dict[str, Any]]:
    """Load repositories from config file."""
    if not os.path.exists(REPO_CONFIG_PATH):
        return []
    
    try:
        with open(REPO_CONFIG_PATH, 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading repositories: {e}")
        return []

def save_repositories(repositories: List[Dict[str, Any]]):
    """Save repositories to config file."""
    try:
        with open(REPO_CONFIG_PATH, 'w') as f:
            json.dump(repositories, f, indent=2)
    except Exception as e:
        print(f"Error saving repositories: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save repository information: {str(e)}")

@router.get("/repositories")
async def get_repositories():
    """Get all indexed repositories."""
    repositories = load_repositories()
    
    # Get additional metadata for each repository
    for repo in repositories:
        # Get last indexed time from file history
        if repo["repo_path"] in file_history:
            repo["last_indexed"] = file_history[repo["repo_path"]].get("last_indexed")
            
            # Count files
            files = file_history[repo["repo_path"]].get("files", {})
            repo["file_count"] = len(files)
        
        # Get node and link count from Neo4j
        if neo4j_service.connected:
            try:
                graph_data = neo4j_service.get_code_graph(repo["repo_path"])
                repo["node_count"] = len(graph_data.get("nodes", []))
                repo["link_count"] = len(graph_data.get("links", []))
            except Exception as e:
                print(f"Error getting graph data: {e}")
        
        # Get snapshot count (will implement later)
        snapshots_dir = os.path.join(os.path.dirname(REPO_CONFIG_PATH), 'snapshots', repo["repo_path"].replace('/', '_'))
        if os.path.exists(snapshots_dir):
            snapshot_files = [f for f in os.listdir(snapshots_dir) if f.endswith('.json')]
            repo["snapshots"] = len(snapshot_files)
        else:
            repo["snapshots"] = 0
    
    return {"repositories": repositories}

@router.post("/repositories")
async def add_repository(repo: RepositoryCreate):
    """Add a new repository to the index."""
    repositories = load_repositories()
    
    # Check if path exists
    if not os.path.exists(repo.repo_path):
        raise HTTPException(status_code=400, detail=f"Path does not exist: {repo.repo_path}")
    
    # Check if already exists
    for existing in repositories:
        if existing["repo_path"] == repo.repo_path:
            raise HTTPException(status_code=400, detail=f"Repository already indexed: {repo.repo_path}")
    
    # Add new repository
    display_name = repo.display_name or os.path.basename(repo.repo_path)
    new_repo = {
        "repo_path": repo.repo_path,
        "display_name": display_name,
        "added_date": datetime.now().isoformat()
    }
    
    repositories.append(new_repo)
    save_repositories(repositories)
    
    return {"success": True, "repository": new_repo}

@router.delete("/repositories")
async def delete_repository(repo_path: str = Query(..., description="Path to the repository")):
    """Remove a repository from the index."""
    repositories = load_repositories()
    
    # Find and remove repository
    found = False
    for i, repo in enumerate(repositories):
        if repo["repo_path"] == repo_path:
            repositories.pop(i)
            found = True
            break
    
    if not found:
        raise HTTPException(status_code=404, detail=f"Repository not found: {repo_path}")
    
    save_repositories(repositories)
    
    return {"success": True} 