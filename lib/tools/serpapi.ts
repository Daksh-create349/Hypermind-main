
interface SerpResult {
    title: string;
    link: string;
    snippet: string;
    date?: string;
    source?: string;
}

export async function searchGoogle(query: string): Promise<string> {
    const apiKey = import.meta.env.VITE_SERPAPI_KEY || process.env.VITE_SERPAPI_KEY;

    if (!apiKey) {
        console.warn("SerpAPI Key missing. Skipping deep research.");
        return "";
    }

    try {
        // We use a proxy or direct fetch. 
        // Note: SerpAPI doesn't support CORS directly on free tier usually, so we might need a proxy.
        // However, for this MVP, let's try direct fetch or assume the user has a proxy if needed.
        // Actually, for client-side usage, we often need a backend proxy.
        // BUT, since this is a local/personal app, we can try fetching directly.

        const url = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${apiKey}&num=5`;

        const response = await fetch(url);
        if (!response.ok) throw new Error("SerpAPI fetch failed");

        const data = await response.json();

        const organicResults = (data.organic_results || []).map((r: any) => ({
            title: r.title,
            link: r.link,
            snippet: r.snippet,
            date: r.date
        }));

        const newsResults = (data.news_results || []).map((r: any) => ({
            title: r.title,
            link: r.link,
            snippet: r.snippet,
            date: r.date,
            source: r.source
        }));

        const combined = [...newsResults, ...organicResults].slice(0, 5);

        if (combined.length === 0) return "";

        return `
        [RESEARCH BRIEF FOR: "${query}"]
        
        ${combined.map((r: any) => `
        - TITLE: ${r.title}
          SOURCE: ${r.source || 'Web'} (${r.date || 'Unknown Date'})
          URL: ${r.link}
          SUMMARY: ${r.snippet}
        `).join('\n')}
        `;

    } catch (e) {
        console.error("SerpAPI Error:", e);
        return "";
    }
}
