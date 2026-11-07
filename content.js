// content.js

// Regular expression to match YouTube Shorts URLs
const SHORTS_URL_REGEX = /^https:\/\/(www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/;
let previousUrl = window.location.href;
let shortsCountDisplay = null; // Reference to the injected UI element
let blockingOverlay = null; // Reference to the blocking overlay
let wasOnShortsPage = false; // Track if the tab was previously on a Shorts page
let localShortsCount = null; // Instantly tracks count to prevent race conditions
let enforceBlockInterval = null; // Interval to prevent DevTools deletion
let isBlocked = false; // Central state for blocking

/**
 * Creates and injects a small UI element to display the shorts count.
 */
function injectShortsCountDisplay() {
    if (shortsCountDisplay) return; // Only inject once

    shortsCountDisplay = document.createElement('div');
    shortsCountDisplay.id = 'yt-shorts-scolder-display';
    shortsCountDisplay.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background-color: #d32f2f; /* YouTube red */
        color: white;
        padding: 8px 12px;
        border-radius: 8px;
        font-family: 'Roboto', sans-serif;
        font-size: 14px;
        font-weight: bold;
        z-index: 10000;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        display: none; /* Hide by default */
        pointer-events: none; /* Make it non-interactive */
        opacity: 0.9;
    `;
    document.body.appendChild(shortsCountDisplay);
    console.log("Doom Scolder: Injected UI display.");
}

/**
 * Creates and injects a full-screen blocking overlay.
 */
function injectBlockingOverlay() {
    if (blockingOverlay && document.getElementById('yt-shorts-scolder-block-overlay')) return;

    blockingOverlay = document.createElement('div');
    blockingOverlay.id = 'yt-shorts-scolder-block-overlay';
    blockingOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background-color: rgba(13, 13, 18, 0.95);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        color: #e2e2e9;
        z-index: 9999999;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        font-family: 'Inter', -apple-system, sans-serif;
        display: none;
    `;
    
    const message = document.createElement('h1');
    message.textContent = "Shorts Limit Reached! Get back to work.";
    message.style.cssText = `
        margin-bottom: 30px;
        font-size: 42px;
        font-weight: 700;
        color: #ff4b4b;
        text-shadow: 0 4px 12px rgba(0,0,0,0.5);
    `;
    
    const homeButton = document.createElement('button');
    homeButton.textContent = "Go to YouTube Home";
    homeButton.style.cssText = `
        padding: 16px 32px;
        background-color: #d32f2f;
        color: white;
        border: none;
        border-radius: 12px;
        font-size: 20px;
        cursor: pointer;
        font-weight: 700;
        box-shadow: 0 8px 24px rgba(211, 47, 47, 0.3);
        transition: all 0.2s ease;
    `;
    
    // Add hover effect programmatically
    homeButton.addEventListener('mouseenter', () => {
        homeButton.style.transform = 'translateY(-2px)';
        homeButton.style.boxShadow = '0 12px 28px rgba(211, 47, 47, 0.5)';
    });
    homeButton.addEventListener('mouseleave', () => {
        homeButton.style.transform = 'translateY(0)';
        homeButton.style.boxShadow = '0 8px 24px rgba(211, 47, 47, 0.3)';
    });
    homeButton.addEventListener('click', () => {
        // Just navigate to home, do NOT reset the count so the blocker persists!
        window.location.href = "https://www.youtube.com";
    });
    
    blockingOverlay.appendChild(message);
    blockingOverlay.appendChild(homeButton);
    document.body.appendChild(blockingOverlay);
}

    function pauseAllVideos() {
        document.querySelectorAll('video').forEach(v => {
            if (!v.paused) v.pause();
        });
    }

    function startEnforcingBlock() {
        isBlocked = true;
        if (!blockingOverlay || !document.getElementById('yt-shorts-scolder-block-overlay')) {
            injectBlockingOverlay();
        }
        blockingOverlay.style.display = 'flex';
        document.body.style.overflow = 'hidden'; // disable scroll
        pauseAllVideos(); // Mute and stop playback instantly

        // Anti-DevTools Enforcement
        if (!enforceBlockInterval) {
            enforceBlockInterval = setInterval(() => {
                if (isBlocked) {
                    if (!document.getElementById('yt-shorts-scolder-block-overlay')) {
                        console.log("Doom Scolder: Overlay deletion detected. Re-injecting.");
                        blockingOverlay = null; // force recreation
                        injectBlockingOverlay();
                        blockingOverlay.style.display = 'flex';
                    }
                    if (document.body.style.overflow !== 'hidden') {
                        document.body.style.overflow = 'hidden';
                    }
                    pauseAllVideos(); // Constantly enforce pause in case they hit spacebar
                }
            }, 1000);
        }
    }

function stopEnforcingBlock() {
    isBlocked = false;
    if (blockingOverlay) {
        blockingOverlay.style.display = 'none';
        document.body.style.overflow = ''; // enable scroll
    }
    if (enforceBlockInterval) {
        clearInterval(enforceBlockInterval);
        enforceBlockInterval = null;
    }
}

/**
 * Plays the selected scold audio shouting at the user.
 * Temporarily ducks YouTube video volume for maximum shock value.
 */
function playScoldAudio(sound) {
    if (!sound) return;
    try {
        const audioSrc = sound.dataUrl || chrome.runtime.getURL(sound.url);
        const audio = new Audio(audioSrc);
        audio.volume = 1.0;

        // Duck YouTube background audio
        const video = document.querySelector('video');
        let originalVol = 1.0;
        if (video) {
            originalVol = video.volume;
            video.volume = Math.max(0, originalVol * 0.15);
        }

        const restoreVol = () => {
            if (video) video.volume = originalVol;
        };

        audio.onended = restoreVol;
        audio.onerror = restoreVol;
        setTimeout(restoreVol, 6000); // Safety timeout

        audio.play().catch(err => {
            console.warn("Doom Scolder: Audio play blocked by browser:", err);
        });
    } catch (e) {
        console.error("Doom Scolder audio error:", e);
    }
}

/**
 * Updates the text content and visibility of the injected UI element.
 * @param {number} count The current shorts count.
 * @param {number} limit The shorts limit.
 */
function updateShortsCountDisplay(count, limit) {
    if (shortsCountDisplay) {
        if (window.location.pathname.startsWith('/shorts/')) {
            shortsCountDisplay.textContent = `Shorts: ${count}/${limit}`;
            shortsCountDisplay.style.display = 'block'; // Show if on a shorts page
        } else {
            shortsCountDisplay.style.display = 'none'; // Hide otherwise
        }
    }
}

/**
 * Handles changes in the URL to detect shorts navigation.
 */
function handleUrlChange() {
    const currentUrl = window.location.href;

    if (currentUrl === previousUrl) {
        return; // URL hasn't changed
    }

    previousUrl = currentUrl; // Update previous URL for next check

    // Check if we are on a YouTube Shorts page
    const match = currentUrl.match(SHORTS_URL_REGEX);

    if (match) {
        wasOnShortsPage = true;
        const currentVideoId = match[2];

        chrome.storage.local.get(['shortsCount', 'lastWatchedVideoId', 'shortsLimit', 'shortsBlockLimit', 'scoldingEnabled', 'dailyShortsCount', 'lastActiveDate'], (result) => {
            // Speed scroll race condition fix: use localShortsCount
            localShortsCount = (localShortsCount !== null ? localShortsCount : (result.shortsCount || 0));
            const scoldLimit = result.shortsLimit || 2;
            const blockLimit = result.shortsBlockLimit || 10;
            const scoldingEnabled = result.scoldingEnabled || false;
            const lastWatchedVideoId = result.lastWatchedVideoId || null;

            if (currentVideoId !== lastWatchedVideoId) {
                // It's a new short, so increment the local count
                localShortsCount++;
                console.log(`Doom Scolder: New short detected: ${currentVideoId}. Count is now ${localShortsCount}`);

                let today = new Date().toDateString();
                let dailyCount = result.dailyShortsCount || 0;
                if (result.lastActiveDate && result.lastActiveDate !== today) {
                    dailyCount = 0;
                }
                dailyCount++;

                if (localShortsCount >= blockLimit) {
                    console.log("Doom Scolder: Block Limit reached.");
                    startEnforcingBlock();
                    // Update the count
                    chrome.storage.local.set({ shortsCount: localShortsCount, lastWatchedVideoId: currentVideoId, dailyShortsCount: dailyCount, lastActiveDate: today });
                    updateShortsCountDisplay(localShortsCount, blockLimit); // Update UI immediately
                } else {
                    stopEnforcingBlock();
                    
                    if (scoldingEnabled && localShortsCount % scoldLimit === 0) {
                        console.log("Doom Scolder: Scold Limit reached. Requesting a scolding.");
                        chrome.runtime.sendMessage({ action: "scoldUser" }, (response) => {
                            if (chrome.runtime.lastError) return;
                            if (response && response.sound) {
                                playScoldAudio(response.sound);
                            }
                        });
                    }
                    
                    // Save the new count and the current video ID
                    chrome.storage.local.set({ shortsCount: localShortsCount, lastWatchedVideoId: currentVideoId, dailyShortsCount: dailyCount, lastActiveDate: today });
                    updateShortsCountDisplay(localShortsCount, blockLimit); // Update UI
                }
                // Inform the popup about the change
                chrome.runtime.sendMessage({ action: "updateCount" }, () => {
                    void chrome.runtime.lastError;
                });
            } else {
                // Still on the same short or navigated back to it, just update UI
                if (localShortsCount >= blockLimit) {
                    startEnforcingBlock();
                } else {
                    stopEnforcingBlock();
                }
                updateShortsCountDisplay(localShortsCount, blockLimit);
            }
        });
    } else {
        // Not on a shorts page
        stopEnforcingBlock();
        
        if (wasOnShortsPage) {
            wasOnShortsPage = false;
            // Removed localShortsCount = 0 and shortsCount: 0 storage set
            // so the count persists across normal YouTube navigations.
            chrome.storage.local.set({ lastWatchedVideoId: null });
            chrome.storage.local.get(['shortsBlockLimit'], (result) => {
                updateShortsCountDisplay(localShortsCount, result.shortsBlockLimit || 10);
            });
            console.log("Doom Scolder: Navigated away from shorts. Count preserved.");
            // Inform the popup about the change
            chrome.runtime.sendMessage({ action: "updateCount" }, () => {
                void chrome.runtime.lastError;
            });
        } else {
            // Loaded a non-Shorts page, but wasn't on Shorts before in this tab. Just hide UI.
            updateShortsCountDisplay(localShortsCount || 0, 10);
        }
    }
}

// Observe changes to the DOM to detect URL changes in YouTube's SPA
const bodyObserver = new MutationObserver(handleUrlChange);
bodyObserver.observe(document.body, { childList: true, subtree: true });

// Listen for global storage changes to handle pre-load loophole across tabs
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.shortsCount) {
        localShortsCount = changes.shortsCount.newValue;
        chrome.storage.local.get(['shortsBlockLimit'], (result) => {
            const blockLimit = result.shortsBlockLimit || 10;
            if (localShortsCount >= blockLimit && window.location.pathname.startsWith('/shorts/')) {
                startEnforcingBlock();
            } else if (localShortsCount < blockLimit) {
                stopEnforcingBlock();
            }
            updateShortsCountDisplay(localShortsCount, blockLimit);
        });
    }
});

// Also run on initial page load
window.addEventListener('load', () => {
    injectShortsCountDisplay();
    injectBlockingOverlay();
    
    chrome.storage.local.get(['shortsCount', 'shortsBlockLimit'], (result) => {
        localShortsCount = result.shortsCount || 0;
        updateShortsCountDisplay(localShortsCount, result.shortsBlockLimit || 10);
        if (localShortsCount >= (result.shortsBlockLimit || 10) && window.location.pathname.startsWith('/shorts/')) {
            startEnforcingBlock();
        }
        handleUrlChange(); // Check URL on initial load after grabbing initial storage
    });
});

// Listener for messages from the background script or popup (e.g., reset)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "updateDisplay") {
        chrome.storage.local.get(['shortsBlockLimit'], (result) => {
            updateShortsCountDisplay(request.count, result.shortsBlockLimit || 10);
            sendResponse({ status: "display updated" });
        });
        return true;
    }
});
