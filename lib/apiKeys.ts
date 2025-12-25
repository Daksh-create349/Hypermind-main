
// Dedicated Purchased Key for maximum reliability
const MAIN_API_KEY = "AIzaSyAdjrPEMeWIJeJTNXv018KcBxiYCeGMTfI";

// Free tier keys (currently exhausted/unstable)
const BACKUP_KEYS = [
    "AIzaSyAqN2WOLmURZuTvBB6-1bT6AzwpMbi2gr0",
    "AIzaSyAYohUhcwWtkVlalgJuKg9yAv30hPzD0jA",
    "AIzaSyDBl8xQ48BnEj4ducjvsDK7ZTDH_tnG84w",
    "AIzaSyAv42cJKC5SjRN7oq2zgA4nULq95HBKg3k",
    "AIzaSyAG-Sx1jtGKCo_it50841Scy-f-pjOWreo",
    "AIzaSyDLdKWe_dulKSqN05bFmqgz5eniWRobk24"
];

export const ROTATING_API_KEYS = [MAIN_API_KEY];

export const getRandomApiKey = () => {
    // Always return the main key since others are exhausted
    return MAIN_API_KEY;
};
