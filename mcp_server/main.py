from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any

from .mcp_handler import handle_mcp_request

app = FastAPI(
    title="MCP Codebase Indexer Server",
    description="An MCP server to index and query local codebases.",
    version="0.1.0"
)

# CORS Configuration
origins = [
    "http://localhost:3000", # Default Next.js port
    "http://localhost",      # Allow general localhost
    # Add any other origins if needed
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], # Allow all methods (POST for MCP)
    allow_headers=["*"] # Allow all headers
)

@app.post("/")
async def mcp_endpoint(request: Request):
    """Main endpoint for handling all MCP requests."""
    if request.headers.get("content-type") != "application/json":
        raise HTTPException(status_code=415, detail="Unsupported Media Type. Expecting application/json")

    try:
        body = await request.json()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON body: {e}")

    if not isinstance(body, dict) or body.get("jsonrpc") != "2.0":
         raise HTTPException(status_code=400, detail="Invalid JSON-RPC request format.")

    response_data = handle_mcp_request(body)
    return JSONResponse(content=response_data)

@app.get("/health")
async def health_check():
    """Simple health check endpoint."""
    return {"status": "ok"}

# Example usage (for local testing):
# Run with: uvicorn mcp_server.main:app --reload --port 8000 