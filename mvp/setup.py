from setuptools import setup, find_packages

setup(
    name="mcp_code_indexer",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        "fastapi>=0.68.0",
        "uvicorn>=0.15.0",
        "python-dotenv>=0.19.0",
        "neo4j>=4.4.0",
        "pydantic>=1.8.0",
        "astroid>=2.8.0",  # For Python parsing
        "esprima>=4.0.0",  # For JavaScript/TypeScript parsing
        "pytest>=6.2.0",
        "requests>=2.26.0",
    ],
    extras_require={
        "dev": [
            "black",
            "flake8",
            "pytest-cov",
        ]
    },
    python_requires=">=3.8",
    author="Your Organization",
    author_email="your.email@example.com",
    description="A tool for indexing and analyzing code structure using Neo4j",
    long_description=open("README.md").read(),
    long_description_content_type="text/markdown",
    keywords="code-analysis, ast, neo4j, indexer",
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
    ],
) 