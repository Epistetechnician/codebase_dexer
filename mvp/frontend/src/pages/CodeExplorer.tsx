import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, FileText, FolderTree, Code, History, PenSquare, Network, ArrowLeft, Database } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GraphView } from '@/components/GraphView';
import { Neo4jConsole } from '@/components/Neo4jConsole';

interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  content?: string;
}

interface CodeStructure {
  files: {
    path: string;
    structure: {
      classes: { name: string; lineno: number; end_lineno: number }[];
      functions: { name: string; lineno: number; end_lineno: number }[];
      imports: { name: string; lineno: number }[];
    };
  }[];
}

interface FileHistoryData {
  last_indexed: string | null;
  changes: {
    new: string[];
    changed: string[];
    deleted: string[];
  };
}

interface Documentation {
  [key: string]: {
    content: string;
    last_updated: string;
  };
}

export function CodeExplorer() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const repoPath = searchParams.get('path');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileTree, setFileTree] = useState<FileNode | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [codeStructure, setCodeStructure] = useState<CodeStructure | null>(null);
  const [fileHistory, setFileHistory] = useState<FileHistoryData | null>(null);
  const [documentation, setDocumentation] = useState<Documentation>({});
  const [newDocumentation, setNewDocumentation] = useState('');
  const [savingDoc, setSavingDoc] = useState(false);

  useEffect(() => {
    // Redirect to home if no repo path is provided
    if (!repoPath) {
      navigate('/');
      return;
    }

    const fetchData = async () => {
      try {
        // Fetch file tree
        const treeResponse = await fetch(`/api/file-tree?path=${encodeURIComponent(repoPath)}`);
        if (!treeResponse.ok) throw new Error('Failed to fetch file tree');
        const treeData = await treeResponse.json();
        setFileTree(treeData);

        // Fetch code structure
        const structureResponse = await fetch(`/api/code-structure?path=${encodeURIComponent(repoPath)}`);
        if (!structureResponse.ok) throw new Error('Failed to fetch code structure');
        const structureData = await structureResponse.json();
        setCodeStructure(structureData);

        // Fetch file history
        const historyResponse = await fetch(`/api/file-history?repo_path=${encodeURIComponent(repoPath)}`);
        if (!historyResponse.ok) throw new Error('Failed to fetch file history');
        const historyData = await historyResponse.json();
        setFileHistory(historyData);

        // Fetch documentation
        try {
          const docResponse = await fetch(`/api/documentation?repo_path=${encodeURIComponent(repoPath)}`);
          if (docResponse.ok) {
            const docData = await docResponse.json();
            setDocumentation(docData.documentation || {});
          } else {
            // Initialize with empty object if endpoint still fails
            setDocumentation({});
          }
        } catch (error) {
          console.warn('Could not fetch documentation, initializing empty:', error);
          setDocumentation({});
        }

        setLoading(false);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
        setLoading(false);
      }
    };

    fetchData();
  }, [repoPath, navigate]);

  const handleFileSelect = async (fileId: string) => {
    try {
      setSelectedFile(fileId);
      // The backend expects an absolute path, but fileId is relative to the repo
      if (!repoPath) {
        throw new Error('Repository path is not defined');
      }
      const fullPath = `${repoPath}/${fileId}`;
      const response = await fetch(`/api/file-content?path=${encodeURIComponent(fullPath)}`);
      
      if (!response.ok) throw new Error('Failed to fetch file content');
      
      const data = await response.json();
      setFileContent(data.content);
    } catch (err) {
      console.error('Error loading file:', err);
      setError(err instanceof Error ? err.message : 'Failed to load file content');
    }
  };

  const handleSaveDocumentation = async () => {
    if (!selectedFile || !newDocumentation.trim() || !repoPath) return;
    
    try {
      setSavingDoc(true);
      const response = await fetch(`/api/documentation?repo_path=${encodeURIComponent(repoPath)}&file_path=${encodeURIComponent(selectedFile)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: newDocumentation }),
      });
      
      if (!response.ok) throw new Error('Failed to save documentation');
      
      // Update local state after successful save
      const updatedDocs = {
        ...documentation,
        [selectedFile]: {
          content: newDocumentation,
          last_updated: new Date().toISOString(),
        },
      };
      
      setDocumentation(updatedDocs);
      setNewDocumentation('');
      setSavingDoc(false);
    } catch (err) {
      console.error('Error saving documentation:', err);
      setError(err instanceof Error ? err.message : 'Failed to save documentation');
      setSavingDoc(false);
    }
  };

  const renderFileTree = (node: FileNode | null) => {
    if (!node) return null;
  
    return (
      <div>
        <div
          className={`py-1 px-2 hover:bg-accent cursor-pointer rounded ${
            selectedFile === node.id ? 'bg-accent' : ''
          }`}
          onClick={() => node.type === 'file' && handleFileSelect(node.id)}
        >
          {node.type === 'directory' ? '📁 ' : '📄 '}
          {node.name}
        </div>
        {node.children && (
          <div style={{ paddingLeft: '16px' }}>
            {node.children.map((child) => (
              <div key={child.id}>
                {renderFileTree(child)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Function to highlight changed files in the tree
  const getFileStatus = (fileId: string) => {
    if (!fileHistory) return null;
    
    if (fileHistory.changes.new.includes(fileId)) {
      return 'new';
    } else if (fileHistory.changes.changed.includes(fileId)) {
      return 'changed';
    }
    return null;
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
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="bg-red-50 border border-red-200 p-4 rounded-md max-w-md w-full">
          <h2 className="text-lg font-semibold text-red-700 mb-2">Error Loading Repository</h2>
          <p className="text-red-600">{error}</p>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Code Explorer</h1>
        
        <div className="grid grid-cols-12 gap-6">
          {/* File Tree */}
          <Card className="col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center">
                <FolderTree className="h-5 w-5 mr-2" />
                Files
                {fileHistory && fileHistory.last_indexed && (
                  <span className="ml-auto text-xs text-muted-foreground">
                    Last indexed: {new Date(fileHistory.last_indexed).toLocaleString()}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[calc(100vh-300px)]">
                {fileTree ? renderFileTree(fileTree) : <p>No files available</p>}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Main Content */}
          <div className="col-span-9">
            <Tabs defaultValue="code" className="w-full">
              <TabsList>
                <TabsTrigger value="code" className="flex items-center">
                  <FileText className="h-4 w-4 mr-2" />
                  Code View
                </TabsTrigger>
                <TabsTrigger value="structure" className="flex items-center">
                  <Code className="h-4 w-4 mr-2" />
                  Structure View
                </TabsTrigger>
                <TabsTrigger value="graph" className="flex items-center">
                  <Network className="h-4 w-4 mr-2" />
                  Graph View
                </TabsTrigger>
                <TabsTrigger value="history" className="flex items-center">
                  <History className="h-4 w-4 mr-2" />
                  Change History
                </TabsTrigger>
                <TabsTrigger value="documentation" className="flex items-center">
                  <PenSquare className="h-4 w-4 mr-2" />
                  Documentation
                </TabsTrigger>
                <TabsTrigger value="database" className="flex items-center">
                  <Database className="h-4 w-4 mr-2" />
                  Neo4j DB
                </TabsTrigger>
              </TabsList>

              {/* Code View Tab */}
              <TabsContent value="code">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      {selectedFile || 'Select a file to view'}
                      {selectedFile && getFileStatus(selectedFile) && (
                        <Badge 
                          className={`ml-2 ${
                            getFileStatus(selectedFile) === 'new' ? 'bg-green-100 text-green-800' : 
                            'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {getFileStatus(selectedFile) === 'new' ? 'New' : 'Changed'}
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[calc(100vh-400px)]">
                      {fileContent ? (
                        <pre className="p-4 bg-muted rounded-md overflow-auto">
                          <code>{fileContent}</code>
                        </pre>
                      ) : selectedFile ? (
                        <div className="flex items-center justify-center h-full">
                          <Loader2 className="h-6 w-6 animate-spin mr-2" />
                          <p>Loading file content...</p>
                        </div>
                      ) : (
                        <p className="text-muted-foreground">Select a file from the tree to view its contents</p>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Structure View Tab */}
              <TabsContent value="structure">
                <Card>
                  <CardHeader>
                    <CardTitle>Code Structure</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[calc(100vh-400px)]">
                      {codeStructure ? (
                        <div className="space-y-6">
                          {codeStructure.files.map((file, fileIndex) => (
                            <div key={fileIndex} className="p-4 border rounded-md">
                              <h3 className="text-lg font-medium mb-2">{file.path}</h3>
                              
                              {file.structure.classes.length > 0 && (
                                <div className="mb-4">
                                  <h4 className="text-sm font-semibold mb-1">Classes</h4>
                                  <ul className="space-y-1 ml-4">
                                    {file.structure.classes.map((cls, i) => (
                                      <li key={i} className="text-sm">
                                        {cls.name} <span className="text-muted-foreground text-xs">(Line {cls.lineno}-{cls.end_lineno})</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              
                              {file.structure.functions.length > 0 && (
                                <div className="mb-4">
                                  <h4 className="text-sm font-semibold mb-1">Functions</h4>
                                  <ul className="space-y-1 ml-4">
                                    {file.structure.functions.map((func, i) => (
                                      <li key={i} className="text-sm">
                                        {func.name} <span className="text-muted-foreground text-xs">(Line {func.lineno}-{func.end_lineno})</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              
                              {file.structure.imports.length > 0 && (
                                <div>
                                  <h4 className="text-sm font-semibold mb-1">Imports</h4>
                                  <ul className="space-y-1 ml-4">
                                    {file.structure.imports.map((imp, i) => (
                                      <li key={i} className="text-sm">
                                        {imp.name} <span className="text-muted-foreground text-xs">(Line {imp.lineno})</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground">No structure data available</p>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Graph View Tab */}
              <TabsContent value="graph">
                <Card>
                  <CardHeader>
                    <CardTitle>Code Graph</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[calc(100vh-400px)]">
                      {repoPath ? (
                        <GraphView 
                          repoPath={repoPath}
                          width={800}
                          height={600}
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <p className="text-muted-foreground">No repository path specified</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* History Tab */}
              <TabsContent value="history">
                <Card>
                  <CardHeader>
                    <CardTitle>Change History</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[calc(100vh-400px)]">
                      {fileHistory ? (
                        <div className="space-y-6">
                          <div>
                            <h3 className="font-medium mb-2">New Files ({fileHistory.changes.new.length})</h3>
                            {fileHistory.changes.new.length > 0 ? (
                              <ul className="space-y-1 ml-4 text-green-600">
                                {fileHistory.changes.new.map((file, index) => (
                                  <li key={index} className="text-sm hover:underline cursor-pointer" onClick={() => handleFileSelect(file)}>
                                    {file}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-sm text-muted-foreground ml-4">No new files</p>
                            )}
                          </div>
                          
                          <div>
                            <h3 className="font-medium mb-2">Changed Files ({fileHistory.changes.changed.length})</h3>
                            {fileHistory.changes.changed.length > 0 ? (
                              <ul className="space-y-1 ml-4 text-amber-600">
                                {fileHistory.changes.changed.map((file, index) => (
                                  <li key={index} className="text-sm hover:underline cursor-pointer" onClick={() => handleFileSelect(file)}>
                                    {file}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-sm text-muted-foreground ml-4">No changed files</p>
                            )}
                          </div>
                          
                          <div>
                            <h3 className="font-medium mb-2">Deleted Files ({fileHistory.changes.deleted.length})</h3>
                            {fileHistory.changes.deleted.length > 0 ? (
                              <ul className="space-y-1 ml-4 text-red-600">
                                {fileHistory.changes.deleted.map((file, index) => (
                                  <li key={index} className="text-sm">{file}</li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-sm text-muted-foreground ml-4">No deleted files</p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <p className="text-muted-foreground">No change history available</p>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Documentation Tab */}
              <TabsContent value="documentation">
                <Card>
                  <CardHeader>
                    <CardTitle>Documentation</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedFile ? (
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">
                          {selectedFile}
                        </h3>
                        
                        {documentation[selectedFile] ? (
                          <div className="p-4 bg-muted rounded-md">
                            <div className="flex justify-between items-center mb-2">
                              <h4 className="text-sm font-semibold">Current Documentation</h4>
                              <span className="text-xs text-muted-foreground">
                                Last updated: {new Date(documentation[selectedFile].last_updated).toLocaleString()}
                              </span>
                            </div>
                            <p className="whitespace-pre-wrap">{documentation[selectedFile].content}</p>
                          </div>
                        ) : (
                          <p className="text-muted-foreground mb-4">No documentation available for this file.</p>
                        )}
                        
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold">Add/Update Documentation</h4>
                          <Textarea
                            value={newDocumentation}
                            onChange={(e) => setNewDocumentation(e.target.value)}
                            placeholder="Add documentation for this file..."
                            className="min-h-[150px]"
                          />
                          <Button 
                            onClick={handleSaveDocumentation} 
                            disabled={savingDoc || !newDocumentation.trim()}
                            className="w-full"
                          >
                            {savingDoc ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving...
                              </>
                            ) : 'Save Documentation'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">Select a file to view or add documentation</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Neo4j Database Tab */}
              <TabsContent value="database">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Database className="h-5 w-5 mr-2" />
                        Neo4j Database Explorer
                      </div>
                    </CardTitle>
                    <CardDescription>
                      Query and explore the Neo4j graph database
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {repoPath ? (
                      <Neo4jConsole defaultQuery={`
// Find all nodes related to the current repository
MATCH (n)
WHERE n.repo = "${repoPath}"
RETURN n LIMIT 25`} />
                    ) : (
                      <div className="text-muted-foreground">
                        No repository path specified. Please select a repository.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
} 