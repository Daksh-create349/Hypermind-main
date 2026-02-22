import mongoose from 'mongoose';

const councilSessionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    topic: { type: String, required: true },
    context: { type: String, default: '' },
    agents: { type: Array, default: [] },
    messages: { type: Array, default: [] },
}, { timestamps: true });

const CouncilSession = mongoose.models.CouncilSession || mongoose.model('CouncilSession', councilSessionSchema);

export default CouncilSession;
