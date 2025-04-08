from fastapi import APIRouter, Query, Body, HTTPException
from typing import Dict, Any, Optional
from ..services.neo4j_service import neo4j_service, NEO4J_URI

router = APIRouter()

@router.get("/code-graph")
async def get_code_graph(repo_path: str = Query(..., description="Path to the repository")):
    """Get the code graph for the specified repository."""
    if not neo4j_service.connected:
        if not neo4j_service.reconnect():
            raise HTTPException(status_code=503, detail="Neo4j database is not connected")
    
    graph_data = neo4j_service.get_code_graph(repo_path)
    
    return graph_data

@router.post("/neo4j-query")
async def execute_neo4j_query(
    query: str = Body(..., embed=True, description="Cypher query to execute"),
    params: Optional[Dict[str, Any]] = Body({}, embed=True, description="Query parameters")
):
    """Execute a custom Cypher query against the Neo4j database."""
    if not neo4j_service.connected:
        if not neo4j_service.reconnect():
            raise HTTPException(status_code=503, detail="Neo4j database is not connected")
    
    result = neo4j_service.execute_query(query, params)
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result

@router.get("/neo4j-status")
async def get_neo4j_status():
    """Get the current status of the Neo4j connection."""
    status = {
        "connected": neo4j_service.connected,
        "uri": NEO4J_URI,
        "auto_start_docker": neo4j_service.auto_start_docker
    }
    
    return status 