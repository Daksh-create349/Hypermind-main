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

    // Learning Progress
    progress: {
        completedModules: string[]; // List of module IDs or titles
        currentModule?: string;
    };

    certificates: Array<{
        title: string;
        date: Date;
        url?: string;
    }>;

    // Onboarding Data
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
        },

        certificates: [{
            title: String,
            date: { type: Date, default: Date.now },
            url: String
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
            primaryGoal: String
        }
    },
    { timestamps: true }
);

// Prevent overwrite on HMR
const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
