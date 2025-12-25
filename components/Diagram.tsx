import React, { useMemo, useEffect } from 'react';
import ReactFlow, {
    Handle,
    Position,
    useNodesState,
    useEdgesState,
    Background,
    Controls,
    MarkerType,
    Node,
    Edge
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import { cn } from '../lib/utils';
import { Maximize2 } from 'lucide-react';

interface DiagramProps {
    data: {
        title?: string;
        nodes: { id: string; label: string; type?: string }[];
        edges: { id: string; source: string; target: string; label?: string }[];
    };
    onNodeClick?: (label: string) => void;
}

const nodeWidth = 220;
const nodeHeight = 70;

// Auto Layout function using Dagre
const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    // Increased node separation for a clearer vertical hierarchy
    dagreGraph.setGraph({ rankdir: 'LR', nodesep: 40, ranksep: 120 });

    nodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    nodes.forEach((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        node.position = {
            x: nodeWithPosition.x - nodeWidth / 2,
            y: nodeWithPosition.y - nodeHeight / 2,
        };
        return node;
    });

    return { nodes, edges };
};

// Custom Node Component (Monochrome)
const CustomNode = ({ data }: any) => {
    // Determine styles based on internal type found in data payload
    const isMain = data.type === 'main';
    const isPhase = data.type === 'phase';

    return (
        <div className={cn(
            "px-6 py-4 rounded-xl border min-w-[200px] text-center relative group transition-all duration-300 hover:-translate-y-1",
            isMain ? "bg-white text-black border-white shadow-[0_0_30px_rgba(255,255,255,0.3)] scale-110" :
                isPhase ? "bg-neutral-900 border-white/40 shadow-[0_0_20px_rgba(0,0,0,0.5)]" :
                    "bg-neutral-950 border-white/10 opacity-80 hover:opacity-100 hover:border-white/40"
        )}>
            <Handle type="target" position={Position.Left} className={cn("!w-3 !h-3 !-left-1.5 transition-all !border-4 !border-neutral-900", isMain ? "!bg-black" : "!bg-white")} />

            <div className="flex items-center justify-center gap-3">
                {!isMain && <div className={cn("w-2 h-2 rounded-full transition-colors", isPhase ? "bg-white" : "bg-neutral-600 group-hover:bg-white")} />}
                <div className={cn("font-bold transition-colors text-sm tracking-wide", isMain ? "text-black" : "text-neutral-300 group-hover:text-white")}>{data.label}</div>
            </div>

            <Handle type="source" position={Position.Right} className={cn("!w-3 !h-3 !-right-1.5 transition-all !border-4 !border-neutral-900", isMain ? "!bg-black" : "!bg-white")} />
        </div>
    );
};

export function Diagram({ data, onNodeClick }: DiagramProps) {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    const nodeTypes = useMemo(() => ({ custom: CustomNode }), []);

    useEffect(() => {
        if (!data) return;

        // Transform simplified data to ReactFlow format
        const initialNodes: Node[] = data.nodes.map(n => ({
            id: n.id,
            type: 'custom',
            data: { label: n.label },
            position: { x: 0, y: 0 } // Position calculated by dagre
        }));

        const initialEdges: Edge[] = data.edges.map(e => ({
            id: e.id,
            source: e.source,
            target: e.target,
            label: e.label,
            type: 'smoothstep',
            animated: true,
            style: { stroke: '#ffffff', strokeWidth: 2, opacity: 0.3 },
            markerEnd: {
                type: MarkerType.ArrowClosed,
                color: '#ffffff',
            },
        }));

        const layouted = getLayoutedElements(initialNodes, initialEdges);
        setNodes(layouted.nodes);
        setEdges(layouted.edges);
    }, [data, setNodes, setEdges]);

    const handleNodeClick = (_: React.MouseEvent, node: Node) => {
        if (onNodeClick && node.data?.label) {
            onNodeClick(node.data.label);
        }
    };

    if (!data) return null;

    return (
        <div className="w-full h-[600px] mt-6 bg-black/40 border border-white/10 rounded-3xl overflow-hidden relative shadow-2xl animate-in fade-in zoom-in-95 duration-700">
            {data.title && (
                <div className="absolute top-4 left-4 z-10 bg-neutral-900/80 backdrop-blur border border-white/10 px-4 py-2 rounded-xl">
                    <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-widest">{data.title}</h3>
                </div>
            )}

            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                onNodeClick={handleNodeClick}
                fitView
                className="bg-transparent"
                minZoom={0.5}
                maxZoom={2}
                attributionPosition="bottom-right"
            >
                <Background color="#6366f1" gap={40} size={1} className="opacity-5" />
                <Controls className="bg-neutral-800 border-white/10 fill-white text-white rounded-lg overflow-hidden" showInteractive={false} />
            </ReactFlow>

            <div className="absolute bottom-4 left-4 pointer-events-none text-[10px] text-neutral-600 font-mono tracking-widest">
                NEURAL_MAP // v1.0
            </div>
        </div>
    );
}