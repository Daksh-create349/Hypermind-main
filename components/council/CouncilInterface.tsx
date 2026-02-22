import React, { useState, useEffect, useRef } from 'react';
import { CouncilEngine } from '../../lib/council/Engine';
import { AgentConfig, CouncilMessage } from '../../lib/council/types';
import { cn } from '../../lib/utils';
import { BrainCircuit, Play, Pause, FileText, ChevronRight, Scale, Gavel, X, Minus, User } from 'lucide-react';
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

    const [showStaff, setShowStaff] = useState(false);

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
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-500">
            <div className="w-full max-w-6xl h-full max-h-[90vh] bg-[#0a0a0a] rounded-[2.5rem] border border-white/10 shadow-2xl relative flex flex-col overflow-hidden">
                {/* Header / Nav */}
                <div className="h-20 border-b border-white/5 bg-black/40 backdrop-blur-xl flex items-center justify-between px-8 flex-shrink-0">
                    <div className="flex items-center gap-4">
                        <button onClick={onClose} className="p-2.5 hover:bg-white/10 rounded-full transition-colors text-white border border-white/5">
                            <X size={18} />
                        </button>
                        <button onClick={() => setIsMinimized(true)} className="p-2.5 hover:bg-white/10 rounded-full transition-colors text-neutral-500 hover:text-white border border-white/5">
                            <Minus size={18} />
                        </button>
                        <div className="h-8 w-[1px] bg-white/10 mx-2" />
                        <div className="flex flex-col">
                            <span className="text-[10px] text-indigo-400 font-black uppercase tracking-[0.2em] flex items-center gap-2">
                                Cognitive Court // Active
                                {messages.length === 0 && <span className="animate-pulse text-xs text-yellow-500">⚡ Researching...</span>}
                            </span>
                            <span className="text-base font-bold text-white max-w-sm truncate">{topic}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setShowStaff(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-neutral-900 border border-white/10 hover:border-white/20 text-neutral-400 hover:text-white rounded-full text-xs font-bold uppercase tracking-widest transition-all"
                        >
                            <User size={14} /> View Personnel
                        </button>

                        {!showReport && (
                            <button
                                onClick={() => setIsDebating(!isDebating)}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all",
                                    isDebating ? "bg-red-500/10 text-red-500 border border-red-500/30 hover:bg-red-500/20" : "bg-green-500/10 text-green-500 border border-green-500/30 hover:bg-green-500/20"
                                )}
                            >
                                {isDebating ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
                                {isDebating ? "Pause" : "Resume"}
                            </button>
                        )}
                        <button
                            onClick={generateVerdict}
                            className="flex items-center gap-2 px-6 py-2 bg-white text-black rounded-full text-xs font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-white/5"
                        >
                            <Gavel size={14} /> Verdict
                        </button>
                    </div>
                </div>

                {/* Main View: One Focused Column */}
                <div className="flex-1 overflow-hidden relative flex flex-col">
                    <div className="flex-1 overflow-y-auto px-6 md:px-24 py-12 space-y-10 custom-scrollbar scroll-smooth" ref={scrollRef}>
                        {messages.filter(m => m.id !== 'init').map((msg) => {
                            const isJudge = agents.find(a => a.id === msg.agentId)?.role === 'moderator';
                            const agent = agents.find(a => a.id === msg.agentId);
                            const align = agent?.role === 'visionary' ? 'left' : agent?.role === 'skeptic' ? 'right' : 'center';

                            return (
                                <div key={msg.id} className={cn(
                                    "flex flex-col max-w-3xl transition-all duration-700 animate-in fade-in slide-in-from-bottom-8",
                                    align === 'left' ? "items-start mr-auto" : align === 'right' ? "items-end ml-auto" : "items-center mx-auto text-center"
                                )}>
                                    <div className={cn(
                                        "text-[10px] font-black uppercase tracking-[0.15em] mb-3 flex items-center gap-2",
                                        align === 'left' ? "text-indigo-400" : align === 'right' ? "text-rose-400" : "text-purple-400"
                                    )}>
                                        <div className={cn("w-1.5 h-1.5 rounded-full", align === 'left' ? "bg-indigo-500" : align === 'right' ? "bg-rose-500" : "bg-purple-500")} />
                                        {agent?.name || 'User'}
                                        {isJudge && <Gavel size={10} />}
                                    </div>
                                    <div className={cn(
                                        "p-8 rounded-[1.5rem] text-sm leading-relaxed shadow-2xl backdrop-blur-md border transition-all",
                                        align === 'left' ? "bg-indigo-950/20 border-indigo-500/20 rounded-tl-none text-indigo-100/90" :
                                            align === 'right' ? "bg-rose-950/20 border-rose-500/20 rounded-tr-none text-rose-100/90" :
                                                "bg-neutral-900/50 border-white/5 text-neutral-300 w-full"
                                    )}>
                                        <div
                                            className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-headings:text-white prose-strong:text-white"
                                            dangerouslySetInnerHTML={{ __html: marked.parse(msg.content) as string }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                        {currentSpeaker && (
                            <div className="flex justify-center py-8">
                                <div className="flex items-center gap-3 px-6 py-3 bg-white/5 border border-white/5 rounded-full text-[10px] text-neutral-400 animate-pulse uppercase tracking-[0.2em] font-black">
                                    <div className="flex gap-1">
                                        <div className="w-1 h-1 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <div className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <div className="w-1 h-1 bg-indigo-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                    Capturing Testimony
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Court Staff Pop-up */}
                {showStaff && (
                    <div className="absolute inset-0 z-[60] bg-black/60 backdrop-blur-md flex items-center justify-center p-8 animate-in fade-in duration-300">
                        <div className="w-full max-w-4xl bg-[#0d0d0d] border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                            <div className="p-8 border-b border-white/5 flex justify-between items-center bg-black/40">
                                <div className="flex flex-col">
                                    <h3 className="text-xl font-black text-white uppercase tracking-wider flex items-center gap-3">
                                        <User className="text-indigo-500" />
                                        Court Personnel
                                    </h3>
                                    <p className="text-xs text-neutral-500 mt-1 uppercase tracking-widest font-bold">The Strategic Intelligence Engines Accessing Your Case</p>
                                </div>
                                <button onClick={() => setShowStaff(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-neutral-400 hover:text-white">
                                    <X size={24} />
                                </button>
                            </div>
                            <div className="p-10 grid grid-cols-1 md:grid-cols-3 gap-8 overflow-y-auto">
                                <div className="space-y-4">
                                    <div className="text-[10px] font-black text-indigo-500 uppercase tracking-widest ml-4">Plaintiff Side</div>
                                    {plaintiff && <AgentCard agent={plaintiff} isSpeaking={currentSpeaker === plaintiff.id} align="left" />}
                                </div>
                                <div className="space-y-4">
                                    <div className="text-[10px] font-black text-purple-500 uppercase tracking-widest ml-4">Presiding Over</div>
                                    {judge && <AgentCard agent={judge} isSpeaking={currentSpeaker === judge.id} align="left" />}
                                </div>
                                <div className="space-y-4">
                                    <div className="text-[10px] font-black text-rose-500 uppercase tracking-widest ml-4">Defense Side</div>
                                    {defendant && <AgentCard agent={defendant} isSpeaking={currentSpeaker === defendant.id} align="right" />}
                                </div>
                            </div>
                            <div className="p-8 bg-black/40 border-t border-white/5 flex justify-center">
                                <button
                                    onClick={() => setShowStaff(false)}
                                    className="px-10 py-3 bg-white text-black rounded-full text-xs font-black uppercase tracking-widest transition-transform hover:scale-105"
                                >
                                    Return to Trial
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Verdict Modal (Roadmap) */}
                {showReport && (
                    <div className="absolute inset-0 z-[70] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-8 animate-in fade-in duration-500">
                        <div className="max-w-5xl w-full bg-[#0d0d0d] border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col h-[85vh] animate-in slide-in-from-bottom-12">
                            <div className="p-8 border-b border-white/5 flex justify-between items-center bg-black/60">
                                <div className="flex flex-col">
                                    <h2 className="text-2xl font-black text-white flex items-center gap-3 uppercase tracking-[0.1em]">
                                        <Gavel size={28} className="text-indigo-500" />
                                        Final Verdict
                                    </h2>
                                    <p className="text-xs text-neutral-500 mt-1 uppercase tracking-widest font-bold">Comprehensive Strategic Roadmap & Synthesis</p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <button onClick={downloadPDF} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/20">
                                        <FileText size={16} /> Archive Brief
                                    </button>
                                    <button onClick={() => setShowReport(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-neutral-500 hover:text-white border border-white/5"><X size={20} /></button>
                                </div>
                            </div>
                            <div id="report-export-container" className="flex-1 overflow-y-auto p-12 custom-scrollbar bg-[#0d0d0d]">
                                {/* Mermaid Chart Container */}
                                <div className="mb-12 p-10 bg-black/40 border border-white/5 rounded-[2rem] flex justify-center shadow-inner">
                                    <div id="mermaid-chart" className="w-full max-w-3xl flex justify-center text-white"></div>
                                </div>

                                {/* Text Content */}
                                <div className="prose prose-invert prose-stone max-w-none prose-headings:text-white prose-a:text-indigo-400 prose-p:text-neutral-400 prose-p:leading-relaxed prose-lg">
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

function AgentCard({ agent, isSpeaking, align }: { agent: AgentConfig, isSpeaking: any, align: 'left' | 'right' }) {
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
