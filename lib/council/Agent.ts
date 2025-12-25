import { GoogleGenAI, Chat } from "@google/genai";
import { AgentConfig, CouncilMessage } from "./types";

export class Agent {
    private model: string;
    private chat: Chat | null = null;
    public config: AgentConfig;
    private client: GoogleGenAI;

    constructor(config: AgentConfig, apiKey?: string) {
        this.config = config;
        // PRIORITY: Use valid VITE_COUNCIL_API_KEY if available, else fall back to standard key
        const councilKey = import.meta.env.VITE_COUNCIL_API_KEY;
        // FORCE USE of Council Key if present, ignoring the passed apiKey which might be from the exhausted rotating pool
        const key = (councilKey && councilKey.startsWith("AIza")) ? councilKey : (apiKey || import.meta.env.VITE_GEMINI_API_KEY);

        if (!key) console.error("Missing Gemini API Key in Council Agent");

        this.client = new GoogleGenAI({ apiKey: key });
        // Initialize model (we'll create the chat session on first run)
        // Note: The SDK usage here is simplified for the wrapper
    }

    public async initialize(context: string = "") {
        const systemInstruction = `
            You are ${this.config.name}, acting as the "${this.config.role}" in a Council of AI debate.
            
            YOUR BIO:
            ${this.config.bio}

            CONTEXT OF DEBATE:
            ${context}

            INSTRUCTIONS:
            - Stick strictly to your persona.
            - ANALYZE the provided Context/Documents above. Your arguments must be grounded in or explicitly reference this material where relevant.
            - Provide sharp, insightful arguments.
            - Refer to other agents' points when rebutting.
            - Keep responses concise (under 150 words) unless asked for a synthesis.
            - If you are the Moderator, you must be neutral, objective, and synthesis-focused.
            
            GLOBAL PARAMETERS:
            - Current Date: ${new Date().toLocaleString()}
            - Knowledge Cutoff: Ignored. Assume your internal training data is stale.
            - Search Requirement: You MUST use the 'googleSearch' tool for any query about "current", "latest", or "best".
        `;

        this.chat = this.client.chats.create({
            model: this.config.model,
            config: {
                systemInstruction,
                tools: [{ googleSearch: {} }] // Enable Real-Time Grounding
            },
            history: [] // Start fresh
        });
    }

    public async speak(
        history: CouncilMessage[],
        currentTopic: string,
        customInstruction?: string
    ): Promise<string> {
        if (!this.chat) throw new Error("Agent not initialized");

        // TOKEN OPTIMIZATION: Strict Sliding Window
        // Only send the last 4 messages to prevent token bursting.
        // The model relies on its system instruction and the immediate context.
        const recentMessages = history.slice(-4);

        // If customInstruction is provided, use it as the primary directive.
        // Otherwise, use the default turn-taking logic.
        const dynamicInstruction = customInstruction || (
            this.config.role === 'moderator'
                ? "Evaluate the arguments. If the topic is thoroughly explored and a clear consensus or solution is visible, output ONLY the text '[CONCLUSION_REACHED]'. Otherwise, summarize current points and ask a deepening question."
                : "Offer your unique perspective or rebut the previous point."
        );

        const contextPrompt = `
            CURRENT TOPIC: ${currentTopic}
            
            RECENT TRANSCRIPT:
            ${recentMessages.map(m => `${m.agentId.toUpperCase()}: ${m.content}`).join('\n')}

            DIRECTIVE: 
            ${dynamicInstruction}
        `;

        // Retry Logic (Exponential Backoff)
        let retries = 0;
        const maxRetries = 3;

        while (retries <= maxRetries) {
            try {
                const response = await this.chat.sendMessage({ message: contextPrompt });
                return response.text || "...";
            } catch (e: any) {
                retries++;
                const isQuota = e.message?.includes('429') || e.status === 429;

                if (retries > maxRetries) {
                    console.error(`Agent ${this.config.name} failed after ${maxRetries} retries:`, e);
                    return `*${this.config.name} is briefly lost in thought (API Limit Reached)*`;
                }

                console.warn(`Agent ${this.config.name} hit error (Attempt ${retries}/${maxRetries}). Retrying...`);

                // Wait: 1s, 2s, 4s...
                const delay = isQuota ? 2000 * Math.pow(2, retries - 1) : 1000;
                await new Promise(r => setTimeout(r, delay));
            }
        }

        // Fallback: If Pro failed, try Flash
        try {
            console.log(`Agent ${this.config.name} switching to fallback model (Flash 1.5).`);
            const fallbackChat = this.client.chats.create({
                model: 'gemini-1.5-flash',
                config: { systemInstruction: this.config.bio },
                history: []
            });
            const response = await fallbackChat.sendMessage({ message: contextPrompt });
            return response.text + " *(via backup 1.5 model)*";
        } catch (finalError) {
            console.error("Fallback failed", finalError);
            return `*${this.config.name} is unreachable.*`;
        }
    }
}
