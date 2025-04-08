# MCP Code Indexer Setup Guide

This guide will help you set up and run the MCP Code Indexer with Neo4j graph database integration.

## Prerequisites

- Python 3.8+
- Node.js 14+
- Docker and Docker Compose (for Neo4j)
- Git

## Quick Start

We provide a convenient script that automatically sets up the entire development environment:

```bash
# Clone the repository
git clone <repository-url>
cd mcp-code-indexer/mvp

# Make the script executable
chmod +x start_dev.sh

# Run the setup script
./start_dev.sh
```

This script will:
1. Start Neo4j in Docker
2. Set up the Python virtual environment
3. Install backend dependencies
4. Start the backend server
5. Install frontend dependencies
6. Start the frontend server

Once complete, you can access:
- The frontend at http://localhost:5173
- The API at http://localhost:8000
- The Neo4j browser at http://localhost:7474 (default credentials: neo4j/password)

## Manual Setup

If you prefer to set up each component manually, follow these steps:

### 1. Set up the Neo4j Database

```bash
# Start Neo4j using Docker Compose
docker-compose up -d neo4j
```

### 2. Set up the Backend

```bash
# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -e .

# Start the backend server
cd backend
uvicorn app.main:app --reload --host 0.0.0.0
```

### 3. Set up the Frontend

```bash
# Install dependencies
cd frontend
npm install

# Start the development server
npm run dev
```

## Configuration

The application is configured using environment variables in the `.env` file:

```
# Neo4j Connection Settings
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password

# API Settings
HOST=0.0.0.0
PORT=8000
DEBUG=true

# Indexing Settings
MAX_FILE_SIZE_MB=10
EXCLUDE_DIRS=node_modules,.git,__pycache__,venv,dist,build
```

Modify these settings as needed for your environment.

## Using the Code Indexer

1. Open the application in your browser at http://localhost:5173
2. Enter the path to a repository you want to analyze
3. Click "Start Indexing" and wait for the indexing to complete
4. Explore the codebase through:
   - File Tree View
   - Code Structure View
   - Graph Visualization
   - Documentation

## Troubleshooting

- If you encounter connection issues with Neo4j, check that the Docker container is running:
  ```bash
  docker ps | grep neo4j
  ```

- If the backend fails to start, check that the environment variables in `.env` are correct

- If the graph visualization doesn't load, ensure that the Neo4j connection is working:
  ```bash
  curl http://localhost:8000/api/code-graph?repo_path=/path/to/repo
  ```

## Next Steps

- Explore the Neo4j browser at http://localhost:7474 to run custom Cypher queries
- Add support for additional languages by extending the parsers
- Contribute to the project by opening a pull request 