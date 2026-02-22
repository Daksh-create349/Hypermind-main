
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Import Models (ensure these files exist and are compiled/runnable via tsx)
// We need to use relative paths. Since we are in server/index.ts, models are in ../lib/models
// NOTE: We might need to adjust paths depending on how we run this. 
// Using `tsx` allows direct TS execution.

import User from '../lib/models/User';
import Chat from '../lib/models/Chat';
import Note from '../lib/models/Note';
import CouncilSession from '../lib/models/CouncilSession';

// Database Connection
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error("❌ MONGODB_URI is not defined in .env");
    process.exit(1);
}

mongoose.connect(MONGODB_URI)
    .then(() => console.log("✅ MongoDB Connected"))
    .catch(err => console.error("❌ MongoDB Connection Error:", err));

// Routes

// Root Route to ensure server status is visible in browser
app.get('/', (req, res) => {
    res.send('HyperMind Backend Server is running! This server only responds to /api requests. Please open your frontend URL (typically localhost:3000 or localhost:5173) to view the application.');
});

// 1. Sync User (Called after Clerk Login)
app.post('/api/user/sync', async (req, res) => {
    try {
        const { email, clerkId, name, image, provider } = req.body;

        if (!email) {
            res.status(400).json({ error: "Email is required" });
            return;
        }

        // Find or Create User
        // We use findOneAndUpdate with upsert to handle both cases efficiently
        const user = await User.findOneAndUpdate(
            { email },
            {
                $set: {
                    name,
                    image,
                    provider: provider || 'email',
                    // Update last login
                    'gamification.lastLogin': new Date()
                },
                $setOnInsert: {
                    // Default values for new users
                    'gamification.xp': 0,
                    'gamification.level': 1,
                    'gamification.streak': 0,
                    'progress.completedModules': []
                }
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        res.json(user);
    } catch (error) {
        console.error("Sync User Error:", error);
        res.status(500).json({ error: "Failed to sync user" });
    }
});

// 1.5 Save Onboarding Data
app.post('/api/user/onboarding', async (req, res) => {
    try {
        const { email, data } = req.body;
        if (!email) {
            res.status(400).json({ error: "Email required" });
            return;
        }

        const user = await User.findOneAndUpdate(
            { email },
            {
                $set: {
                    onboarding: {
                        qualification: data.qualification,
                        ageRange: data.ageRange,
                        language: data.language,
                        studyTime: data.studyTime,
                        subjects: data.subjects,
                        learningDepth: data.learningDepth,
                        motivation: data.motivation,
                        assessmentScore: data.assessmentScore,
                        primaryGoal: data.primaryGoal,
                        secondaryGoals: data.secondaryGoals,
                        roadmap: data.roadmap,
                        preferredLanguage: data.preferredLanguage || data.language
                    }
                }
            },
            { new: true }
        );

        res.json(user);
    } catch (error) {
        console.error("Onboarding Save Error:", error);
        res.status(500).json({ error: "Failed to save onboarding data" });
    }
});

// 1.6 Update User Stats (XP / Level)
app.post('/api/user/stats', async (req, res) => {
    try {
        const { email, stats } = req.body;
        if (!email || !stats) {
            res.status(400).json({ error: "Email and stats required" });
            return;
        }

        const user = await User.findOneAndUpdate(
            { email },
            {
                $set: {
                    'gamification.xp': stats.xp,
                    'gamification.level': stats.level,
                    'gamification.streak': stats.streak,
                    'gamification.lastLogin': new Date()
                }
            },
            { new: true }
        );
        res.json(user);
    } catch (error) {
        console.error("Stats Update Error:", error);
        res.status(500).json({ error: "Failed to update stats" });
    }
});

// 1.6.5 Reset User Progress
app.post('/api/user/reset', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: "Email required" });

        const user = await User.findOneAndUpdate(
            { email },
            {
                $set: {
                    'progress.completedModules': [],
                    'progress.currentModule': null,
                    'progress.activeChatId': null,
                    'progress.topicModules': {},
                    'onboarding': null
                }
            },
            { new: true }
        );
        res.json(user);
    } catch (error) {
        console.error("Reset Error:", error);
        res.status(500).json({ error: "Failed to reset data" });
    }
});

// 1.7 Update User Progress (Modules & Active Chat)
app.post('/api/user/progress', async (req, res) => {
    try {
        const { email, progress } = req.body;
        if (!email || !progress) return res.status(400).json({ error: "Email and progress required" });

        const user = await User.findOneAndUpdate(
            { email },
            {
                $set: {
                    'progress.completedModules': progress.completedModules || [],
                    'progress.currentModule': progress.currentModule || null,
                    'progress.activeChatId': progress.activeChatId || null,
                    'progress.topicModules': progress.topicModules || {},
                    'progress.lastActiveSubject': progress.lastActiveSubject || null,
                    'progress.totalSessions': progress.totalSessions || 0
                }
            },
            { new: true }
        );
        res.json(user);
    } catch (error) {
        console.error("Progress Update Error:", error);
        res.status(500).json({ error: "Failed to update progress" });
    }
});

// 1.8 Fetch Leaderboard
app.get('/api/leaderboard', async (req, res) => {
    try {
        // Fetch top 50 users sorted by XP desc
        const users = await User.find({})
            .sort({ 'gamification.xp': -1 })
            .limit(50)
            .select('name image gamification.xp gamification.level gamification.streak');

        res.json(users);
    } catch (error) {
        console.error("Leaderboard Error:", error);
        res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
});

// 2. Chat Routes
app.post('/api/chat', async (req, res) => {
    try {
        const { email, title, messages, chatId } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            res.status(404).json({ error: "User not found" });
            return;
        }

        let chat;
        if (chatId) {
            chat = await Chat.findByIdAndUpdate(
                chatId,
                { title, messages, updatedAt: new Date() },
                { new: true }
            );
        }

        if (!chat) {
            chat = await Chat.create({
                userId: user._id,
                title: title || `Chat ${new Date().toLocaleDateString()}`,
                messages
            });
        }

        res.json(chat);
    } catch (error) {
        console.error("Save Chat Error:", error);
        res.status(500).json({ error: "Failed to save chat" });
    }
});

app.get('/api/chat', async (req, res) => {
    try {
        const { email } = req.query;
        if (!email) {
            res.status(400).json({ error: "Email required" });
            return;
        }

        const user = await User.findOne({ email });
        if (!user) {
            res.json([]); // Return empty if user not found (e.g. first login)
            return;
        }

        const chats = await Chat.find({ userId: user._id }).sort({ createdAt: -1 });
        res.json(chats);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch chats" });
    }
});


// 3. Notes Routes
app.get('/api/notes', async (req, res) => {
    try {
        const { email } = req.query;
        if (!email) {
            res.status(400).json({ error: "Email required" });
            return
        }

        const user = await User.findOne({ email });
        if (!user) {
            res.json([]);
            return;
        }

        const notes = await Note.find({ userId: user._id }).sort({ updatedAt: -1 });
        res.json(notes);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch notes" });
    }
});

app.post('/api/notes', async (req, res) => {
    try {
        const { email, title, nodes, edges, tags } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            res.status(404).json({ error: "User not found" });
            return;
        }

        const note = await Note.create({
            userId: user._id,
            title,
            nodes,
            edges,
            tags
        });

        res.json(note);
    } catch (error) {
        console.error("Save Note Error:", error);
        res.status(500).json({ error: "Failed to save note" });
    }
});

// 4. Council Routes
app.post('/api/council', async (req, res) => {
    try {
        const { email, topic, context, agents, messages } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            res.status(404).json({ error: "User not found" });
            return;
        }

        const session = await CouncilSession.create({
            userId: user._id,
            topic: topic || "Council Session",
            context,
            agents,
            messages
        });

        res.json(session);
    } catch (error) {
        console.error("Save Council Error:", error);
        res.status(500).json({ error: "Failed to save council session" });
    }
});

app.get('/api/council', async (req, res) => {
    try {
        const { email } = req.query;
        if (!email) {
            res.status(400).json({ error: "Email required" });
            return;
        }

        const user = await User.findOne({ email });
        if (!user) {
            res.json([]);
            return;
        }

        // @ts-ignore
        const sessions = await CouncilSession.find({ userId: user._id }).sort({ createdAt: -1 });
        res.json(sessions);
    } catch (error) {
        console.error("Fetch Council Sessions Error:", error);
        res.status(500).json({ error: "Failed to fetch council sessions" });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
