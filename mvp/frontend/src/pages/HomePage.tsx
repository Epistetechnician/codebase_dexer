import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderOpenIcon, PlusIcon, CodeIcon, ClockIcon, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { IndexingSettings } from '@/components/IndexingSettings';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
  const [activeTab, setActiveTab] = useState('path');
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
    
    // If on the path tab, switch to settings tab when "Next" is clicked
    if (activeTab === 'path') {
      setActiveTab('settings');
      return;
    }
    
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
            setActiveTab('path'); // Reset to first tab for next time
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
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 text-slate-50">
      <div className="container mx-auto py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Code Explorer</h1>
            <p className="text-slate-400">Explore and analyze your code repositories</p>
          </div>
          
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-slate-800 hover:bg-slate-700">
                <PlusIcon className="h-4 w-4" />
                Add Codebase
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-3xl">
              <DialogHeader>
                <DialogTitle className="text-white">Add New Codebase</DialogTitle>
                <DialogDescription className="text-slate-400">
                  Enter the path to the code repository you want to analyze.
                </DialogDescription>
              </DialogHeader>
              
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full py-4">
                <TabsList className="grid w-full grid-cols-2 bg-slate-800">
                  <TabsTrigger value="path">Repository Path</TabsTrigger>
                  <TabsTrigger value="settings">Indexing Settings</TabsTrigger>
                </TabsList>
                
                <TabsContent value="path" className="space-y-4 mt-4">
                  <div className="space-y-4">
                    <p className="text-sm text-slate-400">
                      Enter the local path to your repository
                    </p>
                    <Input 
                      placeholder="/path/to/repository" 
                      value={newRepoPath} 
                      onChange={(e) => setNewRepoPath(e.target.value)}
                      disabled={isIndexing}
                      className="bg-slate-800 border-slate-700 focus:border-slate-600"
                    />
                    
                    {isIndexing && (
                      <div className="mt-4">
                        <p className="mb-2 text-sm text-slate-300">Indexing repository... {indexingProgress}%</p>
                        <Progress value={indexingProgress} className="h-2 bg-slate-800" />
                      </div>
                    )}
                  </div>
                </TabsContent>
                
                <TabsContent value="settings" className="mt-4">
                  {newRepoPath ? (
                    <IndexingSettings repositoryPath={newRepoPath} />
                  ) : (
                    <div className="p-8 text-center text-slate-400">
                      Please enter a repository path first
                    </div>
                  )}
                </TabsContent>
              </Tabs>
              
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setIsAddDialogOpen(false)} 
                  disabled={isIndexing}
                  className="bg-transparent border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleAddCodebase} 
                  disabled={!newRepoPath || isIndexing}
                  className="bg-teal-700 hover:bg-teal-600 text-white"
                >
                  {isIndexing ? 'Indexing...' : activeTab === 'path' ? 'Next' : 'Add & Index'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {savedCodebases.map((codebase) => (
            <Card 
              key={codebase.id} 
              className={`mb-4 bg-slate-800 border-slate-700 hover:border-slate-600 transition-all ${selectedCodebase === codebase.id ? 'ring-2 ring-teal-500' : ''}`} 
              onClick={() => setSelectedCodebase(codebase.id)}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b border-slate-700">
                <div className="flex items-center space-x-2">
                  <FolderOpenIcon className="h-5 w-5 text-teal-500" />
                  <CardTitle className="text-lg text-white">{codebase.name}</CardTitle>
                </div>
                <div className="flex space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleOpenCodebase(codebase.path)}
                    className="bg-transparent border-slate-700 text-slate-300 hover:bg-slate-700"
                  >
                    Open
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <CardDescription className="text-xs text-slate-400 mt-1">{codebase.path}</CardDescription>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="flex items-center space-x-2">
                    <CodeIcon className="h-4 w-4 text-slate-500" />
                    <span className="text-sm text-slate-300">{codebase.fileCount} files</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <ClockIcon className="h-4 w-4 text-slate-500" />
                    <span className="text-sm text-slate-300">Last indexed: {formatDate(codebase.lastOpened)}</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between pt-0">
                {codebase.indexProgress < 100 ? (
                  <div className="w-full">
                    <div className="flex justify-between text-xs mb-1 text-slate-400">
                      <span>Indexing...</span>
                      <span>{codebase.indexProgress}%</span>
                    </div>
                    <Progress value={codebase.indexProgress} className="h-2 bg-slate-700" />
                  </div>
                ) : (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => e.stopPropagation()}
                        className="w-full text-sm text-slate-400 hover:text-slate-300 hover:bg-slate-700"
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Indexing Settings
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-[625px] max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="text-white">Repository Indexing Settings</DialogTitle>
                        <DialogDescription className="text-slate-400">
                          Configure which files and directories should be indexed for {codebase.name}.
                        </DialogDescription>
                      </DialogHeader>
                      
                      <IndexingSettings repositoryPath={codebase.path} />
                    </DialogContent>
                  </Dialog>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
        
        {savedCodebases.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-slate-800/50 rounded-lg border border-slate-700">
            <div className="rounded-full bg-slate-700 p-6 mb-4">
              <CodeIcon className="h-10 w-10 text-slate-400" />
            </div>
            <h3 className="text-xl font-medium mb-2 text-white">No Codebases Found</h3>
            <p className="text-slate-400 mb-6 max-w-md">
              Get started by adding a codebase to analyze its structure and relationships.
            </p>
            <Button 
              onClick={() => setIsAddDialogOpen(true)} 
              className="gap-2 bg-teal-700 hover:bg-teal-600 text-white"
            >
              <PlusIcon className="h-4 w-4" />
              Add Your First Codebase
            </Button>
          </div>
        )}
      </div>
    </div>
  );
} 