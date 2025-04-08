from fastapi import APIRouter, HTTPException
import os
from typing import List, Optional
from pydantic import BaseModel
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

class FileNode(BaseModel):
    id: str
    name: str
    type: str
    children: Optional[List['FileNode']] = None

FileNode.model_rebuild()

def build_file_tree(path: str, base_path: str) -> FileNode:
    """Recursively build a file tree structure."""
    name = os.path.basename(path)
    relative_path = os.path.relpath(path, base_path)
    
    if os.path.isfile(path):
        return FileNode(
            id=relative_path,
            name=name,
            type='file'
        )
    
    children = []
    try:
        for item in sorted(os.listdir(path)):
            item_path = os.path.join(path, item)
            # Skip hidden files and common exclude directories
            if item.startswith('.') or item in {'node_modules', '__pycache__', 'venv', 'env'}:
                continue
            children.append(build_file_tree(item_path, base_path))
    except PermissionError:
        # Handle permission errors gracefully
        return FileNode(
            id=relative_path,
            name=name,
            type='directory',
            children=[]
        )
    except Exception as e:
        logger.error(f"Error processing path {path}: {str(e)}")
        # Return a partial tree in case of other errors
        return FileNode(
            id=relative_path,
            name=name,
            type='directory',
            children=[]
        )
    
    return FileNode(
        id=relative_path,
        name=name,
        type='directory',
        children=children
    )

@router.get("/file-tree")
async def get_file_tree(path: str):
    """Get the file tree structure for a given repository path."""
    # Normalize the path to handle URL-encoded paths
    normalized_path = os.path.normpath(path)
    
    logger.info(f"Request to get file tree for path: {normalized_path}")
    
    if not os.path.exists(normalized_path):
        logger.error(f"Repository path not found: {normalized_path}")
        raise HTTPException(status_code=404, detail=f"Repository path not found: {normalized_path}")
    
    if not os.path.isdir(normalized_path):
        logger.error(f"Path is not a directory: {normalized_path}")
        raise HTTPException(status_code=400, detail="Path must be a directory")
    
    try:
        tree = build_file_tree(normalized_path, normalized_path)
        return tree
    except Exception as e:
        logger.error(f"Error building file tree: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e)) 