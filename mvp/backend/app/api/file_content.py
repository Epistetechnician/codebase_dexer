from fastapi import APIRouter, HTTPException
import os
from typing import Optional
from pathlib import Path

router = APIRouter()

def is_binary(file_path: str) -> bool:
    """Check if a file is binary."""
    try:
        with open(file_path, 'tr') as check_file:
            check_file.read(1024)
            return False
    except UnicodeDecodeError:
        return True

def get_file_extension(file_path: str) -> Optional[str]:
    """Get the file extension without the dot."""
    return Path(file_path).suffix.lstrip('.')

@router.get("/file-content")
async def get_file_content(path: str):
    """Get the content of a file."""
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found")
    
    if not os.path.isfile(path):
        raise HTTPException(status_code=400, detail="Path is not a file")
    
    try:
        # Check if file is binary
        if is_binary(path):
            raise HTTPException(status_code=400, detail="Cannot display binary file")
        
        # Get file extension
        extension = get_file_extension(path)
        
        # Read file content
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        return {
            "content": content,
            "extension": extension
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 