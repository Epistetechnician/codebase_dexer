from typing import Dict, Optional, List, Set
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .config import settings
from .database.neo4j_client import db_client
from .indexer.indexer import indexer

app = FastAPI(
    title="MCP Code Indexer",
    description="A tool for indexing and analyzing codebases using AST and graph databases",
    version="0.1.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class IndexRequest(BaseModel):
    repository_path: str
    clear_existing: bool = True
    incremental: bool = True

class GraphRequest(BaseModel):
    node_id: str
    depth: int = 2

class RepositorySettings(BaseModel):
    """Repository-specific indexing settings"""
    max_file_size_mb: Optional[int] = Field(None, description="Maximum file size in MB to index")
    include_dirs: Optional[List[str]] = Field(None, description="Only index these directories (relative to repo root)")
    exclude_dirs: Optional[List[str]] = Field(None, description="Directories to exclude from indexing")
    ignore_patterns: Optional[List[str]] = Field(None, description="Glob patterns for files to ignore")
    supported_extensions: Optional[List[str]] = Field(None, description="File extensions to index")

@app.on_event("startup")
async def startup():
    """Connect to Neo4j database on startup"""
    try:
        db_client.connect()
    except Exception as e:
        print(f"Error connecting to Neo4j: {e}")
        raise

@app.on_event("shutdown")
async def shutdown():
    """Close Neo4j connection on shutdown"""
    db_client.close()

@app.get("/health")
async def health_check() -> Dict[str, str]:
    """Check if the service is healthy"""
    return {"status": "healthy"}

@app.post("/index")
async def index_repository(request: IndexRequest) -> Dict:
    """Index a repository and store its structure in Neo4j"""
    try:
        result = indexer.index_repository(
            request.repository_path,
            incremental=request.incremental if not request.clear_existing else False
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/graph/{node_id}")
async def get_graph(node_id: str, depth: int = 2) -> Dict:
    """Get a subgraph starting from the specified node"""
    try:
        return db_client.get_subgraph(node_id, depth)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/node/{node_id}")
async def get_node(node_id: str) -> Optional[Dict]:
    """Get details about a specific node"""
    try:
        node = db_client.get_node_by_id(node_id)
        if not node:
            raise HTTPException(status_code=404, detail="Node not found")
        return node
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/node/{node_id}/relationships")
async def get_node_relationships(node_id: str) -> Dict[str, list]:
    """Get all relationships for a specific node"""
    try:
        relationships = db_client.get_node_relationships(node_id)
        return {"relationships": relationships}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/settings/indexing")
async def get_indexing_settings():
    """Get global indexing settings"""
    return {
        "max_file_size_mb": settings.skip_files_larger_than_mb,
        "skip_directories": list(settings.skip_directories),
        "ignore_patterns": list(settings.ignore_patterns),
        "supported_languages": list(settings.supported_languages),
        "max_repository_size_gb": settings.skip_repositories_larger_than_gb,
        "max_files_per_repository": settings.max_files_per_repository
    }

@app.get("/settings/repository/{repo_path:path}")
async def get_repository_settings(repo_path: str):
    """Get repository-specific indexing settings"""
    if repo_path not in settings.repository_settings:
        return {"message": "No custom settings for this repository", "using_defaults": True}
    
    return {
        "repository": repo_path,
        "settings": settings.repository_settings[repo_path],
        "using_defaults": False
    }

@app.post("/settings/repository/{repo_path:path}")
async def update_repository_settings(repo_path: str, repo_settings: RepositorySettings):
    """Update repository-specific indexing settings"""
    if repo_path not in settings.repository_settings:
        settings.repository_settings[repo_path] = {}
    
    # Update only the provided fields
    if repo_settings.max_file_size_mb is not None:
        settings.repository_settings[repo_path]["max_file_size_mb"] = repo_settings.max_file_size_mb
    
    if repo_settings.include_dirs is not None:
        settings.repository_settings[repo_path]["include_dirs"] = repo_settings.include_dirs
    
    if repo_settings.exclude_dirs is not None:
        settings.repository_settings[repo_path]["exclude_dirs"] = repo_settings.exclude_dirs
    
    if repo_settings.ignore_patterns is not None:
        settings.repository_settings[repo_path]["ignore_patterns"] = repo_settings.ignore_patterns
    
    if repo_settings.supported_extensions is not None:
        settings.repository_settings[repo_path]["supported_extensions"] = repo_settings.supported_extensions
    
    # Save settings to file
    settings.save_repository_settings()
    
    return {
        "message": "Repository settings updated successfully",
        "repository": repo_path,
        "settings": settings.repository_settings[repo_path]
    }

@app.delete("/settings/repository/{repo_path:path}")
async def delete_repository_settings(repo_path: str):
    """Delete repository-specific indexing settings"""
    if repo_path in settings.repository_settings:
        del settings.repository_settings[repo_path]
        
        # Save settings to file
        settings.save_repository_settings()
        
        return {"message": f"Settings for {repo_path} deleted successfully"}
    
    raise HTTPException(status_code=404, detail="No custom settings found for this repository")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug
    ) 