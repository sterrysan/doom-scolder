// popup.js

(function () {
    document.addEventListener('DOMContentLoaded', () => {
        const counterElement = document.getElementById('shorts-counter');
        const limitElement = document.getElementById('dashboard-block-limit');
        const resetButton = document.getElementById('reset-button');
        const settingsButton = document.getElementById('settings-button');

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

        // Base phrase and Leet-speak mapping
        const BASE_PHRASE = "I admit I am wasting my time on shorts and I should be doing something productive.";
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
            "😂 Strike ONE and you're OUT! Reflect on your habits for 10s.",
            "🤦‍♂️ A typo already? Stop trembling and wait 10 seconds again!",
            "📉 Brain rot detected! One wrong key and you start completely over!"
        ];

        const KEYBOARD_ROASTS = [
            " Tab won't save you. Use your damn mouse!",
            " Trying to Tab + Enter?🖕",
            "😏 Nice try keyboard warrior! You can't shortcut this.",
            " Did you really think Tab + Enter would work?"
        ];

        let currentPhrase = BASE_PHRASE;
        let timerInterval = null;
        let toastTimeout = null;
        let typoTimeout = null;
        let isHandlingTypo = false;

        // Generate tricky phrase with exactly 1 random leet-speak character
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

        // Web Audio Synthesizer (100% self-contained, no external audio files)
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
            } catch (e) {
                // AudioContext not permitted or disabled
            }
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
                    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.28);

                    osc.connect(gain);
                    gain.connect(ctx.destination);

                    osc.start(startTime);
                    osc.stop(startTime + 0.28);
                });
            } catch (e) {
                // AudioContext not permitted or disabled
            }
        };

        // Scold toast popup
        const showScold = (msg) => {
            if (!scoldToast) return;
            scoldToast.textContent = msg;
            scoldToast.style.display = 'block';
            clearTimeout(toastTimeout);
            toastTimeout = setTimeout(() => {
                scoldToast.style.display = 'none';
            }, 3000);
        };

        // Shake input field on mistake
        const shakeInput = () => {
            mindfulnessInput.classList.remove('shake');
            void mindfulnessInput.offsetWidth; // trigger reflow
            mindfulnessInput.classList.add('shake');
        };

        // Start 10-second countdown
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

        // Reset Modal state
        const resetModalState = () => {
            clearInterval(timerInterval);
            clearTimeout(toastTimeout);
            clearTimeout(typoTimeout);
            clearTimeout(stunTimer);
            isHandlingTypo = false;
            isResetDodgedUp = false;
            isResetDodging = false;
            isStunned = false;
            dodgeCount = 0;
            resetButton.classList.remove('dodge-up-left', 'dodge-up-right', 'dodge-down-left', 'dodge-down-right');
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

        // Function to update the counter display
        const updateCounter = () => {
            chrome.storage.local.get(['shortsCount', 'shortsBlockLimit', 'dailyShortsCount', 'lastActiveDate'], (result) => {
                const count = result.shortsCount || 0;
                const limit = result.shortsBlockLimit || 10;
                counterElement.textContent = count;
                limitElement.textContent = limit;

                let today = new Date().toDateString();
                let dailyCount = result.dailyShortsCount || 0;
                if (result.lastActiveDate && result.lastActiveDate !== today) {
                    dailyCount = 0;
                }

                const dailyCounterElement = document.getElementById('daily-shorts-count');
                if (dailyCounterElement) {
                    dailyCounterElement.textContent = dailyCount;
                }

                const statusElement = document.getElementById('ring-status');
                if (statusElement) {
                    if (count >= limit) {
                        statusElement.textContent = "BLOCKED";
                        statusElement.style.color = "#ff4b4b"; // Red
                    } else if (count >= limit * 0.7) {
                        statusElement.textContent = "WARNING";
                        statusElement.style.color = "#FFDD00"; // Yellow
                    } else {
                        statusElement.textContent = "SAFE";
                        statusElement.style.color = "#4caf50"; // Green
                    }
                }
            });
        };

        // Initial update
        updateCounter();

        // Listen for changes in storage and update the popup if it's open
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'local' && (changes.shortsCount || changes.dailyShortsCount || changes.shortsBlockLimit)) {
                updateCounter();
            }
        });

        // Dodging Reset Button mechanic (dodges 10 times, then gives a 1-second click window)
        let isResetDodgedUp = false;
        let isResetDodging = false;
        let lastLean = 'left';
        let dodgeCount = 0;
        let isStunned = false;
        let stunTimer = null;

        const dodgeResetButton = (e) => {
            // If button is currently in the 1-second vulnerable window, DO NOT DODGE!
            if (isStunned) return;

            if (isResetDodging) return;
            isResetDodging = true;
            dodgeCount++;

            const rect = resetButton.getBoundingClientRect();
            let leanSide;

            if (e && typeof e.clientX === 'number') {
                const mouseX = e.clientX - rect.left;
                // If cursor attacks from left, pivot on bottom-right and lean right; if from right, pivot bottom-left and lean left
                leanSide = mouseX < (rect.width / 2) ? 'right' : 'left';
            } else {
                leanSide = lastLean === 'left' ? 'right' : 'left';
            }
            lastLean = leanSide;

            // Toggle vertical jump
            isResetDodgedUp = !isResetDodgedUp;

            resetButton.classList.remove('dodge-up-left', 'dodge-up-right', 'dodge-down-left', 'dodge-down-right');

            if (isResetDodgedUp) {
                resetButton.classList.add(leanSide === 'left' ? 'dodge-up-left' : 'dodge-up-right');
            } else {
                resetButton.classList.add(leanSide === 'left' ? 'dodge-down-left' : 'dodge-down-right');
            }

            // On every 10th dodge, stay still for 2 seconds so it can be clicked
            if (dodgeCount % 10 === 0) {
                setTimeout(() => {
                    isStunned = true;
                    clearTimeout(stunTimer);
                    stunTimer = setTimeout(() => {
                        isStunned = false;
                    }, 2000);
                }, 240);
            }

            setTimeout(() => {
                isResetDodging = false;
            }, 260);
        };

        resetButton.addEventListener('mouseenter', dodgeResetButton);
        resetButton.addEventListener('mousedown', dodgeResetButton);

        const handleKeyboardCheat = (e) => {
            if (e) e.preventDefault();
            resetButton.blur();
            playBuzzerSound();
            const roast = KEYBOARD_ROASTS[Math.floor(Math.random() * KEYBOARD_ROASTS.length)];
            showScold(roast);
        };

        // ANTI-CHEAT 0: Catch Tab + Enter / Space loophole on Reset Button
        resetButton.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                handleKeyboardCheat(e);
            }
        });

        // Handle manual reset button click (Opens Modal only if clicked with mouse)
        resetButton.addEventListener('click', (e) => {
            // If triggered via keyboard (detail === 0 or synthetic click without cursor coordinates)
            if (e.detail === 0 || (e.clientX === 0 && e.clientY === 0 && e.screenX === 0)) {
                handleKeyboardCheat(e);
                return;
            }

            resetModalState();
            setupNewPhrase();
            resetModal.style.display = 'flex';
            startCountdown();
        });

        cancelResetButton.addEventListener('click', resetModalState);

        // ANTI-CHEAT 1: Disable Paste & Scold
        mindfulnessInput.addEventListener('paste', (e) => {
            e.preventDefault();
            playBuzzerSound();
            shakeInput();
            showScold("🚫 CAUGHT IN 4K! Copy-paste is disabled. Type it with your own hands! 🫵");
        });

        // ANTI-CHEAT 2: Block Copy / Selection / Context Menu on Phrase & Scold
        if (phraseDisplay) {
            phraseDisplay.addEventListener('copy', (e) => {
                e.preventDefault();
                playBuzzerSound();
                showScold("🕵️‍♂️ Stop looking for loopholes! The phrase is locked. Type it out! 🔒");
            });
            phraseDisplay.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                playBuzzerSound();
                showScold("😏 Right-click won't save you! Get typing!");
            });
            phraseDisplay.addEventListener('selectstart', (e) => e.preventDefault());
            phraseDisplay.addEventListener('dragstart', (e) => e.preventDefault());
        }

        // STRICT TYPO CHECK: "One Strike & Restart"
        mindfulnessInput.addEventListener('input', () => {
            if (isHandlingTypo) return;

            const val = mindfulnessInput.value;
            if (val.length === 0) {
                confirmResetButton.disabled = true;
                return;
            }

            // Check if what they typed matches the prefix of current tricky phrase
            if (!currentPhrase.startsWith(val)) {
                // Mistake detected! Lock input and show error on the SAME page for a split second
                isHandlingTypo = true;
                playBuzzerSound();
                shakeInput();
                mindfulnessInput.classList.add('error');
                mindfulnessInput.disabled = true;
                confirmResetButton.disabled = true;

                const randomMock = TYPO_MOCKS[Math.floor(Math.random() * TYPO_MOCKS.length)];
                showScold(randomMock);

                // Stay on the same page for ~900ms so user clearly feels the mockery!
                typoTimeout = setTimeout(() => {
                    mindfulnessInput.disabled = false;
                    mindfulnessInput.classList.remove('error', 'shake');
                    mindfulnessInput.value = '';
                    isHandlingTypo = false;

                    // Re-roll phrase with a new random leet char and start penalty countdown
                    setupNewPhrase();
                    startCountdown();
                }, 900);

                return;
            }

            // If exact match reached, enable confirmation button
            if (val === currentPhrase) {
                confirmResetButton.disabled = false;
            } else {
                confirmResetButton.disabled = true;
            }
        });

        // Handle confirmation of reset: Confetti + Sarcastic Mockery
        confirmResetButton.addEventListener('click', () => {
            if (mindfulnessInput.value === currentPhrase) {
                // Play victory sound
                playSuccessFanfare();

                // Hide typing UI and action buttons
                typingSection.style.display = 'none';
                modalActions.style.display = 'none';
                celebrationSection.style.display = 'block';

                // Launch Confetti
                startConfetti(2800);

                // Perform actual reset in storage
                chrome.storage.local.set({ shortsCount: 0 }, () => {
                    console.log('Doom Scolder: Count reset to 0 after mindfulness check.');
                    updateCounter();
                });

                // Auto-close modal after 3 seconds of celebration
                setTimeout(() => {
                    resetModalState();
                }, 3000);
            }
        });

        // View Switch Navigation: Dashboard (360px natural) <-> Settings (440x600px)
        const viewDashboard = document.getElementById('view-dashboard');
        const viewSettings = document.getElementById('view-settings');
        const backToDashboardBtn = document.getElementById('back-to-dashboard-btn');
        const popoutSettingsBtn = document.getElementById('popout-settings-btn');

        const openSettings = () => {
            if (viewDashboard && viewSettings) {
                document.body.classList.add('settings-mode');
                viewDashboard.style.display = 'none';
                viewSettings.style.display = 'flex';
                setTimeout(() => {
                    window.dispatchEvent(new Event('resize'));
                }, 60);
            }
        };

        const closeSettings = () => {
            if (viewDashboard && viewSettings) {
                document.body.classList.remove('settings-mode');
                viewSettings.style.display = 'none';
                viewDashboard.style.display = 'block';
                window.dispatchEvent(new CustomEvent('exit-settings'));
                updateCounter();
            }
        };

        if (settingsButton) settingsButton.addEventListener('click', openSettings);
        if (backToDashboardBtn) backToDashboardBtn.addEventListener('click', closeSettings);
        if (popoutSettingsBtn) popoutSettingsBtn.addEventListener('click', () => {
            chrome.runtime.openOptionsPage();
        });

        // Canvas Confetti Generator (Pure Vanilla JS, 0 external dependencies)
        function startConfetti(durationMs = 2800) {
            const canvas = document.getElementById('confetti-canvas');
            if (!canvas) return;
            canvas.style.display = 'block';
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            const ctx = canvas.getContext('2d');

            const colors = ['#ff4b4b', '#FFDD00', '#4caf50', '#00d2ff', '#ff007f', '#ffffff'];
            const particles = [];
            const count = 75;

            for (let i = 0; i < count; i++) {
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
