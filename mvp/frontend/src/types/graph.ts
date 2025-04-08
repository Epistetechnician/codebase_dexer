export interface GraphNode {
    id: string;
    properties: {
        name: string;
        type: string;
        file_path?: string;
        start_line?: number;
        end_line?: number;
    };
}

export interface GraphLink {
    source: string;
    target: string;
    type: string;
}

export interface GraphData {
    nodes: GraphNode[];
    relationships: GraphLink[];
} 