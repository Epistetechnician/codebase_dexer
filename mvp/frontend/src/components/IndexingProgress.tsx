import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';

interface IndexingProgressProps {
  repoPath: string;
  onComplete: () => void;
}

interface IndexingStatus {
  current_file?: string;
  total_files: number;
  processed_files: number;
  completed?: boolean;
  error?: string;
}

export function IndexingProgress({ repoPath, onComplete }: IndexingProgressProps) {
  const [status, setStatus] = useState<IndexingStatus>({
    total_files: 0,
    processed_files: 0
  });
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const eventSource = new EventSource(`/api/indexing-status?repo_path=${encodeURIComponent(repoPath)}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.error) {
          setError(data.error);
          eventSource.close();
          return;
        }
        
        setStatus(data);
        
        if (data.current_file) {
          setLogs(prev => [`Processing: ${data.current_file}`, ...prev].slice(0, 50));
        }

        if (data.completed) {
          setLogs(prev => ['Indexing complete!', ...prev]);
          eventSource.close();
          // Add a small delay before transitioning to give user time to see completion
          setTimeout(onComplete, 1500);
        }
      } catch (error) {
        console.error('Error parsing event data:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('EventSource failed:', error);
      setError('Connection to indexing status failed. Please try again.');
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [repoPath, onComplete]);

  const progress = status.total_files > 0
    ? (status.processed_files / status.total_files) * 100
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Indexing Progress</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Progress value={progress} />
          <p className="text-sm text-muted-foreground">
            {status.processed_files} of {status.total_files} files processed
          </p>
        </div>

        {error ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        ) : (
          <div className="space-y-2">
            <h3 className="font-medium">Recent Activity</h3>
            <ScrollArea className="h-[200px] rounded-md border p-4">
              <div className="space-y-2">
                {logs.map((log, index) => (
                  <p key={index} className="text-sm">
                    {log}
                  </p>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 