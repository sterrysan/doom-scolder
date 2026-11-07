// options.js - Doom Scolder Settings with Shame Slalom & Anti-Cheat

(function () {
    document.addEventListener('DOMContentLoaded', () => {
        // Form elements
        const container = document.getElementById('settings-container');
        const titleElem = document.getElementById('settings-title');
        const blockLimitInput = document.getElementById('shorts-block-limit');
        const scoldLimitInput = document.getElementById('shorts-limit');
        const scoldingEnabledCheckbox = document.getElementById('scolding-enabled');
        const saveButton = document.getElementById('save-button');
        const saveButtonWrapper = document.getElementById('save-button-wrapper');

        // Sound Manager elements
        const soundDropzone = document.getElementById('sound-dropzone');
        const soundFileInput = document.getElementById('sound-file-input');
        const browseSoundsBtn = document.getElementById('browse-sounds-btn');
        const soundList = document.getElementById('sound-list');
        const soundCount = document.getElementById('sound-count');
        const restoreDefaultSoundsBtn = document.getElementById('restore-default-sounds-btn');

        // Maze elements
        const mazeInstructionBar = document.getElementById('maze-instruction-bar');
        const mazeStartPad = document.getElementById('maze-start-pad');
        const startLabel = document.getElementById('start-label');
        const mazeCanvas = document.getElementById('maze-canvas');
        const dodgeRoastBubble = document.getElementById('dodge-roast-bubble');
        const optionsToast = document.getElementById('options-toast');

        const settingCards = [
            document.getElementById('card-block-limit'),
            document.getElementById('card-scold-toggle'),
            document.getElementById('card-scold-limit'),
            document.getElementById('card-sounds')
        ];

        // Default built-in sounds (copied from user's downloads folder)
        const DEFAULT_SOUNDS = [
            { id: 'default_scream1', name: 'Scream1.mp3', url: 'sounds/Scream1.mp3', isDefault: true, enabled: true },
            { id: 'default_scream2', name: 'Scream2.mp3', url: 'sounds/Scream2.mp3', isDefault: true, enabled: true },
            { id: 'default_obsession', name: 'Obsession.mp3', url: 'sounds/Obsession.mp3', isDefault: true, enabled: true }
        ];

        let currentSounds = [];
        let previewAudio = null;
        let currentlyPlayingId = null;

        // State variables
        let savedBlockLimit = 10;
        let savedScoldLimit = 2;
        let isLockdownActive = false;
        let isDrawing = false;
        let mazeCompleted = false;
        let currentGateIndex = 0;
        let pathPoints = [];
        let toastTimeout = null;

        const WARNING_ICON_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
        const LIMIT_INCREASE_WARNING = `${WARNING_ICON_SVG}<span>Complete the Shame Slalom to unlock Save.</span>`;

        // Roasts & Mockery
        const DODGE_ROASTS = [
            "Negotiating with yourself already?",
            "Draw the line without touching cards, coward!",
            "No shortcuts to your addiction! Slalom above!",
            "Look at you, bargaining with a robot! 🤡",
            "Nice try! Navigate the wire first.",
            "Hands off!",
            "Earn it through the shame slalom 🖕"
        ];

        const BUZZ_ROASTS = [
            "BZZT! Shaky hands?",
            "WALL TOUCHED! Even a toddler has steadier hands.",
            "Zapped! Avoid touching ANY card to unlock Save.",
            "BZZZZZT! Keep inside the corridor!",
            "Careful! One touch and you start over."
        ];

        // ==========================================
        // Web Audio Synthesizer (Zero External Files)
        // ==========================================
        let audioCtx = null;
        const getAudioContext = () => {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
            return audioCtx;
        };

        const playBuzzerSound = () => {
            try {
                const ctx = getAudioContext();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(160, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(75, ctx.currentTime + 0.2);

                gain.gain.setValueAtTime(0.18, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.2);
            } catch (e) { }
        };

        const playGatePing = () => {
            try {
                const ctx = getAudioContext();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = 'sine';
                osc.frequency.setValueAtTime(600 + (currentGateIndex * 70), ctx.currentTime);

                gain.gain.setValueAtTime(0.1, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.12);
            } catch (e) { }
        };

        const playSuccessFanfare = () => {
            try {
                const ctx = getAudioContext();
                const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
                notes.forEach((freq, idx) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    const startTime = ctx.currentTime + (idx * 0.1);

                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, startTime);

                    gain.gain.setValueAtTime(0.15, startTime);
                    gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.22);

                    osc.connect(gain);
                    gain.connect(ctx.destination);

                    osc.start(startTime);
                    osc.stop(startTime + 0.22);
                });
            } catch (e) { }
        };

        const playThunderSound = () => {
            try {
                const ctx = getAudioContext();
                const now = ctx.currentTime;

                const bufferSize = Math.floor(ctx.sampleRate * 2.2);
                const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
                const output = noiseBuffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    output[i] = Math.random() * 2 - 1;
                }

                const whiteNoise = ctx.createBufferSource();
                whiteNoise.buffer = noiseBuffer;

                const filter = ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(450, now);
                filter.frequency.exponentialRampToValueAtTime(60, now + 1.8);

                const gain = ctx.createGain();
                gain.gain.setValueAtTime(0.01, now);
                gain.gain.linearRampToValueAtTime(0.4, now + 0.04);
                gain.gain.exponentialRampToValueAtTime(0.12, now + 0.35);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 2.1);

                const subOsc = ctx.createOscillator();
                const subGain = ctx.createGain();
                subOsc.type = 'sawtooth';
                subOsc.frequency.setValueAtTime(90, now);
                subOsc.frequency.exponentialRampToValueAtTime(32, now + 1.8);

                subGain.gain.setValueAtTime(0.25, now);
                subGain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);

                whiteNoise.connect(filter);
                filter.connect(gain);
                gain.connect(ctx.destination);

                subOsc.connect(subGain);
                subGain.connect(ctx.destination);

                whiteNoise.start(now);
                whiteNoise.stop(now + 2.1);
                subOsc.start(now);
                subOsc.stop(now + 1.8);
            } catch (e) { }
        };

        // Ambient Continuous Rain Sound Synthesizer (Realistic Filtered Downpour)
        let rainAudioSource = null;
        let rainAudioGain = null;

        const startRainSound = () => {
            try {
                if (rainAudioSource) return;
                const ctx = getAudioContext();
                const now = ctx.currentTime;

                // 2-second looped pink-filtered noise buffer for natural rain texture
                const bufferSize = Math.floor(ctx.sampleRate * 2.0);
                const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
                const output = noiseBuffer.getChannelData(0);
                let b0 = 0, b1 = 0, b2 = 0;
                for (let i = 0; i < bufferSize; i++) {
                    const white = Math.random() * 2 - 1;
                    b0 = 0.99765 * b0 + white * 0.0990460;
                    b1 = 0.96300 * b1 + white * 0.2965164;
                    b2 = 0.57000 * b2 + white * 1.0526913;
                    output[i] = (b0 + b1 + b2 + white * 0.1848) * 0.04;
                }

                rainAudioSource = ctx.createBufferSource();
                rainAudioSource.buffer = noiseBuffer;
                rainAudioSource.loop = true;

                const bandpass = ctx.createBiquadFilter();
                bandpass.type = 'bandpass';
                bandpass.frequency.setValueAtTime(1400, now);
                bandpass.Q.setValueAtTime(0.7, now);

                const lowpass = ctx.createBiquadFilter();
                lowpass.type = 'lowpass';
                lowpass.frequency.setValueAtTime(3400, now);

                rainAudioGain = ctx.createGain();
                rainAudioGain.gain.setValueAtTime(0.001, now);
                rainAudioGain.gain.linearRampToValueAtTime(0.14, now + 0.6);

                rainAudioSource.connect(bandpass);
                bandpass.connect(lowpass);
                lowpass.connect(rainAudioGain);
                rainAudioGain.connect(ctx.destination);

                rainAudioSource.start(now);
            } catch (e) { }
        };

        const stopRainSound = () => {
            try {
                if (rainAudioGain && audioCtx) {
                    const now = audioCtx.currentTime;
                    rainAudioGain.gain.cancelScheduledValues(now);
                    rainAudioGain.gain.setValueAtTime(rainAudioGain.gain.value, now);
                    rainAudioGain.gain.linearRampToValueAtTime(0.0001, now + 0.4);
                    const src = rainAudioSource;
                    setTimeout(() => {
                        try {
                            if (src) src.stop();
                        } catch (e) { }
                    }, 450);
                    rainAudioSource = null;
                    rainAudioGain = null;
                }
            } catch (e) { }
        };

        // ==========================================
        // Toast Notification Utility
        // ==========================================
        const showToast = (message, color = '#ff5252', duration = 3000) => {
            if (!optionsToast) return;
            if (toastTimeout) clearTimeout(toastTimeout);

            optionsToast.innerHTML = message;
            optionsToast.style.borderColor = color;
            optionsToast.style.color = color;
            optionsToast.style.display = 'flex';

            toastTimeout = setTimeout(() => {
                optionsToast.style.display = 'none';
            }, duration);
        };

        // ==========================================
        // Canvas & Slalom Geometry Setup
        // ==========================================
        const ctx = mazeCanvas.getContext('2d');

        const resizeCanvas = () => {
            const rect = container.getBoundingClientRect();
            const targetW = Math.round(rect.width);
            const targetH = Math.round(rect.height);
            if (mazeCanvas.width !== targetW || mazeCanvas.height !== targetH) {
                mazeCanvas.width = targetW;
                mazeCanvas.height = targetH;
            }
        };

        // Returns bounding rect of element relative to container
        const getRelRect = (elem) => {
            if (!elem) return { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 };
            const cRect = container.getBoundingClientRect();
            const eRect = elem.getBoundingClientRect();
            return {
                left: eRect.left - cRect.left,
                right: eRect.right - cRect.left,
                top: eRect.top - cRect.top,
                bottom: eRect.bottom - cRect.top,
                width: eRect.width,
                height: eRect.height,
                centerX: (eRect.left + eRect.right) / 2 - cRect.left,
                centerY: (eRect.top + eRect.bottom) / 2 - cRect.top
            };
        };

        // Calculate the 8 S-curve Slalom Checkpoint Gates
        const getGates = () => {
            const cWidth = container.clientWidth;
            const rStart = getRelRect(mazeStartPad);
            const r0 = getRelRect(settingCards[0]); // Block Limit
            const r1 = getRelRect(settingCards[1]); // Scold Toggle
            const r2 = getRelRect(settingCards[2]); // Scold Limit
            const r3 = getRelRect(settingCards[3]); // Messages
            const rBtn = getRelRect(saveButton);

            return [
                // Gate 1: Right corridor of Card 0 (starts from right of start pad)
                { name: "Top Right", xMin: r0.right, xMax: cWidth, yMin: Math.min(rStart.centerY - 8, r0.top - 20), yMax: r0.bottom + 10 },
                // Gate 2: Gap between Card 0 and Card 1 (crossing towards left)
                { name: "Gap 1", xMin: r0.left - 10, xMax: r0.right + 10, yMin: r0.bottom - 5, yMax: r1.top + 5 },
                // Gate 3: Left corridor of Card 1
                { name: "Mid Left 1", xMin: 0, xMax: r1.left, yMin: r1.top - 10, yMax: r1.bottom + 10 },
                // Gate 4: Gap between Card 1 and Card 2 (crossing towards right)
                { name: "Gap 2", xMin: r1.left - 10, xMax: r1.right + 10, yMin: r1.bottom - 5, yMax: r2.top + 5 },
                // Gate 5: Right corridor of Card 2
                { name: "Mid Right 2", xMin: r2.right, xMax: cWidth, yMin: r2.top - 10, yMax: r2.bottom + 10 },
                // Gate 6: Gap between Card 2 and Card 3 (crossing towards left)
                { name: "Gap 3", xMin: r2.left - 10, xMax: r2.right + 10, yMin: r2.bottom - 5, yMax: r3.top + 5 },
                // Gate 7: Left corridor of Card 3
                { name: "Bottom Left", xMin: 0, xMax: r3.left, yMin: r3.top - 10, yMax: r3.bottom + 10 },
                // Gate 8: Under Card 3 / Entrance to Save Button
                { name: "Finish Line", xMin: r3.left - 20, xMax: r3.right + 20, yMin: r3.bottom - 5, yMax: rBtn.top + 15 }
            ];
        };

        // Guide line fade animation state
        let guideOpacity = 1.0;
        let targetGuideOpacity = 1.0;

        const fadeGuide = (targetOpacity) => {
            targetGuideOpacity = targetOpacity;
        };

        // Draw the faint dashed guide course matching the user's diagram
        const drawSlalomGuide = () => {
            if (guideOpacity <= 0.01) return;

            const rStart = getRelRect(mazeStartPad);
            const r0 = getRelRect(settingCards[0]);
            const r1 = getRelRect(settingCards[1]);
            const r2 = getRelRect(settingCards[2]);
            const r3 = getRelRect(settingCards[3]);
            const rBtn = getRelRect(saveButton);
            const cWidth = container.clientWidth;

            const rightX = (r0.right + cWidth) / 2;
            const leftX = r0.left / 2;

            const gap01Y = (r0.bottom + r1.top) / 2;
            const gap12Y = (r1.bottom + r2.top) / 2;
            const gap23Y = (r2.bottom + r3.top) / 2;
            const gap3BtnY = (r3.bottom + rBtn.top) / 2;

            // Clean orthogonal corridor path with rounded corners (starts directly from the RIGHT side of the pill)
            const pathPointsGuide = [
                { x: rStart.right + 4, y: rStart.centerY },
                { x: rightX, y: rStart.centerY },
                { x: rightX, y: gap01Y },
                { x: leftX, y: gap01Y },
                { x: leftX, y: gap12Y },
                { x: rightX, y: gap12Y },
                { x: rightX, y: gap23Y },
                { x: leftX, y: gap23Y },
                { x: leftX, y: gap3BtnY },
                { x: rBtn.centerX, y: gap3BtnY },
                { x: rBtn.centerX, y: rBtn.top - 8 }
            ];

            ctx.save();
            ctx.beginPath();
            ctx.setLineDash([6, 6]);
            ctx.strokeStyle = `rgba(255, 107, 0, ${0.45 * guideOpacity})`;
            ctx.lineWidth = 2.5;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            ctx.moveTo(pathPointsGuide[0].x, pathPointsGuide[0].y);
            const cornerRadius = Math.max(4, Math.min(10, (r1.top - r0.bottom) / 2));
            for (let i = 1; i < pathPointsGuide.length - 1; i++) {
                const pCurrent = pathPointsGuide[i];
                const pNext = pathPointsGuide[i + 1];
                ctx.arcTo(pCurrent.x, pCurrent.y, pNext.x, pNext.y, cornerRadius);
            }
            const lastPt = pathPointsGuide[pathPointsGuide.length - 1];
            ctx.lineTo(lastPt.x, lastPt.y);
            ctx.stroke();

            // Glowing anchor dot at the right side launch port of the pill
            ctx.beginPath();
            ctx.fillStyle = `rgba(255, 107, 0, ${0.8 * guideOpacity})`;
            ctx.arc(pathPointsGuide[0].x, pathPointsGuide[0].y, 3.5, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        };

        // ==========================================
        // Multi-Layer Realistic Rain, Thunder & Line Erosion System
        // ==========================================
        let farRain = [];
        let midRain = [];
        let nearRain = [];
        let rainRipples = [];
        let rainSplashes = [];
        let rainMist = [];

        const FAR_RAIN_COUNT = 105;
        const MID_RAIN_COUNT = 72;
        const NEAR_RAIN_COUNT = 24;

        const initRain = () => {
            farRain = [];
            midRain = [];
            nearRain = [];
            rainRipples = [];
            rainSplashes = [];
            rainMist = [];

            const w = mazeCanvas.width || container.clientWidth || 540;
            const h = mazeCanvas.height || container.clientHeight || 750;

            // 1. Far / Background rain (misty, short, slower, silver-blue tint)
            for (let i = 0; i < FAR_RAIN_COUNT; i++) {
                farRain.push({
                    x: Math.random() * (w + 140) - 50,
                    y: Math.random() * h,
                    len: 12 + Math.random() * 10,
                    speed: 12 + Math.random() * 5,
                    slant: -1.4 - Math.random() * 0.5,
                    alpha: 0.10 + Math.random() * 0.12,
                    width: 0.65
                });
            }

            // 2. Midground rain (crisp silver-white streaks with card surface impacts)
            for (let i = 0; i < MID_RAIN_COUNT; i++) {
                midRain.push({
                    x: Math.random() * (w + 140) - 50,
                    y: Math.random() * h,
                    len: 22 + Math.random() * 14,
                    speed: 18 + Math.random() * 6,
                    slant: -1.8 - Math.random() * 0.5,
                    alpha: 0.22 + Math.random() * 0.20,
                    width: 1.05
                });
            }

            // 3. Near / Foreground rain (long, fast, motion-blurred streaks with specular highlights)
            for (let i = 0; i < NEAR_RAIN_COUNT; i++) {
                nearRain.push({
                    x: Math.random() * (w + 140) - 50,
                    y: Math.random() * h,
                    len: 48 + Math.random() * 32,
                    speed: 28 + Math.random() * 10,
                    slant: -2.2 - Math.random() * 0.6,
                    alpha: 0.35 + Math.random() * 0.25,
                    width: 1.6 + Math.random() * 0.4
                });
            }

            // 4. Soft atmospheric storm mist
            for (let i = 0; i < 7; i++) {
                rainMist.push({
                    x: Math.random() * w,
                    y: Math.random() * h,
                    radius: 45 + Math.random() * 45,
                    vx: -0.5 - Math.random() * 0.4,
                    vy: 0.15 + Math.random() * 0.25,
                    alpha: 0.025 + Math.random() * 0.03
                });
            }
        };

        const addImpact = (x, y, slant) => {
            // Perspective horizontal elliptical ripple
            if (rainRipples.length < 35) {
                rainRipples.push({
                    x: x,
                    y: y,
                    radiusX: 1.8,
                    alpha: 0.45
                });
            }

            // 2-3 bouncing micro-droplet splashes with gravity
            const count = 2 + (Math.random() < 0.4 ? 1 : 0);
            for (let i = 0; i < count; i++) {
                if (rainSplashes.length >= 40) break;
                rainSplashes.push({
                    x: x,
                    y: y,
                    vx: (Math.random() - 0.5) * 2.8 + (slant || -1.8) * 0.15,
                    vy: -1.0 - Math.random() * 2.0,
                    gravity: 0.22,
                    life: 1.0,
                    radius: 0.7 + Math.random() * 0.7
                });
            }
        };

        const drawRainBackground = () => {
            if (!isStormActive) return;
            const w = mazeCanvas.width;
            const h = mazeCanvas.height;
            if (farRain.length === 0) initRain();

            ctx.save();

            // 1. Drifting atmospheric storm mist
            for (let i = 0; i < rainMist.length; i++) {
                const m = rainMist[i];
                m.x += m.vx;
                m.y += m.vy;
                if (m.x < -m.radius) m.x = w + m.radius;
                if (m.y > h + m.radius) m.y = -m.radius;

                const radGrad = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.radius);
                radGrad.addColorStop(0, `rgba(180, 205, 230, ${m.alpha * (1 + lightningIntensity * 1.5)})`);
                radGrad.addColorStop(1, 'rgba(180, 205, 230, 0)');
                ctx.fillStyle = radGrad;
                ctx.beginPath();
                ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
                ctx.fill();
            }

            // 2. Far / Background rain streaks (batched single stroke for peak 60fps performance)
            ctx.beginPath();
            const farAlpha = Math.min(0.35, 0.14 * (1 + lightningIntensity * 1.8));
            ctx.strokeStyle = `rgba(190, 210, 235, ${farAlpha})`;
            ctx.lineWidth = 0.65;
            ctx.lineCap = 'butt';

            for (let i = 0; i < farRain.length; i++) {
                const d = farRain[i];
                d.y += d.speed;
                d.x += d.slant;
                if (d.y > h + 30 || d.x < -60) {
                    d.y = -25;
                    d.x = Math.random() * (w + 140) - 30;
                }
                const tailRatio = (d.len / d.speed);
                ctx.moveTo(d.x, d.y);
                ctx.lineTo(d.x - d.slant * tailRatio, d.y - d.len);
            }
            ctx.stroke();

            ctx.restore();
        };

        const drawRainForeground = () => {
            if (!isStormActive) return;
            const w = mazeCanvas.width;
            const h = mazeCanvas.height;
            ctx.save();

            // 1. Query obstacle bounds once for this frame
            const obstacles = [];
            for (let c = 0; c < settingCards.length; c++) {
                obstacles.push(getRelRect(settingCards[c]));
            }
            if (saveButton) obstacles.push(getRelRect(saveButton));

            // 2. Wet glistening sheen on card top edges
            for (let i = 0; i < obstacles.length; i++) {
                const obs = obstacles[i];
                if (obs.width <= 0) continue;
                const grad = ctx.createLinearGradient(obs.left, obs.top, obs.right, obs.top);
                const sheenAlpha = Math.min(0.7, 0.16 + lightningIntensity * 0.45);
                grad.addColorStop(0, 'rgba(215, 235, 255, 0)');
                grad.addColorStop(0.15, `rgba(225, 240, 255, ${sheenAlpha})`);
                grad.addColorStop(0.85, `rgba(225, 240, 255, ${sheenAlpha})`);
                grad.addColorStop(1, 'rgba(215, 235, 255, 0)');

                ctx.beginPath();
                ctx.strokeStyle = grad;
                ctx.lineWidth = 1.2;
                ctx.moveTo(obs.left + 4, obs.top);
                ctx.lineTo(obs.right - 4, obs.top);
                ctx.stroke();
            }

            // 3. Perspective Surface Ripples (horizontal ellipses)
            for (let i = rainRipples.length - 1; i >= 0; i--) {
                const r = rainRipples[i];
                r.radiusX += 0.55;
                r.alpha -= 0.038;
                if (r.alpha <= 0 || r.radiusX > 13) {
                    rainRipples.splice(i, 1);
                    continue;
                }
                ctx.beginPath();
                ctx.strokeStyle = `rgba(225, 240, 255, ${r.alpha * (1 + lightningIntensity * 1.2)})`;
                ctx.lineWidth = 0.85;
                ctx.ellipse(r.x, r.y, r.radiusX, r.radiusX * 0.30, 0, 0, Math.PI * 2);
                ctx.stroke();
            }

            // 4. Bouncing micro-droplets
            for (let i = rainSplashes.length - 1; i >= 0; i--) {
                const s = rainSplashes[i];
                s.x += s.vx;
                s.y += s.vy;
                s.vy += s.gravity;
                s.life -= 0.068;
                if (s.life <= 0) {
                    rainSplashes.splice(i, 1);
                    continue;
                }
                ctx.beginPath();
                ctx.fillStyle = `rgba(235, 245, 255, ${s.life * 0.75 * (1 + lightningIntensity)})`;
                ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
                ctx.fill();
            }

            // 5. Midground rain streaks & obstacle collisions
            ctx.beginPath();
            const midAlpha = Math.min(0.65, 0.28 * (1 + lightningIntensity * 1.5));
            ctx.strokeStyle = `rgba(225, 238, 252, ${midAlpha})`;
            ctx.lineWidth = 1.05;
            ctx.lineCap = 'round';

            for (let i = 0; i < midRain.length; i++) {
                const d = midRain[i];
                d.y += d.speed;
                d.x += d.slant;

                let hit = false;
                for (let j = 0; j < obstacles.length; j++) {
                    const obs = obstacles[j];
                    if (d.x >= obs.left - 2 && d.x <= obs.right + 2 && d.y >= obs.top - 3 && d.y <= obs.top + 7) {
                        addImpact(d.x, obs.top, d.slant);
                        hit = true;
                        break;
                    }
                }

                if (!hit && d.y >= h - 8) {
                    addImpact(d.x, h - 8, d.slant);
                    hit = true;
                }

                if (hit || d.y > h + 30 || d.x < -60) {
                    d.y = -20 - Math.random() * 25;
                    d.x = Math.random() * (w + 140) - 30;
                    continue;
                }

                const tailRatio = (d.len / d.speed);
                ctx.moveTo(d.x, d.y);
                ctx.lineTo(d.x - d.slant * tailRatio, d.y - d.len);
            }
            ctx.stroke();

            // 6. Near / Foreground fast motion-blurred streaks (with linear gradients)
            for (let i = 0; i < nearRain.length; i++) {
                const d = nearRain[i];
                d.y += d.speed;
                d.x += d.slant;

                if (d.y > h + 50 || d.x < -70) {
                    d.y = -35 - Math.random() * 30;
                    d.x = Math.random() * (w + 140) - 30;
                }

                const tailRatio = (d.len / d.speed);
                const tailX = d.x - d.slant * tailRatio;
                const tailY = d.y - d.len;

                const grad = ctx.createLinearGradient(tailX, tailY, d.x, d.y);
                const a = Math.min(0.9, d.alpha * (1 + lightningIntensity * 1.3));
                grad.addColorStop(0, 'rgba(215, 230, 255, 0)');
                grad.addColorStop(0.6, `rgba(235, 245, 255, ${a * 0.4})`);
                grad.addColorStop(1, `rgba(255, 255, 255, ${a})`);

                ctx.beginPath();
                ctx.strokeStyle = grad;
                ctx.lineWidth = d.width;
                ctx.lineCap = 'round';
                ctx.moveTo(tailX, tailY);
                ctx.lineTo(d.x, d.y);
                ctx.stroke();
            }

            ctx.restore();
        };

        // Lightning Flash Control
        let lightningIntensity = 0;
        let nextThunderTime = 0;

        const triggerLightning = () => {
            lightningIntensity = 0.65;
            container.classList.add('lightning-flash');
            playThunderSound();

            setTimeout(() => {
                lightningIntensity = 0.15;
            }, 50);
            setTimeout(() => {
                lightningIntensity = 0.45;
            }, 90);
            setTimeout(() => {
                container.classList.remove('lightning-flash');
            }, 220);
        };

        const checkPeriodicThunder = (now) => {
            if (!isLockdownActive || mazeCompleted) return;
            if (now > nextThunderTime) {
                triggerLightning();
                nextThunderTime = now + 8000 + Math.random() * 8000;
            }
        };

        // Speed Tracking & Storm Activation State
        let isStormActive = false;
        let drawStartTime = 0;
        let slowAccumulatorMs = 0;
        let stormToastShown = false;

        let lastMoveTime = 0;
        let lastMoveX = 0;
        let lastMoveY = 0;
        let currentSpeed = 0;
        let hasLeftStartPad = false;
        let totalDistanceDrawn = 0;

        const WASHOUT_ROASTS = [
            "⛈️ Washed away! Hesitation is defeat in this storm.",
            "🌧️ Too slow! The downpour washed your line away. Move with conviction!",
            "⚡ ZAPPED BY LIGHTNING! Stalling in the rain won't save you.",
            "🌧️ Dissolved! Snail pace won't survive the tempest!",
            "⛈️ Frozen like a deer in headlights! Start over from START."
        ];

        const triggerStormActivation = () => {
            if (isStormActive) return;
            isStormActive = true;
            initRain();
            startRainSound();
            triggerLightning();

            if (!stormToastShown) {
                stormToastShown = true;
                showToast("⛈️ Storm incoming! Move faster before the rain washes your line away!", '#38bdf8', 3200);
            }
        };

        const deactivateStorm = () => {
            isStormActive = false;
            farRain = [];
            midRain = [];
            nearRain = [];
            rainRipples = [];
            rainSplashes = [];
            rainMist = [];
            lightningIntensity = 0;
            container.classList.remove('lightning-flash');
            stopRainSound();
        };

        const triggerRainWashout = () => {
            isDrawing = false;
            currentGateIndex = 0;
            pathPoints = [];
            hasLeftStartPad = false;
            totalDistanceDrawn = 0;

            triggerLightning();
            deactivateStorm();

            const roast = WASHOUT_ROASTS[Math.floor(Math.random() * WASHOUT_ROASTS.length)];
            showToast(roast, '#38bdf8', 3600);

            mazeStartPad.classList.remove('active');
            startLabel.textContent = 'START HERE';

            targetGuideOpacity = 1.0;
        };

        // Master Animation Frame: Canvas Rendering & Storm System
        let canvasLoopAnimId = null;

        const renderStormFrame = (now) => {
            resizeCanvas();
            ctx.clearRect(0, 0, mazeCanvas.width, mazeCanvas.height);

            // 1. Smooth guide opacity transition
            if (Math.abs(guideOpacity - targetGuideOpacity) > 0.01) {
                guideOpacity += (targetGuideOpacity - guideOpacity) * 0.08;
            } else {
                guideOpacity = targetGuideOpacity;
            }
            drawSlalomGuide();

            // 2. Background Rain & Storm Mist (drawn behind laser trail)
            if (isStormActive) {
                drawRainBackground();
            }

            // 3. Slowness Detection & Line Erosion
            if (isDrawing && pathPoints.length > 0) {
                const idleMs = now - lastMoveTime;
                const drawElapsed = now - drawStartTime;

                if (idleMs > 100) {
                    currentSpeed = Math.max(0, currentSpeed * 0.88);
                }

                // Check if player is moving slow
                const isCurrentlySlow = (currentSpeed < 45) || (idleMs > 300);

                if (hasLeftStartPad) {
                    // If they have been drawing for over 2.2 seconds and are moving slow or stalling:
                    if (drawElapsed > 2200 && isCurrentlySlow) {
                        slowAccumulatorMs += 16;
                    } else if (!isCurrentlySlow) {
                        slowAccumulatorMs = Math.max(0, slowAccumulatorMs - 8);
                    }

                    // Trigger storm if slow for ~650ms after grace period, or if completely frozen for > 1.2s
                    if (!isStormActive && (slowAccumulatorMs > 650 || idleMs > 1200)) {
                        triggerStormActivation();
                    }
                }

                // If the storm has arrived, the rain erodes their line!
                if (isStormActive) {
                    let erosionFactor = 0.0005; // gentle baseline decay while moving in rain
                    if (currentSpeed < 35 || idleMs > 300) {
                        // Slower, readable erosion rate giving ~4 to 5 seconds to react
                        const severity = Math.min(2.6, 1.2 + (idleMs / 600));
                        erosionFactor = 0.0018 * severity;
                    }

                    // Erode points from the tail forward
                    for (let i = 0; i < pathPoints.length; i++) {
                        const tailWeight = 1.0 + (1.0 - i / pathPoints.length) * 0.8;
                        pathPoints[i].health -= erosionFactor * tailWeight;
                    }

                    // Shift dead points from tail
                    while (pathPoints.length > 0 && pathPoints[0].health <= 0) {
                        pathPoints.shift();
                    }

                    // If the lines got completely faded away, start over!
                    if (hasLeftStartPad && pathPoints.length < 2) {
                        triggerRainWashout();
                    }
                }
            }

            // 4. Render User's Active Laser Trail with Rain Fading
            if (pathPoints.length >= 2) {
                ctx.save();
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';

                for (let i = 0; i < pathPoints.length - 1; i++) {
                    const p1 = pathPoints[i];
                    const p2 = pathPoints[i + 1];
                    const avgHealth = Math.max(0.06, Math.min(1.0, (p1.health + p2.health) / 2));

                    ctx.beginPath();
                    ctx.strokeStyle = `rgba(255, 107, 0, ${avgHealth})`;
                    ctx.lineWidth = Math.max(2, 6 * avgHealth);
                    ctx.shadowColor = '#ff6b00';
                    ctx.shadowBlur = 12 * avgHealth;

                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.stroke();
                }

                // Tip glowing electric spark at cursor
                const tip = pathPoints[pathPoints.length - 1];
                const tipHealth = Math.max(0.2, tip.health);
                ctx.beginPath();
                ctx.fillStyle = '#ffffff';
                ctx.shadowColor = isStormActive ? '#38bdf8' : '#ff6b00';
                ctx.shadowBlur = 16 * tipHealth;
                ctx.arc(tip.x, tip.y, Math.max(3, 5 * tipHealth), 0, Math.PI * 2);
                ctx.fill();

                ctx.restore();
            }

            // 5. Foreground Rain, Surface Ripples, Micro-Splashes & Wet Sheen (drawn in front of laser trail)
            if (isStormActive) {
                drawRainForeground();
                checkPeriodicThunder(now);
            }

            // 6. Lightning Overlay
            if (lightningIntensity > 0) {
                ctx.save();
                ctx.fillStyle = `rgba(224, 242, 254, ${lightningIntensity})`;
                ctx.fillRect(0, 0, mazeCanvas.width, mazeCanvas.height);
                ctx.restore();
                lightningIntensity = Math.max(0, lightningIntensity - 0.04);
            }
        };

        const redrawCanvas = () => {
            renderStormFrame(performance.now());
        };

        const startCanvasLoop = () => {
            if (canvasLoopAnimId) return;
            const loop = (now) => {
                renderStormFrame(now);
                if (isLockdownActive && !mazeCompleted) {
                    canvasLoopAnimId = requestAnimationFrame(loop);
                } else {
                    canvasLoopAnimId = null;
                }
            };
            canvasLoopAnimId = requestAnimationFrame(loop);
        };

        const stopCanvasLoop = () => {
            if (canvasLoopAnimId) {
                cancelAnimationFrame(canvasLoopAnimId);
                canvasLoopAnimId = null;
            }
            resizeCanvas();
            ctx.clearRect(0, 0, mazeCanvas.width, mazeCanvas.height);
        };

        // ==========================================
        // Collision Detection & Maze Mechanics
        // ==========================================
        const triggerCollision = (cardElem) => {
            isDrawing = false;
            currentGateIndex = 0;
            pathPoints = [];
            hasLeftStartPad = false;
            totalDistanceDrawn = 0;
            deactivateStorm();

            playBuzzerSound();

            if (cardElem && cardElem.classList) {
                cardElem.classList.add('card-buzz');
                setTimeout(() => cardElem.classList.remove('card-buzz'), 360);
            }

            const roast = BUZZ_ROASTS[Math.floor(Math.random() * BUZZ_ROASTS.length)];
            showToast(roast);

            mazeStartPad.classList.remove('active');
            startLabel.textContent = 'START HERE';

            // Fade guide line back in so the player can study the path again
            targetGuideOpacity = 1.0;
        };

        // Check collision along the segment from p1 to p2
        const checkSegmentCollision = (p1, p2) => {
            const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            const steps = Math.max(1, Math.ceil(dist / 4));
            const cRect = container.getBoundingClientRect();
            const titleRect = (titleElem && titleElem.offsetParent !== null) ? titleElem.getBoundingClientRect() : null;

            for (let s = 1; s <= steps; s++) {
                const t = s / steps;
                const testRelX = p1.x + (p2.x - p1.x) * t;
                const testRelY = p1.y + (p2.y - p1.y) * t;
                const testClientX = cRect.left + testRelX;
                const testClientY = cRect.top + testRelY;

                // 1. Container boundaries (only after leaving start pad)
                if (hasLeftStartPad) {
                    if (testRelX < 2 || testRelX > cWidthBounds() - 2 || testRelY < 2 || testRelY > cHeightBounds() - 2) {
                        triggerCollision(container);
                        return true;
                    }
                }

                // 2. Title header collision (if title exists and is visible inside container)
                if (titleRect && testClientX >= titleRect.left && testClientX <= titleRect.right &&
                    testClientY >= titleRect.top && testClientY <= titleRect.bottom) {
                    triggerCollision(titleElem);
                    return true;
                }

                // 3. Setting card collisions
                for (const card of settingCards) {
                    if (!card) continue;
                    const r = card.getBoundingClientRect();
                    if (testClientX >= r.left && testClientX <= r.right &&
                        testClientY >= r.top && testClientY <= r.bottom) {
                        triggerCollision(card);
                        return true;
                    }
                }
            }
            return false;
        };

        const cWidthBounds = () => container.clientWidth;
        const cHeightBounds = () => container.clientHeight;

        // Start drawing from Start Pad
        const startSlalomDrawing = (e) => {
            if (!isLockdownActive || mazeCompleted) return;

            const cRect = container.getBoundingClientRect();
            const startX = e.clientX - cRect.left;
            const startY = e.clientY - cRect.top;

            isDrawing = true;
            currentGateIndex = 0;
            const now = performance.now();
            pathPoints = [{ x: startX, y: startY, health: 1.0, birth: now }];
            hasLeftStartPad = false;
            totalDistanceDrawn = 0;
            lastMoveTime = now;
            lastMoveX = startX;
            lastMoveY = startY;
            currentSpeed = 120;

            // Reset storm state: starts calm!
            drawStartTime = now;
            slowAccumulatorMs = 0;
            isStormActive = false;
            stormToastShown = false;
            deactivateStorm();

            mazeStartPad.classList.add('active');
            startLabel.textContent = '🟠 NAVIGATING (Gate 0/8)';

            // Fade away the dotted guiding line now that drawing has started!
            fadeGuide(0.0);
        };

        mazeStartPad.addEventListener('mousedown', startSlalomDrawing);
        mazeStartPad.addEventListener('mouseenter', (e) => {
            // Allow starting on hover or mousedown
            if (isLockdownActive && !mazeCompleted && !isDrawing) {
                startSlalomDrawing(e);
            }
        });

        // Handle mouse movement across container
        container.addEventListener('mousemove', (e) => {
            if (!isLockdownActive || mazeCompleted) return;

            // Save button dodging check
            handleSaveButtonProximity(e);

            if (!isDrawing) return;

            const cRect = container.getBoundingClientRect();
            const currX = e.clientX - cRect.left;
            const currY = e.clientY - cRect.top;

            const now = performance.now();
            const dt = (now - lastMoveTime) / 1000;
            if (dt > 0.008) {
                const stepDist = Math.hypot(currX - lastMoveX, currY - lastMoveY);
                currentSpeed = stepDist / dt;
                lastMoveTime = now;
                lastMoveX = currX;
                lastMoveY = currY;
                totalDistanceDrawn += stepDist;
                if (totalDistanceDrawn > 35) {
                    hasLeftStartPad = true;
                }
            }

            if (pathPoints.length === 0) {
                pathPoints.push({ x: currX, y: currY, health: 1.0, birth: now });
                return;
            }

            const lastPoint = pathPoints[pathPoints.length - 1];

            // Check collision between last point and current point
            if (checkSegmentCollision(lastPoint, { x: currX, y: currY })) {
                return;
            }

            pathPoints.push({ x: currX, y: currY, health: 1.0, birth: now });

            // Check Gates Progression
            const gates = getGates();
            if (currentGateIndex < gates.length) {
                const g = gates[currentGateIndex];
                if (currX >= g.xMin && currX <= g.xMax && currY >= g.yMin && currY <= g.yMax) {
                    currentGateIndex++;
                    playGatePing();
                    startLabel.textContent = `🟠 GATE ${currentGateIndex}/${gates.length}`;

                    // Finished all gates!
                    if (currentGateIndex >= gates.length) {
                        completeSlalom();
                    }
                }
            }
        });

        // Leaving container cancels/fails drawing
        container.addEventListener('mouseleave', () => {
            if (isDrawing && hasLeftStartPad) {
                triggerCollision(null);
                showToast("Outside the arena? Back to START.");
            }
        });

        // Window blur cancels drawing
        window.addEventListener('blur', () => {
            if (isDrawing) triggerCollision(null);
        });

        // Triumph: Maze successfully completed!
        const completeSlalom = () => {
            isDrawing = false;
            mazeCompleted = true;
            deactivateStorm();
            stopCanvasLoop();

            playSuccessFanfare();

            mazeStartPad.classList.remove('active');
            startLabel.textContent = '✅ SLALOM COMPLETED!';

            saveButtonWrapper.style.transform = 'none';
            saveButton.classList.remove('locked-dodge');
            saveButton.classList.add('slalom-unlocked');
            saveButton.textContent = 'Save Settings';
            saveButton.style.transform = 'none';

            dodgeRoastBubble.style.color = '#4caf50';
            dodgeRoastBubble.style.borderColor = '#4caf50';
            dodgeRoastBubble.textContent = 'Save now before you lose self-control.';

            showToast('✅ Incredible steady hands! Click Save to confirm.', '#4caf50');
        };

        // ==========================================
        // Save Button Dodging & Anti-Cheat
        // ==========================================
        let dodgeCount = 0;
        const handleSaveButtonProximity = (e) => {
            if (!isLockdownActive || mazeCompleted) return;

            const btnRect = saveButton.getBoundingClientRect();
            const btnCenterX = btnRect.left + btnRect.width / 2;
            const btnCenterY = btnRect.top + btnRect.height / 2;
            const dist = Math.hypot(e.clientX - btnCenterX, e.clientY - btnCenterY);

            if (dist < 80) {
                dodgeSaveButton(e, btnCenterX);
            }
        };

        const dodgeSaveButton = (e, btnCenterX) => {
            dodgeCount++;

            // Corner pivot rotation away from cursor
            const isCursorLeft = e.clientX < btnCenterX;
            const angle = isCursorLeft ? 16 : -16;
            const pivot = isCursorLeft ? 'bottom right' : 'bottom left';
            const verticalJump = -45;

            saveButtonWrapper.style.transformOrigin = pivot;
            saveButtonWrapper.style.transform = `translateY(${verticalJump}px) rotate(${angle}deg)`;

            // Update roast bubble
            const roast = DODGE_ROASTS[dodgeCount % DODGE_ROASTS.length];
            dodgeRoastBubble.textContent = roast;
            dodgeRoastBubble.style.display = 'block';

            setTimeout(() => {
                if (isLockdownActive && !mazeCompleted) {
                    saveButtonWrapper.style.transform = 'translateY(0) rotate(0deg)';
                }
            }, 380);
        };

        // Click block when locked
        saveButton.addEventListener('click', (e) => {
            if (isLockdownActive && !mazeCompleted) {
                e.preventDefault();
                e.stopPropagation();
                playBuzzerSound();
                const btnRect = saveButton.getBoundingClientRect();
                dodgeSaveButton(e, btnRect.left + btnRect.width / 2);
                showToast(LIMIT_INCREASE_WARNING, '#ff5252', 3600);
            }
        });

        // Keyboard trap: Tab + Enter/Space blocked
        saveButton.addEventListener('keydown', (e) => {
            if (isLockdownActive && !mazeCompleted && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                saveButton.blur();
                playBuzzerSound();
                showToast("⌨️ Caught in 4K! Tab won't save you. Draw the line with your mouse! 🖱️");
            }
        });

        // ==========================================
        // Real-time Limit Increase Detection
        // ==========================================
        const checkLimitIncrease = () => {
            const currentBlock = parseInt(blockLimitInput.value, 10);
            const currentScold = parseInt(scoldLimitInput.value, 10);

            const isBlockIncreased = !isNaN(currentBlock) && currentBlock > savedBlockLimit;
            const isScoldIncreased = !isNaN(currentScold) && currentScold > savedScoldLimit;

            if (isBlockIncreased || isScoldIncreased) {
                enableLockdownMode();
            } else {
                disableLockdownMode();
            }
        };

        let tightenAnimId = null;
        const animateTightenCanvas = (duration = 420) => {
            if (tightenAnimId) cancelAnimationFrame(tightenAnimId);
            const start = performance.now();
            const step = (now) => {
                redrawCanvas();
                if (now - start < duration) {
                    tightenAnimId = requestAnimationFrame(step);
                } else {
                    tightenAnimId = null;
                    redrawCanvas();
                }
            };
            tightenAnimId = requestAnimationFrame(step);
        };

        const enableLockdownMode = () => {
            if (isLockdownActive && !mazeCompleted) return;

            isLockdownActive = true;
            mazeCompleted = false;
            isDrawing = false;
            currentGateIndex = 0;
            pathPoints = [];
            hasLeftStartPad = false;
            totalDistanceDrawn = 0;

            container.classList.add('lockdown-active');
            mazeInstructionBar.style.display = 'flex';
            mazeCanvas.style.display = 'block';
            dodgeRoastBubble.style.display = 'block';
            dodgeRoastBubble.style.color = '#ff5252';
            dodgeRoastBubble.style.borderColor = '#ff5252';
            dodgeRoastBubble.textContent = "🖕 Negotiating with yourself already?";

            saveButtonWrapper.style.transform = 'none';
            saveButton.classList.add('locked-dodge');
            saveButton.classList.remove('slalom-unlocked');
            saveButton.textContent = 'Save Settings';

            startLabel.textContent = 'START HERE';
            mazeStartPad.classList.remove('active');

            showToast(LIMIT_INCREASE_WARNING, '#ff5252', 4000);

            guideOpacity = 1.0;
            targetGuideOpacity = 1.0;

            deactivateStorm(); // Starts calm! No rain on initial limit increase
            startCanvasLoop();
            animateTightenCanvas(420);
        };

        const disableLockdownMode = () => {
            isLockdownActive = false;
            mazeCompleted = false;
            isDrawing = false;
            currentGateIndex = 0;
            pathPoints = [];
            hasLeftStartPad = false;
            totalDistanceDrawn = 0;

            deactivateStorm();
            stopCanvasLoop();

            guideOpacity = 1.0;
            targetGuideOpacity = 1.0;

            container.classList.remove('lockdown-active');
            mazeInstructionBar.style.display = 'none';
            mazeCanvas.style.display = 'none';
            dodgeRoastBubble.style.display = 'none';

            saveButtonWrapper.style.transform = '';
            saveButton.classList.remove('locked-dodge');
            saveButton.classList.remove('slalom-unlocked');
            saveButton.style.transform = '';
            saveButton.textContent = 'Save Settings';

            animateTightenCanvas(420);
        };

        // ==========================================
        // Scolding Sounds Manager (Drag & Drop)
        // ==========================================
        const renderSoundList = () => {
            soundCount.textContent = currentSounds.length;
            soundList.innerHTML = '';

            if (currentSounds.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'empty-sounds';
                empty.textContent = 'No sounds added. Drag & drop audio files above!';
                soundList.appendChild(empty);
                return;
            }

            currentSounds.forEach((sound, index) => {
                const item = document.createElement('div');
                item.className = 'sound-item';

                const info = document.createElement('div');
                info.className = 'sound-item-info';

                const icon = document.createElement('span');
                icon.className = 'sound-icon';
                icon.textContent = '🔊';

                const name = document.createElement('span');
                name.className = 'sound-name';
                name.textContent = sound.name;
                name.title = sound.name;

                const tag = document.createElement('span');
                tag.className = `sound-tag ${sound.isDefault ? 'default-tag' : 'custom-tag'}`;
                tag.textContent = sound.isDefault ? 'Default' : 'Custom';

                info.appendChild(icon);
                info.appendChild(name);
                info.appendChild(tag);

                const actions = document.createElement('div');
                actions.className = 'sound-item-actions';

                const playBtn = document.createElement('button');
                playBtn.type = 'button';
                playBtn.className = 'sound-play-btn';
                const isPlaying = (currentlyPlayingId === sound.id);
                playBtn.textContent = isPlaying ? '⏹ Stop' : '▶ Play';
                if (isPlaying) playBtn.classList.add('playing');

                playBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    togglePreviewSound(sound, playBtn);
                });

                const deleteBtn = document.createElement('button');
                deleteBtn.type = 'button';
                deleteBtn.className = 'sound-delete-btn';
                deleteBtn.textContent = '🗑️';
                deleteBtn.title = 'Remove sound';
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (currentlyPlayingId === sound.id && previewAudio) {
                        previewAudio.pause();
                        currentlyPlayingId = null;
                    }
                    currentSounds.splice(index, 1);
                    renderSoundList();
                    showToast(`Removed ${sound.name}`, '#a0a0ab');
                });

                actions.appendChild(playBtn);
                actions.appendChild(deleteBtn);

                item.appendChild(info);
                item.appendChild(actions);
                soundList.appendChild(item);
            });
        };

        const togglePreviewSound = (sound, btnElem) => {
            if (currentlyPlayingId === sound.id && previewAudio) {
                previewAudio.pause();
                previewAudio = null;
                currentlyPlayingId = null;
                renderSoundList();
                return;
            }

            if (previewAudio) {
                previewAudio.pause();
                previewAudio = null;
                currentlyPlayingId = null;
            }

            const src = sound.dataUrl || sound.url;
            previewAudio = new Audio(src);
            previewAudio.volume = 1.0;
            currentlyPlayingId = sound.id;
            renderSoundList();

            previewAudio.onended = () => {
                previewAudio = null;
                currentlyPlayingId = null;
                renderSoundList();
            };

            previewAudio.onerror = () => {
                previewAudio = null;
                currentlyPlayingId = null;
                renderSoundList();
                showToast('Error playing audio file', '#ff5252');
            };

            previewAudio.play().catch(e => {
                console.warn('Preview play blocked:', e);
                currentlyPlayingId = null;
                renderSoundList();
            });
        };

        const handleAudioFiles = (files) => {
            if (!files || files.length === 0) return;

            Array.from(files).forEach(file => {
                if (file.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac)$/i.test(file.name)) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        currentSounds.push({
                            id: 'custom_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                            name: file.name,
                            dataUrl: e.target.result,
                            isDefault: false,
                            enabled: true
                        });
                        renderSoundList();
                        showToast(`Added sound: ${file.name}`, '#4caf50');
                    };
                    reader.readAsDataURL(file);
                } else {
                    showToast(`Skipped ${file.name}: not an audio file`, '#ff5252');
                }
            });
        };

        soundDropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            soundDropzone.classList.add('drag-over');
        });

        soundDropzone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            soundDropzone.classList.remove('drag-over');
        });

        soundDropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            soundDropzone.classList.remove('drag-over');
            handleAudioFiles(e.dataTransfer.files);
        });

        browseSoundsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            soundFileInput.click();
        });

        soundDropzone.addEventListener('click', (e) => {
            if (!e.target.closest('.sound-item') && !e.target.closest('button')) {
                soundFileInput.click();
            }
        });

        soundFileInput.addEventListener('change', () => {
            handleAudioFiles(soundFileInput.files);
            soundFileInput.value = '';
        });

        restoreDefaultSoundsBtn.addEventListener('click', () => {
            currentSounds = JSON.parse(JSON.stringify(DEFAULT_SOUNDS));
            renderSoundList();
            showToast('Restored default scold sounds (Screams & Obsession)', '#4caf50');
        });

        blockLimitInput.addEventListener('input', checkLimitIncrease);
        scoldLimitInput.addEventListener('input', checkLimitIncrease);
        window.addEventListener('resize', () => {
            if (isLockdownActive) {
                resizeCanvas();
                initRain();
                redrawCanvas();
            }
        });

        // ==========================================
        // Stepper (+ / -) Control with Long-Press
        // ==========================================
        const initSteppers = () => {
            document.querySelectorAll('.stepper-wrap').forEach(wrap => {
                const input = wrap.querySelector('input[type="number"]');
                const minusBtn = wrap.querySelector('.stepper-btn-minus');
                const plusBtn = wrap.querySelector('.stepper-btn-plus');
                if (!input || !minusBtn || !plusBtn) return;

                const updateButtonStates = () => {
                    const val = parseInt(input.value, 10);
                    const min = parseInt(input.min, 10) || 1;
                    const max = parseInt(input.max, 10) || 100;
                    minusBtn.disabled = (!isNaN(val) && val <= min);
                    plusBtn.disabled = (!isNaN(val) && val >= max);
                };

                const changeVal = (delta) => {
                    let val = parseInt(input.value, 10);
                    const min = parseInt(input.min, 10) || 1;
                    const max = parseInt(input.max, 10) || 100;
                    if (isNaN(val)) val = min;
                    const newVal = Math.min(max, Math.max(min, val + delta));
                    if (newVal !== val) {
                        input.value = newVal;
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                    updateButtonStates();
                };

                let holdTimer = null;
                let repeatInterval = null;

                const stopHold = () => {
                    if (holdTimer) clearTimeout(holdTimer);
                    if (repeatInterval) clearInterval(repeatInterval);
                    holdTimer = null;
                    repeatInterval = null;
                };

                const setupBtn = (btn, delta) => {
                    btn.addEventListener('mousedown', (e) => {
                        if (e.button !== 0) return;
                        e.preventDefault();
                        input.focus();
                        changeVal(delta);
                        stopHold();
                        holdTimer = setTimeout(() => {
                            repeatInterval = setInterval(() => {
                                let val = parseInt(input.value, 10);
                                const min = parseInt(input.min, 10) || 1;
                                const max = parseInt(input.max, 10) || 100;
                                if ((delta > 0 && val >= max) || (delta < 0 && val <= min)) {
                                    stopHold();
                                    return;
                                }
                                changeVal(delta);
                            }, 75);
                        }, 300);
                    });

                    btn.addEventListener('mouseup', stopHold);
                    btn.addEventListener('mouseleave', stopHold);

                    btn.addEventListener('touchstart', (e) => {
                        e.preventDefault();
                        input.focus();
                        changeVal(delta);
                        stopHold();
                        holdTimer = setTimeout(() => {
                            repeatInterval = setInterval(() => {
                                let val = parseInt(input.value, 10);
                                const min = parseInt(input.min, 10) || 1;
                                const max = parseInt(input.max, 10) || 100;
                                if ((delta > 0 && val >= max) || (delta < 0 && val <= min)) {
                                    stopHold();
                                    return;
                                }
                                changeVal(delta);
                            }, 75);
                        }, 300);
                    }, { passive: false });

                    btn.addEventListener('touchend', stopHold);
                    btn.addEventListener('touchcancel', stopHold);

                    btn.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            changeVal(delta);
                        }
                    });

                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                    });
                };

                setupBtn(minusBtn, -1);
                setupBtn(plusBtn, 1);

                input.addEventListener('input', updateButtonStates);
                input.addEventListener('change', updateButtonStates);
                updateButtonStates();
            });
        };

        // ==========================================
        // Settings Persistence (Chrome Storage)
        // ==========================================
        function loadSettings() {
            chrome.storage.local.get(['shortsBlockLimit', 'shortsLimit', 'scoldingEnabled', 'scoldSounds'], (result) => {
                savedBlockLimit = result.shortsBlockLimit || 10;
                savedScoldLimit = result.shortsLimit || 2;

                blockLimitInput.value = savedBlockLimit;
                scoldLimitInput.value = savedScoldLimit;
                scoldingEnabledCheckbox.checked = result.scoldingEnabled || false;

                blockLimitInput.dispatchEvent(new Event('input', { bubbles: true }));
                scoldLimitInput.dispatchEvent(new Event('input', { bubbles: true }));

                if (result.scoldSounds && Array.isArray(result.scoldSounds) && result.scoldSounds.length > 0) {
                    currentSounds = result.scoldSounds;
                } else {
                    currentSounds = JSON.parse(JSON.stringify(DEFAULT_SOUNDS));
                }
                renderSoundList();

                disableLockdownMode();
            });
        }

        const triggerSavedFeedback = (customToastMsg = null) => {
            saveButton.classList.add('saved-success');
            saveButton.textContent = '✓ Settings Saved!';

            if (customToastMsg) {
                showToast(customToastMsg, '#4caf50', 2500);
            }

            setTimeout(() => {
                saveButton.classList.remove('saved-success');
                if (!isLockdownActive || mazeCompleted) {
                    saveButton.textContent = 'Save Settings';
                }
            }, 1800);
        };

        function saveSettings() {
            const blockLimit = parseInt(blockLimitInput.value, 10);
            const scoldLimit = parseInt(scoldLimitInput.value, 10);
            const scoldingEnabled = scoldingEnabledCheckbox.checked;

            if (isNaN(blockLimit) || isNaN(scoldLimit) || blockLimit < 1 || scoldLimit < 1) {
                showToast(`${WARNING_ICON_SVG}<span>Limits must be valid numbers of at least 1.</span>`, '#ff5252', 3200);
                return;
            }

            if (blockLimit > 100 || scoldLimit > 100) {
                showToast('Bro, over 100 shorts? You need a therapist, not a browser extension. 🤡', '#ff5252', 3500);
                return;
            }

            if (scoldLimit >= blockLimit) {
                showToast(`${WARNING_ICON_SVG}<span>Scold limit must be less than the Block limit!</span>`, '#ff5252', 3200);
                return;
            }

            // Lockdown enforcement: If limit increased, must have completed the slalom
            const isLimitIncreased = blockLimit > savedBlockLimit || scoldLimit > savedScoldLimit;
            if (isLimitIncreased && !mazeCompleted) {
                playBuzzerSound();
                showToast(LIMIT_INCREASE_WARNING, '#ff5252', 3600);
                return;
            }

            chrome.storage.local.get(['shortsCount', 'shortsBlockLimit'], (result) => {
                const currentCount = result.shortsCount || 0;
                const currentLimit = result.shortsBlockLimit || 10;

                // Prevent loophole: increasing limit while blocked
                if (currentCount >= currentLimit && blockLimit > currentLimit) {
                    showToast('🛑 Nice try! You are currently blocked. Pass mindfulness test in popup first.', '#ff5252', 3500);
                    return;
                }

                const wasIncreased = isLimitIncreased;
                const wasDecreased = blockLimit < savedBlockLimit;

                chrome.storage.local.set({
                    shortsBlockLimit: blockLimit,
                    shortsLimit: scoldLimit,
                    scoldingEnabled: scoldingEnabled,
                    scoldSounds: currentSounds
                }, () => {
                    savedBlockLimit = blockLimit;
                    savedScoldLimit = scoldLimit;

                    disableLockdownMode();

                    let toastFlavor = null;
                    if (wasDecreased) {
                        toastFlavor = '🫡 Respect. Lowering your limit!';
                    } else if (wasIncreased) {
                        toastFlavor = 'Saved... remember the shame you endured.';
                    }
                    triggerSavedFeedback(toastFlavor);
                });
            });
        }

        window.addEventListener('exit-settings', () => {
            deactivateStorm();
        });

        initSteppers();
        loadSettings();
        saveButton.addEventListener('click', saveSettings);
    });
})();
