// content.js - Universal DOM-Agnostic Doomscrolling Tracker, Scolder & Blocker

(function () {
    if (window.__doomScolderLoaded) return;
    window.__doomScolderLoaded = true;

    const ACTIVE_IDLE_WINDOW_MS = 45000;
    const PING_INTERVAL_MS = 2000;

    let cachedPlatformSettings = null;
    let cachedCustomSites = [];
    let currentMatch = { matched: false };
    let lastUrl = '';

    let lastInteractionAt = Date.now();
    let isBlocked = false;
    let currentDoomSeconds = 0;
    let currentDailySeconds = 0;
    let currentBlockLimitSeconds = 20 * 60;

    // Autoplay fallback queue & audio boost context
    let pendingScoldSound = null;
    let scoldAudioCtx = null;
    const mediaDataUrlCache = {};
    let hudBadge = null;
    let scoldBanner = null;
    let scoldBannerTimer = null;
    let blockingOverlay = null;
    let overlaySparkController = null;
    let enforceInterval = null;

    function isExtensionContextValid() {
        try {
            return Boolean(typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id);
        } catch (_) {
            return false;
        }
    }

    function teardownOrphanedScript() {
        if (pingInterval) {
            clearInterval(pingInterval);
            pingInterval = null;
        }
        if (enforceInterval) {
            clearInterval(enforceInterval);
            enforceInterval = null;
        }
    }

    function safeSendMessage(payload, callback) {
        if (!isExtensionContextValid()) {
            teardownOrphanedScript();
            return false;
        }
        try {
            chrome.runtime.sendMessage(payload, (resp) => {
                if (!isExtensionContextValid()) {
                    teardownOrphanedScript();
                    return;
                }
                const err = chrome.runtime.lastError;
                if (typeof callback === 'function') callback(resp, err);
            });
            return true;
        } catch (_) {
            teardownOrphanedScript();
            return false;
        }
    }
    let pingInterval = null;

    function formatClock(totalSec) {
        const s = Math.max(0, Math.floor(totalSec || 0));
        const hrs = Math.floor(s / 3600);
        const mins = Math.floor((s % 3600) / 60);
        const secs = s % 60;
        if (hrs > 0) {
            return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    function ensureBody(cb) {
        if (document.body) {
            cb();
        } else {
            document.addEventListener('DOMContentLoaded', cb, { once: true });
        }
    }

    function injectHudBadge() {
        if (hudBadge && document.body && document.body.contains(hudBadge)) return;
        if (!document.body) return;

        hudBadge = document.createElement('div');
        hudBadge.id = 'doom-scolder-hud';
        hudBadge.style.cssText = `
            position: fixed;
            bottom: 18px;
            right: 18px;
            background: rgba(20, 20, 24, 0.92);
            border: 1px solid rgba(255, 75, 75, 0.55);
            color: #ffffff;
            padding: 7px 12px;
            border-radius: 999px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.3px;
            z-index: 2147483640;
            box-shadow: 0 4px 14px rgba(0, 0, 0, 0.45);
            display: none;
            pointer-events: none;
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
        `;
        document.body.appendChild(hudBadge);
    }

    function updateHud() {
        if (!hudBadge) injectHudBadge();
        if (!hudBadge) return;

        if (!currentMatch.matched || isBlocked) {
            hudBadge.style.display = 'none';
            return;
        }

        const ratio = currentBlockLimitSeconds > 0 ? currentDoomSeconds / currentBlockLimitSeconds : 0;
        const borderColor = ratio >= 0.7 ? '#ffdd00' : '#ff4b4b';
        hudBadge.style.borderColor = borderColor;
        hudBadge.textContent = `${currentMatch.platformName}: ${formatClock(currentDoomSeconds)} / ${formatClock(currentBlockLimitSeconds)}`;
        hudBadge.style.display = 'block';
    }

    function showScoldBanner(text) {
        ensureBody(() => {
            if (!scoldBanner || !document.body.contains(scoldBanner)) {
                scoldBanner = document.createElement('div');
                scoldBanner.id = 'doom-scolder-toast';
                scoldBanner.style.cssText = `
                    position: fixed;
                    top: 18px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: linear-gradient(135deg, #b91c1c, #7f1d1d);
                    color: #ffffff;
                    border: 1px solid rgba(255, 255, 255, 0.25);
                    padding: 12px 20px;
                    border-radius: 12px;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    font-size: 14px;
                    font-weight: 800;
                    z-index: 2147483646;
                    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.6);
                    pointer-events: none;
                    display: none;
                    text-align: center;
                `;
                document.body.appendChild(scoldBanner);
            }

            scoldBanner.textContent = text;
            scoldBanner.style.display = 'block';
            clearTimeout(scoldBannerTimer);
            scoldBannerTimer = setTimeout(() => {
                if (scoldBanner) scoldBanner.style.display = 'none';
            }, 3500);
        });
    }

    async function playBoostedBuffer(audioSrc, onDone) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return 'fallback';

        if (!scoldAudioCtx) {
            scoldAudioCtx = new AudioCtx();
        }
        if (scoldAudioCtx.state === 'suspended') {
            try {
                await scoldAudioCtx.resume();
            } catch (e) { }
        }
        if (scoldAudioCtx.state !== 'running') {
            return 'blocked';
        }

        const resp = await fetch(audioSrc);
        if (!resp.ok) return 'fallback';
        const arrayBuf = await resp.arrayBuffer();
        const audioBuf = await scoldAudioCtx.decodeAudioData(arrayBuf);

        const source = scoldAudioCtx.createBufferSource();
        source.buffer = audioBuf;

        // Boost quiet recordings and clamp peaks with a limiter
        const gainNode = scoldAudioCtx.createGain();
        gainNode.gain.value = 2.6;

        const compressor = scoldAudioCtx.createDynamicsCompressor();
        compressor.threshold.value = -3;
        compressor.knee.value = 6;
        compressor.ratio.value = 12;
        compressor.attack.value = 0.002;
        compressor.release.value = 0.15;

        source.connect(gainNode);
        gainNode.connect(compressor);
        compressor.connect(scoldAudioCtx.destination);

        const fallbackTimer = setTimeout(onDone, Math.max(6500, Math.ceil(audioBuf.duration * 1000) + 300));
        source.onended = () => {
            clearTimeout(fallbackTimer);
            onDone();
        };
        source.start(0);
        return 'played';
    }

    function isVideoMedia(sound) {
        if (!sound) return false;
        if (sound.mediaType === 'video') return true;
        if (sound.dataUrl && sound.dataUrl.startsWith('data:video/')) return true;
        return /\.(mp4|webm|mov|m4v)$/i.test(sound.name || sound.url || '');
    }

    function playScoldVideo(mediaSrc, sound, reasonLabel, restoreVolumes) {
        const existing = document.getElementById('doom-scolder-video-overlay');
        if (existing) existing.remove();

        const wrap = document.createElement('div');
        wrap.id = 'doom-scolder-video-overlay';
        wrap.style.cssText = [
            'position:fixed',
            'top:50%',
            'left:50%',
            'transform:translate(-50%,-50%) scale(0.75)',
            'opacity:0',
            'transition:transform 4.8s cubic-bezier(0.16,1,0.3,1),opacity 0.35s ease',
            'will-change:transform,opacity',
            'z-index:2147483647',
            'width:min(520px,68vw)',
            'background:#141417',
            'border:2px solid #ef4444',
            'border-radius:16px',
            'padding:12px',
            'box-shadow:0 24px 60px rgba(0,0,0,0.88),0 0 36px rgba(239,68,68,0.35)',
            'display:flex',
            'flex-direction:column',
            'gap:10px',
            'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif'
        ].join(';');

        const header = document.createElement('div');
        header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;color:#f87171;font-size:13px;font-weight:700;';
        header.textContent = reasonLabel || 'Stop doomscrolling! Get back to work.';

        const video = document.createElement('video');
        video.src = mediaSrc;
        video.autoplay = true;
        video.playsInline = true;
        video.volume = 1.0;
        video.style.cssText = 'width:100%;max-height:55vh;border-radius:10px;background:#000;display:block;';

        let cleaned = false;
        const cleanup = () => {
            if (cleaned) return;
            cleaned = true;
            try { video.pause(); } catch (e) { }
            wrap.remove();
            restoreVolumes();
        };

        const fallbackTimer = setTimeout(cleanup, 15000);
        video.onended = () => { clearTimeout(fallbackTimer); cleanup(); };
        video.onerror = () => { clearTimeout(fallbackTimer); cleanup(); };

        wrap.appendChild(header);
        wrap.appendChild(video);
        (document.body || document.documentElement).appendChild(wrap);

        video.play().then(() => {
            pendingScoldSound = null;
            requestAnimationFrame(() => {
                wrap.style.opacity = '1';
                wrap.style.transform = 'translate(-50%,-50%) scale(1.42)';
            });
        }).catch(() => {
            clearTimeout(fallbackTimer);
            cleanup();
            pendingScoldSound = sound;
        });
    }

    function resolveMediaSrc(sound) {
        if (sound.dataUrl) return Promise.resolve(sound.dataUrl);
        const relUrl = sound.url || '';
        if (mediaDataUrlCache[relUrl]) {
            return Promise.resolve(mediaDataUrlCache[relUrl]);
        }
        return new Promise((resolve) => {
            const sent = safeSendMessage({ action: 'fetchMediaDataUrl', url: relUrl }, (resp, err) => {
                if (!err && resp && resp.dataUrl) {
                    mediaDataUrlCache[relUrl] = resp.dataUrl;
                    resolve(resp.dataUrl);
                } else {
                    resolve('');
                }
            });
            if (!sent) resolve('');
        });
    }

    function playScoldAudio(sound, reasonLabel) {
        if (!sound) return;
        showScoldBanner(reasonLabel || 'Stop doomscrolling! Get back to work.');

        try {
            const mediaEls = Array.from(document.querySelectorAll('video, audio'));
            const prevStates = mediaEls.map(el => ({ el, vol: el.volume, muted: el.muted }));
            let restored = false;

            const restoreVolumes = () => {
                if (restored) return;
                restored = true;
                prevStates.forEach(({ el, vol, muted }) => {
                    try {
                        el.volume = vol;
                        el.muted = muted;
                    } catch (e) { }
                });
            };

            prevStates.forEach(({ el }) => {
                try {
                    el.volume = 0;
                    el.muted = true;
                } catch (e) { }
            });

            resolveMediaSrc(sound).then((audioSrc) => {
                if (isVideoMedia(sound)) {
                    playScoldVideo(audioSrc, sound, reasonLabel, restoreVolumes);
                    return;
                }

                const fallbackHtmlAudio = () => {
                    const audio = new Audio(audioSrc);
                    audio.volume = 1.0;
                    const fallbackTimer = setTimeout(restoreVolumes, 6500);

                    audio.onended = () => {
                        clearTimeout(fallbackTimer);
                        restoreVolumes();
                    };
                    audio.onerror = () => {
                        clearTimeout(fallbackTimer);
                        restoreVolumes();
                    };

                    audio.play().then(() => {
                        pendingScoldSound = null;
                    }).catch(() => {
                        clearTimeout(fallbackTimer);
                        restoreVolumes();
                        // Queue sound for the user's next click/keypress if autoplay blocked
                        pendingScoldSound = sound;
                    });
                };

                if (!audioSrc.startsWith('data:')) {
                    fallbackHtmlAudio();
                    return;
                }

                playBoostedBuffer(audioSrc, restoreVolumes).then((status) => {
                    if (status === 'played') {
                        pendingScoldSound = null;
                    } else if (status === 'blocked') {
                        restoreVolumes();
                        pendingScoldSound = sound;
                    } else {
                        fallbackHtmlAudio();
                    }
                }).catch(() => {
                    fallbackHtmlAudio();
                });
            });
        } catch (e) {
            console.warn('Doom Scolder audio error:', e);
        }
    }

    function flushPendingAudio() {
        if (!pendingScoldSound) return;
        const sound = pendingScoldSound;
        pendingScoldSound = null;
        playScoldAudio(sound, 'Stop doomscrolling!');
    }

    function pauseAllMedia() {
        document.querySelectorAll('video, audio').forEach((el) => {
            try {
                if (!el.paused) el.pause();
                if (!el.muted) el.muted = true;
            } catch (e) { }
        });
    }

    function injectBlockingOverlay() {
        if (!document.body) return;
        if (blockingOverlay && document.getElementById('doom-scolder-block-overlay')) return;

        if (!document.getElementById('doom-scolder-overlay-anim-style')) {
            const styleEl = document.createElement('style');
            styleEl.id = 'doom-scolder-overlay-anim-style';
            styleEl.textContent = `
                @keyframes doomOverlayFlicker {
                    0%, 72%, 76%, 80%, 100% { opacity: 1; transform: translate(0, 0) scale(1); }
                    73% { opacity: 0.7; transform: translate(-2px, 1px) scale(1.01); }
                    77% { opacity: 0.45; transform: translate(2px, -1px) scale(0.99); }
                    81% { opacity: 0.85; transform: translate(-1px, 0) scale(1); }
                }
            `;
            (document.head || document.documentElement).appendChild(styleEl);
        }

        blockingOverlay = document.createElement('div');
        blockingOverlay.id = 'doom-scolder-block-overlay';
        blockingOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(11, 11, 15, 0.96);
            backdrop-filter: blur(18px);
            -webkit-backdrop-filter: blur(18px);
            color: #e2e2e9;
            z-index: 2147483647;
            display: none;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            padding: 24px;
            box-sizing: border-box;
            text-align: center;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            overflow: hidden;
        `;

        const sparkCanvas = document.createElement('canvas');
        sparkCanvas.id = 'doom-scolder-overlay-sparks';
        sparkCanvas.style.cssText = `
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 1;
        `;

        const angryIcon = document.createElement('img');
        angryIcon.id = 'doom-scolder-overlay-icon';
        angryIcon.alt = 'Doom Scolder Angry';
        resolveMediaSrc({ url: 'icons/angry128.png' }).then((src) => {
            if (src && src.startsWith('data:')) {
                angryIcon.src = src;
            }
        });
        angryIcon.style.cssText = `
            width: 84px;
            height: 84px;
            border-radius: 50%;
            margin-bottom: 20px;
            position: relative;
            z-index: 2;
            filter: drop-shadow(0 0 18px rgba(255, 40, 40, 0.85));
            animation: doomOverlayFlicker 2.1s infinite;
        `;

        const title = document.createElement('h1');
        title.textContent = 'Doomscroll Limit Reached! Get back to work.';
        title.style.cssText = `
            margin: 0 0 14px 0;
            font-size: 36px;
            font-weight: 800;
            color: #ff4b4b;
            text-shadow: 0 4px 16px rgba(0, 0, 0, 0.6);
            max-width: 680px;
            line-height: 1.2;
            position: relative;
            z-index: 2;
        `;

        const subtitle = document.createElement('p');
        subtitle.id = 'doom-scolder-block-subtitle';
        subtitle.style.cssText = `
            margin: 0 0 28px 0;
            font-size: 16px;
            color: #a1a1aa;
            max-width: 520px;
            line-height: 1.5;
            position: relative;
            z-index: 2;
        `;

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close Tab';
        closeBtn.style.cssText = `
            padding: 15px 34px;
            background: linear-gradient(135deg, #d32f2f, #b71c1c);
            color: #ffffff;
            border: 1px solid rgba(255, 255, 255, 0.18);
            border-radius: 12px;
            font-size: 18px;
            font-weight: 700;
            cursor: pointer;
            box-shadow: 0 8px 24px rgba(211, 47, 47, 0.35);
            transition: transform 0.15s ease, box-shadow 0.15s ease;
            position: relative;
            z-index: 2;
        `;

        closeBtn.addEventListener('mouseenter', () => {
            closeBtn.style.transform = 'translateY(-2px)';
            closeBtn.style.boxShadow = '0 12px 28px rgba(211, 47, 47, 0.55)';
        });
        closeBtn.addEventListener('mouseleave', () => {
            closeBtn.style.transform = 'translateY(0)';
            closeBtn.style.boxShadow = '0 8px 24px rgba(211, 47, 47, 0.35)';
        });
        closeBtn.addEventListener('click', () => {
            safeSendMessage({ action: 'closeTab' });
        });

        blockingOverlay.appendChild(sparkCanvas);
        blockingOverlay.appendChild(angryIcon);
        blockingOverlay.appendChild(title);
        blockingOverlay.appendChild(subtitle);
        blockingOverlay.appendChild(closeBtn);
        document.body.appendChild(blockingOverlay);

        if (overlaySparkController) {
            overlaySparkController.destroy();
            overlaySparkController = null;
        }
        if (window.DoomSparks) {
            overlaySparkController = window.DoomSparks.createSparkController(sparkCanvas, {
                getAnchors: (cRect) => {
                    const anchors = [];
                    const ir = angryIcon.getBoundingClientRect();
                    if (ir.width > 0) {
                        anchors.push({
                            x: (ir.left + ir.right) / 2 - cRect.left,
                            y: (ir.top + ir.bottom) / 2 - cRect.top,
                            r: ir.width / 2
                        });
                    }
                    return anchors;
                }
            });
        }
    }

    function updateOverlaySubtitle() {
        const sub = document.getElementById('doom-scolder-block-subtitle');
        if (sub) {
            const minsLimit = Math.round(currentBlockLimitSeconds / 60);
            sub.textContent = `Close this tab or complete the mindfulness test in the Doom Scolder popup.`;
        }
    }

    function computeEffectStage() {
        if (!currentMatch.matched || currentBlockLimitSeconds <= 0) return 'none';
        const ratio = currentDoomSeconds / currentBlockLimitSeconds;
        if (ratio >= 1.0) return 'climax';
        if (ratio >= 0.84) return 'more_missiles';
        if (ratio >= 0.70) return 'few_missiles';
        return 'none';
    }

    function syncEffectsStage(stageOverride) {
        if (!window.DoomEffects) return;
        const stage = currentMatch.matched ? (stageOverride || computeEffectStage()) : 'none';
        const progress = currentBlockLimitSeconds > 0
            ? Math.min(1, currentDoomSeconds / currentBlockLimitSeconds)
            : 0;
        window.DoomEffects.setStage(stage, {
            progress,
            resolveAudio: (path) => resolveMediaSrc({ url: path }),
            onCloseTab: () => {
                safeSendMessage({ action: 'closeTab' });
            }
        });
    }

    function startEnforcingBlock() {
        isBlocked = true;
        ensureBody(() => {
            if (window.DoomEffects) {
                syncEffectsStage('climax');
            } else {
                injectBlockingOverlay();
                if (blockingOverlay) {
                    updateOverlaySubtitle();
                    blockingOverlay.style.display = 'flex';
                }
                if (overlaySparkController) overlaySparkController.setMode('angry');
            }
            if (document.documentElement) document.documentElement.style.overflow = 'hidden';
            if (document.body) document.body.style.overflow = 'hidden';
            pauseAllMedia();
            updateHud();
        });

        if (!enforceInterval) {
            enforceInterval = setInterval(() => {
                if (!isBlocked) return;
                if (window.DoomEffects) {
                    if (!document.getElementById('doom-scolder-fx-layer')) {
                        syncEffectsStage('climax');
                    }
                } else if (!document.getElementById('doom-scolder-block-overlay')) {
                    blockingOverlay = null;
                    injectBlockingOverlay();
                    if (blockingOverlay) {
                        updateOverlaySubtitle();
                        blockingOverlay.style.display = 'flex';
                    }
                    if (overlaySparkController) overlaySparkController.setMode('angry');
                }
                if (document.documentElement && document.documentElement.style.overflow !== 'hidden') {
                    document.documentElement.style.overflow = 'hidden';
                }
                if (document.body && document.body.style.overflow !== 'hidden') {
                    document.body.style.overflow = 'hidden';
                }
                pauseAllMedia();
            }, 500);
        }
    }

    function stopEnforcingBlock() {
        isBlocked = false;
        if (overlaySparkController) overlaySparkController.setMode('safe');
        if (blockingOverlay) {
            blockingOverlay.style.display = 'none';
        }
        syncEffectsStage(computeEffectStage());
        if (document.documentElement) document.documentElement.style.overflow = '';
        if (document.body) document.body.style.overflow = '';
        if (enforceInterval) {
            clearInterval(enforceInterval);
            enforceInterval = null;
        }
        updateHud();
    }

    // Intercept auto-resuming Shorts / Reels / TikTok videos on frame 1 while blocked
    document.addEventListener('play', (e) => {
        if (!isBlocked) return;
        const target = e.target;
        if (target && (target.tagName === 'VIDEO' || target.tagName === 'AUDIO')) {
            try {
                target.pause();
                target.muted = true;
            } catch (err) { }
        }
    }, true);

    function hasPlayingVisibleVideo() {
        const videos = document.querySelectorAll('video');
        for (const v of videos) {
            if (!v.paused && !v.ended && v.readyState > 2) {
                const rect = v.getBoundingClientRect();
                if (rect.width > 40 && rect.height > 40 && rect.bottom > 0 && rect.top < window.innerHeight) {
                    return true;
                }
            }
        }
        return false;
    }

    function markInteraction() {
        lastInteractionAt = Date.now();
    }

    window.addEventListener('wheel', markInteraction, { passive: true });

    // Capture phase scroll handles SPAs that scroll inner containers (X, IG, Discord, Reddit)
    document.addEventListener('scroll', markInteraction, { capture: true, passive: true });

    window.addEventListener('keydown', () => {
        markInteraction();
        flushPendingAudio();
    }, true);

    window.addEventListener('pointerdown', () => {
        markInteraction();
        flushPendingAudio();
    }, true);

    window.addEventListener('mousemove', markInteraction, { passive: true });
    window.addEventListener('touchstart', markInteraction, { passive: true });

    function evaluateCurrentRoute(forceCheck = false) {
        const href = window.location.href;
        if (!forceCheck && href === lastUrl) return;
        lastUrl = href;

        currentMatch = DoomPlatforms.evaluateUrl(href, cachedPlatformSettings, cachedCustomSites);

        if (!currentMatch.matched) {
            stopEnforcingBlock();
            updateHud();
            return;
        }

        syncStatusFromBackground();
    }

    function syncStatusFromBackground() {
        safeSendMessage({ action: 'getStatus' }, (resp, err) => {
            if (err || !resp) return;
            currentDoomSeconds = resp.doomSeconds || 0;
            currentDailySeconds = resp.dailyDoomSeconds || 0;
            currentBlockLimitSeconds = resp.blockLimitSeconds || (20 * 60);

            if (currentMatch.matched && (resp.blocked || currentDoomSeconds >= currentBlockLimitSeconds)) {
                startEnforcingBlock();
            } else {
                stopEnforcingBlock();
                syncEffectsStage(resp.effectStage);
            }
            updateHud();
        });
    }

    function startActivityLoop() {
        if (pingInterval) return;
        pingInterval = setInterval(() => {
            if (!isExtensionContextValid()) {
                teardownOrphanedScript();
                return;
            }
            if (!currentMatch.matched) return;
            if (document.visibilityState !== 'visible' || !document.hasFocus()) return;

            const recentlyActive = (Date.now() - lastInteractionAt) < ACTIVE_IDLE_WINDOW_MS;
            if (!recentlyActive && !hasPlayingVisibleVideo()) return;

            if (isBlocked) return;

            safeSendMessage({ action: 'activityPing', platform: currentMatch.platformId }, (resp, err) => {
                if (err || !resp || resp.error) return;
                currentDoomSeconds = resp.doomSeconds || 0;
                currentDailySeconds = resp.dailyDoomSeconds || 0;
                currentBlockLimitSeconds = resp.blockLimitSeconds || (20 * 60);

                if (resp.blocked) {
                    startEnforcingBlock();
                } else {
                    if (resp.shouldScold && resp.sound) {
                        playScoldAudio(resp.sound, 'Stop doomscrolling.');
                    }
                    syncEffectsStage(resp.effectStage);
                    updateHud();
                }
            });
        }, PING_INTERVAL_MS);
    }

    // SPA route listeners
    const origPushState = history.pushState;
    history.pushState = function (...args) {
        const ret = origPushState.apply(this, args);
        evaluateCurrentRoute();
        return ret;
    };

    const origReplaceState = history.replaceState;
    history.replaceState = function (...args) {
        const ret = origReplaceState.apply(this, args);
        evaluateCurrentRoute();
        return ret;
    };

    window.addEventListener('popstate', () => evaluateCurrentRoute());

    ensureBody(() => {
        injectHudBadge();
        injectBlockingOverlay();
        const observer = new MutationObserver(() => {
            if (window.location.href !== lastUrl) {
                evaluateCurrentRoute();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    });

    setInterval(() => {
        if (window.location.href !== lastUrl) {
            evaluateCurrentRoute();
        }
    }, 1000);

    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace !== 'local') return;
        let needReeval = false;

        if (changes.platformSettings) {
            cachedPlatformSettings = changes.platformSettings.newValue;
            needReeval = true;
        }
        if (changes.customSites) {
            cachedCustomSites = changes.customSites.newValue || [];
            needReeval = true;
        }
        if (changes.doomSeconds) {
            currentDoomSeconds = changes.doomSeconds.newValue || 0;
        }
        if (changes.blockLimitMinutes) {
            currentBlockLimitSeconds = (changes.blockLimitMinutes.newValue || 20) * 60;
        }

        if (needReeval) {
            evaluateCurrentRoute(true);
        } else if (changes.doomSeconds || changes.blockLimitMinutes) {
            if (currentMatch.matched && currentDoomSeconds >= currentBlockLimitSeconds) {
                startEnforcingBlock();
            } else {
                stopEnforcingBlock();
                syncEffectsStage();
            }
            updateHud();
        }
    });

    // Initial boot
    chrome.storage.local.get([
        'platformSettings',
        'customSites',
        'doomSeconds',
        'dailyDoomSeconds',
        'blockLimitMinutes'
    ], (res) => {
        cachedPlatformSettings = DoomPlatforms.mergePlatformSettings(res.platformSettings);
        cachedCustomSites = Array.isArray(res.customSites) ? res.customSites : [];
        currentDoomSeconds = res.doomSeconds || 0;
        currentDailySeconds = res.dailyDoomSeconds || 0;
        currentBlockLimitSeconds = (res.blockLimitMinutes || 20) * 60;

        evaluateCurrentRoute(true);
        startActivityLoop();
    });
})();
