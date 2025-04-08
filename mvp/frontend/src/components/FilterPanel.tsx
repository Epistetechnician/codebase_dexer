import React from 'react';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Check } from 'lucide-react';

interface FilterPanelProps {
    searchTerm: string;
    onSearchChange: (value: string) => void;
    nodeTypes: string[];
    selectedTypes: string[];
    onTypeToggle: (type: string) => void;
    relationshipTypes: string[];
    selectedRelationships: string[];
    onRelationshipToggle: (type: string) => void;
    selectedNodeId: string | null;
    nodeDetails: any | null;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
    searchTerm,
    onSearchChange,
    nodeTypes,
    selectedTypes,
    onTypeToggle,
    relationshipTypes,
    selectedRelationships,
    onRelationshipToggle,
    selectedNodeId,
    nodeDetails,
}) => {
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Search & Filters</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Input
                        placeholder="Search nodes..."
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e.target.value)}
                    />

                    <div>
                        <h3 className="font-medium mb-2">Node Types</h3>
                        <div className="grid grid-cols-2 gap-2">
                            {nodeTypes.map((type) => (
                                <Button
                                    key={type}
                                    variant={selectedTypes.includes(type) ? "default" : "outline"}
                                    size="sm"
                                    className="justify-start"
                                    onClick={() => onTypeToggle(type)}
                                >
                                    {selectedTypes.includes(type) && (
                                        <Check className="mr-2 h-4 w-4" />
                                    )}
                                    {type}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <h3 className="font-medium mb-2">Relationship Types</h3>
                        <div className="grid grid-cols-2 gap-2">
                            {relationshipTypes.map((type) => (
                                <Button
                                    key={type}
                                    variant={selectedRelationships.includes(type) ? "default" : "outline"}
                                    size="sm"
                                    className="justify-start"
                                    onClick={() => onRelationshipToggle(type)}
                                >
                                    {selectedRelationships.includes(type) && (
                                        <Check className="mr-2 h-4 w-4" />
                                    )}
                                    {type}
                                </Button>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {selectedNodeId && nodeDetails && (
                <Card>
                    <CardHeader>
                        <CardTitle>Node Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div>
                            <span className="font-medium">Name:</span>{' '}
                            <span className="text-muted-foreground">{nodeDetails.name}</span>
                        </div>
                        <div>
                            <span className="font-medium">Type:</span>{' '}
                            <span className="text-muted-foreground">{nodeDetails.type}</span>
                        </div>
                        <div>
                            <span className="font-medium">File:</span>{' '}
                            <span className="text-muted-foreground">{nodeDetails.file_path}</span>
                        </div>
                        <div>
                            <span className="font-medium">Lines:</span>{' '}
                            <span className="text-muted-foreground">
                                {nodeDetails.start_line} - {nodeDetails.end_line}
                            </span>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}; 