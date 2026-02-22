function getRandomApiKey() {
    // Collect all potential keys from environment
    const rawKeys = [
        import.meta.env.VITE_OPENROUTER_API_KEY_1,
        import.meta.env.VITE_OPENROUTER_API_KEY_2,
        import.meta.env.VITE_OPENROUTER_API_KEY_3,
        import.meta.env.VITE_OPENROUTER_API_KEY,
        import.meta.env.VITE_GEMINI_API_KEY
    ];

    // Filter out undefined, null, or empty strings
    const validKeys = rawKeys.filter(k => k && typeof k === 'string' && k.trim().length > 0);

    if (validKeys.length === 0) {
        console.warn("CRITICAL: No OpenRouter keys detected in client environment!");
        return "";
    }

    // Pick a random valid key
    const selectedKey = validKeys[Math.floor(Math.random() * validKeys.length)];

    // Log the first 4 characters to console (Helpful for debugging 401s)
    console.log(`[OpenRouter] Using key starting with: ${selectedKey.substring(0, 4)}...`);

    return selectedKey;
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
            // Google format is role: "user" | "model", parts: [{ text: "..." }]
            // OpenAI format is role: "user" | "assistant", content: "..."
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

        const apiKey = getRandomApiKey();

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "HTTP-Referer": window.location.origin, // Matches Vercel automatically
                "X-Title": "HyperMind" // Required by OpenRouter
            },
            body: JSON.stringify({
                model: this.model,
                messages: messages
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`OpenRouter Error: ${response.status} ${errText}`);
        }

        const data = await response.json();
        const textResponse = data.choices[0]?.message?.content || "";

        // Push to local history in Google SDK format to preserve state structure
        this.history.push({ role: "user", parts: [{ text: message }] });
        this.history.push({ role: "model", parts: [{ text: textResponse }] });

        return { text: textResponse };
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

        const apiKey = getRandomApiKey();

        // Force gemini 2.0 model
        const actualModel = "google/gemini-2.0-flash-001";

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "HTTP-Referer": window.location.origin,
                "X-Title": "HyperMind"
            },
            body: JSON.stringify({
                model: actualModel,
                messages: messages
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`OpenRouter Error: ${response.status} ${errText}`);
        }

        const data = await response.json();
        const textResponse = data.choices[0]?.message?.content || "";

        return { text: textResponse };
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
