from typing import Dict, List, Optional, Union
from neo4j import GraphDatabase, Driver
from neo4j.exceptions import Neo4jError

from ..config import settings
from .models import CodeNode, CodeRelation, NodeType, RelationType

class Neo4jClient:
    def __init__(self):
        self._driver: Optional[Driver] = None
        
    def connect(self) -> None:
        """Establish connection to Neo4j database"""
        if not self._driver:
            self._driver = GraphDatabase.driver(
                settings.neo4j_uri,
                auth=(settings.neo4j_user, settings.neo4j_password)
            )
            
    def close(self) -> None:
        """Close the database connection"""
        if self._driver:
            self._driver.close()
            self._driver = None
            
    def _get_session(self):
        """Get a new session, connecting if necessary"""
        if not self._driver:
            self.connect()
        return self._driver.session()
    
    def create_node(self, node: CodeNode) -> str:
        """Create a new node in the graph database"""
        query = """
        CREATE (n:`{label}` {props})
        SET n.created = timestamp()
        RETURN id(n) as node_id
        """.format(label=node.type.value)
        
        with self._get_session() as session:
            result = session.run(
                query,
                props={
                    "name": node.name,
                    "file_path": node.file_path,
                    "start_line": node.position.start_line,
                    "end_line": node.position.end_line,
                    "start_col": node.position.start_col,
                    "end_col": node.position.end_col,
                    **node.properties
                }
            )
            record = result.single()
            return str(record["node_id"])
            
    def create_relationship(self, relation: CodeRelation) -> None:
        """Create a new relationship between nodes"""
        query = """
        MATCH (source)
        WHERE id(source) = $source_id
        MATCH (target)
        WHERE id(target) = $target_id
        CREATE (source)-[r:`{rel_type}` {props}]->(target)
        SET r.created = timestamp()
        """.format(rel_type=relation.type.value)
        
        with self._get_session() as session:
            session.run(
                query,
                {
                    "source_id": int(relation.source_id),
                    "target_id": int(relation.target_id),
                    "props": relation.properties
                }
            )
            
    def get_node_by_id(self, node_id: str) -> Optional[Dict]:
        """Retrieve a node by its ID"""
        query = """
        MATCH (n)
        WHERE id(n) = $node_id
        RETURN n
        """
        
        with self._get_session() as session:
            result = session.run(query, {"node_id": int(node_id)})
            record = result.single()
            if record:
                node = record["n"]
                return dict(node.items())
            return None
            
    def get_node_relationships(self, node_id: str) -> List[Dict]:
        """Get all relationships for a node"""
        query = """
        MATCH (n)-[r]-(other)
        WHERE id(n) = $node_id
        RETURN type(r) as type, r as props, id(other) as other_id, labels(other) as other_labels
        """
        
        with self._get_session() as session:
            result = session.run(query, {"node_id": int(node_id)})
            return [
                {
                    "type": record["type"],
                    "properties": dict(record["props"].items()),
                    "other_id": str(record["other_id"]),
                    "other_labels": record["other_labels"]
                }
                for record in result
            ]
            
    def clear_database(self) -> None:
        """Clear all nodes and relationships from the database"""
        query = "MATCH (n) DETACH DELETE n"
        with self._get_session() as session:
            session.run(query)
            
    def get_subgraph(self, root_id: str, depth: int = 2) -> Dict:
        """Get a subgraph starting from a root node up to specified depth"""
        query = """
        MATCH path = (n)-[*..{depth}]-(m)
        WHERE id(n) = $root_id
        RETURN path
        """.format(depth=depth)
        
        nodes = {}
        relationships = []
        
        with self._get_session() as session:
            result = session.run(query, {"root_id": int(root_id)})
            for record in result:
                path = record["path"]
                for node in path.nodes:
                    if node.id not in nodes:
                        nodes[node.id] = {
                            "id": str(node.id),
                            "labels": list(node.labels),
                            "properties": dict(node.items())
                        }
                for rel in path.relationships:
                    relationships.append({
                        "source": str(rel.start_node.id),
                        "target": str(rel.end_node.id),
                        "type": rel.type,
                        "properties": dict(rel.items())
                    })
                    
        return {
            "nodes": list(nodes.values()),
            "relationships": relationships
        }

    def get_or_create_root_node(self, node: CodeNode) -> str:
        """Get existing root node or create a new one"""
        with self._get_session() as session:
            result = session.run(
                """
                MERGE (n:Node {is_root: true, file_path: $file_path})
                ON CREATE SET
                    n.name = $name,
                    n.type = $type,
                    n.start_line = $start_line,
                    n.end_line = $end_line,
                    n.properties = $properties
                RETURN id(n) as node_id
                """,
                name=node.name,
                type=node.type.value,
                file_path=node.file_path,
                start_line=node.position.start_line,
                end_line=node.position.end_line,
                properties=node.properties
            )
            return str(result.single()["node_id"])
    
    def delete_file_nodes(self, file_path: str):
        """Delete all nodes associated with a specific file"""
        with self._get_session() as session:
            session.run(
                """
                MATCH (n:Node {file_path: $file_path})
                DETACH DELETE n
                """,
                file_path=file_path
            )

# Create global database client instance
db_client = Neo4jClient() 