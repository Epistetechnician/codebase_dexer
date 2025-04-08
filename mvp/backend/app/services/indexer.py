import os
from typing import Dict, Any, List, Optional
import asyncio
from collections import defaultdict
import ast
import json
from pathlib import Path
import hashlib
import time
from datetime import datetime, timedelta
import schedule
import threading
from .neo4j_service import neo4j_service

# Global state to track indexing progress for multiple repositories
indexing_status = defaultdict(lambda: {
    "current_file": "",
    "total_files": 0,
    "processed_files": 0,
    "completed": False
})

# Store file hashes to track changes between indexing runs
file_history = defaultdict(lambda: {
    "last_indexed": None,
    "files": {}
})

# Store scheduling information
indexing_schedules = {}
schedule_thread = None
is_schedule_running = False

def calculate_file_hash(file_path: str) -> str:
    """Calculate a hash of the file contents to detect changes."""
    try:
        with open(file_path, 'rb') as f:
            return hashlib.md5(f.read()).hexdigest()
    except Exception:
        return ""

def get_file_type(file_path: str) -> str:
    """Get the file type based on extension."""
    ext = os.path.splitext(file_path)[1].lower()
    if ext in ['.py']:
        return 'python'
    elif ext in ['.js', '.jsx']:
        return 'javascript'
    elif ext in ['.ts', '.tsx']:
        return 'typescript'
    else:
        return 'unknown'

async def count_files(repo_path: str) -> int:
    """Count the total number of files to be indexed."""
    total = 0
    for root, _, files in os.walk(repo_path):
        if any(skip in root for skip in [".git", "node_modules", "__pycache__", "venv"]):
            continue
        total += len([f for f in files if f.endswith(('.py', '.js', '.ts', '.tsx', '.jsx'))])
    return total

async def parse_python_file(file_path: str) -> Dict:
    """Parse a Python file and extract its AST structure."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        tree = ast.parse(content)
        
        # Extract classes, functions, and imports
        classes = []
        functions = []
        imports = []
        
        for node in ast.walk(tree):
            if isinstance(node, ast.ClassDef):
                classes.append({
                    'name': node.name,
                    'lineno': node.lineno,
                    'end_lineno': node.end_lineno,
                })
            elif isinstance(node, ast.FunctionDef):
                functions.append({
                    'name': node.name,
                    'lineno': node.lineno,
                    'end_lineno': node.end_lineno,
                })
            elif isinstance(node, (ast.Import, ast.ImportFrom)):
                if isinstance(node, ast.Import):
                    for name in node.names:
                        imports.append({
                            'name': name.name,
                            'lineno': node.lineno
                        })
                else:
                    module = node.module or ''
                    for name in node.names:
                        imports.append({
                            'name': f"{module}.{name.name}",
                            'lineno': node.lineno
                        })
        
        return {
            'classes': classes,
            'functions': functions,
            'imports': imports,
            'success': True
        }
    except Exception as e:
        return {
            'error': str(e),
            'success': False
        }

async def update_indexing_status(repo_path: str, current_file: str = None, increment_processed: bool = False):
    """Update the indexing status for a repository."""
    status = indexing_status[repo_path]
    
    if not status["total_files"]:
        status["total_files"] = await count_files(repo_path)
    
    if current_file:
        status["current_file"] = current_file
    
    if increment_processed:
        status["processed_files"] += 1
        
    if status["processed_files"] >= status["total_files"]:
        status["completed"] = True

async def get_indexing_status(repo_path: str) -> Dict[str, Any]:
    """Get the current indexing status for a repository."""
    return indexing_status[repo_path]

async def start_indexing(repo_path: str, clear_existing: bool = True):
    """Start indexing a repository and update status."""
    # Reset status for this repository
    indexing_status[repo_path] = {
        "current_file": "Initializing...",
        "total_files": 0,
        "processed_files": 0,
        "completed": False
    }
    
    # Clear existing nodes if requested
    if clear_existing:
        neo4j_service.clear_database()
    
    # Count total files first
    total_files = await count_files(repo_path)
    indexing_status[repo_path]["total_files"] = total_files
    
    # Track changes
    changed_files = []
    new_files = []
    deleted_files = []
    
    # Store the current state of files to compare with previous runs
    current_files = {}
    
    # Process each file
    for root, _, files in os.walk(repo_path):
        if any(skip in root for skip in [".git", "node_modules", "__pycache__", "venv"]):
            continue
            
        for file in files:
            if file.endswith(('.py', '.js', '.ts', '.tsx', '.jsx')):
                file_path = os.path.join(root, file)
                rel_path = os.path.relpath(file_path, repo_path)
                
                # Calculate file hash for change detection
                file_hash = calculate_file_hash(file_path)
                current_files[rel_path] = {
                    "hash": file_hash,
                    "last_modified": os.path.getmtime(file_path)
                }
                
                # Check if file is new or changed
                if rel_path not in file_history[repo_path]["files"]:
                    new_files.append(rel_path)
                elif file_history[repo_path]["files"][rel_path]["hash"] != file_hash:
                    changed_files.append(rel_path)
                
                await update_indexing_status(repo_path, rel_path, True)
                
                # Get file type
                file_type = get_file_type(file_path)
                
                # Create file node in Neo4j
                file_id = neo4j_service.create_or_update_file_node(
                    repo_path=repo_path,
                    file_path=rel_path,
                    file_type=file_type
                )
                
                # Parse the file based on its type
                if file.endswith('.py'):
                    result = await parse_python_file(file_path)
                    if result['success']:
                        # Store parsed data in Neo4j
                        neo4j_service.create_module_structure(
                            file_id=file_id,
                            classes=result['classes'],
                            functions=result['functions'],
                            imports=result['imports']
                        )
                
                # Add a small delay to avoid overwhelming the system
                await asyncio.sleep(0.1)
    
    # Check for deleted files
    if file_history[repo_path]["files"]:
        for old_file in file_history[repo_path]["files"]:
            if old_file not in current_files:
                deleted_files.append(old_file)
    
    # Update file history
    file_history[repo_path]["files"] = current_files
    file_history[repo_path]["last_indexed"] = datetime.now().isoformat()
    file_history[repo_path]["changes"] = {
        "new": new_files,
        "changed": changed_files,
        "deleted": deleted_files
    }
    
    # Mark as completed
    indexing_status[repo_path]["completed"] = True
    indexing_status[repo_path]["current_file"] = "Indexing complete"

# Schedule-related functions
def run_scheduled_index(repo_path: str):
    """Run indexing on the scheduled time (called by scheduler)"""
    async def _run():
        await start_indexing(repo_path, False)
    
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.run_until_complete(_run())
    loop.close()

def start_scheduler():
    """Start the scheduler thread"""
    global schedule_thread, is_schedule_running
    
    if is_schedule_running:
        return
    
    def run_scheduler():
        global is_schedule_running
        is_schedule_running = True
        while is_schedule_running:
            schedule.run_pending()
            time.sleep(60)  # Check every minute
    
    schedule_thread = threading.Thread(target=run_scheduler, daemon=True)
    schedule_thread.start()

def stop_scheduler():
    """Stop the scheduler thread"""
    global is_schedule_running
    is_schedule_running = False
    if schedule_thread:
        schedule_thread.join(timeout=2.0)

async def set_indexing_schedule(repo_path: str, 
                               schedule_type: str, 
                               time_value: Optional[str] = None,
                               day_of_week: Optional[str] = None):
    """Set up an indexing schedule for a repository
    
    Args:
        repo_path: Path to the repository
        schedule_type: Type of schedule - 'daily', 'weekly', 'hourly', 'none'
        time_value: Time for the schedule (HH:MM format for daily/weekly)
        day_of_week: Day of week for weekly schedules
    """
    # Clear any existing schedule for this repo
    if repo_path in indexing_schedules:
        schedule.clear(repo_path)
    
    # Set up scheduling based on the type
    if schedule_type == 'none':
        if repo_path in indexing_schedules:
            del indexing_schedules[repo_path]
        return {"success": True, "message": "Indexing schedule removed"}
    
    if schedule_type == 'hourly':
        job = schedule.every().hour.do(run_scheduled_index, repo_path)
        schedule_info = {"type": "hourly"}
    
    elif schedule_type == 'daily':
        if not time_value:
            time_value = "00:00"  # Default to midnight
        
        hour, minute = map(int, time_value.split(':'))
        job = schedule.every().day.at(time_value).do(run_scheduled_index, repo_path)
        schedule_info = {"type": "daily", "time": time_value}
    
    elif schedule_type == 'weekly':
        if not day_of_week:
            day_of_week = "monday"  # Default to Monday
        
        if not time_value:
            time_value = "00:00"  # Default to midnight
        
        # Map day string to schedule method
        day_methods = {
            "monday": schedule.every().monday,
            "tuesday": schedule.every().tuesday,
            "wednesday": schedule.every().wednesday,
            "thursday": schedule.every().thursday,
            "friday": schedule.every().friday,
            "saturday": schedule.every().saturday,
            "sunday": schedule.every().sunday,
        }
        
        day_scheduler = day_methods.get(day_of_week.lower())
        if not day_scheduler:
            return {"success": False, "message": f"Invalid day of week: {day_of_week}"}
        
        job = day_scheduler.at(time_value).do(run_scheduled_index, repo_path)
        schedule_info = {"type": "weekly", "day": day_of_week, "time": time_value}
    
    else:
        return {"success": False, "message": f"Invalid schedule type: {schedule_type}"}
    
    # Store the schedule info
    indexing_schedules[repo_path] = schedule_info
    
    # Ensure scheduler is running
    start_scheduler()
    
    return {
        "success": True, 
        "message": f"Indexing scheduled: {schedule_type}", 
        "schedule": schedule_info
    }

async def get_indexing_schedule(repo_path: str) -> Dict[str, Any]:
    """Get the current indexing schedule for a repository"""
    return {
        "has_schedule": repo_path in indexing_schedules,
        "schedule": indexing_schedules.get(repo_path, {"type": "none"})
    }

# New function to get code graph for visualization
async def get_code_graph(repo_path: str, depth: int = 2) -> Dict[str, Any]:
    """Get the code graph for visualization."""
    return neo4j_service.get_code_graph(repo_path, depth)

# New endpoints for retrieving file history and changes
async def get_file_history(repo_path: str) -> Dict[str, Any]:
    """Get the file history for a repository."""
    if repo_path not in file_history:
        return {
            "last_indexed": None,
            "changes": {
                "new": [],
                "changed": [],
                "deleted": []
            }
        }
    return {
        "last_indexed": file_history[repo_path]["last_indexed"],
        "changes": file_history[repo_path].get("changes", {
            "new": [],
            "changed": [],
            "deleted": []
        })
    }

async def add_documentation(repo_path: str, file_path: str, content: str) -> Dict[str, Any]:
    """Add documentation for a specific file."""
    if repo_path not in file_history:
        return {"error": "Repository not indexed"}
    
    # Ensure the documentation field exists
    if "documentation" not in file_history[repo_path]:
        file_history[repo_path]["documentation"] = {}
    
    file_history[repo_path]["documentation"][file_path] = {
        "content": content,
        "last_updated": datetime.now().isoformat()
    }
    
    return {
        "status": "success",
        "file": file_path,
        "timestamp": datetime.now().isoformat()
    }

async def get_documentation(repo_path: str, file_path: str = None) -> Dict[str, Any]:
    """Get documentation for a repository or specific file."""
    if repo_path not in file_history:
        return {"error": "Repository not indexed"}
    
    if "documentation" not in file_history[repo_path]:
        return {"documentation": {}}
    
    if file_path:
        doc = file_history[repo_path]["documentation"].get(file_path, {})
        return {"documentation": {file_path: doc}}
    
    return {"documentation": file_history[repo_path]["documentation"]} 