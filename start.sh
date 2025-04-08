#!/bin/bash

# Script to start the entire MCP Code Indexer system
# This includes:
# 1. Neo4j Docker container
# 2. Neo4j MCP server
# 3. Backend API
# 4. Frontend app

# Set the base directory to the location of this script
BASE_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
NEO4J_MCP_DIR="$BASE_DIR/mcp_server/neo4j-mcp"
BACKEND_DIR="$BASE_DIR/mvp/backend"
FRONTEND_DIR="$BASE_DIR/mvp/frontend"

# Create logs directory
mkdir -p "$BASE_DIR/logs"

# Function to check if a command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Check for required tools
if ! command_exists docker; then
  echo "Error: Docker is not installed or not in PATH"
  echo "Please install Docker: https://docs.docker.com/get-docker/"
  exit 1
fi

if ! command_exists docker-compose; then
  echo "Error: docker-compose is not installed or not in PATH"
  echo "Please install docker-compose: https://docs.docker.com/compose/install/"
  exit 1
fi

# Start Neo4j Docker container
echo "Starting Neo4j Docker container..."
cd "$NEO4J_MCP_DIR"
docker-compose up -d

# Wait for Neo4j to be ready
echo "Waiting for Neo4j to be ready..."
ATTEMPTS=0
MAX_ATTEMPTS=30
NEO4J_READY=false

while [ $ATTEMPTS -lt $MAX_ATTEMPTS ]; do
  if curl -s http://localhost:7474 > /dev/null; then
    NEO4J_READY=true
    break
  fi
  ATTEMPTS=$((ATTEMPTS+1))
  echo "Waiting for Neo4j... Attempt $ATTEMPTS of $MAX_ATTEMPTS"
  sleep 2
done

if [ "$NEO4J_READY" = false ]; then
  echo "Error: Neo4j did not start properly within the timeout period"
  echo "Check the Docker logs: docker logs neo4j"
  exit 1
fi

echo "Neo4j is ready!"

# Start MCP Neo4j server
echo "Starting Neo4j MCP server..."
cd "$NEO4J_MCP_DIR"
if command_exists bun; then
  # Run in background, directing output to log file
  nohup bun run index.ts > "$BASE_DIR/logs/neo4j-mcp.log" 2>&1 &
  NEO4J_MCP_PID=$!
  echo "Neo4j MCP server started with PID $NEO4J_MCP_PID"
else
  echo "Warning: Bun is not installed. Neo4j MCP server will not be started."
  echo "To install Bun: curl -fsSL https://bun.sh/install | bash"
fi

# Start backend server
echo "Starting backend server..."
cd "$BACKEND_DIR"
source venv/bin/activate 2>/dev/null || echo "No virtual environment found, continuing with system Python"
nohup uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 > "$BASE_DIR/logs/backend.log" 2>&1 &
BACKEND_PID=$!
echo "Backend server started with PID $BACKEND_PID"

# Start frontend server
echo "Starting frontend server..."
cd "$FRONTEND_DIR"
nohup npm run dev > "$BASE_DIR/logs/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo "Frontend server started with PID $FRONTEND_PID"

echo ""
echo "System is starting up! Services:"
echo "  - Neo4j: http://localhost:7474 (credentials: neo4j/your_password)"
echo "  - Neo4j MCP server: Running in the background"
echo "  - Backend API: http://localhost:8000"
echo "  - Frontend: http://localhost:5173"
echo ""
echo "Log files can be found in $BASE_DIR/logs/"
echo ""
echo "To stop all services:"
echo "  - Press Ctrl+C to stop this script"
echo "  - Then run: docker-compose -f $NEO4J_MCP_DIR/docker-compose.yml down"
echo "  - Kill the background processes: kill $NEO4J_MCP_PID $BACKEND_PID $FRONTEND_PID"

# Keep the script running to maintain the foreground processes
# This allows the user to press Ctrl+C to begin the shutdown process
echo "Press Ctrl+C to begin shutdown process"
wait 