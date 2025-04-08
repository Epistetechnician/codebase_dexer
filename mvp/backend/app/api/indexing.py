from fastapi import APIRouter, Query, Body, HTTPException
from fastapi.responses import StreamingResponse
from typing import Optional, Dict, Any
from enum import Enum
import asyncio
import json
from ..services.indexer import (
    get_indexing_status, 
    get_file_history, 
    add_documentation, 
    start_indexing,
    set_indexing_schedule,
    get_indexing_schedule,
    get_documentation
)

router = APIRouter()

class ScheduleType(str, Enum):
    hourly = "hourly"
    daily = "daily"
    weekly = "weekly"
    none = "none"

class DayOfWeek(str, Enum):
    monday = "monday"
    tuesday = "tuesday"
    wednesday = "wednesday"
    thursday = "thursday"
    friday = "friday"
    saturday = "saturday"
    sunday = "sunday"

async def generate_status_events(repo_path: str):
    """Generate SSE events for indexing status."""
    while True:
        status = await get_indexing_status(repo_path)
        yield f"data: {json.dumps(status)}\n\n"
        
        if status["completed"]:
            break
            
        await asyncio.sleep(1)

@router.get("/indexing-status")
async def indexing_status(repo_path: str = Query(..., description="Path to the repository")):
    """Get the current status of an indexing task."""
    try:
        status = await get_indexing_status(repo_path)
        return status
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/indexing-status-stream")
async def indexing_status_stream(repo_path: str = Query(..., description="Path to the repository")):
    """Stream the status of an indexing task using Server-Sent Events."""
    return StreamingResponse(
        generate_status_events(repo_path),
        media_type="text/event-stream"
    )

@router.get("/file-history")
async def file_history(repo_path: str = Query(..., description="Path to the repository")):
    """Get the file history for a repository."""
    return await get_file_history(repo_path)

@router.get("/documentation")
async def get_repo_documentation(
    repo_path: str = Query(..., description="Path to the repository"),
    file_path: str = Query(None, description="Optional: Path to the file, relative to repo")
):
    """Get documentation for a repository or a specific file."""
    result = await get_documentation(repo_path, file_path)
    return result

@router.post("/documentation")
async def save_documentation(
    content: str = Body(..., embed=True),
    repo_path: str = Query(..., description="Path to the repository"),
    file_path: str = Query(..., description="Path to the file, relative to repo")
):
    """Add or update documentation for a specific file."""
    result = await add_documentation(repo_path, file_path, content)
    return result

@router.post("/index-repository")
async def index_repository(
    repository_path: str = Body(..., embed=True),
    clear_existing: bool = Body(True, embed=True)
):
    """Start indexing a repository."""
    # Start indexing in the background
    asyncio.create_task(start_indexing(repository_path, clear_existing))
    return {"message": "Indexing started", "repo_path": repository_path}

@router.post("/schedule-indexing")
async def schedule_indexing(
    repo_path: str = Body(..., description="Path to the repository"),
    schedule_type: ScheduleType = Body(..., description="Type of schedule"),
    time_value: Optional[str] = Body(None, description="Time in HH:MM format (for daily/weekly)"),
    day_of_week: Optional[DayOfWeek] = Body(None, description="Day of week (for weekly)")
):
    """Set up an indexing schedule for a repository."""
    try:
        result = await set_indexing_schedule(
            repo_path=repo_path,
            schedule_type=schedule_type,
            time_value=time_value,
            day_of_week=day_of_week
        )
        
        if not result.get("success", False):
            raise HTTPException(status_code=400, detail=result.get("message", "Failed to set schedule"))
            
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/indexing-schedule")
async def get_schedule(
    repo_path: str = Query(..., description="Path to the repository")
):
    """Get the current indexing schedule for a repository."""
    try:
        schedule = await get_indexing_schedule(repo_path)
        return schedule
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 