
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { SplineScene } from './ui/spline';
import { UserButton } from '@clerk/clerk-react';
import { Send, Paperclip, Loader2, BrainCircuit, Phone, Award, CheckCircle2, AlertCircle, ArrowRight, RotateCcw, X, BookOpen, ChevronRight, ChevronLeft, PlayCircle, Flame, Trophy, Gem, FileText, Sparkles, Gavel, Minus, History } from 'lucide-react';
import { GoogleGenAIOpenRouter as GoogleGenAI, Chat } from "../lib/openrouter";
import { cn, blobToBase64, extractTextFromPdf, parseJsonFromText } from '../lib/utils';
import { marked } from 'marked';
import { Diagram } from './Diagram';
import { Quiz } from './Quiz';
import { GenUI } from './GenUI';
import { LiveSession } from './LiveSession';
import { Certificate } from './Certificate';
import { NotesInterface } from './NotesInterface';
import { Leaderboard } from './Leaderboard';
import { getGamificationStats, updateLoginStreak, addXP, getLevelTitle, UserStats } from '../lib/gamification';

// Types
export interface Topic {
    id: string;
    title: string;
    description: string;
}

const PERSONAS = [
    {
        id: 'musk',
        name: 'Elon Musk',
        role: 'First Principles Thinker',
        img: 'https://upload.wikimedia.org/wikipedia/commons/3/34/Elon_Musk_Royal_Society_%28crop2%29.jpg',
        prompt: 'Explain via first principles. Focus on physics, cost-optimization, and future impact. Be direct, use engineering analogies, and be slightly brusque.'
    },
    {
        id: 'feynman',
        name: 'Richard Feynman',
        role: 'The Great Explainer',
        img: 'https://upload.wikimedia.org/wikipedia/en/4/42/Richard_Feynman_Nobel.jpg',
        prompt: 'Use no jargon. Use simple real-world analogies (like rubber bands or water). Be playful, curious, and energetic. If you can\'t explain it to a 5-year-old, you don\'t understand it.'
    },
    {
        id: 'socrates',
        name: 'Socrates',
        role: 'The Philosopher',
        img: 'https://upload.wikimedia.org/wikipedia/commons/b/bc/Socrate_du_Louvre.jpg',
        prompt: 'Don\'t just give answers. Ask guiding questions. Use the Socratic method to lead me to the truth. Challenge my assumptions.'
    },
    {
        id: 'jobs',
        name: 'Steve Jobs',
        role: 'Visionary',
        img: 'https://upload.wikimedia.org/wikipedia/commons/b/b9/Steve_Jobs_Headshot_2010-CROP.jpg',
        prompt: 'Focus on aesthetics, simplicity, and user experience. Be demanding but inspiring. Use words like "magic", "craft", and "insanely great". Focus on the "why" not just the "how".'
    }
];

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
    onLaunchCouncil?: () => void;
}

export function ChatInterface({ userData, mode = 'learn', onLaunchCouncil }: ChatInterfaceProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [currentMode, setCurrentMode] = useState(mode);
    const [chatSession, setChatSession] = useState<any | null>(null);
    const [sessionId, setSessionId] = useState<string>('default');

    const [attachedImages, setAttachedImages] = useState<{ data: string, mime: string }[]>([]);
    const [isProcessingFile, setIsProcessingFile] = useState(false);
    const [isLiveOpen, setIsLiveOpen] = useState(false);
    const [showMap, setShowMap] = useState(true);
    const [showNotes, setShowNotes] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [pastChats, setPastChats] = useState<any[]>([]);

    // Learning Path State
    // Learning Path State
    const [completedModules, setCompletedModules] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('hypermind_progress');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        } catch (e) { }
        return userData?.progress?.completedModules || [];
    });
    const [currentModule, setCurrentModule] = useState<string | null>(userData?.progress?.currentModule || null);
    const [showCertificate, setShowCertificate] = useState(false);
    const [showNameModal, setShowNameModal] = useState(false);
    const [certificateName, setCertificateName] = useState(userData?.name || "Student");
    const [showLeaderboard, setShowLeaderboard] = useState(false);

    // Module Selection State
    const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
    const [topicModules, setTopicModules] = useState<Topic[] | null>(null);
    const [isLoadingModules, setIsLoadingModules] = useState(false);
    const [topicModulesMap, setTopicModulesMap] = useState<Record<string, Topic[]>>(() => {
        return userData?.progress?.topicModules || {};
    });

    // Persona State
    const [showPersonaSelector, setShowPersonaSelector] = useState(false);
    const [targetModule, setTargetModule] = useState<string | null>(null);
    const [selectedPersona, setSelectedPersona] = useState<typeof PERSONAS[0] | null>(null);
    const [showCustomInput, setShowCustomInput] = useState(false);
    const [customPrompt, setCustomPrompt] = useState("");
    const [autoLoadedSubject, setAutoLoadedSubject] = useState<string | null>(null);

    // Gamification State
    const [userStats, setUserStats] = useState<UserStats>(() => updateLoginStreak());

    useEffect(() => {
        const handleStatsUpdate = () => setUserStats(getGamificationStats());
        window.addEventListener('gamification_update', handleStatsUpdate);
        return () => window.removeEventListener('gamification_update', handleStatsUpdate);
    }, []);

    // Sync state with props when userData arrives or changes
    useEffect(() => {
        if (userData?.progress) {
            if (userData.progress.completedModules && completedModules.length === 0) {
                setCompletedModules(userData.progress.completedModules);
            }
            if (userData.progress.currentModule && !currentModule) {
                setCurrentModule(userData.progress.currentModule);
            }
            if (userData.progress.topicModules) {
                setTopicModulesMap(prev => ({ ...prev, ...userData.progress.topicModules }));
            }
            // If we have a last active subject and no selected one yet, use it
            if (userData.progress.lastActiveSubject && !selectedTopic && !topicModules) {
                // This will trigger the auto-load effect if chatSession is ready
            }
        }
    }, [userData]);

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
        if (userData?.email) {
            fetch(`/api/chat?email=${userData.email}`)
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) {
                        setPastChats(data);
                        // Auto-resume active chat on first load if nothing is loaded
                        if (messages.length === 0 && userData?.progress?.activeChatId) {
                            const activeChat = data.find(c => c._id === userData.progress.activeChatId);
                            if (activeChat && activeChat.messages) {
                                setMessages(activeChat.messages);
                                setSessionId(activeChat._id); // Triggers initChat to build AI context for this ID
                            }
                        }
                    }
                })
                .catch(err => console.error("Failed to fetch history", err));
        }
    }, [userData?.email, showHistory]);

    // Background sync of progress
    useEffect(() => {
        // CRITICAL: Preserve existing curricula by only syncing if we have data 
        // OR if the userData has already been loaded from the DB.
        const hasLocalData = Object.keys(topicModulesMap).length > 0;
        const isUserDataLoaded = !!userData?.progress;

        if (userData?.email && (hasLocalData || isUserDataLoaded)) {
            fetch('/api/user/progress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: userData.email,
                    progress: {
                        completedModules,
                        currentModule,
                        topicModules: topicModulesMap,
                        activeChatId: sessionId.startsWith('default') ? null : sessionId,
                        lastActiveSubject: selectedTopic || userData?.selectedSubject || userData?.progress?.lastActiveSubject
                    }
                })
            }).catch(e => console.error("Failed to sync progress", e));
        }
    }, [completedModules, currentModule, sessionId, topicModulesMap, userData?.email]);

    useEffect(() => {
        const initChat = async () => {
            if (!import.meta.env.VITE_GEMINI_API_KEY) {
                console.error("API Key missing");
                return;
            }

            try {
                // DIRECT KEY USAGE: Use the standard Vite env var (Safe & Robust)
                const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

                const ai = new GoogleGenAI({ apiKey: apiKey });
                const systemInstruction = `You are HyperMind, an advanced AI tutor.

                RULES:
                1. For "Teach me" requests, provide clearly formatted, easy - to - understand TEXT explanations.
    2. JSON OUPUT(Only when requested or highly relevant):
                - Charts: { "genUi": { "type": "line-chart", ... } }
            - Quizzes: { "quiz": { "questions": [{ "question": "...", "options": [...], "answer": "...", "explanation": "Detailed reason why this option is correct." }] } }
            - Diagrams: { "diagram": { "nodes": [], "edges": [] } }
            - Curriculum: { "curriculum": [...] }(ONLY if asked for a path / syllabus)
                - YouTube: { "youtube": [{ "title": "Video Title", "query": "Exact Search Query for YouTube" }] } (ALWAYS include 1 - 2 search queries for every teaching topic)
    
    Separate JSON from text.Always prioritize helpful text explanations.`;

                const history = messages
                    .filter(m => !m.isError)
                    .map(m => ({
                        role: m.role === 'user' ? 'user' : 'model',
                        parts: [{ text: m.content }]
                    }));


                const chat = ai.chats.create({
                    model: 'gemini-1.5-flash',
                    config: { systemInstruction },
                    history: history
                });

                if (!sessionId.startsWith('default')) {
                    (chat as any)._id = sessionId;
                }

                setChatSession(chat);
            } catch (error) {
                console.error("Failed to initialize AI", error);
            }
        };
        initChat();
    }, [currentMode, sessionId]);


    useEffect(() => {
        const activeSubj = userData?.selectedSubject || userData?.progress?.lastActiveSubject || (userData?.onboarding?.subjects?.[0]);

        if (activeSubj && chatSession && autoLoadedSubject !== activeSubj) {
            setShowMap(true);
            // Removed auto-fetch to show Roadmap first as requested
            setAutoLoadedSubject(activeSubj);
        }
    }, [userData?.selectedSubject, userData?.progress?.lastActiveSubject, chatSession, autoLoadedSubject]);

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

                content = content.replace(JSON.stringify(rawJson), '').replace(/```json[\s\S]*? ```/g, '').replace(/```[\s\S]*? ```/g, '').trim();
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

        // Local variable to track the *intended* current module for this message
        // This fixes the stale state bug inside the setTimeout
        let activeModule = currentModule;

        // Track current module if user is asking to learn
        if (text.startsWith("Teach me about")) {
            const modName = text.replace("Teach me about ", "");
            setCurrentModule(modName);
            activeModule = modName; // Update local ref immediately
            // Append instruction to ensure text response
            if (!hidden) text = `Teach me about ${modName}. Explain it in detail with examples.`;
        } else if (text.startsWith("Generate a 5 question quiz for ")) {
            const modName = text.replace("Generate a 5 question quiz for ", "").split(".")[0];
            setCurrentModule(modName);
            activeModule = modName;
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
            if ((text.startsWith("Teach me about") && !processed.quizData) || (activeModule && !processed.quizData && !processed.isAction && !isQuizRequest && !text.includes("doubt") && !text.includes("Generate a 5 question quiz"))) {
                setTimeout(() => {
                    const actionMsg: Message = {
                        id: Date.now() + 2,
                        role: 'ai',
                        content: "",
                        isAction: true,
                        actionType: 'lesson_options',
                        actionData: { module: activeModule }, // Use local variable
                        timestamp: new Date().toLocaleTimeString()
                    };
                    setMessages(prev => [...prev, actionMsg]);
                }, 800);
            }

            // Sync Chat immediately after AI response
            if (userData?.email) {
                try {
                    // Send entire conversation state up to DB
                    // Note: We use the *updated* set of messages since setMessages runs async
                    const currentChatState = [...messages, (hidden ? null : {
                        id: Date.now(),
                        role: 'user',
                        content: userText,
                        images: attachedImages.map(img => img.data),
                        timestamp: new Date().toLocaleTimeString()
                    }), aiMsg].filter(Boolean);

                    let generatedTitle = `Chat with HyperMind - ${new Date().toLocaleDateString()}`;
                    if (chatSession?.title && !chatSession.title.startsWith('Chat with HyperMind')) {
                        generatedTitle = chatSession.title;
                    } else if (activeModule) {
                        generatedTitle = activeModule;
                    } else if (userText) {
                        const cleanText = userText.replace(/teach me about/i, '').trim();
                        generatedTitle = cleanText.split(' ').slice(0, 4).join(' ') + (cleanText.split(' ').length > 4 ? '...' : '');
                    }

                    const res = await fetch('/api/chat', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            email: userData.email,
                            title: generatedTitle,
                            messages: currentChatState,
                            chatId: sessionId.startsWith('default') ? undefined : sessionId
                        })
                    });
                    const data = await res.json();
                    if (data && data._id && sessionId.startsWith('default')) {
                        setSessionId(data._id);
                    }
                } catch (e) {
                    console.error("Failed to sync chat to DB", e);
                }
            }

        } catch (error: any) {
            console.error("AI Error:", error);

            console.error("AI Error:", error);

            const isQuota = error.message?.includes('429') || error.status === 429 || error.toString().includes('Quota') || error.toString().includes('429');
            const isKeyError = error.message?.includes('400') || error.status === 400 || error.message?.includes('403') || error.status === 403 || error.message?.includes('API key');

            let errorMessage = "I encountered a connection error. Please try again.";
            let errorHtml = `< p class="text-neutral-400 font-bold" > Connection Error</p > `;

            if (isQuota) {
                errorMessage = "API Quota Exceeded. Please try again later.";
                errorHtml = `< p class="text-red-400 font-bold" >⚠️ API Quota Limit Reached</p > <p class="text-neutral-500 text-sm">The AI service is temporarily unavailable due to high traffic. Please try again in a few minutes.</p>`;
            } else if (isKeyError) {
                errorMessage = "Invalid API Key. Please check your configuration.";
                errorHtml = `< p class="text-red-400 font-bold" >🔑 Invalid API Key</p > <p class="text-neutral-500 text-sm">Please check your .env file and ensure the API key is correct.</p>`;
            } else {
                // Fallback: Show exact error for debugging
                errorMessage = `Connection Error: ${error.message} `;
                errorHtml = `< p class="text-red-400 font-bold" > Connection Error</p > <p class="text-neutral-500 text-sm font-mono mt-1">${error.message || JSON.stringify(error)}</p>`;
            }

            const errorMsg: Message = {
                id: Date.now() + 1,
                role: 'ai',
                content: errorMessage,
                htmlContent: errorHtml + `< div class="mt-2" > <button onclick="window.location.reload()" class="bg-red-500/10 text-red-400 px-3 py-1 rounded text-xs hover:bg-red-500/20 transition-colors">↻ Switch API Key & Retry</button></div > `,
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

                // Gamification: Add XP
                const { stats: newStats, leveledUp } = addXP(100);
                if (leveledUp) {
                    handleSendMessage(`I just leveled up! Congratulations to me!`, true, true);
                }

                // Sync with backend
                if (userData?.email) {
                    fetch('http://localhost:3001/api/user/stats', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            email: userData.email,
                            stats: newStats
                        })
                    }).catch(err => console.error("XP Sync failed", err));
                }
            }

            // Return to selecting modules after observing the passing result
            setTimeout(() => {
                setCurrentModule(null);
                setShowMap(true);
            }, 4000);
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

        // PERSISTENCE CHECK: Prioritize existing modules from state or props
        const existingModules = topicModulesMap[topic] || userData?.progress?.topicModules?.[topic];

        if (existingModules && existingModules.length > 0) {
            setTopicModules(existingModules);
            setIsLoadingModules(false);

            // Sync to local map if it was only in props
            if (!topicModulesMap[topic]) {
                setTopicModulesMap(prev => ({ ...prev, [topic]: existingModules }));
            }
            return;
        }

        try {
            const prompt = `Break down the topic "${topic}" into 4 - 6 key learning modules / sub - topics. 
            Return strictly a JSON object with this structure:
    { "curriculum": [{ "id": "1", "title": "Module Title", "description": "Brief description" }] } `;

            const result = await chatSession.sendMessage({ message: prompt });
            const processed = processResponse(result.text);

            if (processed.curriculumData && processed.curriculumData.length > 0) {
                const modules = processed.curriculumData as Topic[];
                setTopicModules(modules);
                // Save to local map for persistence
                setTopicModulesMap(prev => ({
                    ...prev,
                    [topic]: modules
                }));
            } else {
                // Fallback if structured data fails
                handleSendMessage(`Teach me about ${topic} `, false);
                setSelectedTopic(null); // Cancel module flow
            }
        } catch (e) {
            console.error("Module generation failed", e);
            handleSendMessage(`Teach me about ${topic} `, false);
            setSelectedTopic(null);
        } finally {
            setIsLoadingModules(false);
        }
    };

    const handleModuleSelect = (module: Topic | string) => {
        const moduleTitle = typeof module === 'string' ? module : module.title;
        setTopicModules(null);
        setSelectedTopic(null);
        setShowMap(false);

        // INTERCEPT: Open Persona Selector
        setTargetModule(moduleTitle);
        setShowPersonaSelector(true);
    };

    const handlePersonaConfirm = (persona: typeof PERSONAS[0]) => {
        setSelectedPersona(persona);
        setShowPersonaSelector(false);
        setCurrentModule(targetModule);

        // Trigger the lesson with persona context
        const prompt = `Teach me about ${targetModule}. Explain it in detail.

        IMPORTANT: Act as ${persona.name} (${persona.role}).
        Style Guide: ${persona.prompt} `;

        handleSendMessage(prompt, false);
    };


    // --- 3. INITIAL FLOWCHART RENDERER (The "No Blank Screen" Fix) ---
    // Memoize this data to prevent Diagram re-renders loops
    const initialDiagramData = useMemo(() => {
        // Prioritize actually selected subject if coming from Continue flow
        const subject = userData?.selectedSubject || userData?.onboarding?.subjects?.[0] || userData?.subjects?.[0] || "Learning Path";

        // Check for new Roadmap structure
        const roadmapData = userData?.onboarding?.roadmap || userData?.roadmap;

        if (roadmapData && Array.isArray(roadmapData)) {
            const nodes: any[] = [];
            const edges: any[] = [];

            // 1. Root Node
            nodes.push({ id: 'root', label: subject, type: 'custom', data: { type: 'main' } });

            roadmapData.forEach((phase: any, phaseIdx: number) => {
                const phaseId = `phase - ${phaseIdx} `;

                // 2. Phase Nodes (Branches from Root)
                nodes.push({
                    id: phaseId,
                    label: phase.title,
                    type: 'custom',
                    data: { type: 'phase' }
                });

                edges.push({
                    id: `edge - root - ${phaseId} `,
                    source: 'root',
                    target: phaseId,
                    animated: true,
                    style: { stroke: '#ffffff', strokeWidth: 2 }
                });

                // 3. Topic Nodes (Branches from Phase)
                if (phase.topics) {
                    phase.topics.forEach((topic: string, topicIdx: number) => {
                        const topicId = `topic - ${phaseIdx} -${topicIdx} `;
                        nodes.push({
                            id: topicId,
                            label: topic,
                            type: 'custom',
                            data: { type: 'topic' }
                        });

                        edges.push({
                            id: `edge - ${phaseId} -${topicId} `,
                            source: phaseId,
                            target: topicId,
                            animated: false,
                            type: 'smoothstep',
                            style: { stroke: '#52525b', strokeWidth: 1.5, strokeDasharray: '5,5' }
                        });
                    });
                }
            });

            return { title: `${subject} Roadmap`, nodes, edges };
        }

        // Fallback for legacy data
        const vectors = userData?.onboarding?.secondaryGoals || userData?.secondaryGoals || ["Start"];
        return {
            title: `${subject} Mastery Path`,
            nodes: [
                { id: "root", label: subject, type: "custom" },
                ...vectors.map((vec: string, i: number) => ({
                    id: `node - ${i} `,
                    label: vec,
                    type: "custom"
                }))
            ],
            edges: vectors.map((_: string, i: number) => ({
                id: `edge - ${i} `,
                source: "root",
                target: `node - ${i} `,
                animated: true
            }))
        };
    }, [userData]);


    // --- 3. PERSONA SELECTOR OVERLAY (Replaces Standard View) ---
    if (showPersonaSelector) {
        console.log("RENDERING PERSONA SELECTOR");
        return (
            <div className="flex h-full w-full bg-black relative animate-in fade-in duration-500 overflow-hidden">
                {/* 3D Character Column */}
                <div className="w-1/2 h-full relative border-r border-white/10 hidden md:block">
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/80 z-10 pointer-events-none" />
                    <div className="absolute top-8 left-8 z-20">
                        <div className="bg-black/60 backdrop-blur border border-white/20 px-4 py-2 rounded-xl text-neutral-200 text-sm font-mono flex items-center gap-2">
                            <BrainCircuit size={14} className="animate-pulse text-indigo-400" /> Neural Link: Establishing...
                        </div>
                    </div>
                    <div className="w-full h-full relative z-0 scale-125">
                        <SplineScene scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode" className="w-full h-full" />
                    </div>
                </div>

                {/* Selection Column */}
                <div className="flex-1 h-full flex flex-col p-8 md:p-12 overflow-y-auto bg-neutral-950/80 backdrop-blur-xl">
                    <div className="max-w-xl mx-auto w-full space-y-8">
                        <div>
                            <button
                                onClick={() => {
                                    if (showCustomInput) setShowCustomInput(false);
                                    else setShowPersonaSelector(false);
                                }}
                                className="text-neutral-500 hover:text-white mb-6 flex items-center gap-2 transition-colors"
                            >
                                <ChevronLeft size={16} /> {showCustomInput ? "Back to Selection" : "Cancel"}
                            </button>

                            <h2 className="text-4xl font-bold text-white mb-2 tracking-tight">
                                {showCustomInput ? "Design Your Instructor" : "Identify Instructor"}
                            </h2>
                            <p className="text-neutral-400 text-lg">
                                {showCustomInput
                                    ? "Describe exactly how the AI should behave."
                                    : <span>Who should teach you <span className="text-white font-bold">{targetModule}</span>?</span>
                                }
                            </p>
                        </div>

                        {showCustomInput ? (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                                <textarea
                                    value={customPrompt}
                                    onChange={(e) => setCustomPrompt(e.target.value)}
                                    placeholder="e.g. You are a chill surfer dude who explains things using ocean analogies. Be super relaxed, use slang like 'gnarly' and 'totally', but keep the facts accurate."
                                    className="w-full h-48 bg-neutral-900/50 border border-white/10 rounded-2xl p-6 text-white text-lg focus:outline-none focus:border-white/30 transition-all resize-none"
                                    autoFocus
                                />
                                <button
                                    onClick={() => {
                                        if (!customPrompt.trim()) return;

                                        setShowPersonaSelector(false);
                                        setShowCustomInput(false);
                                        setCurrentModule(targetModule);

                                        const prompt = `Teach me about ${targetModule}. Explain it in detail.

        IMPORTANT: Act as a custom persona defined as follows:
    "${customPrompt}"
                                        
                                        Maintain this persona strictly throughout the explanation.`;

                                        handleSendMessage(prompt, false);
                                    }}
                                    disabled={!customPrompt.trim()}
                                    className="w-full py-4 rounded-xl bg-white text-black font-bold text-lg hover:bg-neutral-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    <Sparkles size={20} /> Initialize Custom Persona
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4">
                                {PERSONAS.map((p) => (
                                    <button
                                        key={p.id}
                                        onClick={() => handlePersonaConfirm(p)}
                                        className="group relative flex items-center gap-4 p-4 rounded-2xl bg-neutral-900/50 border border-white/5 hover:bg-neutral-900 hover:border-white/20 transition-all duration-300 hover:scale-[1.02] text-left overflow-hidden"
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                                        <div className="w-16 h-16 rounded-xl bg-neutral-800 overflow-hidden flex-shrink-0 border border-white/10 group-hover:border-white/40 transition-colors relative z-10">
                                            <img src={p.img} alt={p.name} className="w-full h-full object-cover filter grayscale group-hover:grayscale-0 transition-all duration-500" />
                                        </div>

                                        <div className="flex-1 relative z-10">
                                            <div className="flex justify-between items-center mb-1">
                                                <h3 className="font-bold text-white text-lg group-hover:text-indigo-300 transition-colors">{p.name}</h3>
                                                <ArrowRight size={16} className="text-neutral-600 group-hover:text-white transform -translate-x-4 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all" />
                                            </div>
                                            <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">{p.role}</div>
                                            <p className="text-sm text-neutral-400 line-clamp-2 group-hover:text-neutral-300 transition-colors">{p.prompt}</p>
                                        </div>
                                    </button>
                                ))}

                                {/* Custom Persona Button */}
                                <button
                                    onClick={() => setShowCustomInput(true)}
                                    className="group relative flex items-center gap-4 p-4 rounded-2xl bg-indigo-900/20 border border-indigo-500/20 hover:bg-indigo-900/40 hover:border-indigo-500/50 transition-all duration-300 hover:scale-[1.02] text-left overflow-hidden"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                                    <div className="w-16 h-16 rounded-xl bg-neutral-900 overflow-hidden flex-shrink-0 border border-indigo-500/30 group-hover:border-indigo-400 transition-colors relative z-10 flex items-center justify-center">
                                        <Sparkles size={32} className="text-indigo-400 group-hover:text-white transition-colors" />
                                    </div>

                                    <div className="flex-1 relative z-10">
                                        <div className="flex justify-between items-center mb-1">
                                            <h3 className="font-bold text-white text-lg group-hover:text-indigo-300 transition-colors">Create Custom</h3>
                                            <ArrowRight size={16} className="text-indigo-400 group-hover:text-white transform -translate-x-4 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all" />
                                        </div>
                                        <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1">Hyper-Personalized</div>
                                        <p className="text-sm text-neutral-400 line-clamp-2 group-hover:text-neutral-300 transition-colors">Define your own instructor personality and teaching style.</p>
                                    </div>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

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
                                // If label matches a known phase or topic, create modules
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
                                        {topicModules?.map((mod, idx) => {
                                            const isCompleted = completedModules.includes(mod.title);
                                            const isCurrent = currentModule === mod.title;
                                            return (
                                                <button
                                                    key={idx}
                                                    onClick={() => handleModuleSelect(mod)}
                                                    className={`w-full text-left bg-neutral-950 hover:bg-neutral-800 border ${isCompleted ? 'border-green-500/50' : isCurrent ? 'border-yellow-500/50' : 'border-white/5'} hover:border-white/20 p-5 rounded-xl transition-all group flex items-start gap-4`}
                                                >
                                                    <div className={`w-10 h-10 rounded-lg ${isCompleted ? 'bg-green-500/20 text-green-400' : isCurrent ? 'bg-yellow-500/20 text-yellow-400' : 'bg-neutral-900 text-white'} flex items-center justify-center flex-shrink-0 group-hover:bg-opacity-80 transition-colors`}>
                                                        <span className="font-bold text-sm">{isCompleted ? <CheckCircle2 size={18} /> : idx + 1}</span>
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex justify-between items-start mb-1">
                                                            <h3 className="font-bold text-white group-hover:text-indigo-300 transition-colors flex items-center gap-2">
                                                                {mod.title}
                                                                <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity transform -translate-x-2 group-hover:translate-x-0" />
                                                            </h3>
                                                            {isCompleted ? (
                                                                <span className="text-xs font-bold bg-green-500/20 text-green-400 px-2 py-1 rounded-full border border-green-500/30">Completed</span>
                                                            ) : (
                                                                <span className="text-xs font-bold bg-neutral-900 text-neutral-400 px-2 py-1 rounded-full border border-white/10">Incomplete</span>
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-neutral-400 line-clamp-2">{mod.description}</p>
                                                    </div>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full relative">
            {/* Top Controls */}
            {/* Top Controls Header */}
            <div className="w-full flex justify-between items-center gap-2 p-4 border-b border-white/5 bg-black/20 backdrop-blur-sm z-20">
                {/* Gamification Stats (Left) */}
                <div className="flex items-center gap-3 md:gap-4 overflow-x-auto no-scrollbar">
                    <button
                        onClick={() => setShowLeaderboard(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900/80 border border-white/10 rounded-full hover:bg-neutral-800 transition-colors"
                    >
                        <Trophy size={14} className="text-yellow-500" />
                        <span className="text-xs font-bold text-white whitespace-nowrap">Lvl {userStats.level} <span className="text-neutral-500 font-medium hidden sm:inline">• {getLevelTitle(userStats.level)}</span></span>
                    </button>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900/80 border border-white/10 rounded-full">
                        <Flame size={14} className="text-orange-500 fill-orange-500/20" />
                        <span className="text-xs font-bold text-white whitespace-nowrap">{userStats.streak} Day{userStats.streak !== 1 && 's'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900/80 border border-white/10 rounded-full">
                        <Gem size={14} className="text-blue-400" />
                        <span className="text-xs font-bold text-white whitespace-nowrap">{userStats.xp} XP</span>
                    </div>
                </div>

                {/* Council Launch Button */}
                <button
                    onClick={onLaunchCouncil}
                    className="hidden md:flex items-center gap-2 px-3 py-1.5 ml-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:text-white hover:bg-indigo-500/20 rounded-full text-xs font-bold transition-all"
                >
                    <Gavel size={14} /> Council
                </button>

                {/* Right Controls */}
                <div className="flex items-center gap-2">
                    <div className="mr-2">
                        <UserButton afterSignOutUrl="/" />
                    </div>
                    <button
                        onClick={() => setShowMap(true)}
                        className="bg-neutral-900/80 hover:bg-neutral-800 text-neutral-400 hover:text-white p-2 rounded-full border border-white/10 transition-all"
                        title="View Roadmap"
                    >
                        <BrainCircuit size={16} />
                    </button>

                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        className="bg-neutral-900/80 hover:bg-neutral-800 text-neutral-400 hover:text-white p-2 rounded-full border border-white/10 transition-all"
                        title="Chat History"
                    >
                        <History size={16} />
                    </button>

                    <button
                        onClick={() => setShowNotes(true)}
                        className="bg-neutral-900/80 hover:bg-neutral-800 text-neutral-400 hover:text-white p-2 rounded-full border border-white/10 transition-all"
                        title="Smart Notes"
                    >
                        <FileText size={16} />
                    </button>

                    <button
                        onClick={() => setIsLiveOpen(true)}
                        className="bg-neutral-900 hover:bg-neutral-800 text-white p-2 rounded-full border border-white/10 transition-all"
                    >
                        <Phone size={16} fill="currentColor" />
                    </button>
                </div>
            </div>

            {isLiveOpen && <LiveSession onClose={() => setIsLiveOpen(false)} />}
            {showNotes && (
                <NotesInterface
                    onClose={() => setShowNotes(false)}
                    chatSession={chatSession}
                    currentContext={messages.map(m => m.content).join('\n')}
                />
            )}
            {showHistory && (
                <div className="absolute right-0 top-[72px] bottom-0 w-80 bg-neutral-950 border-l border-white/10 z-40 p-4 overflow-y-auto animate-in fade-in slide-in-from-right-8 fade-in-0 duration-300 shadow-2xl">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-white flex items-center gap-2"><History size={16} /> Chat History</h3>
                        <div className="flex gap-4 items-center">
                            <button onClick={() => {
                                setMessages([]);
                                setSessionId('default-' + Date.now()); // trigger new session
                                setShowHistory(false);
                            }} className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded-full transition-colors font-medium">
                                + New
                            </button>
                            <button onClick={() => setShowHistory(false)} className="text-neutral-400 hover:text-white"><X size={16} /></button>
                        </div>
                    </div>
                    {pastChats.length === 0 ? (
                        <p className="text-neutral-500 text-sm">No past conversations found.</p>
                    ) : (
                        <div className="space-y-3">
                            {pastChats.map((chat, idx) => (
                                <button key={idx} onClick={() => {
                                    setMessages(chat.messages || []);
                                    setSessionId(chat._id); // Set session ID the backend uses
                                    // Sync the new active chat back
                                    if (userData?.email) {
                                        fetch('/api/user/progress', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ email: userData.email, progress: { completedModules, currentModule, activeChatId: chat._id } })
                                        }).catch(() => { });
                                    }
                                    setShowHistory(false);
                                }} className="w-full text-left bg-neutral-900 hover:bg-neutral-800 p-3 rounded-lg border border-white/5 transition-colors group">
                                    <h4 className="text-sm font-semibold text-white group-hover:text-indigo-300 truncate">{chat.title}</h4>
                                    <p className="text-xs text-neutral-500 mt-1">{new Date(chat.createdAt).toLocaleDateString()}</p>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
            {showLeaderboard && <Leaderboard onClose={() => setShowLeaderboard(false)} />}

            {/* Message Stream */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-10 pb-4 overflow-x-hidden">
                {messages.map((msg) => (
                    <div key={msg.id} className={cn("flex gap-4 w-full", msg.role === 'user' ? "flex-row-reverse" : "")}>
                        <div className={cn("w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 border border-white/10", msg.role === 'user' ? "bg-neutral-900" : "bg-neutral-950")}>
                            {msg.role === 'user' ? <span className="text-xs font-bold text-neutral-400">ME</span> : <BrainCircuit size={20} className="text-white" />}
                        </div>
                        <div className={cn("flex flex-col gap-2 min-w-0 max-w-[85%]", msg.role === 'user' ? "items-end" : "items-start flex-1")}>
                            <div className={cn("rounded-2xl px-6 py-4 w-full", msg.role === 'user' ? "bg-neutral-900 text-white border border-white/5" : "bg-transparent text-neutral-200 p-0")}>
                                {msg.role === 'ai' ? (
                                    <>
                                        {msg.content && <div className="prose prose-invert prose-sm max-w-4xl" dangerouslySetInnerHTML={{ __html: msg.htmlContent || '' }} />}

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
                                                        <div key={t.id} onClick={() => handleSendMessage(`Teach me about ${t.title} `, false)} className="text-sm text-neutral-400 hover:text-white transition-colors cursor-pointer border-l border-white/10 pl-4 hover:border-white">
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
                                                        </a >
                                                    ))
                                                    }
                                                </div >
                                            </div >
                                        )}
                                    </>
                                ) : (
                                    <p>{msg.content}</p>
                                )}
                            </div >
                        </div >
                    </div >
                ))}
                {
                    isTyping && (
                        <div className="ml-14 flex items-center gap-2 text-neutral-500 text-sm animate-pulse">
                            <div className="w-2 h-2 bg-neutral-600 rounded-full animate-bounce" />
                            <div className="w-2 h-2 bg-neutral-600 rounded-full animate-bounce delay-75" />
                            <div className="w-2 h-2 bg-neutral-600 rounded-full animate-bounce delay-150" />
                        </div>
                    )
                }
            </div >

            {/* Input Area */}
            < div className="w-full px-4 md:px-8 pb-6 pt-4 z-20 bg-neutral-950 border-t border-white/5" >
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
            </div >

            {/* Module Selection Overlay (Universal) */}
            {(topicModules || isLoadingModules) && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
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
                                    {topicModules?.map((mod, idx) => {
                                        const isCompleted = completedModules.includes(mod.title);
                                        const isCurrent = currentModule === mod.title;
                                        return (
                                            <button
                                                key={idx}
                                                onClick={() => handleModuleSelect(mod)}
                                                className={`w-full text-left bg-neutral-950 hover:bg-neutral-800 border ${isCompleted ? 'border-green-500/50' : isCurrent ? 'border-yellow-500/50' : 'border-white/5'} hover:border-white/20 p-5 rounded-xl transition-all group flex items-start gap-4`}
                                            >
                                                <div className={`w-10 h-10 rounded-lg ${isCompleted ? 'bg-green-500/20 text-green-400' : isCurrent ? 'bg-yellow-500/20 text-yellow-400' : 'bg-neutral-900 text-white'} flex items-center justify-center flex-shrink-0 group-hover:bg-opacity-80 transition-colors`}>
                                                    <span className="font-bold text-sm">{isCompleted ? <CheckCircle2 size={18} /> : idx + 1}</span>
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <h3 className="font-bold text-white group-hover:text-indigo-300 transition-colors flex items-center gap-2">
                                                            {mod.title}
                                                            <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity transform -translate-x-2 group-hover:translate-x-0" />
                                                        </h3>
                                                        {isCompleted ? (
                                                            <span className="text-xs font-bold bg-green-500/20 text-green-400 px-2 py-1 rounded-full border border-green-500/30">Completed</span>
                                                        ) : (
                                                            <span className="text-xs font-bold bg-neutral-900 text-neutral-400 px-2 py-1 rounded-full border border-white/10">Incomplete</span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-neutral-400 line-clamp-2">{mod.description}</p>
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Certificate Name Modal */}
            {
                showNameModal && (
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
                )
            }
        </div >
    );
}