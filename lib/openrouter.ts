export function getAllApiKeys() {
    const keys: Set<string> = new Set();

    // Aggregate keys from environment variables
    const k1 = import.meta.env.VITE_OPENROUTER_API_KEY_1;
    const k2 = import.meta.env.VITE_OPENROUTER_API_KEY_2;
    const k3 = import.meta.env.VITE_OPENROUTER_API_KEY_3;
    const orKey = import.meta.env.VITE_OPENROUTER_API_KEY;
    const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
    const councilKey = import.meta.env.VITE_COUNCIL_API_KEY;

    if (k1) keys.add(k1);
    if (k2) keys.add(k2);
    if (k3) keys.add(k3);
    if (orKey) keys.add(orKey);
    if (geminiKey && geminiKey.startsWith('sk-or-v1-')) keys.add(geminiKey);
    if (councilKey) keys.add(councilKey);

    // Filter out empties and duplicates (Set handles duplicates)
    return Array.from(keys).filter(k => !!k);
}

export class Chat {
    public model: string;
    public systemInstruction: string;
    public history: any[];

    constructor(model: string, systemInstruction: string, history: any[]) {
        // Force Gemini 2.0 model on OpenRouter
        this.model = "google/gemini-2.0-flash-001";
        this.systemInstruction = systemInstruction;
        this.history = history || [];
    }

    async sendMessage({ message }: { message: string }) {
        const messages = [];
        if (this.systemInstruction) {
            messages.push({ role: "system", content: this.systemInstruction });
        }

        for (const msg of this.history) {
            const role = msg.role === "model" ? "assistant" : "user";
            let content = "";
            if (msg.parts && msg.parts.length > 0) {
                content = msg.parts.map((p: any) => p.text).join("\n");
            } else if (msg.content) {
                content = msg.content;
            }
            messages.push({ role, content });
        }

        messages.push({ role: "user", content: message });

        const apiKeys = getAllApiKeys();
        if (apiKeys.length === 0) {
            throw new Error("No OpenRouter API keys found in environment variables.");
        }

        // Shuffle keys to distribute load
        const shuffledKeys = [...apiKeys].sort(() => Math.random() - 0.5);
        let lastError: any = null;

        for (const apiKey of shuffledKeys) {
            try {
                const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${apiKey}`,
                        "Content-Type": "application/json",
                        "HTTP-Referer": "http://localhost:5173",
                        "X-Title": "HyperMind"
                    },
                    body: JSON.stringify({
                        model: this.model,
                        messages: messages
                    })
                });

                if (response.status === 401 || response.status === 402 || response.status === 429) {
                    const errText = await response.text();
                    console.warn(`API key failed with status ${response.status}. Trying next key...`, errText);
                    lastError = new Error(`OpenRouter Error: ${response.status} ${errText}`);
                    continue; // Try next key
                }

                if (!response.ok) {
                    const errText = await response.text();
                    throw new Error(`OpenRouter Error: ${response.status} ${errText}`);
                }

                const data = await response.json();
                const textResponse = data.choices[0]?.message?.content || "";

                // Push to local history
                this.history.push({ role: "user", parts: [{ text: message }] });
                this.history.push({ role: "model", parts: [{ text: textResponse }] });

                return { text: textResponse };
            } catch (error: any) {
                console.error("Fetch attempt failed:", error);
                lastError = error;
                // If it's a network error or other fetch error, try next key
                continue;
            }
        }

        throw lastError || new Error("All API keys failed or no keys available.");
    }
}

class OpenRouterModels {
    async generateContent({ model, contents, config }: any) {
        let systemInstruction = "";
        if (config?.systemInstruction) {
            if (typeof config.systemInstruction === "string") {
                systemInstruction = config.systemInstruction;
            } else if (config.systemInstruction.parts) {
                systemInstruction = config.systemInstruction.parts.map((p: any) => p.text).join("\\n");
            }
        }

        const messages = [];
        if (systemInstruction) {
            messages.push({ role: "system", content: systemInstruction });
        }

        for (const msg of contents) {
            const role = msg.role === "model" ? "assistant" : "user";
            let content = "";
            if (msg.parts && msg.parts.length > 0) {
                content = msg.parts.map((p: any) => p.text).join("\n");
            } else if (msg.content) {
                content = msg.content;
            }
            messages.push({ role, content });
        }

        const apiKeys = getAllApiKeys();
        if (apiKeys.length === 0) {
            throw new Error("No OpenRouter API keys found in environment variables.");
        }

        const shuffledKeys = [...apiKeys].sort(() => Math.random() - 0.5);
        let lastError: any = null;

        // Force gemini 2.0 model
        const actualModel = "google/gemini-2.0-flash-001";

        for (const apiKey of shuffledKeys) {
            try {
                const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${apiKey}`,
                        "Content-Type": "application/json",
                        "HTTP-Referer": "http://localhost:5173",
                        "X-Title": "HyperMind"
                    },
                    body: JSON.stringify({
                        model: actualModel,
                        messages: messages
                    })
                });

                if (response.status === 401 || response.status === 402 || response.status === 429) {
                    const errText = await response.text();
                    console.warn(`API key failed with status ${response.status}. Trying next key...`, errText);
                    lastError = new Error(`OpenRouter Error: ${response.status} ${errText}`);
                    continue;
                }

                if (!response.ok) {
                    const errText = await response.text();
                    throw new Error(`OpenRouter Error: ${response.status} ${errText}`);
                }

                const data = await response.json();
                const textResponse = data.choices[0]?.message?.content || "";

                return { text: textResponse };
            } catch (error: any) {
                lastError = error;
                continue;
            }
        }

        throw lastError || new Error("All API keys failed.");
    }
}


export class GoogleGenAIOpenRouter {
    constructor(options?: any) { }
    models = new OpenRouterModels();
    chats = {
        create: (options: any) => {
            let sysInst = "";
            if (options.config?.systemInstruction) {
                sysInst = typeof options.config.systemInstruction === 'string'
                    ? options.config.systemInstruction
                    : typeof options.config.systemInstruction.parts !== 'undefined'
                        ? options.config.systemInstruction.parts.map((p: any) => p.text).join('')
                        : options.config.systemInstruction;
            }
            return new Chat("google/gemini-2.0-flash-001", sysInst, options.history || []);
        }
    }
}
