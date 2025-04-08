from setuptools import setup, find_packages

setup(
    name="mcp_code_indexer",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        "fastapi>=0.104.1",
        "uvicorn>=0.24.0",
        "python-dotenv>=1.0.0",
        "neo4j>=5.14.0",
        "aiofiles>=23.2.1",
        "pydantic>=2.4.2",
        "python-multipart>=0.0.6",
    ],
    extras_require={
        "dev": [
            "pytest>=7.4.3",
            "black>=23.10.1",
            "isort>=5.12.0",
        ],
    },
    entry_points={
        "console_scripts": [
            "mcp-code-indexer=app.main:start",
        ],
    },
    python_requires=">=3.8",
    description="Code indexing and exploration tool with Neo4j integration",
    author="MCP Team",
    author_email="info@example.com",
    url="https://github.com/apinpc/mcp_code_indexer",
) 