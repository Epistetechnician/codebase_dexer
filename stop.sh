#!/bin/bash

# Script to stop all MCP Code Indexer services
# This includes:
# 1. Neo4j Docker container
# 2. Neo4j MCP server
# 3. Backend API
# 4. Frontend app

# Set the base directory to the location of this script
BASE_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
NEO4J_MCP_DIR="$BASE_DIR/mcp_server/neo4j-mcp"
LOGS_DIR="$BASE_DIR/logs"

echo "Stopping all MCP Code Indexer services..."

# Stop Neo4j MCP server, backend, and frontend processes
echo "Stopping application processes..."
pkill -f "bun run index.ts" || echo "No Neo4j MCP server process found"
pkill -f "uvicorn app.main:app" || echo "No backend server process found"
pkill -f "npm run dev" || echo "No frontend server process found"

# Stop Neo4j Docker container
echo "Stopping Neo4j Docker container..."
cd "$NEO4J_MCP_DIR"
docker-compose down || echo "Failed to stop Neo4j Docker container. You may need to stop it manually."

echo ""
echo "All services have been stopped!"
echo ""
echo "If you want to clean up any orphaned processes, you can run:"
echo "  pkill -f 'uvicorn|npm run dev|bun run'"
echo ""
echo "Logs can still be found in $LOGS_DIR/" 