
export interface UserStats {
    xp: number;
    level: number;
    streak: number;
    lastLogin: string;
}

const DEFAULT_STATS: UserStats = {
    xp: 0,
    level: 1,
    streak: 0,
    lastLogin: ''
};

export const LEVELS = [
    { level: 1, xp: 0, title: "Novice" },
    { level: 2, xp: 100, title: "Apprentice" },
    { level: 3, xp: 300, title: "Scholar" },
    { level: 4, xp: 600, title: "Expert" },
    { level: 5, xp: 1000, title: "Master" },
    { level: 6, xp: 2000, title: "Grandmaster" },
    { level: 7, xp: 5000, title: "HyperMind" }
];

export function getGamificationStats(): UserStats {
    if (typeof window === 'undefined') return DEFAULT_STATS;
    const saved = localStorage.getItem('hypermind_stats');
    return saved ? JSON.parse(saved) : DEFAULT_STATS;
}

export function saveGamificationStats(stats: UserStats) {
    localStorage.setItem('hypermind_stats', JSON.stringify(stats));
    // Dispatch event for UI updates
    window.dispatchEvent(new Event('gamification_update'));
}

export function updateLoginStreak(): UserStats {
    const stats = getGamificationStats();
    const today = new Date().toDateString();

    // If already logged in today, do nothing
    if (stats.lastLogin === today) return stats;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    // Check if last login was yesterday (continuation)
    if (stats.lastLogin === yesterday.toDateString()) {
        stats.streak += 1;
    } else {
        // Streak broken or new user
        stats.streak = 1;
    }

    stats.lastLogin = today;
    saveGamificationStats(stats);
    return stats;
}

export function addXP(amount: number): { stats: UserStats, leveledUp: boolean } {
    const stats = getGamificationStats();
    stats.xp += amount;

    // Check Level Up
    let nextLevel = stats.level;
    for (const lvl of LEVELS) {
        if (stats.xp >= lvl.xp) {
            nextLevel = lvl.level;
        }
    }

    const leveledUp = nextLevel > stats.level;
    stats.level = nextLevel;

    saveGamificationStats(stats);
    return { stats, leveledUp };
}

export function getLevelTitle(level: number): string {
    const found = LEVELS.find(l => l.level === level);
    // Find the highest level achieved if exact match not found (fallback)
    if (!found) {
        return LEVELS.slice().reverse().find(l => l.level <= level)?.title || "Novice";
    }
    return found.title;
}
