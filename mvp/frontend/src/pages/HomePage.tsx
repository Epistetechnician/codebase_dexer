import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderOpenIcon, PlusIcon, CodeIcon, ClockIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { IndexingSettings } from '@/components/IndexingSettings';

interface CodebaseData {
  id: string;
  path: string;
  name: string;
  lastOpened: string;
  fileCount: number;
  indexProgress: number;
}

export function HomePage() {
  const [savedCodebases, setSavedCodebases] = useState<CodebaseData[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newRepoPath, setNewRepoPath] = useState('');
  const [isIndexing, setIsIndexing] = useState(false);
  const [indexingProgress, setIndexingProgress] = useState(0);
  const [selectedCodebase, setSelectedCodebase] = useState<string | null>(null);
  const navigate = useNavigate();

  // Function to fetch saved codebases
  const fetchSavedCodebases = async () => {
    try {
      const response = await fetch('/api/repositories');
      if (response.ok) {
        const data = await response.json();
        if (data.repositories && Array.isArray(data.repositories)) {
          // Transform API response to match our CodebaseData interface
          const formattedData = data.repositories.map((repo: any) => ({
            id: repo.repo_path,
            path: repo.repo_path,
            name: repo.display_name,
            lastOpened: repo.last_indexed || new Date().toISOString(),
            fileCount: repo.file_count || 0,
            indexProgress: 100
          }));
          setSavedCodebases(formattedData);
        } else {
          setSavedCodebases([]);
        }
      } else {
        // For demo purposes, use mock data if API isn't ready
        setSavedCodebases([
          {
            id: '1',
            path: '/Users/shaanp/Documents/GitHub/apinpc/mcp_code_indexer/mvp/frontend',
            name: 'MCP Frontend',
            lastOpened: new Date().toISOString(),
            fileCount: 45,
            indexProgress: 100
          },
          {
            id: '2',
            path: '/Users/shaanp/Documents/GitHub/apinpc/mcp_code_indexer/mvp/backend',
            name: 'MCP Backend',
            lastOpened: new Date(Date.now() - 86400000).toISOString(),
            fileCount: 32,
            indexProgress: 100
          },
          {
            id: '3',
            path: '/Users/shaanp/Documents/GitHub/apinpc/mcp_code_indexer/mcp_server',
            name: 'MCP Server',
            lastOpened: new Date(Date.now() - 172800000).toISOString(),
            fileCount: 18,
            indexProgress: 100
          }
        ]);
      }
    } catch (error) {
      console.error('Error fetching saved codebases:', error);
    }
  };

  useEffect(() => {
    // Fetch saved codebases on component mount
    fetchSavedCodebases();
  }, []);

  const handleAddCodebase = async () => {
    if (!newRepoPath) return;
    
    setIsIndexing(true);
    setIndexingProgress(0);
    
    try {
      // Start indexing the repository
      const response = await fetch('/api/index-repository', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          repository_path: newRepoPath,
          clear_existing: true
        })
      });
      
      if (response.ok) {
        // Poll for indexing status
        const statusCheckInterval = setInterval(async () => {
          const statusResponse = await fetch(`/api/indexing-status?repo_path=${encodeURIComponent(newRepoPath)}`);
          const statusData = await statusResponse.json();
          
          // Calculate progress percentage based on processed vs total files
          const progress = statusData.total_files > 0 
            ? Math.round((statusData.processed_files / statusData.total_files) * 100) 
            : 0;
            
          setIndexingProgress(progress);
          
          if (statusData.completed) {
            clearInterval(statusCheckInterval);
            
            // Add to repositories API
            try {
              const pathParts = newRepoPath.split('/');
              const name = pathParts[pathParts.length - 1];
              
              const addRepoResponse = await fetch('/api/repositories', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                  repo_path: newRepoPath,
                  display_name: name
                })
              });
              
              if (addRepoResponse.ok) {
                // After successful addition, fetch the updated list
                fetchSavedCodebases();
              }
            } catch (error) {
              console.error('Error adding repository:', error);
            }
            
            setIsIndexing(false);
            setIsAddDialogOpen(false);
            setNewRepoPath('');
          }
        }, 1000);
      } else {
        throw new Error('Failed to start indexing');
      }
    } catch (error) {
      console.error('Error indexing repository:', error);
      setIsIndexing(false);
    }
  };

  const handleOpenCodebase = (path: string) => {
    navigate(`/explorer?path=${encodeURIComponent(path)}`);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Code Explorer</h1>
          <p className="text-muted-foreground">Explore and analyze your code repositories</p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <PlusIcon className="h-4 w-4" />
              Add Codebase
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Codebase</DialogTitle>
              <DialogDescription>
                Enter the path to the code repository you want to analyze.
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-4">
              <Input 
                placeholder="/path/to/repository" 
                value={newRepoPath} 
                onChange={(e) => setNewRepoPath(e.target.value)}
                disabled={isIndexing}
              />
              
              {isIndexing && (
                <div className="mt-4">
                  <p className="mb-2 text-sm">Indexing repository... {indexingProgress}%</p>
                  <Progress value={indexingProgress} className="h-2" />
                </div>
              )}
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={isIndexing}>
                Cancel
              </Button>
              <Button onClick={handleAddCodebase} disabled={!newRepoPath || isIndexing}>
                {isIndexing ? 'Indexing...' : 'Add & Index'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {savedCodebases.map((codebase) => (
          <Card key={codebase.id} className={`mb-4 ${selectedCodebase === codebase.id ? 'ring-2 ring-primary' : ''}`} onClick={() => setSelectedCodebase(codebase.id)}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center space-x-2">
                <FolderOpenIcon className="h-5 w-5" />
                <CardTitle className="text-lg">{codebase.name}</CardTitle>
              </div>
              <div className="flex space-x-2">
                <IndexingSettings repositoryPath={codebase.path} />
                <Button variant="outline" size="sm" onClick={() => handleOpenCodebase(codebase.path)}>Open</Button>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-xs text-muted-foreground mt-1">{codebase.path}</CardDescription>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="flex items-center space-x-2">
                  <CodeIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{codebase.fileCount} files</span>
                </div>
                <div className="flex items-center space-x-2">
                  <ClockIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Last indexed: {formatDate(codebase.lastOpened)}</span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between pt-0">
              {codebase.indexProgress < 100 ? (
                <div className="w-full">
                  <div className="flex justify-between text-xs mb-1">
                    <span>Indexing...</span>
                    <span>{codebase.indexProgress}%</span>
                  </div>
                  <Progress value={codebase.indexProgress} className="h-2" />
                </div>
              ) : null}
            </CardFooter>
          </Card>
        ))}
      </div>
      
      {savedCodebases.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-muted p-6 mb-4">
            <CodeIcon className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-medium mb-2">No Codebases Found</h3>
          <p className="text-muted-foreground mb-6 max-w-md">
            Get started by adding a codebase to analyze its structure and relationships.
          </p>
          <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
            <PlusIcon className="h-4 w-4" />
            Add Your First Codebase
          </Button>
        </div>
      )}
    </div>
  );
} 