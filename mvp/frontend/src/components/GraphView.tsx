import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Loader2, Settings } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { GraphOptions } from './GraphOptions';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface GraphViewProps {
  repoPath: string;
  width?: number;
  height?: number;
  graphData?: GraphData;
}

interface GraphNode {
  id: string;
  label: string;
  type: string;
  properties: Record<string, any>;
  x?: number;
  y?: number;
  z?: number;
  color?: string;
  cluster?: string;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  type: string;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export function GraphView({ repoPath, width = 800, height = 600, graphData: initialGraphData }: GraphViewProps) {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nodeCount, setNodeCount] = useState(0);
  const [linkCount, setLinkCount] = useState(0);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderingStarted, setRenderingStarted] = useState(false);
  const [renderingComplete, setRenderingComplete] = useState(false);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  
  const [options, setOptions] = useState({
    clustering: false,
    clusterBy: 'nodeType',
    is3D: false,
    showLabels: true,
    linkStrength: 30,
    nodeSize: 6,
    colorScheme: 'default',
    layoutAlgorithm: 'forceDirected',
    stabilizationIterations: 300,
    nodeSizeByConnections: false,
    edgeWidthByStrength: false,
    highlightNeighbors: true,
    physics: true,
  });
  
  const [showTypes, setShowTypes] = useState(true);
  const [showImports, setShowImports] = useState(true);
  const [showExports, setShowExports] = useState(true);
  const [showUsages, setShowUsages] = useState(true);
  const [showSvg, setShowSvg] = useState(true);
  
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Color schemes
  const colorSchemes = {
    default: {
      File: '#4CAF50',
      Class: '#2196F3',
      Function: '#FFC107',
      Import: '#9C27B0',
      Unknown: '#607D8B'
    },
    pastel: {
      File: '#A8E6CF',
      Class: '#DCEDC1',
      Function: '#FFD3B6',
      Import: '#FFAAA5',
      Unknown: '#FF8B94'
    },
    vibrant: {
      File: '#FF1744',
      Class: '#2979FF',
      Function: '#00E676',
      Import: '#FFEA00',
      Unknown: '#9C27B0'
    },
    monochrome: {
      File: '#424242',
      Class: '#616161',
      Function: '#757575',
      Import: '#9E9E9E',
      Unknown: '#BDBDBD'
    }
  };

  const getNodeColor = (node: GraphNode) => {
    const scheme = colorSchemes[options.colorScheme as keyof typeof colorSchemes] || colorSchemes.default;
    return scheme[node.type as keyof typeof scheme] || scheme.Unknown;
  };

  useEffect(() => {
    if (initialGraphData) {
      processGraphData(initialGraphData);
    } else {
      fetchGraphData();
    }
  }, [repoPath, initialGraphData]);

  const fetchGraphData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/code-graph?repo_path=${encodeURIComponent(repoPath)}`);
      if (!response.ok) throw new Error('Failed to fetch graph data');
      
      const data = await response.json();
      processGraphData(data);
    } catch (err) {
      console.error('Error fetching graph data:', err);
      setError(err instanceof Error ? err.message : 'An error occurred fetching graph data');
      setLoading(false);
    }
  };

  const processGraphData = (data: any) => {
    // Transform data for the graph
    const transformedData: GraphData = {
      nodes: data.nodes.map((node: GraphNode) => ({
        ...node,
        color: getNodeColor(node)
      })),
      links: data.links.map((link: GraphLink) => ({
        ...link,
        source: link.source.toString(),
        target: link.target.toString()
      }))
    };
    
    setGraphData(transformedData);
    setNodeCount(transformedData.nodes.length);
    setLinkCount(transformedData.links.length);
    setLoading(false);
  };

  // Apply clustering to the graph data
  const applyGraphClustering = (data: GraphData, clusterBy: string) => {
    if (!data) return data;
    
    const nodes = [...data.nodes];
    
    // Assign clusters based on the selected criteria
    nodes.forEach(node => {
      switch(clusterBy) {
        case 'nodeType':
          node.cluster = node.type;
          break;
        case 'directory':
          if (node.properties && node.properties.path) {
            const pathParts = node.properties.path.split('/');
            node.cluster = pathParts.length > 1 ? pathParts[0] : 'root';
          } else {
            node.cluster = 'unknown';
          }
          break;
        case 'fileType':
          if (node.properties && node.properties.path) {
            const extension = node.properties.path.split('.').pop();
            node.cluster = extension || 'unknown';
          } else {
            node.cluster = 'unknown';
          }
          break;
        case 'imports':
          node.cluster = node.type === 'Import' ? 'imports' : 
                         node.type === 'File' ? 'files' : 'code';
          break;
        default:
          node.cluster = 'default';
      }
    });
    
    return { ...data, nodes };
  };

  // Create the force-directed graph when data is available
  useEffect(() => {
    if (!graphData || !svgRef.current) return;
    
    // Apply clustering if needed
    const processedData = options.clustering 
      ? applyGraphClustering(graphData, options.clusterBy) 
      : graphData;
    
    setRenderingStarted(true);
    setRenderProgress(5); // Initialize progress
    
    // Clear any existing SVG content
    d3.select(svgRef.current).selectAll("*").remove();
    
    const svg = d3.select(svgRef.current);
    const container = svg.append("g");
    
    // Set up zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on("zoom", (event: any) => {
        container.attr("transform", event.transform);
      });
    
    svg.call(zoom as any);
    
    // Create a simulation with forces
    setRenderProgress(15);
    
    const simulation = d3.forceSimulation(processedData.nodes as any[])
      .force("link", d3.forceLink(processedData.links)
        .id((d: any) => d.id)
        .distance(100 * (options.linkStrength / 30)))
      .force("charge", d3.forceManyBody().strength(-120))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(options.nodeSize * 1.5));
    
    // Add clustering forces if enabled
    if (options.clustering) {
      const clusters = new Map();
      processedData.nodes.forEach((d: any) => {
        if (!clusters.has(d.cluster)) {
          clusters.set(d.cluster, {
            x: Math.random() * width,
            y: Math.random() * height
          });
        }
      });
      
      // Add cluster centering force
      simulation.force("cluster", (alpha: number) => {
        processedData.nodes.forEach((d: any) => {
          if (d.cluster) {
            const cluster = clusters.get(d.cluster);
            if (cluster) {
              d.vx = (d.vx || 0) + (cluster.x - d.x) * alpha * 0.1;
              d.vy = (d.vy || 0) + (cluster.y - d.y) * alpha * 0.1;
            }
          }
        });
      });
    }
    
    setRenderProgress(25);
    
    // Create links
    const link = container.append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(processedData.links)
      .enter()
      .append("line")
      .attr("stroke", (d: any) => d.type === "IMPORTS" ? "#aaa" : "#999")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", (d: any) => d.type === "CONTAINS" ? 2 : 1);
    
    setRenderProgress(40);
    
    // Create node groups
    const node = container.append("g")
      .attr("class", "nodes")
      .selectAll(".node")
      .data(processedData.nodes)
      .enter()
      .append("g")
      .attr("class", "node")
      .call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended) as any);
    
    setRenderProgress(60);
    
    // Append circles to node groups
    node.append("circle")
      .attr("r", (d: any) => d.type === "File" ? options.nodeSize * 1.5 : options.nodeSize)
      .attr("fill", (d: any) => {
        // Use the appropriate color scheme
        const scheme = colorSchemes[options.colorScheme as keyof typeof colorSchemes] || colorSchemes.default;
        return scheme[d.type as keyof typeof scheme] || scheme.Unknown;
      })
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5);
    
    // Append text labels to node groups if enabled
    if (options.showLabels) {
      node.append("text")
        .attr("dx", options.nodeSize + 5)
        .attr("dy", ".35em")
        .text((d: any) => d.label)
        .style("font-size", "10px")
        .style("fill", "#333")
        .style("pointer-events", "none"); // Prevent text from intercepting mouse events
    }
    
    setRenderProgress(80);
    
    // Create custom tooltips with more detailed information
    const tooltip = d3.select(containerRef.current)
      .append("div")
      .attr("class", "graph-tooltip")
      .style("position", "absolute")
      .style("visibility", "hidden")
      .style("background-color", "white")
      .style("border", "1px solid #ddd")
      .style("border-radius", "4px")
      .style("padding", "10px")
      .style("box-shadow", "0 2px 5px rgba(0,0,0,0.1)")
      .style("pointer-events", "none")
      .style("z-index", "10");
      
    node.on("mouseover", function(this: SVGGElement, event: MouseEvent, d: any) {
      d3.select(this).select("circle")
        .transition()
        .duration(200)
        .attr("r", (d: any) => (d.type === "File" ? options.nodeSize * 1.5 : options.nodeSize) * 1.3);
      
      // Build tooltip content
      const tooltipHtml = `
        <div>
          <div style="font-weight: bold; margin-bottom: 5px;">${d.label}</div>
          <div style="color: #666; font-size: 12px;">Type: ${d.type}</div>
          ${d.properties.path ? `<div style="color: #666; font-size: 12px;">Path: ${d.properties.path}</div>` : ''}
          ${d.cluster ? `<div style="color: #666; font-size: 12px;">Cluster: ${d.cluster}</div>` : ''}
          ${d.properties.line_start ? `<div style="color: #666; font-size: 12px;">Lines: ${d.properties.line_start}-${d.properties.line_end}</div>` : ''}
        </div>
      `;
      
      tooltip
        .html(tooltipHtml)
        .style("visibility", "visible")
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px");
    })
    .on("mousemove", function(event: MouseEvent) {
      tooltip
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px");
    })
    .on("mouseout", function(this: SVGGElement) {
      d3.select(this).select("circle")
        .transition()
        .duration(200)
        .attr("r", (d: any) => d.type === "File" ? options.nodeSize * 1.5 : options.nodeSize);
      
      tooltip.style("visibility", "hidden");
    });
    
    // Update positions on each tick of the simulation
    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);
      
      node
        .attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });
    
    simulation.on("end", () => {
      setRenderProgress(100);
      setRenderingComplete(true);
    });
    
    // Simulate rendering progress if the simulation doesn't end quickly
    const progressInterval = setInterval(() => {
      setRenderProgress(prev => {
        if (prev >= 95) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + 1;
      });
    }, 100);
    
    // Drag functions
    function dragstarted(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }
    
    function dragged(event: any, d: any) {
      d.fx = event.x;
      d.fy = event.y;
    }
    
    function dragended(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }
    
    // Clean up function
    return () => {
      simulation.stop();
      clearInterval(progressInterval);
      tooltip.remove();
    };
  }, [graphData, width, height, options]);

  const handleOptionsChange = (newOptions: any) => {
    setOptions(newOptions);
    setRenderingComplete(false);
    setRenderingStarted(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="flex flex-col items-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading graph data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-md">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (!graphData || graphData.nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
        <p className="text-muted-foreground">No code graph data available</p>
        <p className="text-sm text-muted-foreground mt-2">
          Try indexing the repository first
        </p>
      </div>
    );
  }

  // Group nodes by type
  const nodesByType: Record<string, number> = {};
  graphData.nodes.forEach(node => {
    nodesByType[node.type] = (nodesByType[node.type] || 0) + 1;
  });

  return (
    <div className="p-4 border rounded-md" ref={containerRef}>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-semibold mb-2">Code Graph Statistics</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-muted rounded-md">
              <div className="text-2xl font-bold">{nodeCount}</div>
              <div className="text-sm text-muted-foreground">Total Nodes</div>
            </div>
            <div className="p-4 bg-muted rounded-md">
              <div className="text-2xl font-bold">{linkCount}</div>
              <div className="text-sm text-muted-foreground">Total Relationships</div>
            </div>
          </div>
        </div>
        
        <Button 
          variant="outline" 
          className="gap-2"
          onClick={() => setIsOptionsOpen(!isOptionsOpen)}
        >
          <Settings className="h-4 w-4" />
          Visualization Options
        </Button>
      </div>

      {isOptionsOpen && (
        <div className="mb-6 p-4 border rounded-md bg-background">
          <h3 className="text-lg font-semibold mb-4">Graph Options</h3>
          <GraphOptions 
            options={options} 
            onOptionsChange={handleOptionsChange}
            showTypes={showTypes}
            setShowTypes={setShowTypes}
            showImports={showImports}
            setShowImports={setShowImports}
            showExports={showExports}
            setShowExports={setShowExports}
            showUsages={showUsages}
            setShowUsages={setShowUsages}
            showSvg={showSvg}
            setShowSvg={setShowSvg}
          />
        </div>
      )}

      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Node Types</h3>
        <div className="space-y-2">
          {Object.entries(nodesByType).map(([type, count]) => (
            <div key={type} className="flex items-center">
              <div 
                className="w-3 h-3 rounded-full mr-2"
                style={{ 
                  backgroundColor: colorSchemes[options.colorScheme as keyof typeof colorSchemes]?.[type as keyof typeof colorSchemes.default] || 
                                   colorSchemes.default.Unknown 
                }}
              ></div>
              <span className="flex-1">{type}</span>
              <span className="font-semibold">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {renderingStarted && !renderingComplete && (
        <div className="mt-4 mb-6">
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium">Rendering graph...</span>
            <span className="text-sm text-muted-foreground">{renderProgress}%</span>
          </div>
          <Progress value={renderProgress} className="h-2" />
        </div>
      )}

      <div className="relative bg-muted rounded-md overflow-hidden" style={{ height: `${height}px` }}>
        {!renderingComplete && renderingStarted && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
            <div className="flex flex-col items-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
              <p className="text-sm">Optimizing graph layout ({renderProgress}%)</p>
            </div>
          </div>
        )}
        <svg 
          ref={svgRef} 
          width="100%" 
          height="100%" 
          viewBox={`0 0 ${width} ${height}`}
          className="rounded-md"
        ></svg>
      </div>
      
      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <p>Drag nodes to reposition. Scroll to zoom in/out.</p>
        
        <div className="flex items-center">
          {options.clustering && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center mr-4">
                    <div className="w-3 h-3 rounded-full bg-primary mr-2"></div>
                    <span>Clustering by: {options.clusterBy}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Nodes are grouped by {options.clusterBy}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-secondary mr-2"></div>
                  <span>Color scheme: {options.colorScheme}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Using {options.colorScheme} color scheme</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
} 