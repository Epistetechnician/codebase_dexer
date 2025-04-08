import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';

export interface GraphOptionsProps {
  options: {
    clustering: boolean;
    clusterBy: string;
    is3D: boolean;
    showLabels: boolean;
    linkStrength: number;
    nodeSize: number;
    colorScheme: string;
    layoutAlgorithm: string;
    stabilizationIterations: number;
    nodeSizeByConnections: boolean;
    edgeWidthByStrength: boolean;
    highlightNeighbors: boolean;
    physics: boolean;
  };
  onOptionsChange: (newOptions: any) => void;
  showTypes: boolean;
  setShowTypes: React.Dispatch<React.SetStateAction<boolean>>;
  showImports: boolean;
  setShowImports: React.Dispatch<React.SetStateAction<boolean>>;
  showExports: boolean;
  setShowExports: React.Dispatch<React.SetStateAction<boolean>>;
  showUsages: boolean;
  setShowUsages: React.Dispatch<React.SetStateAction<boolean>>;
  showSvg: boolean;
  setShowSvg: React.Dispatch<React.SetStateAction<boolean>>;
}

const clusterByOptions = [
  { label: 'File Type', value: 'fileType' },
  { label: 'Directory', value: 'directory' },
  { label: 'Node Type', value: 'nodeType' },
  { label: 'Imports', value: 'imports' },
  { label: 'Package', value: 'package' },
  { label: 'Namespace', value: 'namespace' },
];

const colorSchemes = [
  { label: 'Default', value: 'default' },
  { label: 'Pastel', value: 'pastel' },
  { label: 'Vibrant', value: 'vibrant' },
  { label: 'Monochrome', value: 'monochrome' },
  { label: 'Neo4j', value: 'neo4j' },
];

const layoutAlgorithms = [
  { label: 'Force-Directed', value: 'forceDirected' },
  { label: 'Hierarchical', value: 'hierarchical' },
  { label: 'Circular', value: 'circular' },
  { label: 'Grid', value: 'grid' },
];

export function GraphOptions({
  options,
  onOptionsChange,
  showTypes,
  setShowTypes,
  showImports,
  setShowImports,
  showExports,
  setShowExports,
  showUsages,
  setShowUsages,
  showSvg,
  setShowSvg,
}: GraphOptionsProps) {
  const handleChange = (key: string, value: string | number | boolean) => {
    onOptionsChange({ ...options, [key]: value });
  };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Graph Display</CardTitle>
          <CardDescription>Configure how the graph is displayed</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Accordion type="single" collapsible>
            <AccordionItem value="layout">
              <AccordionTrigger>Layout Algorithm</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-2">
                  <Select
                    value={options.layoutAlgorithm}
                    onValueChange={(value: string) => handleChange('layoutAlgorithm', value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select layout algorithm" />
                    </SelectTrigger>
                    <SelectContent>
                      {layoutAlgorithms.map((algorithm) => (
                        <SelectItem key={algorithm.value} value={algorithm.value}>
                          {algorithm.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label htmlFor="physics" className="text-sm font-medium">
                        Physics Simulation
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Enable physics engine for dynamic layouts
                      </p>
                    </div>
                    <Switch
                      id="physics"
                      checked={options.physics}
                      onCheckedChange={(checked) => handleChange('physics', checked)}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="stabilization" className="text-sm font-medium">
                        Stabilization Iterations
                      </Label>
                      <span className="text-xs text-muted-foreground">
                        {options.stabilizationIterations}
                      </span>
                    </div>
                    <Slider
                      id="stabilization"
                      min={0}
                      max={1000}
                      step={10}
                      value={[options.stabilizationIterations]}
                      onValueChange={(value) => handleChange('stabilizationIterations', value[0])}
                    />
                    <p className="text-xs text-muted-foreground">
                      Higher values make the layout more stable but slower
                    </p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="nodes">
              <AccordionTrigger>Nodes & Edges</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Node Size</Label>
                      <span className="text-xs text-muted-foreground">{options.nodeSize}</span>
                    </div>
                    <Slider
                      min={1}
                      max={15}
                      step={1}
                      value={[options.nodeSize]}
                      onValueChange={(value) => handleChange('nodeSize', value[0])}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium">Size by Connections</Label>
                      <p className="text-xs text-muted-foreground">
                        Make connected nodes larger
                      </p>
                    </div>
                    <Switch
                      checked={options.nodeSizeByConnections}
                      onCheckedChange={(checked) => handleChange('nodeSizeByConnections', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium">Show Labels</Label>
                      <p className="text-xs text-muted-foreground">
                        Display node names in the graph
                      </p>
                    </div>
                    <Switch
                      checked={options.showLabels}
                      onCheckedChange={(checked) => handleChange('showLabels', checked)}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Link Strength</Label>
                      <span className="text-xs text-muted-foreground">{options.linkStrength}</span>
                    </div>
                    <Slider
                      min={10}
                      max={100}
                      step={5}
                      value={[options.linkStrength]}
                      onValueChange={(value) => handleChange('linkStrength', value[0])}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium">Edge Width by Strength</Label>
                      <p className="text-xs text-muted-foreground">
                        Vary edge width based on relationship strength
                      </p>
                    </div>
                    <Switch
                      checked={options.edgeWidthByStrength}
                      onCheckedChange={(checked) => handleChange('edgeWidthByStrength', checked)}
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="visuals">
              <AccordionTrigger>Visual Styling</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Color Scheme</Label>
                    <Select
                      value={options.colorScheme}
                      onValueChange={(value: string) => handleChange('colorScheme', value)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select color scheme" />
                      </SelectTrigger>
                      <SelectContent>
                        {colorSchemes.map((scheme) => (
                          <SelectItem key={scheme.value} value={scheme.value}>
                            {scheme.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium">3D Visualization</Label>
                      <p className="text-xs text-muted-foreground">
                        Enable 3D graph view
                      </p>
                    </div>
                    <Switch
                      checked={options.is3D}
                      onCheckedChange={(checked) => handleChange('is3D', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium">Highlight Neighbors</Label>
                      <p className="text-xs text-muted-foreground">
                        Highlight connected nodes on hover
                      </p>
                    </div>
                    <Switch
                      checked={options.highlightNeighbors}
                      onCheckedChange={(checked) => handleChange('highlightNeighbors', checked)}
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="clustering">
              <AccordionTrigger>Clustering & Grouping</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium">Enable Clustering</Label>
                      <p className="text-xs text-muted-foreground">
                        Group related nodes together
                      </p>
                    </div>
                    <Switch
                      checked={options.clustering}
                      onCheckedChange={(checked) => handleChange('clustering', checked)}
                    />
                  </div>

                  {options.clustering && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Cluster By</Label>
                      <Select
                        value={options.clusterBy}
                        onValueChange={(value: string) => handleChange('clusterBy', value)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select clustering option" />
                        </SelectTrigger>
                        <SelectContent>
                          {clusterByOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Node Filters</CardTitle>
          <CardDescription>Control which nodes are displayed</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Show Type Nodes</Label>
            <Switch
              checked={showTypes}
              onCheckedChange={setShowTypes}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Show Import Relationships</Label>
            <Switch
              checked={showImports}
              onCheckedChange={setShowImports}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Show Export Relationships</Label>
            <Switch
              checked={showExports}
              onCheckedChange={setShowExports}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Show Usage Relationships</Label>
            <Switch
              checked={showUsages}
              onCheckedChange={setShowUsages}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">SVG Renderer</Label>
            <Switch
              checked={showSvg}
              onCheckedChange={setShowSvg}
            />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <div className="text-sm font-medium">Relationship Legend</div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="bg-blue-50">IMPORTS</Badge>
          <Badge variant="outline" className="bg-green-50">CONTAINS</Badge>
          <Badge variant="outline" className="bg-amber-50">EXTENDS</Badge>
          <Badge variant="outline" className="bg-purple-50">CALLS</Badge>
          <Badge variant="outline" className="bg-red-50">DEPENDS_ON</Badge>
        </div>
      </div>
    </div>
  );
} 