from typing import Dict, List, Any

# Placeholder for MCP capability definitions
# See MCP spec: https://docs.google.com/document/d/1JsCmU-qdq3-yfMA11RgQwyNxPJmaKzSCliLh_2I506s/edit

# We will define our tools ('index_directory', 'list_indexed_directories') here
# according to the MCP JSON-RPC format.

CAPABILITIES: Dict[str, Any] = {
    "mcp_version": "0.1.0", # Example version
    "capabilities": {
        "tools": [
            {
                "name": "index_directory",
                "description": "Registers a directory path to be indexed by the server.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": {
                            "type": "string",
                            "description": "The absolute or relative path to the directory to index."
                        }
                    },
                    "required": ["path"]
                },
                "returns": {
                    "type": "object",
                    "properties": {
                        "success": {
                            "type": "boolean",
                            "description": "Whether the directory was successfully registered."
                        },
                        "message": {
                            "type": "string",
                            "description": "A message indicating the result."
                        }
                    }
                }
            },
            {
                "name": "list_indexed_directories",
                "description": "Lists the directory paths currently registered for indexing.",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "required": []
                },
                "returns": {
                    "type": "object",
                    "properties": {
                        "directories": {
                            "type": "array",
                            "items": {
                                "type": "string"
                            },
                            "description": "A list of registered directory paths."
                        }
                    }
                }
            },
            {
                "name": "list_files_in_directory",
                "description": "Lists the relative paths of files found within a previously indexed directory.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": {
                            "type": "string",
                            "description": "The absolute or relative path of the previously indexed directory."
                        }
                    },
                    "required": ["path"]
                },
                "returns": {
                    "type": "object",
                    "properties": {
                        "files": {
                            "type": "array",
                            "items": {
                                "type": "string"
                            },
                            "description": "A list of relative file paths within the specified directory."
                        }
                    }
                }
            },
            {
                "name": "get_file_content",
                "description": "Retrieves the indexed text content of a specific file within an indexed directory.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": {
                            "type": "string",
                            "description": "The path of the indexed directory."
                        },
                        "file": {
                            "type": "string",
                            "description": "The relative path of the file within the directory (e.g., 'src/main.py')."
                        }
                    },
                    "required": ["path", "file"]
                },
                "returns": {
                    "type": "object",
                    "properties": {
                        "content": {
                            "type": ["string", "null"],
                            "description": "The text content of the file, or null if the file was not indexed (skipped, ignored, too large, binary, or not found)."
                        }
                    }
                }
            }
        ],
        "resources": [], # We'll define resources later
        "prompts": []
    }
} 