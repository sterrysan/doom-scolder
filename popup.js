// popup.js

(function () {
    document.addEventListener('DOMContentLoaded', () => {
        const counterElement = document.getElementById('shorts-counter');
        const limitElement = document.getElementById('dashboard-block-limit');
        const progressRing = document.getElementById('progress-ring');
        const brandIcon = document.getElementById('dashboard-brand-icon');
        const sparkCanvas = document.getElementById('dashboard-spark-canvas');
        const dashboardCard = document.getElementById('dashboard-card');
        const actionButtons = document.getElementById('action-buttons');
        const gooBlobsEl = [
            document.getElementById('goo-blob-0'),
            document.getElementById('goo-blob-1'),
            document.getElementById('goo-blob-2'),
            document.getElementById('goo-blob-3')
        ];
        const resetButton = document.getElementById('reset-button');
        const resetButtonIcon = document.getElementById('reset-button-icon');
        const resetButtonLabel = document.getElementById('reset-button-label');
        const decoyButtons = [
            null,
            document.getElementById('reset-decoy-1'),
            document.getElementById('reset-decoy-2'),
            document.getElementById('reset-decoy-3')
        ];
        const settingsButton = document.getElementById('settings-button');

        const sparkController = (window.DoomSparks && sparkCanvas)
            ? window.DoomSparks.createSparkController(sparkCanvas, {
                getAnchors: (cRect) => {
                    const anchors = [];
                    if (progressRing) {
                        const r = progressRing.getBoundingClientRect();
                        if (r.width > 0) {
                            anchors.push({
                                x: (r.left + r.right) / 2 - cRect.left,
                                y: (r.top + r.bottom) / 2 - cRect.top,
                                r: r.width / 2
                            });
                        }
                    }
                    if (brandIcon) {
                        const br = brandIcon.getBoundingClientRect();
                        if (br.width > 0) {
                            anchors.push({
                                x: (br.left + br.right) / 2 - cRect.left,
                                y: (br.top + br.bottom) / 2 - cRect.top,
                                r: br.width / 2
                            });
                        }
                    }
                    return anchors;
                }
            })
            : null;

        // Modal elements
        const resetModal = document.getElementById('reset-modal');
        const timerText = document.getElementById('timer-text');
        const resetTimerDisplay = document.getElementById('reset-timer');
        const typingSection = document.getElementById('typing-section');
        const phraseDisplay = document.getElementById('phrase-display');
        const mindfulnessInput = document.getElementById('mindfulness-input');
        const celebrationSection = document.getElementById('celebration-section');
        const modalActions = document.getElementById('modal-actions');
        const confirmResetButton = document.getElementById('confirm-reset-button');
        const cancelResetButton = document.getElementById('cancel-reset-button');
        const scoldToast = document.getElementById('scold-toast');

        const BASE_PHRASE = "I admit I am wasting my time doomscrolling and I should be doing something productive.";
        const LEET_MAP = {
            'a': '@',
            'e': '3',
            'i': '1',
            'o': '0',
            's': '$'
        };

        const TYPO_MOCKS = [
            "🤡 ONE TYPO! Back to the 10-second penalty box, butterfingers!",
            "💀 Can't even spell under dopamine withdrawal? Timer restarted!",
            "Strike ONE and you're OUT! Reflect on your habits for 10s.",
            "🤦‍♂️ A typo already? Stop trembling and wait 10 seconds again!",
            "📉 Brain rot detected! One wrong key and you start completely over!"
        ];

        const KEYBOARD_ROASTS = [
            "Tab won't save you. Use your damn mouse!",
            "Trying to Tab + Enter? 🖕",
            "Nice try, keyboard warrior. You can't shortcut this.",
            "Did you really think Tab + Enter would work?"
        ];

        let currentPhrase = BASE_PHRASE;
        let timerInterval = null;
        let toastTimeout = null;
        let typoTimeout = null;
        let isHandlingTypo = false;

        const formatClock = (totalSec) => {
            const s = Math.max(0, Math.floor(totalSec || 0));
            const hrs = Math.floor(s / 3600);
            const mins = Math.floor((s % 3600) / 60);
            const secs = s % 60;
            if (hrs > 0) {
                return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
            }
            return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        };

        const formatHumanDuration = (totalSec) => {
            const s = Math.max(0, Math.floor(totalSec || 0));
            const hrs = Math.floor(s / 3600);
            const mins = Math.floor((s % 3600) / 60);
            const secs = s % 60;
            if (hrs > 0) return `${hrs}h ${mins}m`;
            return `${mins}m ${String(secs).padStart(2, '0')}s`;
        };

        const setupNewPhrase = () => {
            const candidates = [];
            for (let i = 0; i < BASE_PHRASE.length; i++) {
                const char = BASE_PHRASE[i].toLowerCase();
                if (LEET_MAP[char]) {
                    candidates.push({ index: i, replacement: LEET_MAP[char] });
                }
            }
            if (candidates.length > 0) {
                const choice = candidates[Math.floor(Math.random() * candidates.length)];
                currentPhrase = BASE_PHRASE.slice(0, choice.index) + choice.replacement + BASE_PHRASE.slice(choice.index + 1);
            } else {
                currentPhrase = BASE_PHRASE;
            }
            if (phraseDisplay) {
                phraseDisplay.textContent = currentPhrase;
            }
        };

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
                osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.18);
                gain.gain.setValueAtTime(0.12, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.18);
            } catch (e) { }
        };

        const playSuccessFanfare = () => {
            try {
                const ctx = getAudioContext();
                const notes = [523.25, 659.25, 783.99, 1046.50];
                notes.forEach((freq, idx) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    const startTime = ctx.currentTime + (idx * 0.1);
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, startTime);
                    gain.gain.setValueAtTime(0.15, startTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.28);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(startTime);
                    osc.stop(startTime + 0.28);
                });
            } catch (e) { }
        };

        const showScold = (msg) => {
            if (!scoldToast) return;
            scoldToast.textContent = msg;
            scoldToast.style.display = 'block';
            clearTimeout(toastTimeout);
            toastTimeout = setTimeout(() => {
                scoldToast.style.display = 'none';
            }, 3000);
        };

        const shakeInput = () => {
            mindfulnessInput.classList.remove('shake');
            void mindfulnessInput.offsetWidth;
            mindfulnessInput.classList.add('shake');
        };

        const startCountdown = () => {
            clearInterval(timerInterval);
            typingSection.style.display = 'none';
            timerText.style.display = 'block';
            mindfulnessInput.value = '';
            confirmResetButton.disabled = true;

            let timeLeft = 10;
            resetTimerDisplay.textContent = timeLeft;

            timerInterval = setInterval(() => {
                timeLeft--;
                resetTimerDisplay.textContent = timeLeft;
                if (timeLeft <= 0) {
                    clearInterval(timerInterval);
                    timerText.style.display = 'none';
                    typingSection.style.display = 'block';
                    mindfulnessInput.focus();
                }
            }, 1000);
        };

        let splitStage = 1; // 1 = whole, 2 = 2 pieces, 4 = 4 pieces
        let flashSlotY = 0;
        let split2Progress = 0;
        let split4Progress = 0;
        let chaseAccumMs = 0;
        let isStunned = false;
        let stunTimer = null;
        let fluidRafId = null;
        let lastFluidFrame = 0;
        let pointerInsideCard = false;
        let pointerCardX = -999;
        let pointerCardY = -999;
        let lastPointerMoveAt = 0;

        const blobs = [
            { x: 0, y: 0, vx: 0, vy: 0, swirl: 1 },
            { x: 0, y: 0, vx: 0, vy: 0, swirl: -1 },
            { x: 0, y: 0, vx: 0, vy: 0, swirl: 1 },
            { x: 0, y: 0, vx: 0, vy: 0, swirl: -1 }
        ];

        const setSplitStage = (stage) => {
            if (splitStage === stage) return;
            const prev = splitStage;
            splitStage = stage;
            if (actionButtons) {
                actionButtons.classList.toggle('is-split-2', stage >= 2);
                actionButtons.classList.toggle('is-split-4', stage === 4);
            }
            if (decoyButtons[1]) {
                decoyButtons[1].setAttribute('data-stage', stage >= 2 ? '2' : '');
            }
            // Spawn impulses cleanly when breaking apart
            if (prev === 1 && stage === 2) {
                blobs[1].x = blobs[0].x + 14;
                blobs[1].y = blobs[0].y;
                blobs[0].vx -= 440;
                blobs[0].vy -= 260;
                blobs[1].vx += 460;
                blobs[1].vy -= 140;
            } else if (prev <= 2 && stage === 4) {
                blobs[2].x = blobs[0].x + 10;
                blobs[2].y = blobs[0].y - 6;
                blobs[3].x = blobs[1].x + 10;
                blobs[3].y = blobs[1].y - 6;
                blobs[0].vx -= 360;
                blobs[0].vy -= 240;
                blobs[2].vx += 240;
                blobs[2].vy -= 360;
                blobs[1].vx -= 220;
                blobs[1].vy -= 320;
                blobs[3].vx += 380;
                blobs[3].vy -= 200;
            }
        };

        const renderBlobAndLabel = (gooEl, labelEl, blob, widthPx, gooOpacity = 1, labelOpacity = 1, applyLabelOpacity = false) => {
            const speed = Math.hypot(blob.vx, blob.vy);
            const widthRatio = Math.max(0.25, Math.min(1, 130 / Math.max(68, widthPx)));
            const stretch = Math.min(0.14 * widthRatio, speed * 0.00018 * widthRatio);
            const angle = Math.max(-14, Math.min(14, blob.vx * 0.02 * widthRatio));
            const sx = (1 + stretch).toFixed(3);
            const sy = (1 - stretch * 0.65).toFixed(3);
            const marginLeft = -(widthPx / 2);

            if (gooEl) {
                gooEl.style.width = `${widthPx.toFixed(1)}px`;
                gooEl.style.marginLeft = `${marginLeft.toFixed(1)}px`;
                gooEl.style.opacity = gooOpacity.toFixed(3);
                gooEl.style.transform = `translate3d(${blob.x.toFixed(1)}px, ${blob.y.toFixed(1)}px, 0) rotate(${angle.toFixed(1)}deg) scale(${sx}, ${sy})`;
            }
            if (labelEl) {
                labelEl.style.width = `${widthPx.toFixed(1)}px`;
                labelEl.style.marginLeft = `${marginLeft.toFixed(1)}px`;
                labelEl.style.pointerEvents = labelOpacity > 0.25 ? 'auto' : 'none';
                if (applyLabelOpacity) {
                    labelEl.style.opacity = labelOpacity.toFixed(3);
                }
                labelEl.style.transform = `translate3d(${blob.x.toFixed(1)}px, ${blob.y.toFixed(1)}px, 0) rotate(${angle.toFixed(1)}deg)`;
            }
        };

        const resetFluidBlobs = () => {
            setSplitStage(1);
            flashSlotY = 0;
            split2Progress = 0;
            split4Progress = 0;
            chaseAccumMs = 0;
            blobs.forEach((b) => {
                b.x = 0;
                b.y = 0;
                b.vx = 0;
                b.vy = 0;
            });
            if (actionButtons) actionButtons.classList.remove('is-stunned');
            if (resetButtonIcon) resetButtonIcon.style.display = '';
            if (resetButtonLabel) {
                resetButtonLabel.textContent = 'Reset Timer';
                resetButtonLabel.style.opacity = '';
            }
            renderBlobAndLabel(gooBlobsEl[0], resetButton, blobs[0], 288, 1, 1, false);
            for (let i = 1; i < 4; i++) {
                renderBlobAndLabel(gooBlobsEl[i], decoyButtons[i], blobs[i], 68, 0, 0, true);
            }
        };

        const resetModalState = () => {
            clearInterval(timerInterval);
            clearTimeout(toastTimeout);
            clearTimeout(typoTimeout);
            clearTimeout(stunTimer);
            isHandlingTypo = false;
            isStunned = false;
            resetFluidBlobs();
            mindfulnessInput.disabled = false;
            mindfulnessInput.classList.remove('error', 'shake');
            resetModal.style.display = 'none';
            typingSection.style.display = 'none';
            timerText.style.display = 'block';
            celebrationSection.style.display = 'none';
            modalActions.style.display = 'flex';
            mindfulnessInput.value = '';
            confirmResetButton.disabled = true;
            resetTimerDisplay.textContent = '10';
            if (scoldToast) scoldToast.style.display = 'none';
        };

        const renderDashboard = (doomSec, dailySec, limitMin) => {
            const limitSec = Math.max(60, (limitMin || 20) * 60);
            const clockStr = formatClock(doomSec);
            counterElement.textContent = clockStr;
            counterElement.classList.toggle('long-time', clockStr.length > 5);
            limitElement.textContent = `${limitMin || 20}m`;

            const dailyCounterElement = document.getElementById('daily-shorts-count');
            if (dailyCounterElement) {
                dailyCounterElement.textContent = formatHumanDuration(dailySec);
            }

            const ratio = Math.min(1, doomSec / limitSec);
            const pct = Math.round(ratio * 100);
            let ringColor = '#84cc16';
            let statusText = 'SAFE';
            let stateTier = 'safe';

            if (doomSec >= limitSec) {
                ringColor = '#ef4444';
                statusText = 'BLOCKED';
                stateTier = 'angry';
            } else if (ratio >= 0.7) {
                ringColor = '#f59e0b';
                statusText = 'WARNING';
                stateTier = 'warn';
            }

            const statusElement = document.getElementById('ring-status');
            if (statusElement) {
                statusElement.textContent = statusText;
                statusElement.style.color = ringColor;
            }
            if (progressRing) {
                progressRing.style.background = `conic-gradient(${ringColor} ${pct * 3.6}deg, #2e2e34 0deg)`;
                progressRing.classList.toggle('state-warn', stateTier === 'warn');
                progressRing.classList.toggle('state-angry', stateTier === 'angry');
            }
            if (brandIcon) {
                brandIcon.src = stateTier === 'angry'
                    ? 'icons/angry48.png'
                    : (stateTier === 'warn' ? 'icons/warn48.png' : 'icons/icon48.png');
                brandIcon.classList.toggle('state-warn', stateTier === 'warn');
                brandIcon.classList.toggle('state-angry', stateTier === 'angry');
            }
            if (sparkController) {
                sparkController.setMode(stateTier);
            }
        };

        const updateCounter = () => {
            chrome.runtime.sendMessage({ action: 'getStatus' }, (resp) => {
                if (!chrome.runtime.lastError && resp) {
                    const limitMin = Math.round((resp.blockLimitSeconds || 1200) / 60);
                    renderDashboard(resp.doomSeconds || 0, resp.dailyDoomSeconds || 0, limitMin);
                    return;
                }
                chrome.storage.local.get(['doomSeconds', 'dailyDoomSeconds', 'blockLimitMinutes'], (result) => {
                    renderDashboard(result.doomSeconds || 0, result.dailyDoomSeconds || 0, result.blockLimitMinutes || 20);
                });
            });
        };

        updateCounter();

        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'local' && (changes.doomSeconds || changes.dailyDoomSeconds || changes.blockLimitMinutes)) {
                updateCounter();
            }
        });

        const STAGE_2_THRESHOLD_MS = 1600;
        const STAGE_4_THRESHOLD_MS = 3800;
        const STUN_THRESHOLD_MS = 7000;

        const triggerStunWindow = () => {
            isStunned = true;
            setSplitStage(1);
            chaseAccumMs = 0;
            if (actionButtons) actionButtons.classList.add('is-stunned');
            clearTimeout(stunTimer);
            stunTimer = setTimeout(() => {
                isStunned = false;
                if (actionButtons) actionButtons.classList.remove('is-stunned');
            }, 1900);
        };

        const stepFluidPhysics = (now) => {
            if (!lastFluidFrame) lastFluidFrame = now;
            const dt = Math.min(0.032, Math.max(0.008, (now - lastFluidFrame) / 1000));
            lastFluidFrame = now;

            let repellingAny = false;

            const targetSplit2 = splitStage >= 2 ? 1 : 0;
            const targetSplit4 = splitStage === 4 ? 1 : 0;
            split2Progress += (targetSplit2 - split2Progress) * (1 - Math.exp(-14 * dt));
            split4Progress += (targetSplit4 - split4Progress) * (1 - Math.exp(-14 * dt));
            if (Math.abs(targetSplit2 - split2Progress) < 0.002) split2Progress = targetSplit2;
            if (Math.abs(targetSplit4 - split4Progress) < 0.002) split4Progress = targetSplit4;

            if (dashboardCard && actionButtons && resetButton) {
                const cardRect = dashboardCard.getBoundingClientRect();
                const wrapRect = actionButtons.getBoundingClientRect();
                const originX = (wrapRect.left + wrapRect.width / 2) - cardRect.left;
                const originY = (wrapRect.top + wrapRect.height / 2) - cardRect.top;

                const anchorsX = [
                    (-70 * split2Progress) + (-34 * split4Progress),
                    (70 * split2Progress) + (34 * split4Progress),
                    -36 * split4Progress,
                    36 * split4Progress
                ];
                const anchorsY = [
                    -10 * split4Progress,
                    -10 * split4Progress,
                    8 * split4Progress,
                    8 * split4Progress
                ];

                const activeCount = split4Progress > 0.01 ? 4 : (split2Progress > 0.01 ? 2 : 1);

                if (splitStage === 1 && split2Progress < 0.05) {
                    const b = blobs[0];
                    if (pointerInsideCard && !isStunned) {
                        const nearX = Math.abs(pointerCardX - (originX + b.x)) < 165;
                        const nearY = Math.abs(pointerCardY - (originY + b.y)) < 48;
                        if (nearX && nearY) {
                            repellingAny = true;
                            const slots = [0, -72, -142];
                            let bestSlot = flashSlotY;
                            let bestDist = -1;
                            for (const s of slots) {
                                const d = Math.abs((originY + s) - pointerCardY);
                                if (d > bestDist) {
                                    bestDist = d;
                                    bestSlot = s;
                                }
                            }
                            if (bestSlot !== flashSlotY) {
                                flashSlotY = bestSlot;
                                if (now - lastPointerMoveAt < 300) {
                                    chaseAccumMs += 450;
                                    if (chaseAccumMs >= STAGE_2_THRESHOLD_MS) {
                                        setSplitStage(2);
                                    }
                                }
                            }
                        }
                    } else {
                        flashSlotY = 0;
                    }

                    const snap = 1 - Math.exp(-34 * dt);
                    b.x += (0 - b.x) * snap;
                    b.y += (flashSlotY - b.y) * snap;
                    b.vx = 0;
                    b.vy = 0;
                } else {
                    for (let i = 0; i < activeCount; i++) {
                        const b = blobs[i];
                        let repellingSelf = false;
                        let repelFx = 0;
                        let repelFy = 0;

                        if (pointerInsideCard && !isStunned) {
                            const bx = originX + b.x;
                            const by = originY + b.y;
                            const dx = bx - pointerCardX;
                            const dy = by - pointerCardY;
                            const dist = Math.hypot(dx, dy);
                            const repelRadius = 132;

                            if (dist < repelRadius) {
                                repellingAny = true;
                                repellingSelf = true;
                                const safeDist = Math.max(8, dist);
                                const t = 1 - dist / repelRadius;
                                const strength = (t * t * 14500) + (t * 4200);
                                const nx = dx / safeDist;
                                const ny = dy / safeDist;

                                repelFx += nx * strength + (-ny * b.swirl) * strength * 0.65;
                                repelFy += ny * strength + (nx * b.swirl) * strength * 0.65 - strength * 0.28;
                            }
                        }

                        // Gentle blob-to-blob spacing when split so droplets fan out cleanly
                        if (activeCount > 1 && !isStunned) {
                            for (let j = 0; j < activeCount; j++) {
                                if (i === j) continue;
                                const o = blobs[j];
                                const sdx = b.x - o.x;
                                const sdy = b.y - o.y;
                                const sdist = Math.hypot(sdx, sdy);
                                const minSep = activeCount === 4 ? 56 : 86;
                                if (sdist > 0.1 && sdist < minSep) {
                                    const push = ((minSep - sdist) / minSep) * 1800;
                                    repelFx += (sdx / sdist) * push;
                                    repelFy += (sdy / sdist) * push;
                                }
                            }
                        }

                        const springK = repellingSelf ? 12 : 40;
                        const fx = (anchorsX[i] - b.x) * springK + repelFx;
                        const fy = (anchorsY[i] - b.y) * springK + repelFy;

                        b.vx = (b.vx + fx * dt) * Math.pow(0.035, dt);
                        b.vy = (b.vy + fy * dt) * Math.pow(0.035, dt);
                        b.x += b.vx * dt;
                        b.y += b.vy * dt;

                        const maxX = 12 + split2Progress * 80 + split4Progress * 22;
                        const minY = -225;
                        const maxY = 10;
                        if (b.x < -maxX) { b.x = -maxX; b.vx = Math.abs(b.vx) * 0.45; }
                        if (b.x > maxX) { b.x = maxX; b.vx = -Math.abs(b.vx) * 0.45; }
                        if (b.y < minY) { b.y = minY; b.vy = Math.abs(b.vy) * 0.45; }
                        if (b.y > maxY) { b.y = maxY; b.vy = -Math.abs(b.vy) * 0.45; }
                    }
                }

                // Keep unspawned blobs anchored to their parent blob so splits pull directly out of them
                if (split2Progress <= 0.01) {
                    blobs[1].x = blobs[0].x;
                    blobs[1].y = blobs[0].y;
                    blobs[1].vx = blobs[0].vx;
                    blobs[1].vy = blobs[0].vy;
                }
                if (split4Progress <= 0.01) {
                    blobs[2].x = blobs[0].x;
                    blobs[2].y = blobs[0].y;
                    blobs[2].vx = blobs[0].vx;
                    blobs[2].vy = blobs[0].vy;
                    blobs[3].x = blobs[1].x;
                    blobs[3].y = blobs[1].y;
                    blobs[3].vx = blobs[1].vx;
                    blobs[3].vy = blobs[1].vy;
                }

                const isActivelyChasing = repellingAny && !isStunned && (now - lastPointerMoveAt < 240);
                if (isActivelyChasing) {
                    chaseAccumMs += dt * 1000;
                    if (chaseAccumMs >= STUN_THRESHOLD_MS) {
                        triggerStunWindow();
                    } else if (chaseAccumMs >= STAGE_4_THRESHOLD_MS && splitStage < 4) {
                        setSplitStage(4);
                    } else if (chaseAccumMs >= STAGE_2_THRESHOLD_MS && splitStage < 2) {
                        setSplitStage(2);
                    }
                } else if (!pointerInsideCard && !isStunned) {
                    chaseAccumMs = Math.max(0, chaseAccumMs - dt * 450);
                }

                const fullWidth = wrapRect.width || 288;
                const w0 = fullWidth - (fullWidth - 126) * split2Progress - (126 - 68) * split4Progress;
                const w1 = (96 + 30 * split2Progress) - (126 - 68) * split4Progress;
                const w23 = 56 + 12 * split4Progress;

                const g1Op = Math.min(1, split2Progress * 2.2);
                const l1Op = Math.max(0, Math.min(1, (split2Progress - 0.35) / 0.55));
                const g4Op = Math.min(1, split4Progress * 2.2);
                const l4Op = Math.max(0, Math.min(1, (split4Progress - 0.35) / 0.55));

                if (resetButtonIcon) {
                    resetButtonIcon.style.display = split4Progress > 0.42 ? 'none' : '';
                }
                if (resetButtonLabel) {
                    const targetText = split4Progress > 0.42 ? 'Re' : (split2Progress > 0.42 ? 'Reset' : 'Reset Timer');
                    if (resetButtonLabel.textContent !== targetText) {
                        resetButtonLabel.textContent = targetText;
                    }
                }
                if (decoyButtons[1]) {
                    const d1Text = split4Progress > 0.42 ? 'set' : 'Timer';
                    if (decoyButtons[1].textContent !== d1Text) {
                        decoyButtons[1].textContent = d1Text;
                    }
                }

                renderBlobAndLabel(gooBlobsEl[0], resetButton, blobs[0], w0, 1, 1, false);
                renderBlobAndLabel(gooBlobsEl[1], decoyButtons[1], blobs[1], w1, g1Op, l1Op, true);
                renderBlobAndLabel(gooBlobsEl[2], decoyButtons[2], blobs[2], w23, g4Op, l4Op, true);
                renderBlobAndLabel(gooBlobsEl[3], decoyButtons[3], blobs[3], w23, g4Op, l4Op, true);
            }

            const stillMoving =
                Math.abs(blobs[0].x) > 0.3 || Math.abs(blobs[0].y) > 0.3 ||
                Math.abs(blobs[0].vx) > 2 || Math.abs(blobs[0].vy) > 2 ||
                split2Progress > 0.005 || split4Progress > 0.005;

            if (pointerInsideCard || stillMoving || splitStage > 1) {
                fluidRafId = requestAnimationFrame(stepFluidPhysics);
            } else {
                fluidRafId = null;
                lastFluidFrame = 0;
                resetFluidBlobs();
            }
        };

        const ensureFluidLoop = () => {
            if (!fluidRafId) {
                lastFluidFrame = 0;
                fluidRafId = requestAnimationFrame(stepFluidPhysics);
            }
        };

        if (dashboardCard) {
            dashboardCard.addEventListener('mousemove', (e) => {
                const cardRect = dashboardCard.getBoundingClientRect();
                const nx = e.clientX - cardRect.left;
                const ny = e.clientY - cardRect.top;
                if (Math.hypot(nx - pointerCardX, ny - pointerCardY) > 1.5) {
                    lastPointerMoveAt = performance.now();
                }
                pointerInsideCard = true;
                pointerCardX = nx;
                pointerCardY = ny;
                ensureFluidLoop();
            });

            dashboardCard.addEventListener('mouseleave', () => {
                pointerInsideCard = false;
                setSplitStage(1);
                ensureFluidLoop();
            });
        }

        const burstEvade = (e) => {
            if (isStunned) return;
            chaseAccumMs += 650;
            if (chaseAccumMs >= STUN_THRESHOLD_MS) {
                triggerStunWindow();
                ensureFluidLoop();
                return;
            }
            if (chaseAccumMs >= STAGE_4_THRESHOLD_MS && splitStage < 4) {
                setSplitStage(4);
            } else if (chaseAccumMs >= STAGE_2_THRESHOLD_MS && splitStage < 2) {
                setSplitStage(2);
            }

            const dir = (e && e.clientX && resetButton)
                ? (e.clientX < resetButton.getBoundingClientRect().left + resetButton.getBoundingClientRect().width / 2 ? 1 : -1)
                : 1;
            blobs[0].vx += dir * 520;
            blobs[0].vy -= 420;
            blobs[1].vx -= dir * 520;
            blobs[1].vy -= 260;
            blobs[2].vx += dir * 420;
            blobs[2].vy -= 360;
            blobs[3].vx -= dir * 420;
            blobs[3].vy -= 320;
            ensureFluidLoop();
        };

        resetFluidBlobs();

        resetButton.addEventListener('mousedown', (e) => {
            if (!isStunned) {
                e.preventDefault();
                burstEvade(e);
            }
        });

        decoyButtons.forEach((btn) => {
            if (!btn) return;
            btn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                playBuzzerSound();
                burstEvade(e);
            });
        });

        const handleKeyboardCheat = (e) => {
            if (e) e.preventDefault();
            resetButton.blur();
            playBuzzerSound();
            const roast = KEYBOARD_ROASTS[Math.floor(Math.random() * KEYBOARD_ROASTS.length)];
            showScold(roast);
        };

        resetButton.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                handleKeyboardCheat(e);
            }
        });

        resetButton.addEventListener('click', (e) => {
            if (e.detail === 0 || (e.clientX === 0 && e.clientY === 0 && e.screenX === 0)) {
                handleKeyboardCheat(e);
                return;
            }
            if (!isStunned) {
                burstEvade(e);
                return;
            }
            resetModalState();
            setupNewPhrase();
            resetModal.style.display = 'flex';
            startCountdown();
        });

        cancelResetButton.addEventListener('click', resetModalState);

        mindfulnessInput.addEventListener('paste', (e) => {
            e.preventDefault();
            playBuzzerSound();
            shakeInput();
            showScold("Copy-paste is disabled. Type it with your own hands.");
        });

        if (phraseDisplay) {
            phraseDisplay.addEventListener('copy', (e) => {
                e.preventDefault();
                playBuzzerSound();
                showScold("Stop looking for loopholes. The phrase is locked—type it out.");
            });
            phraseDisplay.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                playBuzzerSound();
                showScold("Right-click won't save you. Get typing.");
            });
            phraseDisplay.addEventListener('selectstart', (e) => e.preventDefault());
            phraseDisplay.addEventListener('dragstart', (e) => e.preventDefault());
        }

        mindfulnessInput.addEventListener('input', () => {
            if (isHandlingTypo) return;
            const val = mindfulnessInput.value;
            if (val.length === 0) {
                confirmResetButton.disabled = true;
                return;
            }

            if (!currentPhrase.startsWith(val)) {
                isHandlingTypo = true;
                playBuzzerSound();
                shakeInput();
                mindfulnessInput.classList.add('error');
                mindfulnessInput.disabled = true;
                confirmResetButton.disabled = true;

                const randomMock = TYPO_MOCKS[Math.floor(Math.random() * TYPO_MOCKS.length)];
                showScold(randomMock);

                typoTimeout = setTimeout(() => {
                    mindfulnessInput.disabled = false;
                    mindfulnessInput.classList.remove('error', 'shake');
                    mindfulnessInput.value = '';
                    isHandlingTypo = false;
                    setupNewPhrase();
                    startCountdown();
                }, 900);
                return;
            }

            confirmResetButton.disabled = (val !== currentPhrase);
        });

        confirmResetButton.addEventListener('click', () => {
            if (mindfulnessInput.value === currentPhrase) {
                playSuccessFanfare();
                typingSection.style.display = 'none';
                modalActions.style.display = 'none';
                celebrationSection.style.display = 'block';
                startConfetti(2800);

                chrome.runtime.sendMessage({ action: 'resetDoomCount' }, () => {
                    void chrome.runtime.lastError;
                    updateCounter();
                });

                setTimeout(() => {
                    resetModalState();
                }, 3000);
            }
        });

        if (settingsButton) {
            settingsButton.addEventListener('click', () => {
                chrome.runtime.openOptionsPage();
            });
        }

        function startConfetti(durationMs = 2800) {
            const canvas = document.getElementById('confetti-canvas');
            if (!canvas) return;
            canvas.style.display = 'block';
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            const ctx = canvas.getContext('2d');

            const colors = ['#84cc16', '#f59e0b', '#ef4444', '#38bdf8', '#ffffff'];
            const particles = [];
            for (let i = 0; i < 75; i++) {
                particles.push({
                    x: Math.random() * canvas.width,
                    y: Math.random() * -canvas.height * 0.5,
                    vx: (Math.random() - 0.5) * 4,
                    vy: Math.random() * 3 + 2.5,
                    size: Math.random() * 6 + 4,
                    color: colors[Math.floor(Math.random() * colors.length)],
                    rot: Math.random() * 360,
                    rotSpeed: (Math.random() - 0.5) * 8
                });
            }

            let animId;
            const startTime = Date.now();

            function render() {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                particles.forEach((p) => {
                    p.x += p.vx;
                    p.y += p.vy;
                    p.rot += p.rotSpeed;
                    ctx.save();
                    ctx.translate(p.x, p.y);
                    ctx.rotate((p.rot * Math.PI) / 180);
                    ctx.fillStyle = p.color;
                    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.5);
                    ctx.restore();
                });

                if (Date.now() - startTime < durationMs) {
                    animId = requestAnimationFrame(render);
                } else {
                    cancelAnimationFrame(animId);
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    canvas.style.display = 'none';
                }
            }
            render();
        }
    });
})();
