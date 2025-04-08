import os
from typing import Dict, Any, Union

from . import index_store
from .capabilities import CAPABILITIES

def handle_mcp_request(request: Dict[str, Any]) -> Dict[str, Any]:
    """Handles incoming MCP JSON-RPC requests."""
    method = request.get("method")
    params = request.get("params", {})
    request_id = request.get("id")

    print(f"Received MCP request: method={method}, params={params}, id={request_id}")

    response: Dict[str, Any] = {"jsonrpc": "2.0", "id": request_id}

    try:
        if method == "mcp.discovery.get_capabilities":
            response["result"] = CAPABILITIES
        elif method == "index_directory":
            path = params.get("path")
            if not path:
                raise ValueError("Missing required parameter: path")
            # Basic validation (can be improved)
            abs_path = os.path.abspath(path)
            if not os.path.isdir(abs_path):
                 raise ValueError(f"Path is not a valid directory: {path}")

            index_store.add_indexed_directory(abs_path)
            response["result"] = {"success": True, "message": f"Directory '{abs_path}' registered for indexing."}
        elif method == "list_indexed_directories":
            directories = index_store.get_indexed_directories()
            response["result"] = {"directories": directories}
        elif method == "list_files_in_directory":
            path = params.get("path")
            if not path:
                raise ValueError("Missing required parameter: path")
            # No need to check if path is dir here, index_store handles it
            files = index_store.get_files_in_directory(path)
            response["result"] = {"files": files}
        elif method == "get_file_content":
            dir_path = params.get("path")
            file_path = params.get("file")
            if not dir_path or not file_path:
                raise ValueError("Missing required parameter(s): path and file")
            content = index_store.get_file_content(dir_path, file_path)
            response["result"] = {"content": content}
        else:
            # Unknown method
            response["error"] = {"code": -32601, "message": "Method not found"}

    except Exception as e:
        print(f"Error processing request: {e}")
        response["error"] = {"code": -32000, "message": str(e)} # Generic server error

    print(f"Sending MCP response: {response}")
    return response 