import React, { useState, useEffect, useRef } from 'react';
import { CouncilEngine } from '../../lib/council/Engine';
import { AgentConfig, CouncilMessage } from '../../lib/council/types';
import { cn } from '../../lib/utils';
import { BrainCircuit, Play, Pause, FileText, ChevronRight, Scale, Gavel, X, Minus } from 'lucide-react';
import { marked } from 'marked';
import mermaid from 'mermaid';

interface Props {
    topic: string;
    context: string;
    initialAgents: AgentConfig[];
    onClose: () => void;
    userProfile: any; // Passed from App -> Setup -> Interface
}

export function CouncilInterface({ topic, context, initialAgents, onClose, userProfile }: Props) {
    const [engine] = useState(() => new CouncilEngine(import.meta.env.VITE_COUNCIL_API_KEY || import.meta.env.VITE_GEMINI_API_KEY || ''));
    const [isDebating, setIsDebating] = useState(false);
    const [messages, setMessages] = useState<CouncilMessage[]>([]);
    const [currentSpeaker, setCurrentSpeaker] = useState<string | null>(null);
    const [agents, setAgents] = useState<AgentConfig[]>(initialAgents);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [showReport, setShowReport] = useState(false);
    const [reportContent, setReportContent] = useState("");
    const [isMinimized, setIsMinimized] = useState(false);

    const [plaintiff, setPlaintiff] = useState<AgentConfig | null>(null);
    const [defendant, setDefendant] = useState<AgentConfig | null>(null);
    const [judge, setJudge] = useState<AgentConfig | null>(null);

    const [roundCount, setRoundCount] = useState(0);
    const MAX_ROUNDS = 2; // Limit to 2 full rounds before Verdict

    // Initial load
    useEffect(() => {
        if (messages.length > 0) return; // Prevent double init

        const init = async () => {
            // Show "Scanning Web" state if needed (could be a toast or subtle text)
            console.log("Initializing Council & Researching...");

            initialAgents.forEach(a => engine.addAgent(a));
            setAgents(initialAgents);

            setPlaintiff(initialAgents.find(a => a.role === 'visionary') || null);
            setDefendant(initialAgents.find(a => a.role === 'skeptic') || null);
            setJudge(initialAgents.find(a => a.role === 'moderator') || null);

            await engine.startDebate(topic, context, userProfile);
            setMessages([...engine.messages]);
        };

        init();
    }, [topic, context, initialAgents]);

    // Cleanup
    useEffect(() => {
        return () => setIsDebating(false);
    }, []);

    // Scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, currentSpeaker]);

    // Core Loop
    useEffect(() => {
        let timeout: NodeJS.Timeout;

        const loop = async () => {
            if (!isDebating) return;

            // Check Limits
            if (roundCount >= MAX_ROUNDS) {
                setIsDebating(false);
                await generateVerdict();
                return;
            }

            try {
                // 1. Plaintiff
                if (!isDebating) return;
                await processTurn(plaintiff?.id || '');

                // 2. Defendant
                if (!isDebating) return;
                await processTurn(defendant?.id || '');

                // Increment Round
                setRoundCount(prev => prev + 1);

                // Pause before next round
                await new Promise(r => setTimeout(r, 2000));

            } catch (e) {
                console.error(e);
                setIsDebating(false);
            }
        };

        if (isDebating) {
            // Faster start, but substantial delays between turns
            timeout = setTimeout(loop, 1000);
        }

        return () => clearTimeout(timeout);
    }, [isDebating, roundCount]);

    const processTurn = async (id: string) => {
        if (!id) return;
        setCurrentSpeaker(id);

        // RATE LIMIT: Artificial delay to prevent 429s (Pro is 60 RPM = 1 req/sec)
        // We'll wait 2 seconds before requesting
        await new Promise(r => setTimeout(r, 2000));

        try {
            const msg = await engine.triggerTurn(id);
            setMessages(prev => [...prev, msg]);
        } catch (e) {
            console.error(`Turn Error for ${id}:`, e);
        }

        setCurrentSpeaker(null);
        // Visual delay for reading
        await new Promise(r => setTimeout(r, 1000));
    };

    const generateVerdict = async () => {
        if (showReport) return; // Already done
        setIsDebating(false);
        setCurrentSpeaker('judge');

        // Heavy Rate Limit Protection for the big model call
        await new Promise(r => setTimeout(r, 2000));

        try {
            const report = await engine.generateVerdict();
            setReportContent(report);
            setShowReport(true);

            // Save Council Session to DB
            const userEmail = userProfile?.primaryEmailAddress?.emailAddress || userProfile?.email;
            if (userEmail) {
                try {
                    await fetch('http://localhost:3001/api/council', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            email: userEmail,
                            topic: topic,
                            context: context,
                            agents: initialAgents,
                            messages: engine.messages
                        })
                    });
                } catch (e) { console.error("Failed to sync council session", e); }
            }

        } catch (e) {
            console.error("Verdict Error:", e);
        }

        setCurrentSpeaker(null);
    };

    // Initialize Mermaid
    useEffect(() => {
        mermaid.initialize({ startOnLoad: false, theme: 'dark' });
    }, []);

    // Render Mermaid when report is shown
    useEffect(() => {
        if (showReport && reportContent) {
            // Find mermaid block
            const mermaidMatch = reportContent.match(/```mermaid([\s\S]*?)```/);
            if (mermaidMatch && mermaidMatch[1]) {
                setTimeout(async () => {
                    try {
                        const element = document.getElementById('mermaid-chart');
                        if (element) {
                            const { svg } = await mermaid.render('mermaid-svg', mermaidMatch[1].trim());
                            element.innerHTML = svg;
                        }
                    } catch (e) {
                        console.error("Mermaid Render Error", e);
                    }
                }, 500);
            }
        }
    }, [showReport, reportContent]);

    // Dynamic Imports for Client-Side only
    const downloadPDF = async () => {
        try {
            const html2canvas = (await import('html2canvas')).default;
            const { jsPDF } = await import('jspdf');

            const originalElement = document.getElementById('report-export-container');
            if (!originalElement) return;

            // CLONE & EXPAND STRATEGY
            // 1. Clone the node to avoid messing with the UI
            const clonedElement = originalElement.cloneNode(true) as HTMLElement;

            // 2. Style it to be full height (no scroll) and consistent width
            clonedElement.style.position = 'absolute';
            clonedElement.style.top = '-9999px';
            clonedElement.style.left = '0';
            clonedElement.style.width = '1000px'; // Fixed width for consistent formatting
            clonedElement.style.height = 'auto';
            clonedElement.style.overflow = 'visible';
            clonedElement.style.background = '#171717'; // Match neutral-900
            clonedElement.style.color = 'white';

            // Fix text wrapping in clone
            const proseDiv = clonedElement.querySelector('.prose') as HTMLElement;
            if (proseDiv) proseDiv.style.maxWidth = 'none';

            document.body.appendChild(clonedElement);

            // 3. Wait a tick for DOM to settle (and SVG to be ready if needed)
            await new Promise(resolve => setTimeout(resolve, 100));

            // 4. Capture
            const canvas = await html2canvas(clonedElement, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#171717',
                windowWidth: 1000
            });

            // 5. Generate PDF
            const imgData = canvas.toDataURL('image/png');
            const imgWidth = 210; // A4 width in mm
            const pageHeight = 297; // A4 height in mm
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            // Choose: One LOOOONG page (better for digital reading/email)
            // or standard A4 pages. Let's do One Long Page for the "Brief" feel.
            const pdf = new jsPDF('p', 'mm', [imgWidth, imgHeight]);

            pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
            pdf.save(`HyperMind_Strategy_Brief_${topic.slice(0, 10).replace(/\s+/g, '_')}.pdf`);

            // 6. Cleanup
            document.body.removeChild(clonedElement);

        } catch (e) {
            console.error("PDF Export Failed", e);
            alert("Failed to generate PDF. Check console.");
        }
    };

    // Minimized View
    if (isMinimized) {
        return (
            <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4">
                <div className="bg-neutral-900 border border-white/10 rounded-xl shadow-2xl p-4 flex items-center gap-4 w-80">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                    <div className="flex-1 min-w-0">
                        <div className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">Council Active</div>
                        <div className="text-sm font-bold text-white truncate">{topic}</div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsMinimized(false)}
                            className="p-2 hover:bg-white/10 rounded-lg text-white transition-colors"
                        >
                            <Scale size={16} />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-red-500/20 rounded-lg text-neutral-400 hover:text-red-400 transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-40 bg-black/95 backdrop-blur-sm relative font-sans overflow-hidden animate-in fade-in duration-300 flex flex-col items-center justify-center">
            <div className="w-full h-full max-w-[1920px] bg-black relative flex overflow-hidden lg:border-x lg:border-white/10 shadow-2xl">
                {/* Header / Nav */}
                <div className="absolute top-0 w-full h-16 border-b border-white/10 bg-black/60 backdrop-blur-md z-20 flex items-center justify-between px-6">
                    <div className="flex items-center gap-4">
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white"><X size={16} /></button>
                        <button onClick={() => setIsMinimized(true)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-neutral-400 hover:text-white -ml-2"><Minus size={16} /></button>
                        <div className="h-6 w-[1px] bg-white/20" />
                        <div className="flex flex-col">
                            <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest flex items-center gap-2">
                                Cognitive Court // Session Active
                                {messages.length === 0 && <span className="animate-pulse text-xs text-yellow-400">⚡ Scanning Live Web...</span>}
                            </span>
                            <span className="text-sm font-medium text-white max-w-md truncate">{topic}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {!showReport && (
                            <button
                                onClick={() => setIsDebating(!isDebating)}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all",
                                    isDebating ? "bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30" : "bg-green-500/20 text-green-400 border border-green-500/50 hover:bg-green-500/30"
                                )}
                            >
                                {isDebating ? <Pause size={12} /> : <Play size={12} />}
                                {isDebating ? "Pause Analysis" : "Resume"}
                            </button>
                        )}
                        <button
                            onClick={generateVerdict}
                            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-full text-xs font-bold uppercase tracking-widest hover:scale-105 hover:bg-indigo-500 transition-all shadow-lg"
                        >
                            <Gavel size={14} /> Issue Verdict
                        </button>
                    </div>
                </div>

                {/* Left Col: Plaintiff (Fixed) */}
                <div className="w-[18rem] pt-24 pb-6 px-6 border-r border-white/5 bg-gradient-to-b from-neutral-900/30 to-black flex flex-col items-center gap-4 z-10 hidden md:flex">
                    <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Scale size={12} /> Plaintiff (For)
                    </div>
                    {plaintiff && (
                        <AgentCard agent={plaintiff} isSpeaking={currentSpeaker === plaintiff.id} align="left" />
                    )}
                </div>

                {/* Center: Transcript Or Roadmap */}
                <div className="flex-1 pt-20 pb-6 relative flex flex-col bg-neutral-950/50">
                    <div className="flex-1 overflow-y-auto px-6 md:px-20 py-8 space-y-8 no-scrollbar scroll-smooth" ref={scrollRef}>
                        {messages.filter(m => m.id !== 'init').map((msg) => {
                            const isJudge = agents.find(a => a.id === msg.agentId)?.role === 'moderator';
                            const isUser = msg.agentId === 'user';
                            const agent = agents.find(a => a.id === msg.agentId);

                            // Layout: Plaintiff Left, Defendant Right, Judge/User Center
                            const align = agent?.role === 'visionary' ? 'left' : agent?.role === 'skeptic' ? 'right' : 'center';

                            return (
                                <div key={msg.id} className={cn(
                                    "flex flex-col max-w-2xl transition-all duration-500 animate-in fade-in slide-in-from-bottom-4",
                                    align === 'left' ? "items-start mr-auto" : align === 'right' ? "items-end ml-auto" : "items-center mx-auto text-center"
                                )}>
                                    <div className={cn(
                                        "text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center gap-2",
                                        align === 'left' ? "text-indigo-400" : align === 'right' ? "text-rose-400" : "text-neutral-500"
                                    )}>
                                        {agent?.name || 'User'}
                                        {isJudge && <Gavel size={10} className="text-purple-500" />}
                                    </div>
                                    <div className={cn(
                                        "p-6 rounded-2xl text-sm leading-relaxed shadow-lg backdrop-blur-sm border",
                                        align === 'left' ? "bg-indigo-950/20 border-indigo-500/20 rounded-tl-sm text-indigo-100" :
                                            align === 'right' ? "bg-rose-950/20 border-rose-500/20 rounded-tr-sm text-rose-100" :
                                                "bg-neutral-900 border-white/10 text-neutral-300 w-full"
                                    )}>
                                        <div
                                            className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed"
                                            dangerouslySetInnerHTML={{ __html: marked.parse(msg.content) as string }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                        {currentSpeaker && (
                            <div className="flex justify-center py-4">
                                <div className="flex items-center gap-2 text-xs text-neutral-500 animate-pulse uppercase tracking-widest font-mono">
                                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" />
                                    Processing Testimony...
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Col: Defendant (Fixed) */}
                <div className="w-[18rem] pt-24 pb-6 px-6 border-l border-white/5 bg-gradient-to-b from-neutral-900/30 to-black flex flex-col items-center gap-4 z-10 hidden md:flex">
                    <div className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Scale size={12} /> Defendant (Against)
                    </div>
                    {defendant && (
                        <AgentCard agent={defendant} isSpeaking={currentSpeaker === defendant.id} align="right" />
                    )}
                </div>

                {/* Verdict Modal (Roadmap) */}
                {showReport && (
                    <div className="absolute inset-0 z-50 bg-black/95 backdrop-blur-xl flex items-center justify-center p-8 animate-in fade-in duration-500">
                        <div className="max-w-5xl w-full bg-neutral-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[90vh]">
                            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-neutral-950">
                                <h2 className="text-xl font-bold text-white flex items-center gap-3 uppercase tracking-wider">
                                    <Gavel size={24} className="text-indigo-500" />
                                    Strategic Roadmap
                                </h2>
                                <div className="flex items-center gap-4">
                                    <button onClick={downloadPDF} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-sm text-xs font-bold uppercase tracking-widest">
                                        <FileText size={14} /> Download Strategy
                                    </button>
                                    <button onClick={() => setShowReport(false)} className="text-neutral-500 hover:text-white"><X size={20} /></button>
                                </div>
                            </div>
                            <div id="report-export-container" className="flex-1 overflow-y-auto p-12 custom-scrollbar bg-neutral-900">
                                {/* Mermaid Chart Container */}
                                <div className="mb-12 p-8 bg-neutral-950/50 border border-white/5 rounded-xl flex justify-center">
                                    <div id="mermaid-chart" className="w-full max-w-3xl flex justify-center text-white"></div>
                                </div>

                                {/* Text Content */}
                                <div className="prose prose-invert prose-stone max-w-none prose-headings:text-white prose-a:text-indigo-400">
                                    <div dangerouslySetInnerHTML={{ __html: marked.parse(reportContent.replace(/```mermaid[\s\S]*?```/, '')) as string }} />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function AgentCard({ agent, isSpeaking, align }: { agent: AgentConfig, isSpeaking: Boolean, align: 'left' | 'right' }) {
    return (
        <div className={cn(
            "w-full p-6 rounded-2xl border transition-all duration-500 flex flex-col items-center gap-4 text-center group relative overflow-hidden",
            isSpeaking
                ? (align === 'left' ? "bg-indigo-900/10 border-indigo-500 shadow-[0_0_30px_rgba(99,102,241,0.15)] scale-105" : "bg-rose-900/10 border-rose-500 shadow-[0_0_30px_rgba(244,63,94,0.15)] scale-105")
                : "bg-white/5 border-white/5 opacity-50 grayscale hover:grayscale-0 hover:opacity-80"
        )}>
            {/* Active Glow Background */}
            {isSpeaking && <div className={cn("absolute inset-0 opacity-20", align === 'left' ? "bg-indigo-500 blur-xl" : "bg-rose-500 blur-xl")} />}

            <div className={cn(
                "relative w-20 h-20 rounded-full flex items-center justify-center border-2 transition-colors z-10",
                isSpeaking
                    ? (align === 'left' ? "border-indigo-500 bg-black text-indigo-400" : "border-rose-500 bg-black text-rose-400")
                    : "border-white/10 bg-neutral-900 text-neutral-600"
            )}>
                <BrainCircuit size={40} strokeWidth={1} />
                {isSpeaking && (
                    <div className={cn("absolute inset-0 rounded-full animate-ping opacity-20", align === 'left' ? "bg-indigo-500" : "bg-rose-500")} />
                )}
            </div>

            <div className="relative z-10">
                <div className={cn("font-bold text-base", isSpeaking ? "text-white" : "text-neutral-400")}>{agent.name}</div>
                <div className="text-[10px] text-neutral-500 uppercase tracking-wider mt-1 font-mono">
                    {agent.role === 'visionary' ? 'Plaintiff Engine' : 'Defense Engine'}
                </div>
            </div>

            {agent.fields && (
                <div className="flex flex-wrap justify-center gap-1 mt-2 px-2">
                    {agent.fields.slice(0, 3).map(f => (
                        <span key={f} className="text-[9px] px-1.5 py-0.5 bg-black/50 rounded border border-white/10 text-neutral-500">{f}</span>
                    ))}
                </div>
            )}
        </div>
    )
}
