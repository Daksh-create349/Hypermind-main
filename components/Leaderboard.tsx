
import React, { useEffect, useState } from 'react';
import { X, Trophy, Medal, Crown, Flame, Star, Shield, Zap } from 'lucide-react';
import { cn } from '../lib/utils';
import { useUser } from '@clerk/clerk-react';

interface LeaderboardUser {
    _id: string;
    name: string;
    image: string;
    gamification: {
        xp: number;
        level: number;
        streak: number;
    };
}

interface LeaderboardProps {
    onClose: () => void;
}

export function Leaderboard({ onClose }: LeaderboardProps) {
    const { user } = useUser();
    const [users, setUsers] = useState<LeaderboardUser[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLeaderboard = async () => {
            try {
                const res = await fetch('http://localhost:3001/api/leaderboard');
                const data = await res.json();

                let usersList = Array.isArray(data) ? data : [];

                // DUMMY DATA INJECTION if list is empty or small
                if (usersList.length < 5) {
                    const dummies: LeaderboardUser[] = [
                        { _id: 'd1', name: 'Arjun Mehta', image: '', gamification: { xp: 18500, level: 45, streak: 150 } },
                        { _id: 'd2', name: 'Priya Sharma', image: '', gamification: { xp: 14200, level: 38, streak: 95 } },
                        { _id: 'd3', name: 'Rohan Gupta', image: '', gamification: { xp: 11800, level: 32, streak: 60 } },
                        { _id: 'd4', name: 'Ananya Reddy', image: '', gamification: { xp: 9500, level: 26, streak: 42 } },
                        { _id: 'd5', name: 'Vikram Singh', image: '', gamification: { xp: 7800, level: 22, streak: 18 } },
                    ];
                    // Merge real users with dummies, prioritizing real ones? No, just add dummies to fill
                    usersList = [...usersList, ...dummies];
                }

                if (Array.isArray(usersList)) {
                    // Sort by Custom Formula: 2 * streak + xp / 10
                    const sorted = usersList.sort((a, b) => {
                        const scoreA = (a.gamification.streak || 0) * 2 + (a.gamification.xp || 0) / 10;
                        const scoreB = (b.gamification.streak || 0) * 2 + (b.gamification.xp || 0) / 10;
                        return scoreB - scoreA;
                    });
                    setUsers(sorted);
                }
            } catch (error) {
                console.error("Failed to fetch leaderboard", error);
                // Fallback to dummies on error
                const dummies: LeaderboardUser[] = [
                    { _id: 'd1', name: 'Arjun Mehta', image: '', gamification: { xp: 18500, level: 45, streak: 150 } },
                    { _id: 'd2', name: 'Priya Sharma', image: '', gamification: { xp: 14200, level: 38, streak: 95 } },
                    { _id: 'd3', name: 'Rohan Gupta', image: '', gamification: { xp: 11800, level: 32, streak: 60 } },
                    { _id: 'd4', name: 'Ananya Reddy', image: '', gamification: { xp: 9500, level: 26, streak: 42 } },
                    { _id: 'd5', name: 'Vikram Singh', image: '', gamification: { xp: 7800, level: 22, streak: 18 } },
                ];
                setUsers(dummies);
            } finally {
                setLoading(false);
            }
        };

        fetchLeaderboard();
    }, []);

    const getRankIcon = (index: number) => {
        switch (index) {
            case 0: return <Crown className="text-yellow-400 fill-yellow-400/20" size={24} />;
            case 1: return <Medal className="text-slate-300 fill-slate-300/20" size={24} />;
            case 2: return <Medal className="text-amber-700 fill-amber-700/20" size={24} />;
            default: return <span className="text-neutral-500 font-bold font-mono w-6 text-center">{index + 1}</span>;
        }
    };

    const getRankStyle = (index: number) => {
        switch (index) {
            case 0: return "bg-gradient-to-r from-yellow-500/10 to-transparent border-yellow-500/30";
            case 1: return "bg-gradient-to-r from-slate-300/10 to-transparent border-slate-300/30";
            case 2: return "bg-gradient-to-r from-amber-700/10 to-transparent border-amber-700/30";
            default: return "bg-neutral-900/50 border-white/5 hover:bg-neutral-800";
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-black border border-white/10 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl relative flex flex-col h-[80vh] animate-in zoom-in-95">

                {/* Header */}
                <div className="p-6 border-b border-white/10 flex items-center justify-between bg-neutral-900/50 backdrop-blur-md sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
                            <Trophy className="text-yellow-500" size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white tracking-tight">Global Leaderboard</h2>
                            <p className="text-neutral-400 text-sm">Top learners competing for glory</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-neutral-800 rounded-full text-neutral-400 hover:text-white transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-3 relative">
                    {/* Background decorations */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-fuchsia-500/5 rounded-full blur-[100px] pointer-events-none" />

                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-64 space-y-4">
                            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                            <p className="text-neutral-500 animate-pulse">Syncing with global network...</p>
                        </div>
                    ) : (
                        users.map((u, index) => (
                            <div
                                key={u._id}
                                className={cn(
                                    "flex items-center gap-4 p-4 rounded-xl border transition-all duration-300 group",
                                    getRankStyle(index),
                                    user?.emailAddresses[0]?.emailAddress === u.name ? "ring-1 ring-indigo-500 bg-indigo-500/10" : "" // Fallback check, ideally match ID or email
                                )}
                            >
                                <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
                                    {getRankIcon(index)}
                                </div>

                                <div className="relative">
                                    <div className={cn(
                                        "w-12 h-12 rounded-full overflow-hidden border-2",
                                        index === 0 ? "border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.3)]" : "border-white/10"
                                    )}>
                                        <img src={u.image || `https://api.dicebear.com/7.x/shapes/svg?seed=${u.name}`} alt={u.name} className="w-full h-full object-cover" />
                                    </div>
                                    {index < 3 && (
                                        <div className="absolute -bottom-1 -right-1 bg-black rounded-full p-0.5 border border-white/10">
                                            <Star size={10} className="text-white fill-white" />
                                        </div>
                                    )}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <h3 className={cn(
                                        "font-bold truncate",
                                        index === 0 ? "text-yellow-400" : "text-white"
                                    )}>
                                        {u.name || "Anonymous User"}
                                    </h3>
                                    <div className="flex items-center gap-2 text-xs text-neutral-400">
                                        <span className="flex items-center gap-1">
                                            <Shield size={10} /> Lvl {u.gamification.level}
                                        </span>
                                        <span>•</span>
                                        <span className="font-mono text-indigo-400">Rank #{index + 1}</span>
                                    </div>
                                </div>

                                <div className="text-right">
                                    <div className="font-bold text-white text-lg font-mono flex items-center justify-end gap-1">
                                        <Zap size={14} className="text-yellow-500 fill-yellow-500" />
                                        {u.gamification.xp.toLocaleString()}
                                    </div>
                                    <div className="text-xs text-neutral-500 font-medium uppercase tracking-wider">XP Earned</div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
