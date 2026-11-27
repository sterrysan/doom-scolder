// background.js - Doom Scolder Global Doom Pool & Audio Coordinator

importScripts('platforms.js');

const DEFAULT_SOUNDS = [
    { id: 'default_scream1', name: 'Scream1.mp3', url: 'sounds/Scream1.mp3', mediaType: 'audio', isDefault: true, enabled: true },
    { id: 'default_obsession', name: 'Obsession.mp3', url: 'sounds/Obsession.mp3', mediaType: 'audio', isDefault: true, enabled: true },
    { id: 'default_vid_scream1', name: 'vid_scream1.mp4', url: 'sounds/vid_scream1.mp4', mediaType: 'video', isDefault: true, enabled: true },
    { id: 'default_vid_scream2', name: 'vid_scream2.mp4', url: 'sounds/vid_scream2.mp4', mediaType: 'video', isDefault: true, enabled: true }
];

const DEFAULT_BLOCK_LIMIT_MINUTES = 20;
const SCOLD_COOLDOWN_MS = 5000;
const CUSTOM_SCRIPT_ID = 'doom-scolder-custom-sites';

const ICON_PATHS = {
    safe: {
        16: 'icons/icon16.png',
        32: 'icons/icon32.png',
        48: 'icons/icon48.png',
        128: 'icons/icon128.png'
    },
    warn: {
        16: 'icons/warn16.png',
        32: 'icons/warn32.png',
        48: 'icons/warn48.png',
        128: 'icons/warn128.png'
    },
    angry: {
        16: 'icons/angry16.png',
        32: 'icons/angry32.png',
        48: 'icons/angry48.png',
        128: 'icons/angry128.png'
    }
};

let lastPingTimestampMs = 0;
let lastGlobalScoldMs = 0;
let lastIconTier = null;
let pingLock = Promise.resolve();

function getIconTier(doomSeconds, blockLimitSeconds) {
    const limit = Math.max(60, blockLimitSeconds || (DEFAULT_BLOCK_LIMIT_MINUTES * 60));
    if (doomSeconds >= limit) return 'angry';
    if (doomSeconds >= limit * 0.7) return 'warn';
    return 'safe';
}

function updateActionIcon(doomSeconds, blockLimitSeconds, force = false) {
    const tier = getIconTier(doomSeconds || 0, blockLimitSeconds);
    if (!force && tier === lastIconTier) return;
    lastIconTier = tier;
    chrome.action.setIcon({ path: ICON_PATHS[tier] }).catch(() => { });
}

function syncActionIconFromStorage(force = false) {
    chrome.storage.local.get(['doomSeconds', 'blockLimitMinutes'], (res) => {
        const doomSec = res.doomSeconds || 0;
        const limitSec = (res.blockLimitMinutes || DEFAULT_BLOCK_LIMIT_MINUTES) * 60;
        updateActionIcon(doomSec, limitSec, force);
    });
}

function chooseRandomSound(scoldSounds) {
    const sounds = (Array.isArray(scoldSounds) && scoldSounds.length > 0)
        ? scoldSounds
        : DEFAULT_SOUNDS;
    const enabled = sounds.filter(s => s && s.enabled !== false);
    if (enabled.length > 0) {
        return enabled[Math.floor(Math.random() * enabled.length)];
    }
    return DEFAULT_SOUNDS[0];
}

function getDynamicScoldMilestones(blockLimitSeconds) {
    const ratios = [0.50, 0.62];
    const milestones = [];
    for (const r of ratios) {
        const sec = Math.round(blockLimitSeconds * r);
        if (sec > 0 && sec < blockLimitSeconds) {
            if (milestones.length === 0 || sec - milestones[milestones.length - 1] >= 10) {
                milestones.push(sec);
            }
        }
    }
    return milestones;
}

function getEffectStage(doomSeconds, blockLimitSeconds) {
    if (blockLimitSeconds <= 0) return 'none';
    const ratio = doomSeconds / blockLimitSeconds;
    if (ratio >= 1.0) return 'climax';
    if (ratio >= 0.84) return 'more_missiles';
    if (ratio >= 0.70) return 'few_missiles';
    return 'none';
}

function normalizeState(res) {
    const today = new Date().toDateString();
    const blockLimitMinutes = Number.isFinite(res.blockLimitMinutes) && res.blockLimitMinutes >= 1
        ? Math.min(120, res.blockLimitMinutes)
        : DEFAULT_BLOCK_LIMIT_MINUTES;
    const manualResetOnly = Boolean(res.manualResetOnly);
    const scoldingEnabled = typeof res.scoldingEnabled === 'boolean' ? res.scoldingEnabled : true;

    let doomSeconds = Number.isFinite(res.doomSeconds) && res.doomSeconds >= 0 ? res.doomSeconds : 0;
    let dailyDoomSeconds = Number.isFinite(res.dailyDoomSeconds) && res.dailyDoomSeconds >= 0 ? res.dailyDoomSeconds : 0;
    let lastScoldAtSecond = Number.isFinite(res.lastScoldAtSecond) && res.lastScoldAtSecond >= 0 ? res.lastScoldAtSecond : 0;
    let lastActiveDate = res.lastActiveDate || today;
    let dateChanged = false;

    if (lastActiveDate !== today) {
        dateChanged = true;
        dailyDoomSeconds = 0;
        lastActiveDate = today;
        if (!manualResetOnly) {
            doomSeconds = 0;
            lastScoldAtSecond = 0;
        }
    }

    return {
        blockLimitMinutes,
        manualResetOnly,
        scoldingEnabled,
        doomSeconds,
        dailyDoomSeconds,
        lastScoldAtSecond,
        lastActiveDate,
        dateChanged,
        scoldSounds: (Array.isArray(res.scoldSounds) && res.scoldSounds.length > 0) ? res.scoldSounds : DEFAULT_SOUNDS
    };
}

async function syncCustomContentScripts() {
    try {
        const data = await chrome.storage.local.get(['customSites']);
        const customSites = Array.isArray(data.customSites) ? data.customSites : [];
        const enabledDomains = customSites
            .filter(s => s && s.enabled && s.domain)
            .map(s => s.domain);

        const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [CUSTOM_SCRIPT_ID] });
        if (existing && existing.length > 0) {
            await chrome.scripting.unregisterContentScripts({ ids: [CUSTOM_SCRIPT_ID] });
        }

        if (enabledDomains.length === 0) return;

        const matches = [];
        for (const domain of enabledDomains) {
            const candidates = [`*://${domain}/*`, `*://*.${domain}/*`];
            for (const origin of candidates) {
                const granted = await chrome.permissions.contains({ origins: [origin] });
                if (granted) matches.push(origin);
            }
        }

        if (matches.length > 0) {
            await chrome.scripting.registerContentScripts([{
                id: CUSTOM_SCRIPT_ID,
                matches,
                js: ['platforms.js', 'sparks.js', 'effects.js', 'content.js'],
                runAt: 'document_idle'
            }]);
        }
    } catch (e) {
        console.warn('Doom Scolder: syncCustomContentScripts warning:', e);
    }
}

function handleActivityPing() {
    return new Promise((resolve) => {
        pingLock = pingLock.then(async () => {
            const raw = await chrome.storage.local.get([
                'doomSeconds',
                'dailyDoomSeconds',
                'blockLimitMinutes',
                'scoldingEnabled',
                'manualResetOnly',
                'lastScoldAtSecond',
                'lastActiveDate',
                'scoldSounds'
            ]);

            const state = normalizeState(raw);
            const blockLimitSeconds = state.blockLimitMinutes * 60;

            const now = Date.now();
            let deltaSec = 0;
            if (lastPingTimestampMs > 0) {
                const elapsedSec = Math.round((now - lastPingTimestampMs) / 1000);
                if (elapsedSec >= 1) {
                    deltaSec = Math.min(3, elapsedSec);
                }
            } else {
                deltaSec = 1;
            }
            lastPingTimestampMs = now;

            const alreadyBlocked = state.doomSeconds >= blockLimitSeconds;
            if (!alreadyBlocked && deltaSec > 0) {
                state.doomSeconds += deltaSec;
                state.dailyDoomSeconds += deltaSec;
            }

            const blocked = state.doomSeconds >= blockLimitSeconds;
            let shouldScold = false;
            let sound = null;

            if (!blocked && state.scoldingEnabled) {
                const milestones = getDynamicScoldMilestones(blockLimitSeconds);
                const crossed = milestones.filter(m => state.doomSeconds >= m && state.lastScoldAtSecond < m);
                if (crossed.length > 0) {
                    state.lastScoldAtSecond = crossed[crossed.length - 1];
                    if (now - lastGlobalScoldMs >= SCOLD_COOLDOWN_MS) {
                        lastGlobalScoldMs = now;
                        shouldScold = true;
                        sound = chooseRandomSound(state.scoldSounds);
                    }
                }
            }

            if (deltaSec > 0 || state.dateChanged || shouldScold) {
                await chrome.storage.local.set({
                    doomSeconds: state.doomSeconds,
                    dailyDoomSeconds: state.dailyDoomSeconds,
                    lastScoldAtSecond: state.lastScoldAtSecond,
                    lastActiveDate: state.lastActiveDate
                });
            }

            updateActionIcon(state.doomSeconds, blockLimitSeconds);

            resolve({
                doomSeconds: state.doomSeconds,
                dailyDoomSeconds: state.dailyDoomSeconds,
                blockLimitSeconds,
                scoldingEnabled: state.scoldingEnabled,
                blocked,
                effectStage: getEffectStage(state.doomSeconds, blockLimitSeconds),
                shouldScold,
                sound
            });
        }).catch((err) => {
            console.error('Doom Scolder activityPing error:', err);
            resolve({ error: true });
        });
    });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (!request || !request.action) return false;

    if (request.action === 'activityPing') {
        handleActivityPing().then(sendResponse);
        return true;
    }

    if (request.action === 'getStatus') {
        chrome.storage.local.get([
            'doomSeconds',
            'dailyDoomSeconds',
            'blockLimitMinutes',
            'scoldingEnabled',
            'manualResetOnly',
            'lastScoldAtSecond',
            'lastActiveDate',
            'scoldSounds'
        ], async (raw) => {
            const state = normalizeState(raw);
            if (state.dateChanged) {
                await chrome.storage.local.set({
                    doomSeconds: state.doomSeconds,
                    dailyDoomSeconds: state.dailyDoomSeconds,
                    lastScoldAtSecond: state.lastScoldAtSecond,
                    lastActiveDate: state.lastActiveDate
                });
            }
            const blockLimitSeconds = state.blockLimitMinutes * 60;
            sendResponse({
                doomSeconds: state.doomSeconds,
                dailyDoomSeconds: state.dailyDoomSeconds,
                blockLimitSeconds,
                scoldingEnabled: state.scoldingEnabled,
                blocked: state.doomSeconds >= blockLimitSeconds,
                effectStage: getEffectStage(state.doomSeconds, blockLimitSeconds)
            });
        });
        return true;
    }

    if (request.action === 'resetDoomCount') {
        chrome.storage.local.set({
            doomSeconds: 0,
            lastScoldAtSecond: 0,
            lastActiveDate: new Date().toDateString()
        }, () => {
            lastPingTimestampMs = 0;
            syncActionIconFromStorage(true);
            sendResponse({ status: 'reset' });
        });
        return true;
    }

    if (request.action === 'closeTab') {
        if (sender.tab && sender.tab.id) {
            chrome.tabs.remove(sender.tab.id).catch(() => { });
        }
        sendResponse({ status: 'closing' });
        return false;
    }

    if (request.action === 'fetchMediaDataUrl' && request.url) {
        const cleanUrl = String(request.url).replace(/^\/+/, '');
        if (!cleanUrl.startsWith('sounds/') && !cleanUrl.startsWith('icons/')) {
            sendResponse({ error: 'invalid_url' });
            return false;
        }
        fetch(chrome.runtime.getURL(cleanUrl))
            .then((r) => r.blob())
            .then((blob) => {
                const reader = new FileReader();
                reader.onloadend = () => sendResponse({ dataUrl: reader.result });
                reader.onerror = () => sendResponse({ error: 'read_failed' });
                reader.readAsDataURL(blob);
            })
            .catch(() => sendResponse({ error: 'fetch_failed' }));
        return true;
    }

    if (request.action === 'syncCustomScripts') {
        syncCustomContentScripts().then(() => sendResponse({ status: 'synced' }));
        return true;
    }

    return false;
});

chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get([
        'blockLimitMinutes',
        'scoldingEnabled',
        'manualResetOnly',
        'scoldSounds',
        'doomSeconds',
        'dailyDoomSeconds',
        'lastActiveDate',
        'lastScoldAtSecond',
        'platformSettings',
        'customSites'
    ], (res) => {
        const defaultsToSet = {};

        if (!Number.isFinite(res.blockLimitMinutes)) defaultsToSet.blockLimitMinutes = DEFAULT_BLOCK_LIMIT_MINUTES;
        if (typeof res.scoldingEnabled !== 'boolean') defaultsToSet.scoldingEnabled = true;
        if (typeof res.manualResetOnly !== 'boolean') defaultsToSet.manualResetOnly = false;
        if (!Array.isArray(res.scoldSounds) || res.scoldSounds.length === 0) defaultsToSet.scoldSounds = DEFAULT_SOUNDS;
        if (!Number.isFinite(res.doomSeconds)) defaultsToSet.doomSeconds = 0;
        if (!Number.isFinite(res.dailyDoomSeconds)) defaultsToSet.dailyDoomSeconds = 0;
        if (!res.lastActiveDate) defaultsToSet.lastActiveDate = new Date().toDateString();
        if (!Number.isFinite(res.lastScoldAtSecond)) defaultsToSet.lastScoldAtSecond = 0;
        defaultsToSet.platformSettings = DoomPlatforms.mergePlatformSettings(res.platformSettings);
        if (!Array.isArray(res.customSites)) defaultsToSet.customSites = [];

        chrome.storage.local.set(defaultsToSet, () => {
            syncCustomContentScripts();
            syncActionIconFromStorage(true);
            console.log('Doom Scolder installed/upgraded. Global configuration initialized.');
        });
    });
});

chrome.runtime.onStartup.addListener(() => {
    syncCustomContentScripts();
    syncActionIconFromStorage(true);
});

chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && (changes.doomSeconds || changes.blockLimitMinutes)) {
        syncActionIconFromStorage();
    }
});

// Restore dynamic icon whenever MV3 service worker wakes up
syncActionIconFromStorage(true);
