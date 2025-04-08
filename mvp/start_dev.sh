#!/bin/bash
set -e

# Color output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting MCP Code Indexer development environment...${NC}"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo -e "${RED}Error: Docker is not running. Please start Docker and try again.${NC}"
  exit 1
fi

# Start Neo4j container with docker-compose
echo -e "${YELLOW}Starting Neo4j database...${NC}"
docker-compose up -d neo4j

# Wait for Neo4j to start
echo -e "${YELLOW}Waiting for Neo4j to start...${NC}"
sleep 5

# Check if virtual environment exists, if not create it
if [ ! -d "venv" ]; then
  echo -e "${YELLOW}Creating virtual environment...${NC}"
  python3 -m venv venv
fi

# Activate virtual environment and install dependencies
echo -e "${YELLOW}Installing backend dependencies...${NC}"
source venv/bin/activate
pip install -e .

# Start backend server in background
echo -e "${YELLOW}Starting backend server...${NC}"
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 &
BACKEND_PID=$!

cd ../frontend

# Check if node_modules exists, if not install dependencies
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}Installing frontend dependencies...${NC}"
  npm install
fi

# Start frontend server
echo -e "${YELLOW}Starting frontend server...${NC}"
npm run dev &
FRONTEND_PID=$!

echo -e "${GREEN}Development environment started successfully!${NC}"
echo -e "${GREEN}Backend running at: http://localhost:8000${NC}"
echo -e "${GREEN}Frontend running at: http://localhost:5173${NC}"
echo -e "${GREEN}Neo4j Browser available at: http://localhost:7474${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"

# Function to kill processes on exit
cleanup() {
  echo -e "${YELLOW}Stopping services...${NC}"
  kill $BACKEND_PID 2>/dev/null || true
  kill $FRONTEND_PID 2>/dev/null || true
  docker-compose down
  echo -e "${GREEN}All services stopped${NC}"
}

# Register the cleanup function to be called on exit
trap cleanup EXIT

# Wait for user input
wait 