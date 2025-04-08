import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, FolderTree, RefreshCw, Trash2, ExternalLink, History } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';

interface Repository {
  repo_path: string;
  display_name: string;
  last_indexed: string;
  file_count: number;
  node_count: number;
  link_count: number;
  snapshots: number;
}

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [newRepoPath, setNewRepoPath] = useState('');
  const [newRepoName, setNewRepoName] = useState('');
  const [indexing, setIndexing] = useState<string | null>(null);

  useEffect(() => {
    fetchRepositories();
  }, []);

  const fetchRepositories = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/repositories');
      
      if (!response.ok) throw new Error('Failed to fetch repositories');
      
      const data = await response.json();
      setRepositories(data.repositories || []);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching repositories:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  };

  const handleAddRepository = async () => {
    if (!newRepoPath.trim()) return;
    
    try {
      const response = await fetch('/api/repositories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          repo_path: newRepoPath,
          display_name: newRepoName || getNameFromPath(newRepoPath)
        }),
      });
      
      if (!response.ok) throw new Error('Failed to add repository');
      
      setNewRepoPath('');
      setNewRepoName('');
      await fetchRepositories();
    } catch (err) {
      console.error('Error adding repository:', err);
      setError(err instanceof Error ? err.message : 'Failed to add repository');
    }
  };

  const handleReindex = async (repoPath: string) => {
    try {
      setIndexing(repoPath);
      const response = await fetch('/api/index-repository', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ repo_path: repoPath }),
      });
      
      if (!response.ok) throw new Error('Failed to re-index repository');
      
      // Poll status until indexing is complete
      let completed = false;
      while (!completed) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const statusResponse = await fetch(`/api/indexing-status?repo_path=${encodeURIComponent(repoPath)}`);
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          if (statusData.completed) {
            completed = true;
          }
        }
      }
      
      await fetchRepositories();
      setIndexing(null);
    } catch (err) {
      console.error('Error re-indexing repository:', err);
      setError(err instanceof Error ? err.message : 'Failed to re-index repository');
      setIndexing(null);
    }
  };

  const handleDelete = async (repoPath: string) => {
    try {
      const response = await fetch(`/api/repositories?repo_path=${encodeURIComponent(repoPath)}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) throw new Error('Failed to delete repository');
      
      await fetchRepositories();
    } catch (err) {
      console.error('Error deleting repository:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete repository');
    }
  };

  const handleOpenExplorer = (repoPath: string) => {
    router.push(`/codeexplorer?repo=${encodeURIComponent(repoPath)}`);
  };

  const handleViewSnapshots = (repoPath: string) => {
    router.push(`/snapshots?repo=${encodeURIComponent(repoPath)}`);
  };

  const getNameFromPath = (path: string) => {
    const parts = path.split('/');
    return parts[parts.length - 1];
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">Code Explorer Dashboard</h1>
          
          <Dialog>
            <DialogTrigger asChild>
              <Button className="ml-auto">Add Repository</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add a New Repository</DialogTitle>
                <DialogDescription>
                  Enter the absolute path to the repository you want to index.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="repoPath" className="text-right">
                    Repository Path
                  </Label>
                  <Input
                    id="repoPath"
                    value={newRepoPath}
                    onChange={(e) => setNewRepoPath(e.target.value)}
                    placeholder="/path/to/repository"
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="repoName" className="text-right">
                    Display Name
                  </Label>
                  <Input
                    id="repoName"
                    value={newRepoName}
                    onChange={(e) => setNewRepoName(e.target.value)}
                    placeholder="My Project (optional)"
                    className="col-span-3"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleAddRepository}>Add & Index</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {error && (
          <div className="p-4 mb-6 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
            <button 
              className="mt-2 px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded-md text-sm"
              onClick={() => setError(null)}
            >
              Dismiss
            </button>
          </div>
        )}

        {repositories.length === 0 ? (
          <div className="text-center p-12 border-2 border-dashed rounded-lg">
            <FolderTree className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No repositories indexed yet</h3>
            <p className="text-muted-foreground mb-6">Add a repository to start exploring your code</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {repositories.map((repo) => (
              <Card key={repo.repo_path} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="truncate" title={repo.display_name}>
                    {repo.display_name}
                  </CardTitle>
                  <div className="text-sm text-muted-foreground truncate" title={repo.repo_path}>
                    {repo.repo_path}
                  </div>
                </CardHeader>
                <CardContent className="pb-3">
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="p-2 bg-muted rounded text-center">
                      <div className="text-xl font-semibold">{repo.file_count}</div>
                      <div className="text-xs text-muted-foreground">Files</div>
                    </div>
                    <div className="p-2 bg-muted rounded text-center">
                      <div className="text-xl font-semibold">{repo.node_count}</div>
                      <div className="text-xs text-muted-foreground">Nodes</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Last indexed:</span>
                      <span className="font-medium">{formatDate(repo.last_indexed)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Snapshots:</span>
                      <Badge variant="outline">{repo.snapshots}</Badge>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <div className="flex gap-2">
                    <Button
                      variant="outline" 
                      size="icon"
                      onClick={() => handleDelete(repo.repo_path)} 
                      title="Delete repository"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline" 
                      size="icon"
                      onClick={() => handleReindex(repo.repo_path)}
                      disabled={indexing === repo.repo_path}
                      title="Re-index repository"
                    >
                      {indexing === repo.repo_path ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewSnapshots(repo.repo_path)}
                      className="flex items-center gap-1"
                    >
                      <History className="h-4 w-4 mr-1" />
                      History
                    </Button>
                    <Button 
                      size="sm"
                      onClick={() => handleOpenExplorer(repo.repo_path)}
                      className="flex items-center gap-1"
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Explore
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 