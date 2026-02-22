
import React, { useState, useCallback, useRef, useMemo } from 'react';
import ReactFlow, {
    ReactFlowProvider,
    addEdge,
    useNodesState,
    useEdgesState,
    Controls,
    Background,
    MiniMap,
    Connection,
    Edge,
    Node,
    MarkerType,
    NodeMouseHandler,
    Handle,
    Position,
    NodeProps,
    ConnectionMode,
    useReactFlow,
    ReactFlowInstance
} from 'reactflow';
import dagre from 'dagre';
import { NodeResizer } from '@reactflow/node-resizer';
import '@reactflow/node-resizer/dist/style.css';
import 'reactflow/dist/style.css';
import { X, Plus, Wand2, Save, Download, Trash2, FileText } from 'lucide-react';
import { Chat } from "../lib/openrouter";
import { parseJsonFromText } from '../lib/utils';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// Custom Node Style
const defaultNodeStyle: React.CSSProperties = {
    background: '#171717',
    color: '#fff',
    border: '1px solid #3f3f46',
    borderRadius: '12px',
    padding: '10px',
    fontSize: '14px',
    minWidth: '180px',
    minHeight: '80px',
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
};

const EditableNode = ({ data, selected }: NodeProps) => {
    return (
        <>
            <NodeResizer
                isVisible={selected}
                minWidth={180}
                minHeight={80}
                lineStyle={{ border: '1px solid #6366f1' }}
                handleStyle={{ width: 8, height: 8, borderRadius: 4 }}
            />
            <div style={defaultNodeStyle}>
                {/* Universal Handles (Source type + Loose mode = Input & Output) */}
                <Handle type="source" position={Position.Top} id="top" className="!bg-neutral-500" />
                <Handle type="source" position={Position.Bottom} id="bottom" className="!bg-neutral-500" />
                <Handle type="source" position={Position.Left} id="left" className="!bg-neutral-500" />
                <Handle type="source" position={Position.Right} id="right" className="!bg-neutral-500" />

                <textarea
                    className="w-full h-full bg-transparent border-none text-white focus:outline-none resize-none text-sm font-medium nodrag cursor-text"
                    defaultValue={data.label}
                    placeholder="Type here..."
                    onChange={(evt) => {
                        data.label = evt.target.value;
                    }}
                    onKeyDown={(e) => e.stopPropagation()}
                    style={{ flex: 1, zIndex: 10, position: 'relative' }}
                />
            </div>
        </>
    );
};

interface NotesInterfaceProps {
    onClose: () => void;
    chatSession?: Chat | null;
    currentContext?: string; // The conversation context to generate notes from
}

export function NotesInterface({ onClose, chatSession, currentContext }: NotesInterfaceProps) {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const nodeTypes = useMemo(() => ({ editableNode: EditableNode }), []);
    const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);

    const onPaneClick = useCallback((event: React.MouseEvent) => {
        // handle pane click if needed
    }, []);

    const onPaneContextMenu = useCallback((event: React.MouseEvent) => {
        event.preventDefault();

        // Calculate position relative to the pane
        // This is a simplification; for production, use project/screenToFlowPosition
        const bounds = reactFlowWrapper.current?.getBoundingClientRect();
        if (!bounds) return;

        // We need to project screen coordinates to flow coordinates
        // Since we don't have the instance easily here, we'll try a basic offset
        // But better to use the wrapper relative position for now as a rough estimate
        // If we want precise positioning, we need useReactFlow() hook inside a child component
        // For now, let's just place it near mouse

        // NOTE: Ideally we should use reactFlowInstance.project({ x: event.clientX, y: event.clientY })
        // But we need to move this logic inside a component wrapped with ReactFlowProvider to use useReactFlow

        // fallback: random or center if we can't project easily without restructuring
        // Actually, we can just use the mouse event offset relative to the wrapper for now 
        // OR better: use the existing handleAddNode but pass position

        const position = {
            x: event.clientX - bounds.left - 100, // naive offset
            y: event.clientY - bounds.top - 50
        };

        const id = `node-${Date.now()}`;
        const newNode: Node = {
            id,
            position,
            data: { label: 'New Note' },
            type: 'editableNode',
        };
        setNodes((nds) => [...nds, newNode]);
    }, [setNodes]);



    const onConnect = useCallback(
        (params: Connection | Edge) => setEdges((eds) => addEdge({ ...params, type: 'smoothstep', animated: true }, eds)),
        [setEdges]
    );

    const handleAddNode = () => {
        const id = `node-${Date.now()}`;
        const newNode: Node = {
            id,
            position: { x: Math.random() * 400, y: Math.random() * 400 },
            data: { label: 'New Note' },
            type: 'editableNode',
        };
        setNodes((nds) => [...nds, newNode]);
    };

    const handleGenerateAI = async () => {
        if (!chatSession || !currentContext) return;

        setIsGenerating(true);
        try {
            const prompt = `Based on our conversation so far, create a concept map/flowchart summarizing the key learning points.
            Return ONLY a JSON object with this structure:
            {
                "nodes": [
                    { "id": "1", "label": "Main Topic", "type": "input" },
                    { "id": "2", "label": "Subconcept A" }
                ],
                "edges": [
                    { "source": "1", "target": "2", "label": "includes" }
                ]
            }
            Make sure the layout is somewhat logical (e.g. main topic at top).`;

            const result = await chatSession.sendMessage({ message: prompt });
            // @ts-ignore - Usage varies in codebase, checking result.text
            const text = result.text || result.response?.text() || "";
            const data = parseJsonFromText(text);

            if (data && data.nodes) {
                // Create Dagre graph for layout
                const g = new dagre.graphlib.Graph();
                g.setGraph({ rankdir: 'TB', nodesep: 50, ranksep: 100 });
                g.setDefaultEdgeLabel(() => ({}));

                // Add nodes to graph
                data.nodes.forEach((n: any, i: number) => {
                    // Estimate width/height based on defaultNodeStyle
                    g.setNode(n.id || `ai-node-${i}`, { width: 200, height: 100 });
                });

                // Add edges to graph
                data.edges.forEach((e: any) => {
                    g.setEdge(e.source, e.target);
                });

                // Calculate layout
                dagre.layout(g);

                const newNodes = data.nodes.map((n: any, i: number) => {
                    // Get position from Dagre
                    const nodeId = n.id || `ai-node-${i}`;
                    const nodePos = g.node(nodeId);

                    return {
                        id: nodeId,
                        position: {
                            x: nodePos ? nodePos.x - 100 : 250 + (i % 3) * 200, // Center based on width 
                            y: nodePos ? nodePos.y - 50 : 100 + Math.floor(i / 3) * 150
                        },
                        data: { label: n.label },
                        type: 'editableNode'
                    };
                });

                const newEdges = data.edges.map((e: any, i: number) => ({
                    id: `ai-edge-${i}`,
                    source: e.source,
                    target: e.target,
                    label: e.label,
                    type: 'smoothstep',
                    animated: true,
                    markerEnd: { type: MarkerType.ArrowClosed },
                    style: { stroke: '#71717a' }
                }));

                setNodes(newNodes);
                setEdges(newEdges);
            }

        } catch (error) {
            console.error("Failed to generate notes:", error);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownloadPDF = async () => {
        if (!reactFlowWrapper.current || !rfInstance) return;

        // Fit view to ensure all nodes are visible
        rfInstance.fitView({ padding: 0.2, duration: 0 });

        // Wait a tiny bit for the renderer to update (even with duration 0, just to be safe)
        await new Promise(resolve => setTimeout(resolve, 100));

        try {
            // Find the React Flow viewport
            const flowElement = reactFlowWrapper.current.querySelector('.react-flow__viewport') as HTMLElement;
            if (!flowElement) return;

            // Get the bounding rect of the flow wrapper to set correct canvas size
            const { width, height } = reactFlowWrapper.current.getBoundingClientRect();

            // Capture the element
            // We capture the wrapper, not just viewport, to get the background color correctly
            const canvas = await html2canvas(reactFlowWrapper.current, {
                backgroundColor: '#171717',
                width: width,
                height: height,
                ignoreElements: (element) => {
                    return element.classList.contains('react-flow__controls') ||
                        element.classList.contains('react-flow__minimap') ||
                        element.classList.contains('react-flow__panel');
                }
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'px',
                format: [width, height]
            });

            pdf.addImage(imgData, 'PNG', 0, 0, width, height);
            pdf.save('smart-notes.pdf');

        } catch (error) {
            console.error("Failed to download PDF:", error);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex flex-col animate-in fade-in duration-300">
            {/* Toolbar */}
            <div className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-neutral-900">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-white font-bold text-lg">
                        <FileText className="text-indigo-400" />
                        <span>Smart Notes</span>
                    </div>
                    <div className="h-6 w-px bg-white/10 mx-2" />
                    <button
                        onClick={handleAddNode}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white text-sm font-medium transition-colors"
                    >
                        <Plus size={16} /> Add Note
                    </button>
                    <button
                        onClick={() => setNodes([])}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-red-900/50 text-neutral-300 hover:text-red-200 text-sm font-medium transition-colors"
                    >
                        <Trash2 size={16} /> Clear
                    </button>
                    <button
                        onClick={handleDownloadPDF}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white text-sm font-medium transition-colors"
                    >
                        <Download size={16} /> Save PDF
                    </button>
                    {chatSession && (
                        <button
                            onClick={handleGenerateAI}
                            disabled={isGenerating}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-bold transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
                        >
                            <Wand2 size={16} className={isGenerating ? "animate-spin" : ""} />
                            {isGenerating ? "Generating..." : "Create with AI"}
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>
            </div>

            {/* Canvas */}
            <div className="flex-1 w-full h-full bg-neutral-950 relative" ref={reactFlowWrapper}>
                <ReactFlowProvider>
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        fitView
                        className="bg-neutral-950"
                        nodeTypes={nodeTypes}
                        connectionMode={ConnectionMode.Loose}
                        onInit={setRfInstance}
                    >
                        <Background color="#333" gap={20} size={1} />
                        <Controls className="bg-neutral-800 border-white/10 fill-white text-white" />
                        <MiniMap
                            nodeColor="#404040"
                            maskColor="rgba(0,0,0, 0.6)"
                            style={{ backgroundColor: '#171717', border: '1px solid #333' }}
                        />
                        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} onContextMenu={onPaneContextMenu} />
                    </ReactFlow>
                </ReactFlowProvider>

                {nodes.length === 0 && !isGenerating && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="text-center text-neutral-500">
                            <p className="text-lg font-medium mb-2">Canvas is empty</p>
                            <p className="text-sm">Add a note or ask AI to generate a map from your chat.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
