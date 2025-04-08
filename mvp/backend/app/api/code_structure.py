from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
import os
import ast
from pathlib import Path

router = APIRouter()

class CodeVisitor(ast.NodeVisitor):
    def __init__(self):
        self.classes = []
        self.functions = []
        self.imports = []

    def visit_ClassDef(self, node):
        self.classes.append({
            'name': node.name,
            'lineno': node.lineno,
            'end_lineno': node.end_lineno or node.lineno
        })
        self.generic_visit(node)

    def visit_FunctionDef(self, node):
        self.functions.append({
            'name': node.name,
            'lineno': node.lineno,
            'end_lineno': node.end_lineno or node.lineno
        })
        self.generic_visit(node)

    def visit_Import(self, node):
        for name in node.names:
            self.imports.append({
                'name': name.name,
                'lineno': node.lineno
            })

    def visit_ImportFrom(self, node):
        module = node.module or ''
        for name in node.names:
            import_name = f"{module}.{name.name}" if module else name.name
            self.imports.append({
                'name': import_name,
                'lineno': node.lineno
            })

def parse_python_file(file_path: str) -> Dict[str, Any]:
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            tree = ast.parse(f.read(), filename=file_path)
        
        visitor = CodeVisitor()
        visitor.visit(tree)
        
        return {
            'classes': visitor.classes,
            'functions': visitor.functions,
            'imports': visitor.imports
        }
    except Exception as e:
        print(f"Error parsing {file_path}: {str(e)}")
        return {
            'classes': [],
            'functions': [],
            'imports': []
        }

@router.get("/code-structure")
async def get_code_structure(path: str) -> Dict[str, List[Dict[str, Any]]]:
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Repository path not found")

    files = []
    repo_path = Path(path)

    for root, _, filenames in os.walk(repo_path):
        root_path = Path(root)
        if '.git' in root_path.parts or 'node_modules' in root_path.parts:
            continue

        for filename in filenames:
            if filename.endswith('.py'):  # For now, only handle Python files
                file_path = root_path / filename
                relative_path = str(file_path.relative_to(repo_path))
                
                structure = parse_python_file(str(file_path))
                files.append({
                    'path': relative_path,
                    'structure': structure
                })

    return {'files': files} 