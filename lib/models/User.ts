import mongoose, { Schema, Model } from "mongoose";

export interface IUser {
    email: string;
    password?: string;
    name?: string;
    image?: string;
    provider?: "email" | "google" | "github";

    // Gamification
    gamification: {
        xp: number;
        level: number;
        streak: number;
        lastLogin: Date;
    };

    // Detailed Learning Analytics & Session Tracking
    progress: {
        completedModules: string[]; // History of masteries
        currentModule?: string;     // Active module ID
        activeChatId?: string;      // Last active session link
        topicModules?: Record<string, any[]>; // Persistent curriculum structures
        lastActiveSubject?: string;  // Subject context for "Welcome Back"
        totalSessions?: number;      // Frequency of use
        xpHistory: Array<{ date: Date; amount: number; reason: string }>; // Granular XP tracking
        engagementScore?: number;    // Calculated AI interaction metric
    };

    certificates: Array<{
        title: string;
        date: Date;
        url?: string;
        grade?: string;
    }>;

    // Rich Onboarding Metadata
    onboarding?: {
        qualification: string;
        ageRange: string;
        language: string;
        studyTime: string;
        subjects: string[];
        learningDepth: string;
        motivation: string;
        assessmentScore?: number;
        primaryGoal?: string;
        secondaryGoals?: string[];
        roadmap?: Array<{ title: string; topics: string[] }>;
        preferredLanguage?: string;
        onboardedAt: Date;
        lastUpdate: Date;
    };

    createdAt: Date;
    updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
    {
        email: {
            type: String,
            required: [true, "Please provide an email address"],
            unique: true,
            maxlength: [60, "Email cannot be more than 60 characters"],
        },
        password: {
            type: String,
            required: function (this: IUser) { return this.provider === 'email'; },
        },
        name: {
            type: String,
        },
        image: {
            type: String,
        },
        provider: {
            type: String,
            enum: ["email", "google", "github"],
            default: "email",
        },

        gamification: {
            xp: { type: Number, default: 0 },
            level: { type: Number, default: 1 },
            streak: { type: Number, default: 0 },
            lastLogin: { type: Date, default: null },
        },

        progress: {
            completedModules: { type: [String], default: [] },
            currentModule: { type: String },
            activeChatId: { type: String },
            topicModules: { type: Schema.Types.Mixed, default: {} },
            lastActiveSubject: { type: String },
            totalSessions: { type: Number, default: 0 },
            xpHistory: [{
                date: { type: Date, default: Date.now },
                amount: Number,
                reason: String
            }],
            engagementScore: { type: Number, default: 0 }
        },

        certificates: [{
            title: String,
            date: { type: Date, default: Date.now },
            url: String,
            grade: String
        }],

        onboarding: {
            qualification: String,
            ageRange: String,
            language: String,
            studyTime: String,
            subjects: [String],
            learningDepth: String,
            motivation: String,
            assessmentScore: Number,
            primaryGoal: String,
            secondaryGoals: [String],
            roadmap: [{
                title: String,
                topics: [String]
            }],
            preferredLanguage: String,
            onboardedAt: { type: Date, default: Date.now },
            lastUpdate: { type: Date, default: Date.now }
        }
    },
    { timestamps: true }
);

// Prevent overwrite on HMR
const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
