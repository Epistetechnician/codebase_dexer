from typing import Dict, List, Optional
from enum import Enum
from pydantic import BaseModel, Field

class NodeType(str, Enum):
    MODULE = "module"
    CLASS = "class"
    FUNCTION = "function"
    METHOD = "method"
    VARIABLE = "variable"
    IMPORT = "import"

class RelationType(str, Enum):
    CONTAINS = "CONTAINS"
    CALLS = "CALLS"
    INHERITS = "INHERITS"
    IMPORTS = "IMPORTS"
    USES = "USES"

class Position(BaseModel):
    start_line: int
    end_line: int
    start_col: Optional[int] = None
    end_col: Optional[int] = None

class CodeNode(BaseModel):
    id: Optional[str] = None  # Neo4j ID once created
    name: str
    type: NodeType
    file_path: str
    position: Position
    properties: Dict[str, any] = Field(default_factory=dict)
    
class CodeRelation(BaseModel):
    source_id: str
    target_id: str
    type: RelationType
    properties: Dict[str, any] = Field(default_factory=dict)

class ASTNode(BaseModel):
    """Represents a node in the Abstract Syntax Tree"""
    type: NodeType
    name: str
    position: Position
    children: List['ASTNode'] = Field(default_factory=list)
    properties: Dict[str, any] = Field(default_factory=dict)

# This is needed for the recursive type hint in ASTNode
ASTNode.model_rebuild() 