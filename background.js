// background.js - Doom Scolder Background Worker

const DEFAULT_SOUNDS = [
    { id: 'default_scream1', name: 'Scream1.mp3', url: 'sounds/Scream1.mp3', isDefault: true, enabled: true },
    { id: 'default_scream2', name: 'Scream2.mp3', url: 'sounds/Scream2.mp3', isDefault: true, enabled: true },
    { id: 'default_obsession', name: 'Obsession.mp3', url: 'sounds/Obsession.mp3', isDefault: true, enabled: true }
];

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {    
    if (request.action === "scoldUser") {
        chrome.storage.local.get(['scoldSounds'], (result) => {
            const sounds = (result.scoldSounds && result.scoldSounds.length > 0) 
                ? result.scoldSounds 
                : DEFAULT_SOUNDS;
            const enabled = sounds.filter(s => s.enabled !== false);
            const chosen = (enabled.length > 0)
                ? enabled[Math.floor(Math.random() * enabled.length)]
                : DEFAULT_SOUNDS[0];
            
            console.log("Doom Scolder: Scolding user with sound:", chosen.name);
            sendResponse({ status: "play_sound", sound: chosen });
        });
        return true; // Keep message channel open for async response
    }

    if (request.action === "updateCount") {
        sendResponse({ status: "ok" });
        return false;
    }
});

// Initial configuration when installed
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get(['scoldSounds'], (res) => {
        const initialSounds = (res.scoldSounds && res.scoldSounds.length > 0)
            ? res.scoldSounds
            : DEFAULT_SOUNDS;

        chrome.storage.local.set({ 
            shortsCount: 0,
            shortsBlockLimit: 10,
            shortsLimit: 2,
            scoldingEnabled: false,
            scoldSounds: initialSounds,
            dailyShortsCount: 0,
            lastActiveDate: new Date().toDateString()
        });
        console.log("Doom Scolder installed. Configuration set with default shout sounds.");
    });
});
