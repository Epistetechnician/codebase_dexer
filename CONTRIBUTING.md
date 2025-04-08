# Contributing to MCP Code Indexer

Thank you for your interest in contributing to the MCP Code Indexer! This document provides guidelines and instructions for contributing to the project.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/mcp-code-indexer.git`
3. Set up the development environment by following the instructions in [SETUP.md](mvp/SETUP.md)

## Development Workflow

1. Create a branch for your feature or bugfix: `git checkout -b feature/your-feature-name`
2. Make your changes
3. Run tests to ensure everything works as expected
4. Commit your changes with clear, descriptive commit messages
5. Push your branch to your fork: `git push origin feature/your-feature-name`
6. Open a Pull Request against the main repository

## Code Style

- Follow PEP 8 for Python code
- Use ESLint rules for JavaScript/TypeScript code
- Write meaningful docstrings and comments
- Use type hints in Python and TypeScript

## Adding Support for New Languages

To add support for a new programming language:

1. Create a new parser class in `app/indexer/` that implements the parser interface
2. Update the `get_file_type` function in `app/services/indexer.py`
3. Add any required dependencies to `pyproject.toml`

Example of adding Ruby support:

```python
# app/indexer/ruby_parser.py
from typing import Dict, Any
import subprocess
import json

async def parse_ruby_file(file_path: str) -> Dict[str, Any]:
    """Parse a Ruby file and extract its structure."""
    # Implementation here
    # ...
    return {
        'classes': [...],
        'functions': [...],
        'imports': [...],
        'success': True
    }
```

## Testing

- Write unit tests for all new functionality
- Ensure existing tests pass before submitting a PR
- Run the backend tests with `pytest`
- Run the frontend tests with `npm test`

## Documentation

- Update the documentation to reflect any changes in functionality
- Document any new features, APIs, or configuration options
- Keep the README.md up to date

## Pull Request Process

1. Update the README.md and other documentation with details of changes if appropriate
2. The PR should work on the main development branch
3. Link any relevant issues in your PR description
4. A maintainer will review your PR and may request changes
5. Once approved, a maintainer will merge your PR

## Code of Conduct

Please adhere to the project's code of conduct while participating in the community. Be respectful, inclusive, and constructive in your interactions with other contributors. 