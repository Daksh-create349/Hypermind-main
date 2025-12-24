import mongoose, { Schema, Model, Types } from "mongoose";

export interface INote {
    userId: Types.ObjectId;
    title: string;
    nodes: any[]; // ReactFlow nodes
    edges: any[]; // ReactFlow edges
    tags?: string[];
    createdAt: Date;
    updatedAt: Date;
}

const NoteSchema = new Schema<INote>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        title: { type: String, required: true, default: "Untitled Note" },
        nodes: [{ type: Schema.Types.Mixed }],
        edges: [{ type: Schema.Types.Mixed }],
        tags: { type: [String], default: [] }
    },
    { timestamps: true }
);

// Prevent overwrite on HMR
const Note: Model<INote> = mongoose.models.Note || mongoose.model<INote>("Note", NoteSchema);

export default Note;
