import mongoose, { Schema, Model, Types } from "mongoose";

export interface IMessage {
    role: 'user' | 'ai';
    content: string;
    timestamp: Date;
    metadata?: any; // For quiz results, diagrams, etc.
}

export interface IChat {
    userId: Types.ObjectId;
    title?: string;
    messages: any[];
    createdAt: Date;
    updatedAt: Date;
}

const MessageSchema = new Schema({
    role: { type: String, enum: ['user', 'ai'], required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    metadata: { type: Schema.Types.Mixed }
});

const ChatSchema = new Schema<IChat>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        title: { type: String },
        // @ts-ignore
        messages: { type: Array, default: [] }
    },
    { timestamps: true }
);

// Prevent overwrite on HMR
const Chat: Model<IChat> = mongoose.models.Chat || mongoose.model<IChat>("Chat", ChatSchema);

export default Chat;
