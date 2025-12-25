export type AgentRole = 'moderator' | 'skeptic' | 'visionary' | 'historian' | 'optimist' | 'realist';

export interface AgentConfig {
    id: string;
    role: AgentRole;
    name: string;
    avatar: string; // URL or Lucide icon name
    bio: string; // System instruction for personality
    model: string; // 'gemini-2.0-flash' | 'gemini-2.0-flash-thinking-exp-01-21'
    fields?: string[]; // Areas of expertise
}

export interface CouncilMessage {
    id: string;
    agentId: string; // 'user' or config.id
    content: string;
    timestamp: number;
    type: 'argument' | 'rebuttal' | 'synthesis' | 'verdict' | 'query';
    references?: string[]; // Citations or links
}

export interface DebateStatus {
    round: number;
    phase: 'opening' | 'debate' | 'synthesis' | 'concluded';
    currentSpeakerId?: string;
    verdict?: string; // Final moderator summary
}
