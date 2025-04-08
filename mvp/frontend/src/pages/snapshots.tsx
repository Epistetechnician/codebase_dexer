import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { GraphView } from '@/components/GraphView';
import { Loader2, ArrowLeft, Calendar, Download, Share2 } from 'lucide-react';

interface CodeSnapshot {
  id: string;
  repo_path: string;
  timestamp: string;
  file_count: number;
  node_count: number;
  link_count: number;
  changes: {
    new_files: string[];
    changed_files: string[];
    deleted_files: string[];
  };
  graph_data?: any;
}

export default function Snapshots() {
  const router = useRouter();
  const { repo } = router.query;
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<CodeSnapshot[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<CodeSnapshot | null>(null);
  const [comparisonMode, setComparisonMode] = useState(false);
  const [compareSnapshot, setCompareSnapshot] = useState<CodeSnapshot | null>(null);

  useEffect(() => {
    if (!repo) return;
    
    const fetchSnapshots = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/snapshots?repo_path=${encodeURIComponent(repo as string)}`);
        
        if (!response.ok) throw new Error('Failed to fetch snapshots');
        
        const data = await response.json();
        setSnapshots(data.snapshots || []);
        
        if (data.snapshots && data.snapshots.length > 0) {
          setSelectedSnapshot(data.snapshots[0]);
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching snapshots:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
        setLoading(false);
      }
    };

    fetchSnapshots();
  }, [repo]);

  const fetchSnapshotDetails = async (snapshotId: string) => {
    try {
      const response = await fetch(`/api/snapshot-details?id=${encodeURIComponent(snapshotId)}`);
      
      if (!response.ok) throw new Error('Failed to fetch snapshot details');
      
      const data = await response.json();
      return data;
    } catch (err) {
      console.error('Error fetching snapshot details:', err);
      throw err;
    }
  };

  const handleSnapshotSelect = async (snapshot: CodeSnapshot) => {
    try {
      if (!snapshot.graph_data) {
        const details = await fetchSnapshotDetails(snapshot.id);
        snapshot.graph_data = details.graph_data;
      }
      
      setSelectedSnapshot(snapshot);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load snapshot details');
    }
  };

  const handleCompare = async (snapshot: CodeSnapshot) => {
    try {
      if (!snapshot.graph_data) {
        const details = await fetchSnapshotDetails(snapshot.id);
        snapshot.graph_data = details.graph_data;
      }
      
      setCompareSnapshot(snapshot);
      setComparisonMode(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load snapshot for comparison');
    }
  };

  const handleExportSnapshot = (snapshot: CodeSnapshot) => {
    if (!snapshot.graph_data) return;
    
    const dataStr = JSON.stringify(snapshot.graph_data, null, 2);
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
    
    const exportName = `codebase-snapshot-${snapshot.id}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportName);
    linkElement.click();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto">
          <div className="p-6 bg-red-50 border border-red-200 rounded-md">
            <h2 className="text-lg font-semibold text-red-700 mb-2">Error</h2>
            <p className="text-sm text-red-600">{error}</p>
            <Button 
              className="mt-4"
              variant="outline"
              onClick={() => router.push('/')}
            >
              Return to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center mb-8">
          <Button 
            variant="outline" 
            size="icon" 
            className="mr-4"
            onClick={() => router.push('/')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-4xl font-bold">Code Evolution</h1>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Snapshots Sidebar */}
          <Card className="col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="h-5 w-5 mr-2" />
                Snapshots
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-300px)]">
                {snapshots.length === 0 ? (
                  <div className="p-4 text-center">
                    <p className="text-muted-foreground">No snapshots available</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {snapshots.map(snapshot => (
                      <div 
                        key={snapshot.id}
                        className={`p-3 hover:bg-accent cursor-pointer transition-colors ${
                          selectedSnapshot?.id === snapshot.id ? 'bg-accent' : ''
                        }`}
                        onClick={() => handleSnapshotSelect(snapshot)}
                      >
                        <div className="flex justify-between items-start">
                          <div className="font-medium">{formatDate(snapshot.timestamp)}</div>
                          <Badge variant="outline" className="ml-1">v{snapshot.id}</Badge>
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-1 text-xs text-muted-foreground">
                          <div>{snapshot.file_count} files</div>
                          <div>{snapshot.node_count} nodes</div>
                          <div>{snapshot.link_count} links</div>
                        </div>
                        <div className="mt-2 flex gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 px-2 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCompare(snapshot);
                            }}
                            disabled={comparisonMode && compareSnapshot?.id === snapshot.id}
                          >
                            Compare
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleExportSnapshot(snapshot);
                            }}
                          >
                            <Download className="h-3 w-3 mr-1" />
                            Export
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Main Content */}
          <div className="col-span-9">
            {!selectedSnapshot ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <p className="text-muted-foreground">Select a snapshot to view details</p>
                </CardContent>
              </Card>
            ) : (
              <Tabs defaultValue="graph">
                <div className="flex justify-between items-center mb-4">
                  <TabsList>
                    <TabsTrigger value="graph">Graph View</TabsTrigger>
                    <TabsTrigger value="changes">Changes</TabsTrigger>
                    <TabsTrigger value="stats">Statistics</TabsTrigger>
                  </TabsList>
                  
                  {comparisonMode && (
                    <div className="flex items-center">
                      <Badge className="mr-2 bg-primary">Comparing</Badge>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setComparisonMode(false);
                          setCompareSnapshot(null);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>

                <TabsContent value="graph" className="mt-0">
                  <Card>
                    <CardHeader>
                      <CardTitle>
                        {comparisonMode 
                          ? `Comparing ${formatDate(selectedSnapshot.timestamp)} with ${formatDate(compareSnapshot!.timestamp)}`
                          : `Code Graph at ${formatDate(selectedSnapshot.timestamp)}`
                        }
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[calc(100vh-350px)]">
                        {comparisonMode && compareSnapshot ? (
                          <div className="grid grid-cols-2 gap-4 h-full">
                            <div className="h-full border rounded-md overflow-hidden">
                              <div className="p-2 bg-muted text-xs font-medium">
                                {formatDate(compareSnapshot.timestamp)}
                              </div>
                              <div className="h-[calc(100%-30px)]">
                                <GraphView 
                                  repoPath={repo as string}
                                  width={400}
                                  height={500}
                                  graphData={compareSnapshot.graph_data}
                                />
                              </div>
                            </div>
                            <div className="h-full border rounded-md overflow-hidden">
                              <div className="p-2 bg-muted text-xs font-medium">
                                {formatDate(selectedSnapshot.timestamp)}
                              </div>
                              <div className="h-[calc(100%-30px)]">
                                <GraphView 
                                  repoPath={repo as string}
                                  width={400}
                                  height={500}
                                  graphData={selectedSnapshot.graph_data}
                                />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <GraphView 
                            repoPath={repo as string}
                            width={800}
                            height={600}
                            graphData={selectedSnapshot.graph_data}
                          />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="changes" className="mt-0">
                  <Card>
                    <CardHeader>
                      <CardTitle>Changes in this Snapshot</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        <div>
                          <h3 className="font-medium mb-2">New Files ({selectedSnapshot.changes.new_files.length})</h3>
                          {selectedSnapshot.changes.new_files.length > 0 ? (
                            <div className="p-3 border rounded-md bg-green-50">
                              <ScrollArea className="h-[150px]">
                                <ul className="space-y-1 text-green-600">
                                  {selectedSnapshot.changes.new_files.map((file, index) => (
                                    <li key={index} className="text-sm">{file}</li>
                                  ))}
                                </ul>
                              </ScrollArea>
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">No new files</p>
                          )}
                        </div>
                        
                        <div>
                          <h3 className="font-medium mb-2">Changed Files ({selectedSnapshot.changes.changed_files.length})</h3>
                          {selectedSnapshot.changes.changed_files.length > 0 ? (
                            <div className="p-3 border rounded-md bg-amber-50">
                              <ScrollArea className="h-[150px]">
                                <ul className="space-y-1 text-amber-600">
                                  {selectedSnapshot.changes.changed_files.map((file, index) => (
                                    <li key={index} className="text-sm">{file}</li>
                                  ))}
                                </ul>
                              </ScrollArea>
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">No changed files</p>
                          )}
                        </div>
                        
                        <div>
                          <h3 className="font-medium mb-2">Deleted Files ({selectedSnapshot.changes.deleted_files.length})</h3>
                          {selectedSnapshot.changes.deleted_files.length > 0 ? (
                            <div className="p-3 border rounded-md bg-red-50">
                              <ScrollArea className="h-[150px]">
                                <ul className="space-y-1 text-red-600">
                                  {selectedSnapshot.changes.deleted_files.map((file, index) => (
                                    <li key={index} className="text-sm">{file}</li>
                                  ))}
                                </ul>
                              </ScrollArea>
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">No deleted files</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="stats" className="mt-0">
                  <Card>
                    <CardHeader>
                      <CardTitle>Code Statistics</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        <div className="p-4 bg-muted rounded-md text-center">
                          <div className="text-3xl font-bold">{selectedSnapshot.file_count}</div>
                          <div className="text-sm text-muted-foreground">Total Files</div>
                        </div>
                        <div className="p-4 bg-muted rounded-md text-center">
                          <div className="text-3xl font-bold">{selectedSnapshot.node_count}</div>
                          <div className="text-sm text-muted-foreground">Total Nodes</div>
                        </div>
                        <div className="p-4 bg-muted rounded-md text-center">
                          <div className="text-3xl font-bold">{selectedSnapshot.link_count}</div>
                          <div className="text-sm text-muted-foreground">Total Links</div>
                        </div>
                        <div className="p-4 bg-muted rounded-md text-center">
                          <div className="text-3xl font-bold">
                            {selectedSnapshot.changes.new_files.length + 
                             selectedSnapshot.changes.changed_files.length + 
                             selectedSnapshot.changes.deleted_files.length}
                          </div>
                          <div className="text-sm text-muted-foreground">Changes</div>
                        </div>
                      </div>
                      
                      <div className="mt-8">
                        <h3 className="font-medium mb-4">Additional Metrics</h3>
                        {/* Additional metrics would go here - could be populated from the API */}
                        <p className="text-muted-foreground">Coming soon: Code complexity, dependency metrics, and more.</p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 