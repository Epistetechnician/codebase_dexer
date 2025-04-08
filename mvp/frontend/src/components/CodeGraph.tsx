import { type FC } from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface GraphNode {
  id: string;
  properties: {
    name: string;
    type: string;
  };
}

interface GraphLink {
  source: string;
  target: string;
  type: string;
}

interface GraphData {
  nodes: GraphNode[];
  relationships: GraphLink[];
}

interface CodeGraphProps {
  data: GraphData;
  onNodeClick?: (nodeId: string) => void;
}

export const CodeGraph: FC<CodeGraphProps> = ({ data, onNodeClick }) => {
  // For now, just render a placeholder since we haven't implemented the graph visualization yet
  return (
    <Card className="w-full h-full">
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-medium">Nodes ({data.nodes.length})</h3>
            <div className="space-y-1">
              {data.nodes.map((node) => (
                <div
                  key={node.id}
                  className="p-2 hover:bg-accent rounded-md cursor-pointer"
                  onClick={() => onNodeClick?.(node.id)}
                >
                  <p className="text-sm">
                    {node.properties.name} ({node.properties.type})
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-medium">Relationships ({data.relationships.length})</h3>
            <div className="space-y-1">
              {data.relationships.map((rel, index) => (
                <div key={index} className="p-2 hover:bg-accent rounded-md">
                  <p className="text-sm">
                    {rel.source} → {rel.target} ({rel.type})
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
