import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Play, Database, Check, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface Neo4jConsoleProps {
  defaultQuery?: string;
}

export function Neo4jConsole({ defaultQuery = "MATCH (n) RETURN n LIMIT 10" }: Neo4jConsoleProps) {
  const [query, setQuery] = useState<string>(defaultQuery);
  const [executing, setExecuting] = useState<boolean>(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("query");
  
  const executeQuery = async () => {
    setExecuting(true);
    setError(null);
    setResults(null);
    
    try {
      const response = await fetch('/api/neo4j-query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          query,
          params: {}
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to execute query');
      }
      
      setResults(data);
      setActiveTab("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setExecuting(false);
    }
  };

  // Helper function to format data for display
  const formatValue = (value: any): string => {
    if (value === null) return 'null';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Neo4j Query Console
        </CardTitle>
        <CardDescription>
          Execute Cypher queries against the Neo4j database
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="query">Query Editor</TabsTrigger>
            <TabsTrigger value="results" disabled={!results}>Results</TabsTrigger>
          </TabsList>
          <TabsContent value="query" className="pt-4">
            <Textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter your Cypher query here..."
              className="font-mono min-h-[200px]"
              disabled={executing}
            />
            
            {error && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </TabsContent>
          
          <TabsContent value="results" className="pt-4">
            {results && (
              <div>
                <div className="mb-4 flex items-center">
                  <Check className="h-5 w-5 text-green-500 mr-2" />
                  <span>
                    Query executed successfully. Found {results.records.length} records.
                    (Executed in {results.summary.query_time}ms)
                  </span>
                </div>
                
                {results.records.length > 0 ? (
                  <div className="border rounded-md overflow-auto max-h-[400px]">
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr>
                          {Object.keys(results.records[0]).map((key) => (
                            <th key={key} className="px-4 py-2 text-left font-medium text-muted-foreground">
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {results.records.map((record: any, i: number) => (
                          <tr key={i} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                            {Object.values(record).map((value: any, j: number) => (
                              <td key={j} className="px-4 py-2 align-top">
                                <pre className="text-xs overflow-auto max-w-xs max-h-32">
                                  {formatValue(value)}
                                </pre>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-muted-foreground">No records returned</div>
                )}
                
                <div className="mt-4">
                  <p className="text-sm text-muted-foreground">Counters:</p>
                  <pre className="text-xs bg-muted/20 p-2 rounded-md overflow-auto mt-1">
                    {JSON.stringify(results.summary.counters, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter>
        <Button 
          onClick={executeQuery} 
          disabled={!query.trim() || executing}
          className="gap-2"
        >
          {executing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Executing...
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Execute Query
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
} 