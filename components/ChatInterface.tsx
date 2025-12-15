
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Send, Paperclip, Loader2, BrainCircuit, Phone, Award, CheckCircle2, AlertCircle, ArrowRight, RotateCcw, X, BookOpen, ChevronRight, PlayCircle } from 'lucide-react';
import { GoogleGenAI, Chat } from "@google/genai";
import { cn, blobToBase64, extractTextFromPdf, parseJsonFromText } from '../lib/utils';
import { marked } from 'marked';
import { Diagram } from './Diagram';
import { Quiz } from './Quiz';
import { GenUI } from './GenUI';
import { LiveSession } from './LiveSession';
import { Certificate } from './Certificate';

// Types
export interface Topic {
    id: string;
    title: string;
    description: string;
}

interface Message {
    id: number;
    role: 'user' | 'ai';
    content: string;
    images?: string[];
    htmlContent?: string;
    // Metadata for AI features
    isCurriculum?: boolean;
    curriculumData?: Topic[];
    genUiType?: string;
    genUiData?: any;
    genUiConfig?: any;
    quizData?: any;
    diagramData?: any;
    isError?: boolean;
    timestamp: string;
    isAction?: boolean;
    actionType?: 'lesson_options' | 'quiz_result';
    actionData?: any;
    youtubeQueries?: { title: string; query: string }[];
}

export interface ChatInterfaceProps {
    userData?: any;
    mode?: 'learn' | 'practice' | 'debate';
}

export function ChatInterface({ userData, mode = 'learn' }: ChatInterfaceProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [currentMode, setCurrentMode] = useState(mode);
    const [chatSession, setChatSession] = useState<Chat | null>(null);
    const [sessionId, setSessionId] = useState<string>('default');

    const [attachedImages, setAttachedImages] = useState<{ data: string, mime: string }[]>([]);
    const [isProcessingFile, setIsProcessingFile] = useState(false);
    const [isLiveOpen, setIsLiveOpen] = useState(false);
    const [showMap, setShowMap] = useState(false);

    // Learning Path State
    const [completedModules, setCompletedModules] = useState<string[]>(() => {
        const saved = localStorage.getItem('hypermind_progress');
        return saved ? JSON.parse(saved) : [];
    });
    const [currentModule, setCurrentModule] = useState<string | null>(null);
    const [showCertificate, setShowCertificate] = useState(false);
    const [showNameModal, setShowNameModal] = useState(false);
    const [certificateName, setCertificateName] = useState(userData?.name || "Student");

    // Module Selection State
    const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
    const [topicModules, setTopicModules] = useState<Topic[] | null>(null);
    const [isLoadingModules, setIsLoadingModules] = useState(false);

    const scrollRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- 1. INITIALIZATION & API SETUP ---


    // Also fix the sessionId dependency which might cause resets
    useEffect(() => {
        if (sessionId && sessionId !== 'default') {
            // logic to load session if needed
        }
    }, [sessionId]);



    useEffect(() => {
        if (scrollRef.current) {
            setTimeout(() => scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 100);
        }
    }, [messages, isTyping]);

    // Persistence Effect


    useEffect(() => {
        localStorage.setItem('hypermind_progress', JSON.stringify(completedModules));
    }, [completedModules]);

    useEffect(() => {
        const initChat = async () => {
            if (!process.env.API_KEY) {
                console.error("API Key missing");
                return;
            }

            try {
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
                const systemInstruction = `You are HyperMind, an advanced AI tutor.
    
    RULES:
    1. For "Teach me" requests, provide clearly formatted, easy-to-understand TEXT explanations.
    2. JSON OUPUT (Only when requested or highly relevant):
       - Charts: { "genUi": { "type": "line-chart", ... } }
       - Quizzes: { "quiz": { "questions": [{ "question": "...", "options": [...], "answer": "...", "explanation": "Detailed reason why this option is correct." }] } }
       - Diagrams: { "diagram": { "nodes": [], "edges": [] } }
       - Curriculum: { "curriculum": [...] } (ONLY if asked for a path/syllabus)
       - YouTube: { "youtube": [{ "title": "Video Title", "query": "Exact Search Query for YouTube" }] } (ALWAYS include 1-2 search queries for every teaching topic)
    
    Separate JSON from text. Always prioritize helpful text explanations.`;

                const history = messages
                    .filter(m => m.id !== 'init' && !m.isError)
                    .map(m => ({
                        role: m.role === 'user' ? 'user' : 'model',
                        parts: [{ text: m.content }]
                    }));

                const chat = ai.chats.create({
                    model: 'gemini-2.5-flash',
                    config: { systemInstruction },
                    history: history
                });

                setChatSession(chat);
            } catch (error) {
                console.error("Failed to initialize AI", error);
            }
        };
        initChat();
    }, [currentMode, sessionId]);


    // --- 2. MESSAGE HANDLING ---
    const processResponse = (text: string): Partial<Message> => {
        let content = text;
        let isCurriculum = false;
        let curriculumData: Topic[] = [];
        let genUiType, genUiData, genUiConfig, quizData, diagramData;
        let youtubeQueries: { title: string; query: string }[] | undefined;

        try {
            const rawJson = parseJsonFromText(text);
            const json = Array.isArray(rawJson) ? rawJson[0] : rawJson;

            if (json) {
                if (json.genUi) { genUiType = json.genUi.type; genUiData = json.genUi.data; genUiConfig = json.genUi.config; }
                if (json.quiz) { quizData = json.quiz; }
                if (json.diagram) { diagramData = json.diagram; }
                if (json.curriculum) { isCurriculum = true; curriculumData = json.curriculum; }
                if (json.youtube) { youtubeQueries = json.youtube; }

                content = content.replace(JSON.stringify(rawJson), '').replace(/```json[\s\S]*?```/g, '').replace(/```[\s\S]*?```/g, '').trim();
            }

            // If generic content is detected, try to strip it or leave it empty if we have rich data
            if ((quizData || diagramData || isCurriculum) && (!content || content.length < 5)) {
                content = "";
            }

            // Safe marked parsing
            const parsed = marked.parse(content || " ");
            const htmlContent = typeof parsed === 'string' ? parsed : " ";

            return { content, isCurriculum, curriculumData, htmlContent, genUiType, genUiData, genUiConfig, quizData, diagramData, youtubeQueries };
        } catch (e) {
            console.error("Processing Error", e);
            return { content: text, htmlContent: text };
        }
    };

    const handleSendMessage = async (text: string = inputValue, hidden: boolean = false, isQuizRequest: boolean = false) => {
        if ((!text.trim() && attachedImages.length === 0) || !chatSession) return;

        // Track current module if user is asking to learn
        if (text.startsWith("Teach me about")) {
            const modName = text.replace("Teach me about ", "");
            setCurrentModule(modName);
            // Append instruction to ensure text response
            if (!hidden) text = `Teach me about ${modName}. Explain it in detail with examples.`;
        }

        const userText = text.trim();
        if (!hidden) {
            const userMsg: Message = {
                id: Date.now(),
                role: 'user',
                content: userText,
                images: attachedImages.map(img => img.data),
                timestamp: new Date().toLocaleTimeString()
            };
            setMessages(prev => [...prev, userMsg]);
            setInputValue('');
            setAttachedImages([]);
        }

        setIsTyping(true);
        try {
            const result = await chatSession.sendMessage({ message: userText });
            const processed = processResponse(result.text);

            const aiMsg: Message = {
                id: Date.now() + 1,
                role: 'ai',
                content: processed.content || "",
                ...processed,
                timestamp: new Date().toLocaleTimeString()
            };
            setMessages(prev => [...prev, aiMsg]);

            // CHECK: If this is a lesson explanation, append ACTION BUTTONS
            // We assume it's a lesson if we have a currentModule AND it's not a quiz/diagram response
            if ((text.startsWith("Teach me about") && !processed.quizData) || (currentModule && !processed.quizData && !processed.isAction && !isQuizRequest && !text.includes("doubt") && !text.includes("Generate a 5 question quiz"))) {
                setTimeout(() => {
                    const actionMsg: Message = {
                        id: Date.now() + 2,
                        role: 'ai',
                        content: "",
                        isAction: true,
                        actionType: 'lesson_options',
                        actionData: { module: currentModule },
                        timestamp: new Date().toLocaleTimeString()
                    };
                    setMessages(prev => [...prev, actionMsg]);
                }, 800);
            }

        } catch (error: any) {
            console.error("AI Error:", error);

            const isQuota = error.message?.includes('429') || error.status === 429 || error.toString().includes('Quota') || error.toString().includes('429');
            const errorMessage = isQuota ? "API Quota Exceeded. Please try again later." : "I encountered a connection error. Please try again.";
            const errorHtml = isQuota
                ? `<p class="text-red-400 font-bold">⚠️ API Quota Limit Reached</p><p class="text-neutral-500 text-sm">The AI service is temporarily unavailable due to high traffic. Please try again in a few minutes.</p>`
                : `<p class="text-neutral-400 font-bold">Connection Error</p>`;

            const errorMsg: Message = {
                id: Date.now() + 1,
                role: 'ai',
                content: errorMessage,
                htmlContent: errorHtml,
                isError: true,
                timestamp: new Date().toLocaleTimeString()
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsTyping(false);
        }
    };

    // Helper to find next module
    const getNextModule = (current: string | null) => {
        if (!initialDiagramData || !current) return null;
        const nodes = initialDiagramData.nodes.filter(n => n.id !== 'root');
        const idx = nodes.findIndex(n => n.label === current);
        if (idx !== -1 && idx < nodes.length - 1) {
            return nodes[idx + 1].label;
        }
        return null; // No next module
    };

    const handleQuizComplete = (results: { score: number; total: number }) => {
        const passed = results.score >= 2;

        const resultMsg: Message = {
            id: Date.now(),
            role: 'ai',
            content: "",
            isAction: true,
            actionType: 'quiz_result',
            actionData: {
                passed,
                score: results.score,
                module: currentModule
            },
            timestamp: new Date().toLocaleTimeString()
        };
        setMessages(prev => [...prev, resultMsg]);

        if (passed && currentModule) {
            if (!completedModules.includes(currentModule)) {
                setCompletedModules(prev => [...prev, currentModule]);
            }
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsProcessingFile(true);
        try {
            if (file.type === 'application/pdf') {
                const text = await extractTextFromPdf(file);
                handleSendMessage(`PDF: ${text.substring(0, 10000)}...Analyze.`);
            } else if (file.type.startsWith('image/')) {
                const base64 = await blobToBase64(file);
                setAttachedImages(prev => [...prev, { data: base64, mime: file.type }]);
            }
        } finally {
            setIsProcessingFile(false);
        }
    };

    // --- 2.5 MODULE GENERATION ---
    const fetchModulesForTopic = async (topic: string) => {
        if (!chatSession) return;

        setSelectedTopic(topic);
        setIsLoadingModules(true);
        setTopicModules(null);

        try {
            const prompt = `Break down the topic "${topic}" into 4-6 key learning modules/sub-topics. 
            Return strictly a JSON object with this structure: 
            { "curriculum": [{ "id": "1", "title": "Module Title", "description": "Brief description" }] }`;

            const result = await chatSession.sendMessage(prompt);
            const processed = processResponse(result.response.text());

            if (processed.curriculumData && processed.curriculumData.length > 0) {
                setTopicModules(processed.curriculumData);
            } else {
                // Fallback if structured data fails
                handleSendMessage(`Teach me about ${topic}`, false);
                setSelectedTopic(null); // Cancel module flow
            }
        } catch (e) {
            console.error("Module generation failed", e);
            handleSendMessage(`Teach me about ${topic}`, false);
            setSelectedTopic(null);
        } finally {
            setIsLoadingModules(false);
        }
    };

    const handleModuleSelect = (module: Topic) => {
        setTopicModules(null);
        setSelectedTopic(null);
        setShowMap(false);
        setCurrentModule(module.title);
        handleSendMessage(`Teach me about ${module.title}. Explain it in detail.`, false);
    };


    // --- 3. INITIAL FLOWCHART RENDERER (The "No Blank Screen" Fix) ---
    // Memoize this data to prevent Diagram re-renders loops
    const initialDiagramData = useMemo(() => {
        const subject = userData?.subjects?.[0] || userData?.subjects || "Computer Science";
        const vectors = userData?.secondaryGoals || ["Algorithms", "System Design", "AI Fundamentals", "Ethics"];

        return {
            title: `${subject} Mastery Path`,
            nodes: [
                { id: "root", label: subject, type: "custom" },
                ...vectors.map((vec: string, i: number) => ({
                    id: `node-${i}`,
                    label: vec,
                    type: "custom"
                }))
            ],
            edges: vectors.map((_: string, i: number) => ({
                id: `edge-${i}`,
                source: "root",
                target: `node-${i}`,
                animated: true
            }))
        };
    }, [userData]);


    // --- 3. FLOWCHART RENDERER ---
    if (showCertificate) {
        return (
            <div className="h-full w-full bg-neutral-950 overflow-auto p-4 md:p-8 flex items-center justify-center animate-in fade-in duration-700">
                <div className="max-w-5xl w-full">
                    <div className="mb-6 flex justify-between items-center">
                        <button onClick={() => setShowCertificate(false)} className="text-neutral-400 hover:text-white flex items-center gap-2 font-medium transition-colors">
                            ← Back to Learning
                        </button>
                    </div>
                    <Certificate
                        userName={certificateName}
                        courseName={initialDiagramData?.title || "Mastery Path"}
                        completionDate={new Date().toLocaleDateString()}
                    />
                </div>
            </div>
        );
    }

    if (messages.length === 0 || showMap) {
        const subject = initialDiagramData?.nodes[0].label || "Learning";

        return (
            <div className="flex flex-col h-full w-full bg-black relative animate-in fade-in duration-500">
                {/* Header for Flowchart Mode */}
                <div className="absolute top-6 left-6 z-20">
                    <h1 className="text-3xl font-bold text-white tracking-tight">{subject} <span className="text-neutral-500">Path</span></h1>
                    <p className="text-neutral-400">Interactive Roadmap • Click to start</p>
                </div>

                {/* Back to Chat Button (only if we have messages) */}
                {messages.length > 0 && (
                    <div className="absolute top-6 right-6 z-20">
                        <button
                            onClick={() => setShowMap(false)}
                            className="bg-neutral-900 hover:bg-neutral-800 text-white px-4 py-2 rounded-full border border-white/10 text-sm font-medium transition-colors"
                        >
                            Back to Chat
                        </button>
                    </div>
                )}

                {/* Center Diagram */}
                {initialDiagramData && (
                    <div className="flex-1 flex items-center justify-center p-4">
                        <Diagram
                            data={initialDiagramData}
                            onNodeClick={(label) => {
                                fetchModulesForTopic(label);
                            }}
                        />
                    </div>
                )}

                {/* Hint at bottom */}
                {!topicModules && !isLoadingModules && (
                    <div className="absolute bottom-10 inset-x-0 text-center text-neutral-500 text-sm animate-pulse">
                        Select a topic to view modules
                    </div>
                )}

                {/* Module Selection Overlay */}
                {(topicModules || isLoadingModules) && (
                    <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
                        <div className="bg-neutral-900 border border-white/10 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl relative flex flex-col max-h-[80vh]">

                            {isLoadingModules ? (
                                <div className="p-12 flex flex-col items-center justify-center text-center">
                                    <Loader2 size={40} className="text-white animate-spin mb-4" />
                                    <h3 className="text-xl font-bold text-white mb-2">Analyzing Topic...</h3>
                                    <p className="text-neutral-400">Generating learning modules for {selectedTopic}</p>
                                </div>
                            ) : (
                                <>
                                    <div className="p-6 border-b border-white/10 flex items-center justify-between sticky top-0 bg-neutral-900 z-10">
                                        <div>
                                            <h2 className="text-2xl font-bold text-white">{selectedTopic}</h2>
                                            <p className="text-neutral-400 text-sm">Select a module to start learning</p>
                                        </div>
                                        <button
                                            onClick={() => { setTopicModules(null); setSelectedTopic(null); }}
                                            className="p-2 hover:bg-neutral-800 rounded-full text-neutral-400 hover:text-white transition-colors"
                                        >
                                            <X size={24} />
                                        </button>
                                    </div>

                                    <div className="p-6 overflow-y-auto space-y-3">
                                        {topicModules?.map((mod, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => handleModuleSelect(mod)}
                                                className="w-full text-left bg-neutral-950 hover:bg-neutral-800 border border-white/5 hover:border-white/20 p-5 rounded-xl transition-all group flex items-start gap-4"
                                            >
                                                <div className="w-10 h-10 rounded-lg bg-neutral-900 flex items-center justify-center flex-shrink-0 group-hover:bg-white group-hover:text-black transition-colors">
                                                    <span className="font-bold text-sm">{idx + 1}</span>
                                                </div>
                                                <div className="flex-1">
                                                    <h3 className="font-bold text-white group-hover:text-indigo-300 transition-colors mb-1 flex items-center gap-2">
                                                        {mod.title}
                                                        <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity transform -translate-x-2 group-hover:translate-x-0" />
                                                    </h3>
                                                    <p className="text-sm text-neutral-400 line-clamp-2">{mod.description}</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // --- 4. STANDARD CHAT UI (Only renders if messages > 0) ---
    return (
        <div className="flex flex-col h-full relative">
            {/* Top Controls */}
            {/* Top Controls Header */}
            <div className="w-full flex justify-end items-center gap-2 p-4 border-b border-white/5 bg-black/20 backdrop-blur-sm z-20">
                {/* Map Toggle Button */}
                <button
                    onClick={() => setShowMap(true)}
                    className="bg-neutral-900/80 hover:bg-neutral-800 text-neutral-400 hover:text-white p-2 rounded-full border border-white/10 transition-all"
                    title="View Roadmap"
                >
                    <BrainCircuit size={16} />
                </button>

                <button
                    onClick={() => setIsLiveOpen(true)}
                    className="bg-neutral-900 hover:bg-neutral-800 text-white p-2 rounded-full border border-white/10 transition-all"
                >
                    <Phone size={16} fill="currentColor" />
                </button>


            </div>

            {isLiveOpen && <LiveSession onClose={() => setIsLiveOpen(false)} />}

            {/* Message Stream */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-10 pb-4">
                {messages.map((msg) => (
                    <div key={msg.id} className={cn("flex gap-4", msg.role === 'user' ? "flex-row-reverse" : "")}>
                        <div className={cn("w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 border border-white/10", msg.role === 'user' ? "bg-neutral-900" : "bg-neutral-950")}>
                            {msg.role === 'user' ? <span className="text-xs font-bold text-neutral-400">ME</span> : <BrainCircuit size={20} className="text-white" />}
                        </div>
                        <div className={cn("flex flex-col gap-2 max-w-[85%]", msg.role === 'user' ? "items-end" : "w-full")}>
                            <div className={cn("rounded-2xl px-6 py-4", msg.role === 'user' ? "bg-neutral-900 text-white border border-white/5" : "bg-transparent text-neutral-200 p-0")}>
                                {msg.role === 'ai' ? (
                                    <>
                                        {msg.content && <div className="prose prose-invert prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: msg.htmlContent || '' }} />}

                                        {/* --- ACTION BUTTONS (LESSON END) --- */}
                                        {msg.isAction && msg.actionType === 'lesson_options' && (
                                            <div className="flex flex-col sm:flex-row gap-3 mt-6 animate-in fade-in slide-in-from-top-4">
                                                <button
                                                    onClick={() => handleSendMessage("I have a doubt about this. Can you explain in simple terms?", false)}
                                                    className="px-6 py-3 rounded-xl bg-neutral-900 border border-white/10 hover:bg-neutral-800 text-neutral-300 hover:text-white font-medium transition-all"
                                                >
                                                    Ask a Doubt
                                                </button>
                                                <button
                                                    onClick={() => handleSendMessage(`Generate a 5 question quiz for ${msg.actionData.module}.Return JSON: { "quiz": { "questions": [{ "question": "...", "options": [...], "answer": "...", "explanation": "Detailed explanation of why the answer is correct." }] } } `, true, true)}
                                                    className="px-6 py-3 rounded-xl bg-white text-black font-bold hover:bg-neutral-200 transition-all flex items-center gap-2 justify-center shadow-[0_0_20px_rgba(255,255,255,0.15)]"
                                                >
                                                    <BrainCircuit size={16} /> Take Quiz
                                                </button>
                                            </div>
                                        )}

                                        {/* --- QUIZ RESULT & NEXT STEPS --- */}
                                        {msg.isAction && msg.actionType === 'quiz_result' && (
                                            <div className="mt-4 p-6 rounded-2xl border border-white/10 bg-neutral-900 animate-in zoom-in-95">
                                                <h4 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                                                    {msg.actionData.passed ? <CheckCircle2 className="text-white" size={24} /> : <AlertCircle className="text-neutral-500" size={24} />}
                                                    {msg.actionData.passed ? "Module Passed!" : "Needs Improvement"}
                                                </h4>
                                                <p className="text-neutral-400 mb-6 px-1 leading-relaxed">
                                                    {msg.actionData.passed
                                                        ? "Reflecting on this lesson, you have demonstrated solid understanding. You are ready to advance to the next level."
                                                        : "You need at least 2 correct answers to proceed. I recommend reviewing the generated explanation above."}
                                                </p>

                                                {msg.actionData.passed ? (
                                                    <div className="flex gap-3">
                                                        {(() => {
                                                            const nextMod = getNextModule(msg.actionData.module);
                                                            if (nextMod) {
                                                                return (
                                                                    <button
                                                                        onClick={() => {
                                                                            handleSendMessage(`Teach me about ${nextMod} `, false);
                                                                        }}
                                                                        className="px-6 py-3 rounded-xl bg-white text-black font-bold hover:bg-neutral-200 transition-all w-full md:w-auto flex items-center gap-2 justify-center"
                                                                    >
                                                                        Move to {nextMod} <ArrowRight size={16} />
                                                                    </button>
                                                                );
                                                            } else {
                                                                return (
                                                                    <button
                                                                        onClick={() => setShowNameModal(true)}
                                                                        className="px-8 py-3 rounded-xl bg-gradient-to-r from-neutral-100 to-white text-black font-bold shadow-[0_0_25px_rgba(255,255,255,0.4)] hover:scale-105 transition-all w-full md:w-auto flex items-center gap-2 justify-center"
                                                                    >
                                                                        <Award size={18} /> Download Certificate
                                                                    </button>
                                                                );
                                                            }
                                                        })()}
                                                    </div>
                                                ) : (
                                                    <div className="flex gap-3 flex-wrap">
                                                        <button
                                                            onClick={() => handleSendMessage(`Teach me about ${msg.actionData.module} again, but simplify the core concepts.`, false)}
                                                            className="px-6 py-3 rounded-xl bg-neutral-800 text-white font-medium hover:bg-neutral-700 transition-all w-full md:w-auto"
                                                        >
                                                            Review Module
                                                        </button>
                                                        <button
                                                            onClick={() => handleSendMessage(`Generate a 5 question quiz for ${msg.actionData.module}.Return JSON: { "quiz": { "questions": [...] } } `, true, true)}
                                                            className="px-6 py-3 rounded-xl bg-white text-black font-bold hover:bg-neutral-200 transition-all w-full md:w-auto flex items-center gap-2 justify-center"
                                                        >
                                                            <RotateCcw size={16} /> Retake Quiz
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {msg.genUiType && <GenUI type={msg.genUiType} data={msg.genUiData} config={msg.genUiConfig} />}
                                        {msg.quizData && <Quiz data={msg.quizData} onComplete={handleQuizComplete} />}
                                        {msg.diagramData && (
                                            <div className="w-full -mx-6 md:-mx-10 my-4 h-[400px]">
                                                <Diagram
                                                    data={msg.diagramData}
                                                    onNodeClick={(label) => handleSendMessage(`Teach me about ${label} `, false)}
                                                />
                                            </div>
                                        )}
                                        {msg.isCurriculum && msg.curriculumData && (
                                            <div className="w-full bg-neutral-950 border border-white/10 rounded-xl p-6 mt-4">
                                                <h3 className="font-bold text-white mb-4 flex items-center gap-2"><div className="w-1 h-4 bg-white rounded-full" /> Curriculum</h3>
                                                <div className="space-y-3">
                                                    {msg.curriculumData.map(t => (
                                                        <div key={t.id} onClick={() => handleSendMessage(`Teach me about ${t.title}`, false)} className="text-sm text-neutral-400 hover:text-white transition-colors cursor-pointer border-l border-white/10 pl-4 hover:border-white">
                                                            {t.title}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {msg.youtubeQueries && msg.youtubeQueries.length > 0 && (
                                            <div className="w-full mt-4 space-y-3">
                                                <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                                    Recommended Video Searches
                                                </h4>
                                                <div className="flex gap-4 overflow-x-auto pb-2 -mx-2 px-2">
                                                    {msg.youtubeQueries.map((item, idx) => (
                                                        <a
                                                            key={idx}
                                                            href={`https://www.youtube.com/results?search_query=${encodeURIComponent(item.query)}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex-shrink-0 w-64 group cursor-pointer"
                                                        >
                                                            <div className="w-full aspect-video rounded-xl overflow-hidden bg-neutral-900 border border-white/10 relative mb-2 flex flex-col items-center justify-center p-4 bg-gradient-to-br from-neutral-900 to-neutral-800">
                                                                <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-lg shadow-red-900/50">
                                                                    <PlayCircle size={24} className="text-white fill-current" />
                                                                </div>
                                                                <p className="text-xs text-neutral-400 font-medium text-center">Search on YouTube</p>
                                                            </div>
                                                            <p className="text-sm font-medium text-neutral-300 group-hover:text-white line-clamp-2 leading-snug transition-colors">
                                                                {item.title}
                                                            </p>
                                                        </a>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <p>{msg.content}</p>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
                {isTyping && (
                    <div className="ml-14 flex items-center gap-2 text-neutral-500 text-sm animate-pulse">
                        <div className="w-2 h-2 bg-neutral-600 rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-neutral-600 rounded-full animate-bounce delay-75" />
                        <div className="w-2 h-2 bg-neutral-600 rounded-full animate-bounce delay-150" />
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className="w-full px-4 md:px-8 pb-6 pt-4 z-20 bg-neutral-950 border-t border-white/5">
                <div className="relative bg-neutral-900 border border-white/10 rounded-3xl flex items-center p-2 shadow-2xl">
                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                    <button onClick={() => fileInputRef.current?.click()} className="p-3 text-neutral-400 hover:text-white transition-colors"><Paperclip size={20} /></button>
                    <input
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder="Ask follow-up questions..."
                        className="flex-1 bg-transparent border-0 text-white placeholder:text-neutral-500 focus:outline-none px-4"
                    />
                    <button onClick={() => handleSendMessage()} className="p-3 bg-white text-black rounded-full hover:bg-neutral-200 transition-colors"><Send size={18} /></button>
                </div>
            </div>

            {/* Certificate Name Modal */}
            {showNameModal && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-neutral-900 border border-white/10 p-8 rounded-3xl max-w-md w-full shadow-2xl animate-in zoom-in-95">
                        <h3 className="text-2xl font-bold text-white mb-2">Details for Certificate</h3>
                        <p className="text-neutral-400 mb-6 font-medium">Please enter your full name as you want it to appear on the certificate.</p>

                        <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2 block">Full Name</label>
                        <input
                            value={certificateName}
                            onChange={(e) => setCertificateName(e.target.value)}
                            placeholder="e.g. John Doe"
                            className="w-full bg-black border border-white/15 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/40 transition-colors mb-6 text-lg"
                            autoFocus
                        />

                        <div className="flex gap-3">
                            <button onClick={() => setShowNameModal(false)} className="flex-1 py-3 rounded-xl bg-neutral-800 text-neutral-300 hover:bg-neutral-700 font-medium transition-colors">Cancel</button>
                            <button
                                onClick={() => { setShowNameModal(false); setShowCertificate(true); }}
                                disabled={!certificateName.trim()}
                                className="flex-1 py-3 rounded-xl bg-white text-black font-bold hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Generate Certificate
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}