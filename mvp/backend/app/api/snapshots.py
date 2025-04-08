from fastapi import APIRouter, Query, HTTPException
from typing import Optional, List, Dict, Any
import os
import json
import uuid
from datetime import datetime
from ..services.neo4j_service import neo4j_service
from ..services.indexer import file_history

router = APIRouter()

# Snapshots storage path
SNAPSHOTS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'data', 'snapshots')

# Ensure directory exists
os.makedirs(SNAPSHOTS_DIR, exist_ok=True)

def get_repo_snapshots_dir(repo_path: str) -> str:
    """Get the snapshots directory for a specific repository."""
    # Use sanitized path to create directory name
    safe_name = repo_path.replace('/', '_').replace('\\', '_')
    repo_dir = os.path.join(SNAPSHOTS_DIR, safe_name)
    os.makedirs(repo_dir, exist_ok=True)
    return repo_dir

def load_snapshots(repo_path: str) -> List[Dict[str, Any]]:
    """Load all snapshots for a repository."""
    snapshots_dir = get_repo_snapshots_dir(repo_path)
    snapshots = []
    
    if os.path.exists(snapshots_dir):
        for filename in os.listdir(snapshots_dir):
            if filename.endswith('.json'):
                try:
                    with open(os.path.join(snapshots_dir, filename), 'r') as f:
                        snapshot = json.load(f)
                        # Exclude graph_data from the list to keep it lightweight
                        if 'graph_data' in snapshot:
                            del snapshot['graph_data']
                        snapshots.append(snapshot)
                except Exception as e:
                    print(f"Error loading snapshot {filename}: {e}")
    
    # Sort by timestamp descending (newest first)
    snapshots.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
    return snapshots

def get_snapshot(snapshot_id: str) -> Optional[Dict[str, Any]]:
    """Get a specific snapshot by ID."""
    # Search in all repo directories since we don't know which repo it belongs to
    for repo_dir in os.listdir(SNAPSHOTS_DIR):
        repo_snapshots_dir = os.path.join(SNAPSHOTS_DIR, repo_dir)
        if os.path.isdir(repo_snapshots_dir):
            snapshot_path = os.path.join(repo_snapshots_dir, f"{snapshot_id}.json")
            if os.path.exists(snapshot_path):
                try:
                    with open(snapshot_path, 'r') as f:
                        return json.load(f)
                except Exception as e:
                    print(f"Error loading snapshot {snapshot_id}: {e}")
                    return None
    return None

def save_snapshot(repo_path: str, snapshot: Dict[str, Any]):
    """Save a snapshot to disk."""
    snapshots_dir = get_repo_snapshots_dir(repo_path)
    snapshot_path = os.path.join(snapshots_dir, f"{snapshot['id']}.json")
    
    try:
        with open(snapshot_path, 'w') as f:
            json.dump(snapshot, f, indent=2)
    except Exception as e:
        print(f"Error saving snapshot: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save snapshot: {str(e)}")

@router.get("/snapshots")
async def get_repository_snapshots(repo_path: str = Query(..., description="Path to the repository")):
    """Get all snapshots for a repository."""
    snapshots = load_snapshots(repo_path)
    return {"snapshots": snapshots}

@router.get("/snapshot-details")
async def get_snapshot_details(id: str = Query(..., description="Snapshot ID")):
    """Get details for a specific snapshot."""
    snapshot = get_snapshot(id)
    if not snapshot:
        raise HTTPException(status_code=404, detail=f"Snapshot not found: {id}")
    
    return snapshot

@router.post("/snapshots")
async def create_snapshot(repo_path: str = Query(..., description="Path to the repository")):
    """Create a new snapshot of the current state."""
    if not os.path.exists(repo_path):
        raise HTTPException(status_code=400, detail=f"Repository does not exist: {repo_path}")
    
    # Get current file history for the repo
    repo_history = file_history.get(repo_path, {})
    if not repo_history:
        raise HTTPException(status_code=400, detail=f"Repository not indexed: {repo_path}")
    
    # Get current graph data
    graph_data = None
    if neo4j_service.connected:
        try:
            graph_data = neo4j_service.get_code_graph(repo_path)
        except Exception as e:
            print(f"Error getting graph data: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to get graph data: {str(e)}")
    
    # Create snapshot
    snapshot_id = str(uuid.uuid4())[:8]  # Use first 8 chars of UUID for readability
    timestamp = datetime.now().isoformat()
    
    # Prepare changes data
    changes = repo_history.get("changes", {
        "new": [],
        "changed": [],
        "deleted": []
    })
    
    # Prepare full snapshot
    snapshot = {
        "id": snapshot_id,
        "repo_path": repo_path,
        "timestamp": timestamp,
        "file_count": len(repo_history.get("files", {})),
        "node_count": len(graph_data.get("nodes", [])) if graph_data else 0,
        "link_count": len(graph_data.get("links", [])) if graph_data else 0,
        "changes": {
            "new_files": changes.get("new", []),
            "changed_files": changes.get("changed", []),
            "deleted_files": changes.get("deleted", [])
        },
        "graph_data": graph_data
    }
    
    # Save the snapshot
    save_snapshot(repo_path, snapshot)
    
    # Return the snapshot without the graph_data to keep response size small
    snapshot_response = snapshot.copy()
    if "graph_data" in snapshot_response:
        del snapshot_response["graph_data"]
    
    return snapshot_response

@router.delete("/snapshots")
async def delete_snapshot(id: str = Query(..., description="Snapshot ID")):
    """Delete a specific snapshot."""
    snapshot = get_snapshot(id)
    if not snapshot:
        raise HTTPException(status_code=404, detail=f"Snapshot not found: {id}")
    
    # Find and delete the snapshot file
    repo_path = snapshot.get("repo_path")
    if repo_path:
        snapshots_dir = get_repo_snapshots_dir(repo_path)
        snapshot_path = os.path.join(snapshots_dir, f"{id}.json")
        
        if os.path.exists(snapshot_path):
            try:
                os.remove(snapshot_path)
                return {"success": True}
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Failed to delete snapshot: {str(e)}")
    
    raise HTTPException(status_code=500, detail="Failed to delete snapshot: could not determine file location") 