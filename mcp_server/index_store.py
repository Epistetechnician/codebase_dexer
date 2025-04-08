import os
import gitignore_parser
from typing import List, Dict, Any, Optional

# Store indexed directories and their file contents
# Key: Absolute path of the indexed directory
# Value: Dict[str, Optional[str]] where key is relative file path, value is file content or None if unreadable/ignored
_indexed_data: Dict[str, Dict[str, Optional[str]]] = {}

MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 # Skip files larger than 5MB

def add_indexed_directory(path: str):
    """Scans a directory, respecting .gitignore, and stores the content of text files found within it."""
    abs_path = os.path.abspath(path)
    if not os.path.isdir(abs_path):
        print(f"Error: Path is not a valid directory: {path}")
        return

    gitignore_path = os.path.join(abs_path, ".gitignore")
    matches_gitignore = None
    if os.path.exists(gitignore_path):
        try:
            with open(gitignore_path, 'r') as f:
                matches_gitignore = gitignore_parser.parse(f)
            print(f"Loaded .gitignore rules from {gitignore_path}")
        except Exception as e:
            print(f"Warning: Could not read or parse .gitignore at {gitignore_path}: {e}")

    if abs_path in _indexed_data:
        print(f"Directory already indexed: {abs_path}. Re-scanning...")
    else:
        print(f"Adding directory to index: {abs_path}")

    file_contents: Dict[str, Optional[str]] = {}
    files_scanned = 0
    files_indexed = 0
    files_ignored = 0
    files_skipped_size = 0
    files_skipped_encoding = 0

    for root, dirs, files in os.walk(abs_path, topdown=True):
        # Filter directories based on gitignore (basic implementation)
        # A more robust implementation might modify dirs list in place
        # based on patterns like 'node_modules/'
        dirs[:] = [d for d in dirs if not (matches_gitignore and matches_gitignore(os.path.join(root, d)))]

        for file in files:
            files_scanned += 1
            full_file_path = os.path.join(root, file)
            relative_file_path = os.path.relpath(full_file_path, abs_path)

            # Check if ignored by .gitignore
            if matches_gitignore and matches_gitignore(full_file_path):
                #print(f"Ignoring file (matches .gitignore): {relative_file_path}")
                file_contents[relative_file_path] = None # Mark as ignored
                files_ignored += 1
                continue

            # Check file size
            try:
                file_size = os.path.getsize(full_file_path)
                if file_size > MAX_FILE_SIZE_BYTES:
                    print(f"Skipping file (too large: {file_size} bytes): {relative_file_path}")
                    file_contents[relative_file_path] = None # Mark as skipped (size)
                    files_skipped_size += 1
                    continue
            except OSError as e:
                print(f"Skipping file (cannot get size: {e}): {relative_file_path}")
                file_contents[relative_file_path] = None # Mark as skipped (error)
                continue

            # Try reading file content
            try:
                with open(full_file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                file_contents[relative_file_path] = content
                files_indexed += 1
            except UnicodeDecodeError:
                #print(f"Skipping file (not UTF-8 text): {relative_file_path}")
                file_contents[relative_file_path] = None # Mark as skipped (encoding)
                files_skipped_encoding += 1
            except OSError as e:
                print(f"Skipping file (cannot read: {e}): {relative_file_path}")
                file_contents[relative_file_path] = None # Mark as skipped (error)
            except Exception as e:
                print(f"Skipping file (unexpected error: {e}): {relative_file_path}")
                file_contents[relative_file_path] = None # Mark as skipped (error)


    _indexed_data[abs_path] = file_contents
    print(f"Finished indexing {abs_path}:")
    print(f"  Scanned: {files_scanned}")
    print(f"  Indexed: {files_indexed}")
    print(f"  Ignored (.gitignore): {files_ignored}")
    print(f"  Skipped (Size > {MAX_FILE_SIZE_BYTES / (1024*1024)}MB): {files_skipped_size}")
    print(f"  Skipped (Encoding/Read Error): {files_skipped_encoding}")
    print(f"  Total entries stored (incl. skipped): {len(file_contents)}")

def get_indexed_directories() -> List[str]:
    """Returns the list of currently indexed directory paths."""
    return list(_indexed_data.keys())

def get_files_in_directory(path: str) -> List[str]:
    """Returns the list of *indexed* (non-skipped/ignored) relative file paths for a directory."""
    abs_path = os.path.abspath(path)
    if abs_path not in _indexed_data:
        print(f"Error: Directory not indexed: {abs_path}")
        return []
    # Return only files that have content (were not skipped/ignored)
    return [f for f, content in _indexed_data.get(abs_path, {}).items() if content is not None]

def get_file_content(directory_path: str, file_path: str) -> Optional[str]:
    """Returns the stored content of a specific file within an indexed directory."""
    abs_dir_path = os.path.abspath(directory_path)
    if abs_dir_path not in _indexed_data:
        print(f"Error: Directory not indexed: {abs_dir_path}")
        return None # Or raise error

    directory_data = _indexed_data[abs_dir_path]

    # Normalize file_path separator just in case
    normalized_file_path = os.path.normpath(file_path)

    content = directory_data.get(normalized_file_path)
    if content is None and normalized_file_path in directory_data:
        print(f"Info: File was skipped or ignored during indexing: {normalized_file_path}")
        return None # Indicate skipped/ignored
    elif normalized_file_path not in directory_data:
        print(f"Error: File not found in index: {normalized_file_path}")
        return None # Or raise error

    return content 