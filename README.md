# MCP Code Indexer

<div align="center">
  <img src="https://img.shields.io/badge/status-beta-yellow" alt="Status: Beta">
  <img src="https://img.shields.io/badge/languages-Python%20|%20JavaScript%20|%20TypeScript-blue" alt="Languages">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License">
</div>

## 📖 Overview

MCP Code Indexer is a powerful tool designed to enhance how language models understand and interact with codebases. By generating an abstract syntax tree (AST) of a codebase and storing it in a Neo4j graph database, the tool creates a simplified representation of classes, methods, functions, and their interrelationships. This allows for more efficient code analysis, targeted refactoring, and better context management when working with large codebases.

### ✨ Key Features

- **Intelligent Code Indexing**: Parses and indexes Python, JavaScript, and TypeScript codebases with AST generation
- **Graph Database Storage**: Stores code structure in Neo4j for efficient querying and traversal
- **Visual Code Explorer**: Interactive visualization of code structure using D3.js and React
- **Advanced Filtering**: Search and filter code elements by name, type, and relationships
- **Incremental Updates**: Smart detection of file changes for efficient re-indexing
- **Documentation Management**: Add and track documentation for individual files to maintain context
- **Change Tracking**: Monitor file changes over time to understand code evolution

## 🚀 Getting Started

We've provided a streamlined setup process to get you started quickly. See our [Setup Guide](mvp/SETUP.md) for detailed instructions.

### Quick Start

```bash
# Make the script executable
chmod +x start.sh

# Run the setup script
./start.sh
```

This script automatically sets up Neo4j, the backend API, and the frontend application.

## 🔧 System Architecture

The MCP Code Indexer consists of several integrated components:

1. **Backend (FastAPI)**: 
   - Handles code parsing and indexing
   - Manages file history and documentation
   - Provides APIs for code exploration
   - Interfaces with Neo4j database

2. **Frontend (React)**:
   - Interactive file tree explorer
   - Code structure visualization
   - Graph-based code relationship visualization
   - Documentation management interface
   - Change history tracking

3. **Neo4j Database**:
   - Stores code structure as a graph
   - Enables relationship queries
   - Provides persistent storage for code analysis

4. **Docker**:
   - Containerized Neo4j for simple deployment
   - Ensures consistent environment

## 📷 Screenshots

![Code Graph Visualization](mvp/frontend/public/code-graph-example.png)

## 🔨 Development

See our [Contributing Guide](CONTRIBUTING.md) for information on how to contribute to the project.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🔒 Security

We take security seriously. A comprehensive security audit has been conducted on the codebase, and the findings are available in the [security-report.md](security-report.md) file. This report includes:

- Identified vulnerabilities with severity ratings
- Detailed remediation steps
- Security best practices for deployment
- A security posture improvement plan

If you discover any security issues, please report them responsibly by contacting the maintainers directly rather than opening a public issue.

## 📊 System Architecture

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│                 │         │                 │         │                 │
│  Code Repository│         │  FastAPI Backend│         │  React Frontend │
│                 │◄───────►│                 │◄───────►│                 │
└─────────────────┘         └────────┬────────┘         └─────────────────┘
                                     │
                                     ▼
                            ┌─────────────────┐
                            │                 │
                            │  Neo4j Database │
                            │                 │
                            └─────────────────┘
```

### Components

1. **Language-Specific Parsers**: Python, JavaScript, and TypeScript parsers generate AST representations.
2. **Neo4j Database**: Stores code structure as a graph for efficient querying.
3. **FastAPI Backend**: Handles repository indexing and graph queries.
4. **React Frontend**: Provides an interactive visualization of the code structure.

## 🔍 API Endpoints

The backend exposes the following REST API endpoints:

- `GET /health`: Check if the service is healthy
- `POST /index`: Index a repository
  - Parameters:
    - `repository_path`: Path to the repository
    - `clear_existing`: Whether to clear existing data (default: true)
    - `incremental`: Whether to use incremental indexing (default: true)
- `GET /graph/{node_id}`: Get a subgraph starting from the specified node
  - Parameters:
    - `depth`: Maximum depth of the subgraph (default: 2)
- `GET /node/{node_id}`: Get details about a specific node
- `GET /node/{node_id}/relationships`: Get all relationships for a specific node

## 📝 Usage Examples

### Indexing a Repository

```python
import requests

response = requests.post(
    "http://localhost:8000/index",
    json={
        "repository_path": "/path/to/your/repo",
        "clear_existing": True,
        "incremental": True
    }
)

print(response.json())
```

### Getting a Subgraph

```python
import requests

response = requests.get(
    f"http://localhost:8000/graph/{node_id}",
    params={"depth": 3}
)

print(response.json())
```

## 🛠️ Adding Support for New Languages

To add support for a new programming language:

1. Create a new parser class in `app/indexer/` that implements the parser interface
2. Register the file extensions in the `CodeIndexer` class
3. Update the required dependencies in `pyproject.toml`

Example for adding Ruby support:

```python
# app/indexer/ruby_parser.py
from typing import Optional
from pathlib import Path
from ..database.models import ASTNode, NodeType, Position

class RubyParser:
    @staticmethod
    def parse_file(file_path: Path) -> Optional[ASTNode]:
        # Implementation here
        ...
```

Then register it in `indexer.py`:

```python
def __init__(self):
    self.parsers = {
        ".py": PythonParser,
        ".js": JavaScriptParser,
        ".ts": JavaScriptParser,
        ".jsx": JavaScriptParser,
        ".tsx": JavaScriptParser,
        ".rb": RubyParser,  # Add Ruby parser
    }
```

## 🤝 Contributing

We welcome contributions to the MCP Code Indexer! Here's how you can help:

1. Fork the repository
2. Create a new branch (`git checkout -b feature/your-feature`)
3. Make your changes
4. Run tests to ensure everything works
5. Commit your changes (`git commit -m 'Add some feature'`)
6. Push to the branch (`git push origin feature/your-feature`)
7. Open a Pull Request

## 🙏 Acknowledgements

- [Neo4j](https://neo4j.com/) for the graph database
- [FastAPI](https://fastapi.tiangolo.com/) for the backend framework
- [React](https://reactjs.org/) for the frontend framework
- [D3.js](https://d3js.org/) for the visualization library
- [Esprima](https://esprima.org/) for JavaScript/TypeScript parsing
