#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=========================================================${NC}"
echo -e "${GREEN}    MCP Code Indexer - Setup and Test Script            ${NC}"
echo -e "${GREEN}=========================================================${NC}"

# Check for required tools
echo -e "\n${YELLOW}Checking for required tools...${NC}"

if ! command -v python3 &> /dev/null; then
    echo -e "${RED}Python 3 not found. Please install Python 3.8 or higher.${NC}"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js not found. Please install Node.js 14 or higher.${NC}"
    exit 1
fi

if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}Docker not found. You'll need to set up Neo4j manually.${NC}"
    HAS_DOCKER=false
else
    HAS_DOCKER=true
fi

# Navigate to the project directory
cd "$(dirname "$0")"
PROJECT_ROOT=$(pwd)

echo -e "\n${YELLOW}Setting up the MCP Code Indexer...${NC}"

# Create Python virtual environment and install dependencies
echo -e "\n${YELLOW}Setting up Python environment...${NC}"
cd "${PROJECT_ROOT}/mvp"

if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo -e "${GREEN}Created virtual environment${NC}"
fi

source venv/bin/activate
pip install -e .
echo -e "${GREEN}Installed Python dependencies${NC}"

# Start Neo4j using Docker if available
if [ "$HAS_DOCKER" = true ]; then
    echo -e "\n${YELLOW}Starting Neo4j database with Docker...${NC}"
    if ! docker ps -a | grep -q "neo4j"; then
        docker run -d \
            --name neo4j \
            -p7474:7474 -p7687:7687 \
            -e NEO4J_AUTH=neo4j/password \
            neo4j:latest
        echo -e "${GREEN}Started Neo4j container${NC}"
    else
        if ! docker ps | grep -q "neo4j"; then
            docker start neo4j
            echo -e "${GREEN}Started existing Neo4j container${NC}"
        else
            echo -e "${GREEN}Neo4j container is already running${NC}"
        fi
    fi
else
    echo -e "\n${YELLOW}Please make sure your Neo4j database is running on localhost:7687${NC}"
    echo -e "${YELLOW}with username 'neo4j' and password 'password'${NC}"
    read -p "Press Enter to continue once Neo4j is ready..."
fi

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo -e "\n${YELLOW}Creating .env file...${NC}"
    cat > .env << EOL
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password
HOST=0.0.0.0
PORT=8000
DEBUG=true
MAX_FILE_SIZE_MB=10
EOL
    echo -e "${GREEN}Created .env file${NC}"
fi

# Set up frontend
echo -e "\n${YELLOW}Setting up the frontend...${NC}"
cd "${PROJECT_ROOT}/mvp/frontend"
npm install
echo -e "${GREEN}Installed frontend dependencies${NC}"

# Run backend tests
echo -e "\n${YELLOW}Running backend tests...${NC}"
cd "${PROJECT_ROOT}/mvp"
python -m pytest || echo -e "${RED}Some tests failed, but continuing...${NC}"

# Start the application
echo -e "\n${YELLOW}Starting the application...${NC}"
echo -e "${YELLOW}1. Starting the backend server...${NC}"
cd "${PROJECT_ROOT}/mvp"
uvicorn app.main:app --reload &
BACKEND_PID=$!
echo -e "${GREEN}Backend server started with PID ${BACKEND_PID}${NC}"

echo -e "${YELLOW}2. Starting the frontend development server...${NC}"
cd "${PROJECT_ROOT}/mvp/frontend"
npm start &
FRONTEND_PID=$!
echo -e "${GREEN}Frontend server started with PID ${FRONTEND_PID}${NC}"

echo -e "\n${GREEN}=========================================================${NC}"
echo -e "${GREEN}    MCP Code Indexer is now running!                     ${NC}"
echo -e "${GREEN}    Backend: http://localhost:8000                       ${NC}"
echo -e "${GREEN}    Frontend: http://localhost:3000                      ${NC}"
echo -e "${GREEN}    Neo4j Browser: http://localhost:7474                 ${NC}"
echo -e "${GREEN}=========================================================${NC}"
echo -e "\n${YELLOW}Press Ctrl+C to stop all servers${NC}"

# Function to clean up on exit
cleanup() {
    echo -e "\n${YELLOW}Stopping servers...${NC}"
    kill $BACKEND_PID $FRONTEND_PID
    echo -e "${GREEN}Servers stopped${NC}"
    exit 0
}

# Set up trap for clean exit
trap cleanup SIGINT

# Wait for user to press Ctrl+C
wait 