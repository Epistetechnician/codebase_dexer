import uvicorn
import os

if __name__ == "__main__":
    print(f"Current working directory: {os.getcwd()}")
    print("Starting Uvicorn server...")
    # The app string assumes 'mcp_server' is a package in the cwd
    uvicorn.run("mcp_server.main:app", host="127.0.0.1", port=8000, reload=True) 