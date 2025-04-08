from typing import List, Set, Dict
import os
import json
from pathlib import Path
from pydantic_settings import BaseSettings
from pydantic import Field

class Settings(BaseSettings):
    # Neo4j settings
    neo4j_uri: str = Field(..., env='NEO4J_URI')
    neo4j_user: str = Field(..., env='NEO4J_USER')
    neo4j_password: str = Field(..., env='NEO4J_PASSWORD')
    
    # Server settings
    host: str = Field('0.0.0.0', env='HOST')
    port: int = Field(8000, env='PORT')
    debug: bool = Field(False, env='DEBUG')
    
    # Indexing settings
    max_file_size_mb: int = Field(5, env='MAX_FILE_SIZE_MB')
    supported_languages: Set[str] = Field(
        default_factory=lambda: {'python', 'javascript', 'typescript'},
        env='SUPPORTED_LANGUAGES'
    )
    
    # Default directories to skip (common large directories)
    skip_directories: List[str] = Field(
        default_factory=lambda: [
            'node_modules',
            'venv',
            'env',
            '.env',
            '__pycache__',
            '.git',
            '.idea',
            '.vscode',
            'dist',
            'build',
            'target',
            'out',
            'output',
            '.next',
            '.nuxt',
            'vendor',
            'bower_components',
            'jspm_packages',
            'packages',
            'tmp',
            'temp',
            'coverage',
            '.coverage',
            'htmlcov',
            '.pytest_cache',
            '.mypy_cache',
            '.ruff_cache',
            '.npm',
            '.yarn',
            'migrations',
            'static',
            'assets',
            'public/assets',
            'public/img',
            'public/images',
            'public/static',
        ],
        env='SKIP_DIRECTORIES'
    )
    
    # Default patterns to ignore (common large/binary files)
    ignore_patterns: List[str] = Field(
        default_factory=lambda: [
            # Binary files
            '*.so', '*.dylib', '*.dll', '*.exe', '*.bin', '*.dat',
            # Compiled Python files
            '*.pyc', '*.pyo', '*.pyd',
            # Media files
            '*.jpg', '*.jpeg', '*.png', '*.gif', '*.bmp', '*.svg', 
            '*.mp3', '*.mp4', '*.wav', '*.avi', '*.mov', '*.webm',
            # Archive files
            '*.zip', '*.tar', '*.gz', '*.bz2', '*.rar', '*.7z',
            # Package files
            '*.whl', '*.egg', '*.jar',
            # Database files
            '*.db', '*.sqlite', '*.sqlite3',
            # Other large files
            '*.pdf', '*.doc', '*.docx', '*.ppt', '*.pptx', '*.xls', '*.xlsx',
            # Log files
            '*.log', '*.log.*',
            # Lock files
            'package-lock.json', 'yarn.lock', 'poetry.lock', 'Pipfile.lock',
            # Generated files
            '*.min.js', '*.map', '*.chunk.js', '*.bundle.js'
        ],
        env='IGNORE_PATTERNS'
    )
    
    # Size thresholds
    skip_files_larger_than_mb: int = Field(10, env='SKIP_FILES_LARGER_THAN_MB')
    skip_repositories_larger_than_gb: float = Field(2.0, env='SKIP_REPOSITORIES_LARGER_THAN_GB')
    max_files_per_repository: int = Field(10000, env='MAX_FILES_PER_REPOSITORY')
    
    # Repository-specific settings (can be overridden via API)
    repository_settings: Dict[str, Dict] = Field(
        default_factory=dict,
    )
    
    # Data directory for storing settings, etc.
    data_dir: str = Field("./data", env="DATA_DIR")
    
    # Security settings
    jwt_secret_key: str = Field(..., env='JWT_SECRET_KEY')
    access_token_expire_minutes: int = Field(30, env='ACCESS_TOKEN_EXPIRE_MINUTES')
    
    class Config:
        env_file = '.env'
        case_sensitive = False
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._create_data_dir()
        self._load_repository_settings()
    
    def _create_data_dir(self):
        """Create data directory if it doesn't exist"""
        os.makedirs(self.data_dir, exist_ok=True)
    
    def _get_settings_file_path(self):
        """Get the path to the repository settings file"""
        return os.path.join(self.data_dir, "repository_settings.json")
    
    def _load_repository_settings(self):
        """Load repository settings from file"""
        settings_file = self._get_settings_file_path()
        
        if os.path.exists(settings_file):
            try:
                with open(settings_file, 'r') as f:
                    self.repository_settings = json.load(f)
            except (json.JSONDecodeError, IOError) as e:
                print(f"Error loading repository settings: {e}")
    
    def save_repository_settings(self):
        """Save repository settings to file"""
        settings_file = self._get_settings_file_path()
        
        try:
            with open(settings_file, 'w') as f:
                json.dump(self.repository_settings, f, indent=2)
        except IOError as e:
            print(f"Error saving repository settings: {e}")

# Create global settings instance
settings = Settings() 