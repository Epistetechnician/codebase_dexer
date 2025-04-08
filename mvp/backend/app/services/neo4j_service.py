import os
from typing import Dict, List, Any, Optional
from neo4j import GraphDatabase
from dotenv import load_dotenv
import logging
import subprocess
import time

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Neo4j connection settings (default values provided)
NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "your_password")
DOCKER_COMPOSE_PATH = os.getenv("DOCKER_COMPOSE_PATH", "/Users/shaanp/Documents/GitHub/apinpc/mcp_code_indexer/mcp_server/neo4j-mcp/docker-compose.yml")
USE_DOCKER = os.getenv("USE_DOCKER", "true").lower() == "true"

class Neo4jService:
    """Service for interacting with Neo4j graph database."""
    
    def __init__(self, auto_start_docker=USE_DOCKER):
        """Initialize the Neo4j service with connection settings."""
        self.connected = False
        self.auto_start_docker = auto_start_docker
        
        if self.auto_start_docker:
            self._ensure_docker_running()
        
        try:
            self.driver = GraphDatabase.driver(
                NEO4J_URI, 
                auth=(NEO4J_USER, NEO4J_PASSWORD)
            )
            # Test the connection
            with self.driver.session() as session:
                session.run("RETURN 1")
            self.connected = True
            logger.info("Successfully connected to Neo4j")
        except Exception as e:
            logger.error(f"Failed to connect to Neo4j: {e}")
            self.driver = None

    def _ensure_docker_running(self):
        """Ensure that the Neo4j Docker container is running."""
        if not os.path.exists(DOCKER_COMPOSE_PATH):
            logger.warning(f"Docker compose file not found at: {DOCKER_COMPOSE_PATH}")
            return
            
        try:
            # Check if container is already running
            result = subprocess.run(
                ["docker", "ps", "--filter", "name=neo4j", "--format", "{{.Names}}"],
                capture_output=True,
                text=True
            )
            
            if "neo4j" not in result.stdout:
                logger.info("Starting Neo4j Docker container...")
                
                # Start the Docker container
                subprocess.run(
                    ["docker-compose", "-f", DOCKER_COMPOSE_PATH, "up", "-d"],
                    check=True
                )
                
                # Wait for Neo4j to start
                max_attempts = 30
                for attempt in range(max_attempts):
                    try:
                        logger.info(f"Waiting for Neo4j to start... attempt {attempt+1}/{max_attempts}")
                        time.sleep(2)
                        temp_driver = GraphDatabase.driver(
                            NEO4J_URI, 
                            auth=(NEO4J_USER, NEO4J_PASSWORD)
                        )
                        with temp_driver.session() as session:
                            session.run("RETURN 1")
                        temp_driver.close()
                        logger.info("Neo4j Docker container is now running")
                        return
                    except Exception as e:
                        if attempt == max_attempts - 1:
                            logger.error(f"Failed to connect to Neo4j after {max_attempts} attempts: {e}")
            else:
                logger.info("Neo4j Docker container is already running")
        except Exception as e:
            logger.error(f"Error managing Docker container: {e}")
    
    def close(self):
        """Close the Neo4j connection."""
        if self.driver:
            self.driver.close()
    
    def clear_database(self):
        """Clear all nodes and relationships in the database."""
        if not self.connected:
            logger.warning("Cannot clear database: Not connected to Neo4j")
            return
        
        try:
            with self.driver.session() as session:
                session.run("MATCH (n) DETACH DELETE n")
        except Exception as e:
            logger.error(f"Error clearing database: {e}")

    def reconnect(self):
        """Reconnect to the Neo4j database."""
        try:
            if self.driver:
                self.driver.close()
                
            if self.auto_start_docker:
                self._ensure_docker_running()
                
            self.driver = GraphDatabase.driver(
                NEO4J_URI, 
                auth=(NEO4J_USER, NEO4J_PASSWORD)
            )
            # Test the connection
            with self.driver.session() as session:
                session.run("RETURN 1")
            self.connected = True
            logger.info("Successfully reconnected to Neo4j")
            return True
        except Exception as e:
            logger.error(f"Failed to reconnect to Neo4j: {e}")
            self.driver = None
            self.connected = False
            return False
    
    def create_or_update_file_node(self, repo_path: str, file_path: str, file_type: str = "python") -> Optional[str]:
        """Create or update a file node in the graph.
        
        Args:
            repo_path: Path to the repository
            file_path: Path to the file (relative to repo)
            file_type: Type of the file (python, javascript, etc.)
            
        Returns:
            The ID of the created/updated node or None if operation failed
        """
        if not self.connected:
            logger.warning("Cannot create file node: Not connected to Neo4j")
            if self.reconnect():
                logger.info("Reconnected to Neo4j, retrying operation")
            else:
                return None
            
        try:
            with self.driver.session() as session:
                result = session.run(
                    """
                    MERGE (f:File {path: $path, repo: $repo})
                    SET f.type = $type,
                        f.name = $name,
                        f.last_updated = timestamp()
                    RETURN elementId(f) as node_id
                    """,
                    path=file_path,
                    repo=repo_path,
                    type=file_type,
                    name=os.path.basename(file_path)
                )
                record = result.single()
                return record["node_id"] if record else None
        except Exception as e:
            logger.error(f"Error creating file node: {e}")
            return None
    
    def create_module_structure(self, file_id: str, classes: List[Dict], functions: List[Dict], imports: List[Dict]):
        """Create class, function, and import nodes and connect them to the file.
        
        Args:
            file_id: ID of the file node
            classes: List of class info dictionaries
            functions: List of function info dictionaries
            imports: List of import info dictionaries
        """
        if not self.connected or not file_id:
            logger.warning("Cannot create module structure: Not connected to Neo4j or invalid file_id")
            if not file_id:
                return
            if self.reconnect():
                logger.info("Reconnected to Neo4j, retrying operation")
            else:
                return
        
        try:
            with self.driver.session() as session:
                # Create class nodes
                for cls in classes:
                    session.run(
                        """
                        MATCH (f:File)
                        WHERE elementId(f) = $file_id
                        MERGE (c:Class {name: $name, file_id: $file_id})
                        SET c.line_start = $start,
                            c.line_end = $end
                        MERGE (f)-[:CONTAINS]->(c)
                        """,
                        file_id=file_id,
                        name=cls["name"],
                        start=cls["lineno"],
                        end=cls["end_lineno"]
                    )
                
                # Create function nodes
                for func in functions:
                    session.run(
                        """
                        MATCH (f:File)
                        WHERE elementId(f) = $file_id
                        MERGE (fn:Function {name: $name, file_id: $file_id})
                        SET fn.line_start = $start,
                            fn.line_end = $end
                        MERGE (f)-[:CONTAINS]->(fn)
                        """,
                        file_id=file_id,
                        name=func["name"],
                        start=func["lineno"],
                        end=func["end_lineno"]
                    )
                
                # Create import nodes
                for imp in imports:
                    session.run(
                        """
                        MATCH (f:File)
                        WHERE elementId(f) = $file_id
                        MERGE (i:Import {name: $name, file_id: $file_id})
                        SET i.line = $line
                        MERGE (f)-[:IMPORTS]->(i)
                        """,
                        file_id=file_id,
                        name=imp["name"],
                        line=imp["lineno"]
                    )
        except Exception as e:
            logger.error(f"Error creating module structure: {e}")
    
    def get_code_graph(self, repo_path: str, depth: int = 2) -> Dict[str, Any]:
        """Get the code graph for visualization.
        
        Args:
            repo_path: Path to the repository
            depth: Depth of relationships to include
            
        Returns:
            Dictionary with nodes and relationships for visualization
        """
        if not self.connected:
            logger.warning("Cannot get code graph: Not connected to Neo4j")
            if self.reconnect():
                logger.info("Reconnected to Neo4j, retrying operation")
            else:
                return {"nodes": [], "links": []}
        
        try:
            with self.driver.session() as session:
                # Get file IDs for the repository
                file_ids_result = session.run(
                    """
                    MATCH (f:File)
                    WHERE f.repo = $repo
                    RETURN elementId(f) as id
                    """,
                    repo=repo_path
                )
                
                file_ids = [record["id"] for record in file_ids_result]
                
                if not file_ids:
                    logger.warning(f"No files found for repository: {repo_path}")
                    return {"nodes": [], "links": []}
                
                # Get all nodes
                node_result = session.run(
                    """
                    MATCH (n)
                    WHERE n.repo = $repo OR n.file_id IN $file_ids
                    RETURN elementId(n) as id, labels(n) as labels, properties(n) as props
                    """,
                    repo=repo_path,
                    file_ids=file_ids
                )
                
                # Get all relationships
                rel_result = session.run(
                    """
                    MATCH (n)-[r]->(m)
                    WHERE n.repo = $repo OR m.repo = $repo OR
                          n.file_id IN $file_ids OR m.file_id IN $file_ids
                    RETURN elementId(n) as source, elementId(m) as target, type(r) as type
                    """,
                    repo=repo_path,
                    file_ids=file_ids
                )
                
                # Process nodes
                nodes = []
                for record in node_result:
                    node_type = record["labels"][0] if record["labels"] else "Unknown"
                    nodes.append({
                        "id": str(record["id"]),
                        "label": record["props"].get("name", ""),
                        "type": node_type,
                        "properties": record["props"]
                    })
                
                # Process relationships
                links = []
                for record in rel_result:
                    links.append({
                        "source": str(record["source"]),
                        "target": str(record["target"]),
                        "type": record["type"]
                    })
                
                return {
                    "nodes": nodes,
                    "links": links
                }
        except Exception as e:
            logger.error(f"Error getting code graph: {e}")
            return {"nodes": [], "links": []}
    
    def execute_query(self, query: str, params: Dict = None) -> Dict[str, Any]:
        """Execute a custom Cypher query against the Neo4j database.
        
        Args:
            query: Cypher query to execute
            params: Query parameters
            
        Returns:
            Dictionary with query results
        """
        if not self.connected:
            logger.warning("Cannot execute query: Not connected to Neo4j")
            if self.reconnect():
                logger.info("Reconnected to Neo4j, retrying operation")
            else:
                return {"error": "Not connected to Neo4j"}
                
        try:
            with self.driver.session() as session:
                result = session.run(query, params or {})
                records = [dict(record) for record in result]
                summary = {
                    "counters": dict(result.consume().counters),
                    "query_time": result.consume().result_available_after
                }
                return {"records": records, "summary": summary}
        except Exception as e:
            logger.error(f"Error executing query: {e}")
            return {"error": str(e)}

# Singleton instance
try:
    neo4j_service = Neo4jService()
except Exception as e:
    logger.error(f"Failed to create Neo4j service: {e}")
    # Create a non-functional service as a fallback
    neo4j_service = Neo4jService(auto_start_docker=False) 