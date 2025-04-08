from fastapi import FastAPI, Body
from fastapi.middleware.cors import CORSMiddleware
from app.api import indexing, file_tree, file_content, code_structure, code_graph, repositories, snapshots
from .services.indexer import start_indexing
import asyncio

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],  # Frontend dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(indexing.router, prefix="/api")
app.include_router(file_tree.router, prefix="/api")
app.include_router(file_content.router, prefix="/api")
app.include_router(code_structure.router, prefix="/api")
app.include_router(code_graph.router, prefix="/api")
app.include_router(repositories.router, prefix="/api")
app.include_router(snapshots.router, prefix="/api")

@app.post("/api/index-repository")
async def index_repository(
    repository_path: str = Body(..., embed=True),
    clear_existing: bool = Body(True, embed=True)
):
    """Start indexing a repository."""
    # Start indexing in the background
    asyncio.create_task(start_indexing(repository_path, clear_existing))
    return {"message": "Indexing started", "repo_path": repository_path}

@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": "Code Indexer API"} 