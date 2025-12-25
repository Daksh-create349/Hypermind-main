import { Agent } from "./Agent";
import { AgentConfig, CouncilMessage, DebateStatus } from "./types";
import { searchGoogle } from "../tools/serpapi";

export class CouncilEngine {
    public agents: Map<string, Agent> = new Map();
    public messages: CouncilMessage[] = [];
    public status: DebateStatus;
    private apiKey: string;
    private topic: string = "";
    private userProfile: any = null;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
        this.status = {
            round: 0,
            phase: 'opening'
        };
    }

    public addAgent(config: AgentConfig) {
        const agent = new Agent(config, this.apiKey);
        this.agents.set(config.id, agent);
    }

    public async startDebate(topic: string, context: string = "", userProfile: any = null) {
        this.topic = topic;
        this.userProfile = userProfile;
        this.messages = []; // Clear previous

        // 1. DEEP RESEARCH LAYER (SerpAPI)
        // We force-feed the "Real Truth" before the debate even starts.
        let researchBrief = "";
        try {
            const queries = [
                `Latest news "${topic}" 2024 2025`,
                `Benchmarks and statistics for "${topic}"`,
                `Critiques and failures of "${topic}"`
            ];

            console.log("Conducting Deep Research...", queries);

            // Run in parallel for speed
            const results = await Promise.all(queries.map(q => searchGoogle(q)));
            researchBrief = results.join("\n\n");

        } catch (e) {
            console.error("Deep Research Failed:", e);
        }

        const fullContext = `
        TOPIC: ${topic}
        USER CONTEXT: ${context}
        
        === DEEP RESEARCH BRIEF (LIVE WEB DATA) ===
        (You must prioritize this data over your internal training set)
        ${researchBrief}
        ===========================================
        `;

        // Add user query as first message
        this.messages.push({
            id: 'init',
            agentId: 'user',
            content: `Topic: ${topic}\nContext: ${context}`,
            timestamp: Date.now(),
            type: 'query'
        });

        // Initialize all agents with the Research Brief
        await Promise.all(
            Array.from(this.agents.values()).map(a => a.initialize(fullContext))
        );

        this.status.phase = 'debate';
        this.status.round = 1;
    }

    // Run a single turn for a specific agent
    public async triggerTurn(agentId: string): Promise<CouncilMessage> {
        const agent = this.agents.get(agentId);
        if (!agent) throw new Error("Agent not found");

        this.status.currentSpeakerId = agentId;

        const content = await agent.speak(this.messages, this.topic);

        const message: CouncilMessage = {
            id: Date.now().toString(),
            agentId: agent.config.id,
            content: content,
            timestamp: Date.now(),
            type: agent.config.role === 'moderator' ? 'verdict' : 'argument'
        };

        this.messages.push(message);
        return message;
    }

    public addUserMessage(content: string): CouncilMessage {
        const message: CouncilMessage = {
            id: Date.now().toString(),
            agentId: 'user',
            content: content,
            timestamp: Date.now(),
            type: 'query'
        };
        this.messages.push(message);
        return message;
    }

    public async generateVerdict(): Promise<string> {
        const moderator = this.agents.get('moderator');
        if (!moderator) throw new Error("No moderator found for report generation");

        // Construct Personalization Context
        let profileContext = "";
        if (this.userProfile) {
            const interests = this.userProfile.subjects?.join(", ") || "General";
            const bio = this.userProfile.bio || "";
            profileContext = `
            USER PROFILE:
            - Interests/Major: ${interests}
            - Background: ${bio}
            - Mode: ${this.userProfile.mode || 'Learn'}

            CUSTOMIZATION RULE:
            - Tailor the roadmap SPECIFICALLY for this user.
            - If they are a CS student, use technical jargon (API, Stack, Algo).
            - If they are Business, use ROI, Market, Strategy.
            - If they are a beginner, provide a Learning Path.
            `;
        }

        const reportPrompt = `
            You are the Chief Justice of the Cognitive Court.
            
            YOUR GOAL: Provide a crystal-clear, plain-English answer to the user's problem.

            ${profileContext}
            
            CRITICAL RULES:
            1. DO NOT mention "The Plaintiff", "The Defendant", "The Debate", or "Arguments".
            2. DO NOT summarize what happened.
            3. IGNORE the legal jargon. Just give the solution.
            4. If the topic was a question (e.g. "Should I learn Rust?"), answer it with a YES, NO, or IT DEPENDS immediately.
            
            TONE: Helpful, Decisive, Clear, Action-Oriented.
            
            FORMAT (Markdown):
            # Strategic Roadmap
            
            ### 🎯 The Diagnosis
            [One clear, hard-hitting sentence defining the core problem.]
            
            ### 🗺️ The Strategy (Visual)
            \`\`\`mermaid
            graph TD
              Start[Current State] --> Decision{Key Choice}
              Decision -->|Path A| ResultA[Outcome A]
              Decision -->|Path B| ResultB[Outcome B]
              ResultA --> Goal[Final Goal]
            \`\`\`
            *(MANDATORY: You MUST include this Mermaid code block. It represents the visual strategy.)*
            
            ### 🪜 The Execution Plan
            **Phase 1: Immediate Action (Week 1)**
            - [ ] Step 1
            - [ ] Step 2
            
            **Phase 2: Consolidation (Month 1)**
            - [ ] Step 1
            - [ ] Step 2
            
            ### 📚 Trusted Sources
            *List of verified references used in this strategy:*
            *(MUST be clickable links: [Title](https://...))*
            1. [Source Title](URL) - *Key Insight*
            2. [Source Title](URL) - *Key Insight*

            *Cognitive Court Ruling*
        `;

        return await moderator.speak(this.messages, "Judicial Verdict Generation", reportPrompt);
    }

    // Helper to get suggested order: [Skeptic, Visionary, ..., Moderator]
    public getTurnOrder(): string[] {
        const order: string[] = [];
        this.agents.forEach((agent, id) => {
            if (agent.config.role !== 'moderator') order.push(id);
        });
        // Moderator always speaks last in a round
        const modId = Array.from(this.agents.values()).find(a => a.config.role === 'moderator')?.config.id;
        if (modId) order.push(modId);

        return order;
    }
}
