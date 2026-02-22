import mongoose, { Schema, Model, Types } from "mongoose";

export interface IJourney {
    userId: Types.ObjectId;
    subject: string;
    onboarding: {
        qualification: string;
        ageRange: string;
        language: string;
        studyTime: string;
        learningDepth: string;
        motivation: string;
        assessmentScore?: number;
        primaryGoal?: string;
        secondaryGoals?: string[];
        roadmap?: Array<{ title: string; topics: string[] }>;
        preferredLanguage?: string;
    };
    progress: {
        completedModules: string[];
        currentModule?: string;
        topicModules?: Record<string, any[]>;
        totalSessions: number;
        lastActive: Date;
    };
    chatId?: Types.ObjectId;
    status: "active" | "completed";
    createdAt: Date;
    updatedAt: Date;
}

const JourneySchema = new Schema<IJourney>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        subject: { type: String, required: true },
        onboarding: {
            qualification: String,
            ageRange: String,
            language: String,
            studyTime: String,
            learningDepth: String,
            motivation: String,
            assessmentScore: Number,
            primaryGoal: String,
            secondaryGoals: [String],
            roadmap: [{
                title: String,
                topics: [String]
            }],
            preferredLanguage: String
        },
        progress: {
            completedModules: { type: [String], default: [] },
            currentModule: { type: String },
            topicModules: { type: Schema.Types.Mixed, default: {} },
            totalSessions: { type: Number, default: 0 },
            lastActive: { type: Date, default: Date.now }
        },
        chatId: { type: Schema.Types.ObjectId, ref: 'Chat' },
        status: { type: String, enum: ["active", "completed"], default: "active" }
    },
    { timestamps: true }
);

const Journey: Model<IJourney> = mongoose.models.Journey || mongoose.model<IJourney>("Journey", JourneySchema);

export default Journey;
