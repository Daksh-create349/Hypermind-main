import React, { useState, useRef, useEffect } from 'react';
import { AgentConfig, AgentRole } from '../../lib/council/types';
import { PERSONAS, PersonaDefinition } from '../../lib/council/personas';
import { cn, extractTextFromPdf } from '../../lib/utils';
import { BrainCircuit, Gavel, Sparkles, User, Check, Shuffle, Paperclip, FileText, Loader2, Scale } from 'lucide-react';

interface Props {
    onStart: (config: AgentConfig[], topic: string, context: string) => void;
    onCancel: () => void;
    userProfile?: any;
}

export function CouncilSetup({ onStart, onCancel, userProfile }: Props) {
    const [seats, setSeats] = useState<{ [key: string]: string }>({
        'moderator': 'moderator',
        'skeptic': 'empirical_skeptic', // Defendant
        'visionary': 'first_principles' // Plaintiff
    });
    const [topic, setTopic] = useState("The Future of AI");
    const [context, setContext] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Auto-staff based on user profile on mount
    useEffect(() => {
        if (userProfile?.subjects && userProfile.subjects.length > 0) {
            autoStaff(userProfile.subjects);
        }
    }, [userProfile]);

    const autoStaff = (subjects: string[]) => {
        // Find best match for Plaintiff (Visionary) and Defendant (Skeptic) based on fields
        const available = PERSONAS.filter(p => p.id !== 'moderator');

        // Simple matching logic: Count overlap between persona fields and user subjects
        const scorePersona = (p: PersonaDefinition) => {
            if (!p.fields) return 0;
            return p.fields.filter(f => subjects.some(s => s.includes(f) || f.includes(s))).length;
        }

        const sorted = [...available].sort((a, b) => scorePersona(b) - scorePersona(a));

        // Pick top 2 different ones
        if (sorted.length >= 2) {
            setSeats(prev => ({
                ...prev,
                'visionary': sorted[0].id,
                'skeptic': sorted[1].id
            }));
        }
    };

    const handleSelect = (role: string, personaId: string) => {
        setSeats(prev => ({ ...prev, [role]: personaId }));
    };

    const handleStart = () => {
        const config: AgentConfig[] = [
            // Moderator (Judge)
            createConfig('moderator', seats['moderator'], 'gemini-2.5-pro'),
            // Skeptic (Defendant - Against)
            createConfig('skeptic', seats['skeptic'], 'gemini-2.5-flash-preview-09-2025'),
            // Visionary (Plaintiff - For)
            createConfig('visionary', seats['visionary'], 'gemini-2.5-flash-preview-09-2025')
        ];
        onStart(config, topic, context);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsProcessing(true);
        try {
            let extracted = "";
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                if (file.type === 'application/pdf') {
                    const text = await extractTextFromPdf(file);
                    extracted += `\n--- Document: ${file.name} ---\n${text}\n`;
                } else if (file.type.startsWith('text/')) {
                    const text = await file.text();
                    extracted += `\n--- Document: ${file.name} ---\n${text}\n`;
                } else {
                    extracted += `\n--- Document: ${file.name} ---\n[File uploaded but format ${file.type} text extraction not supported yet]\n`;
                }
            }
            setContext(prev => prev + extracted);
        } catch (err) {
            console.error("Upload failed", err);
            alert("Failed to read file.");
        } finally {
            setIsProcessing(false);
        }
    };

    const createConfig = (role: string, personaId: string, model: string): AgentConfig => {
        const persona = PERSONAS.find(p => p.id === personaId) || PERSONAS[0];
        return {
            id: role,
            role: role as AgentRole, // Keep functional role for logic
            name: persona.name,
            avatar: persona.avatar,
            bio: persona.systemInstruction, // Inject the persona prompt
            model: model,
            fields: persona.fields
        };
    };

    const randomize = () => {
        const available = [...PERSONAS].filter(p => p.id !== 'moderator');
        const newSeats: any = { ...seats };

        const p1 = available[Math.floor(Math.random() * available.length)];
        const p2 = available.filter(p => p.id !== p1.id)[Math.floor(Math.random() * (available.length - 1))];

        newSeats['visionary'] = p1.id;
        newSeats['skeptic'] = p2.id;

        setSeats(newSeats);
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 animate-in fade-in zoom-in-95">
            <div className="w-full max-w-4xl bg-neutral-900 border border-white/10 rounded-xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-6 border-b border-white/10 flex flex-col gap-6 bg-neutral-950">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-xl font-bold text-white flex items-center gap-2 uppercase tracking-wider">
                                <Scale className="text-indigo-500" />
                                Cognitive Court Setup
                            </h2>
                            <p className="text-neutral-400 text-sm">Assemble the Plaintiff and Defendant engines.</p>
                        </div>
                        <button onClick={randomize} className="text-indigo-400 hover:text-indigo-300 flex items-center gap-2 text-xs uppercase tracking-widest font-bold">
                            <Shuffle size={12} /> Randomize Court
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Case Objective</label>
                            <input
                                value={topic}
                                onChange={e => setTopic(e.target.value)}
                                className="w-full bg-neutral-900 border border-white/10 rounded-sm px-4 py-2 text-white focus:border-indigo-500 focus:outline-none font-mono text-sm"
                                placeholder="E.g. Should we adopt Rust?"
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Evidence</label>
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="text-[10px] uppercase tracking-widest font-bold flex items-center gap-1 text-indigo-400 hover:text-indigo-300"
                                >
                                    {isProcessing ? <Loader2 size={10} className="animate-spin" /> : <Paperclip size={10} />}
                                    {isProcessing ? "Ingesting..." : "Attach Data"}
                                </button>
                                <input
                                    type="file"
                                    multiple
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept=".pdf,.txt,.md"
                                    onChange={handleFileUpload}
                                />
                            </div>
                            <textarea
                                value={context}
                                onChange={e => setContext(e.target.value)}
                                className="w-full bg-neutral-900 border border-white/10 rounded-sm px-4 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none min-h-[80px] font-mono"
                                placeholder="Paste context or upload documents..."
                            />
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-3 gap-8">

                    {/* Seat 2: The Visionary -> Plaintiff */}
                    <SeatColumn
                        role="visionary"
                        title="Plaintiff (Motion For)"
                        subtitle="Argues in favor"
                        currentId={seats['visionary']}
                        onSelect={(id) => handleSelect('visionary', id)}
                    />

                    {/* Seat 1: The Moderator -> Judge */}
                    <SeatColumn
                        role="moderator"
                        title="High Justiciar"
                        subtitle="Neutral synthesis"
                        currentId={seats['moderator']}
                        onSelect={(id) => handleSelect('moderator', id)}
                    />

                    {/* Seat 3: The Skeptic -> Defendant */}
                    <SeatColumn
                        role="skeptic"
                        title="Defendant (Motion Against)"
                        subtitle="Argues against"
                        currentId={seats['skeptic']}
                        onSelect={(id) => handleSelect('skeptic', id)}
                    />

                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/10 bg-neutral-950 flex justify-end gap-4">
                    <button onClick={onCancel} className="px-6 py-3 rounded-sm text-neutral-400 hover:text-white font-mono text-xs uppercase tracking-widest">
                        Abort
                    </button>
                    <button
                        onClick={handleStart}
                        className="px-8 py-3 rounded-sm bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-lg transition-all hover:translate-y-[-1px] text-xs uppercase tracking-widest"
                    >
                        Conven Court
                    </button>
                </div>
            </div>
        </div>
    );
}

function SeatColumn({ role, title, subtitle, currentId, onSelect }: { role: string, title: string, subtitle?: string, currentId: string, onSelect: (id: string) => void }) {
    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col pb-2 border-b border-white/10">
                <div className="flex items-center gap-2 text-white font-bold">
                    {role === 'moderator' ? <Gavel size={18} className="text-purple-500" /> : role === 'visionary' ? <Sparkles size={18} className="text-indigo-500" /> : <Scale size={18} className="text-rose-500" />}
                    {title}
                </div>
                {subtitle && <span className="text-[10px] text-neutral-500 uppercase tracking-widest mt-1">{subtitle}</span>}
            </div>

            <div className="space-y-3">
                {PERSONAS.filter(p => (role === 'moderator' ? p.id === 'moderator' : p.id !== 'moderator')).map(p => {
                    const isSelected = currentId === p.id;
                    return (
                        <button
                            key={p.id}
                            onClick={() => onSelect(p.id)}
                            className={cn(
                                "w-full p-3 rounded-lg border text-left transition-all relative group",
                                isSelected
                                    ? "bg-indigo-900/40 border-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.2)]"
                                    : "bg-neutral-800/50 border-white/5 hover:border-white/20 hover:bg-neutral-800"
                            )}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className={cn("font-bold text-sm", isSelected ? "text-white" : "text-neutral-300")}>{p.name}</span>
                                {isSelected && <Check size={14} className="text-indigo-400" />}
                            </div>
                            <div className="text-xs text-neutral-500 line-clamp-2 group-hover:text-neutral-400">
                                {p.description}
                            </div>
                            {p.fields && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                    {p.fields.slice(0, 2).map(f => (
                                        <span key={f} className="text-[9px] px-1.5 py-0.5 bg-neutral-900 rounded border border-white/5 text-neutral-500">{f}</span>
                                    ))}
                                </div>
                            )}
                        </button>
                    )
                })}
            </div>
        </div>
    );
}
