from typing import Optional, Dict, List
import esprima
from pathlib import Path

from ..database.models import ASTNode, NodeType, Position

class JavaScriptParser:
    """Parser for JavaScript/TypeScript source code that generates an AST representation"""
    
    @staticmethod
    def parse_file(file_path: Path) -> Optional[ASTNode]:
        """Parse a JS/TS file and return its AST representation"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                source = f.read()
            
            tree = esprima.parseModule(source, options={'loc': True, 'range': True})
            return JavaScriptParser._process_node(tree, source, str(file_path))
        except Exception as e:
            print(f"Error parsing {file_path}: {e}")
            return None
    
    @staticmethod
    def _get_node_position(node) -> Position:
        """Extract position information from an Esprima node"""
        if hasattr(node, 'loc'):
            return Position(
                start_line=node.loc.start.line,
                end_line=node.loc.end.line,
                start_col=node.loc.start.column,
                end_col=node.loc.end.column
            )
        return Position(start_line=0, end_line=0)
    
    @staticmethod
    def _process_node(node, source: str, file_path: str) -> Optional[ASTNode]:
        """Process an AST node and its children recursively"""
        if node.type == 'Program':
            return JavaScriptParser._process_program(node, source, file_path)
        elif node.type == 'ClassDeclaration':
            return JavaScriptParser._process_class(node, source, file_path)
        elif node.type == 'FunctionDeclaration':
            return JavaScriptParser._process_function(node, source, file_path)
        elif node.type == 'MethodDefinition':
            return JavaScriptParser._process_method(node, source, file_path)
        elif node.type == 'ImportDeclaration':
            return JavaScriptParser._process_import(node, source, file_path)
        return None
    
    @staticmethod
    def _process_program(node, source: str, file_path: str) -> ASTNode:
        """Process a program (module) node"""
        children = []
        for child in node.body:
            if processed := JavaScriptParser._process_node(child, source, file_path):
                children.append(processed)
        
        return ASTNode(
            type=NodeType.MODULE,
            name=Path(file_path).name,
            position=Position(start_line=1, end_line=len(source.splitlines())),
            children=children,
            properties={"file_path": file_path}
        )
    
    @staticmethod
    def _process_class(node, source: str, file_path: str) -> ASTNode:
        """Process a class declaration node"""
        children = []
        for element in node.body.body:  # class body contains a list of methods
            if processed := JavaScriptParser._process_node(element, source, file_path):
                children.append(processed)
        
        # Get superclass if exists
        superclass = node.superClass.name if node.superClass else None
        
        return ASTNode(
            type=NodeType.CLASS,
            name=node.id.name,
            position=JavaScriptParser._get_node_position(node),
            children=children,
            properties={
                "superclass": superclass,
                "decorators": []  # TODO: Add decorator support for TypeScript
            }
        )
    
    @staticmethod
    def _process_function(node, source: str, file_path: str) -> ASTNode:
        """Process a function declaration node"""
        params = [param.name for param in node.params]
        
        return ASTNode(
            type=NodeType.FUNCTION,
            name=node.id.name,
            position=JavaScriptParser._get_node_position(node),
            properties={
                "params": params,
                "is_async": getattr(node, "async", False),
                "is_generator": getattr(node, "generator", False)
            }
        )
    
    @staticmethod
    def _process_method(node, source: str, file_path: str) -> ASTNode:
        """Process a method definition node"""
        params = [param.name for param in node.value.params]
        
        return ASTNode(
            type=NodeType.METHOD,
            name=node.key.name,
            position=JavaScriptParser._get_node_position(node),
            properties={
                "params": params,
                "kind": node.kind,  # 'get', 'set', or 'method'
                "static": node.static,
                "computed": node.computed,
                "is_async": getattr(node.value, "async", False),
                "is_generator": getattr(node.value, "generator", False)
            }
        )
    
    @staticmethod
    def _process_import(node, source: str, file_path: str) -> ASTNode:
        """Process an import declaration node"""
        specifiers = []
        for spec in node.specifiers:
            if spec.type == 'ImportDefaultSpecifier':
                specifiers.append(f"default as {spec.local.name}")
            elif spec.type == 'ImportNamespaceSpecifier':
                specifiers.append(f"* as {spec.local.name}")
            else:
                imported = spec.imported.name if hasattr(spec.imported, 'name') else spec.imported.value
                specifiers.append(f"{imported} as {spec.local.name}" if spec.local.name != imported else imported)
        
        return ASTNode(
            type=NodeType.IMPORT,
            name=f"from {node.source.value} import {', '.join(specifiers)}",
            position=JavaScriptParser._get_node_position(node),
            properties={
                "source": node.source.value,
                "specifiers": specifiers
            }
        ) 