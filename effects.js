(function () {
    if (window.DoomEffects) return;

    // -------------------------------------------------------------------------
    // 1. Procedural Web Audio Engine (no external files, CSP-safe)
    // -------------------------------------------------------------------------
    class SoundEngine {
        constructor() {
            this.ctx = null;
            this.master = null;
            this.reverb = null;
            this.noiseBuffer = null;
            this.unlocked = false;
            this.rainGain = null;
            this.voidGain = null;
            this.plasmaGain = null;
            this.plasmaFilter = null;
            this.lastBassDropTime = 0;
            this.voices = [];

            if ('speechSynthesis' in window) {
                try {
                    this.voices = window.speechSynthesis.getVoices();
                    window.speechSynthesis.onvoiceschanged = () => {
                        this.voices = window.speechSynthesis.getVoices();
                    };
                } catch (_) { }
            }
        }

        unlock() {
            if (this.unlocked) {
                if (this.ctx && this.ctx.state === 'suspended') {
                    this.ctx.resume().catch(() => { });
                }
                return;
            }
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;

            try {
                this.ctx = new AudioCtx();
                this.master = this.ctx.createGain();
                this.master.gain.value = 0.78;

                const comp = this.ctx.createDynamicsCompressor();
                comp.threshold.value = -10;
                comp.knee.value = 18;
                comp.ratio.value = 8;
                comp.attack.value = 0.003;
                comp.release.value = 0.25;

                this.master.connect(comp);
                comp.connect(this.ctx.destination);

                this.noiseBuffer = this._createNoiseBuffer(3.0);
                this.reverb = this._createReverb(2.4, 3.0);
                this.reverb.connect(this.master);

                this._startAmbientRain();
                this._startVoidDrone();
                this._startPlasmaBeam();

                this.unlocked = true;
            } catch (_) { }
        }

        _createNoiseBuffer(seconds) {
            const length = Math.floor(this.ctx.sampleRate * seconds);
            const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            let lastOut = 0;
            for (let i = 0; i < length; i++) {
                const white = Math.random() * 2 - 1;
                data[i] = (lastOut + 0.06 * white) / 1.06;
                lastOut = data[i];
                data[i] *= 2.4;
            }
            return buffer;
        }

        _createReverb(duration, decay) {
            const length = Math.floor(this.ctx.sampleRate * duration);
            const impulse = this.ctx.createBuffer(2, length, this.ctx.sampleRate);
            for (let ch = 0; ch < 2; ch++) {
                const data = impulse.getChannelData(ch);
                for (let i = 0; i < length; i++) {
                    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
                }
            }
            const convolver = this.ctx.createConvolver();
            convolver.buffer = impulse;
            return convolver;
        }

        _startAmbientRain() {
            const src = this.ctx.createBufferSource();
            src.buffer = this.noiseBuffer;
            src.loop = true;

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 1100;
            filter.Q.value = 0.55;

            this.rainGain = this.ctx.createGain();
            this.rainGain.gain.value = 0.0;

            src.connect(filter);
            filter.connect(this.rainGain);
            this.rainGain.connect(this.master);
            src.start();
        }

        _startVoidDrone() {
            const osc1 = this.ctx.createOscillator();
            const osc2 = this.ctx.createOscillator();
            osc1.type = 'sawtooth';
            osc2.type = 'triangle';
            osc1.frequency.value = 38;
            osc2.frequency.value = 57;

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 135;
            filter.Q.value = 4;

            this.voidGain = this.ctx.createGain();
            this.voidGain.gain.value = 0.0;

            osc1.connect(filter);
            osc2.connect(filter);
            filter.connect(this.voidGain);
            this.voidGain.connect(this.master);
            this.voidGain.connect(this.reverb);

            osc1.start();
            osc2.start();
        }

        _startPlasmaBeam() {
            const osc1 = this.ctx.createOscillator();
            const osc2 = this.ctx.createOscillator();
            osc1.type = 'sawtooth';
            osc2.type = 'triangle';
            osc1.frequency.value = 64;
            osc2.frequency.value = 96.5;

            const lfo = this.ctx.createOscillator();
            const lfoGain = this.ctx.createGain();
            lfo.type = 'sine';
            lfo.frequency.value = 18;
            lfoGain.gain.value = 85;

            const arcNoise = this.ctx.createBufferSource();
            arcNoise.buffer = this.noiseBuffer;
            arcNoise.loop = true;

            const arcFilter = this.ctx.createBiquadFilter();
            arcFilter.type = 'bandpass';
            arcFilter.frequency.value = 2400;
            arcFilter.Q.value = 2.2;

            const arcGain = this.ctx.createGain();
            arcGain.gain.value = 0.28;

            this.plasmaFilter = this.ctx.createBiquadFilter();
            this.plasmaFilter.type = 'lowpass';
            this.plasmaFilter.frequency.value = 260;
            this.plasmaFilter.Q.value = 5.0;

            this.plasmaGain = this.ctx.createGain();
            this.plasmaGain.gain.value = 0.0;

            lfo.connect(lfoGain);
            lfoGain.connect(this.plasmaFilter.frequency);

            osc1.connect(this.plasmaFilter);
            osc2.connect(this.plasmaFilter);
            this.plasmaFilter.connect(this.plasmaGain);

            arcNoise.connect(arcFilter);
            arcFilter.connect(arcGain);
            arcGain.connect(this.plasmaGain);

            this.plasmaGain.connect(this.master);
            this.plasmaGain.connect(this.reverb);

            osc1.start();
            osc2.start();
            lfo.start();
            arcNoise.start();
        }

        setRainLevel(level) {
            if (!this.unlocked || !this.rainGain) return;
            this.rainGain.gain.setTargetAtTime(level, this.ctx.currentTime, 0.6);
        }

        setVoidLevel(level) {
            if (!this.unlocked || !this.voidGain) return;
            this.voidGain.gain.setTargetAtTime(level, this.ctx.currentTime, 0.4);
        }

        setPlasmaBeamLevel(level, charge = 0) {
            if (!this.unlocked || !this.plasmaGain || !this.plasmaFilter) return;
            const now = this.ctx.currentTime;
            this.plasmaGain.gain.setTargetAtTime(level * 0.34, now, 0.12);
            this.plasmaFilter.frequency.setTargetAtTime(260 + charge * 780, now, 0.15);
        }

        silenceAll() {
            this.setRainLevel(0);
            this.setVoidLevel(0);
            this.setPlasmaBeamLevel(0, 0);
            this.stopSpeech();
        }

        playThunder(intensity = 1.0) {
            if (!this.unlocked) return;
            const now = this.ctx.currentTime;

            const crack = this.ctx.createBufferSource();
            crack.buffer = this.noiseBuffer;
            const crackFilter = this.ctx.createBiquadFilter();
            crackFilter.type = 'highpass';
            crackFilter.frequency.value = 900;
            const crackGain = this.ctx.createGain();
            crackGain.gain.setValueAtTime(0.4 * intensity, now);
            crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

            crack.connect(crackFilter);
            crackFilter.connect(crackGain);
            crackGain.connect(this.reverb);
            crack.start(now);
            crack.stop(now + 0.25);

            const boom = this.ctx.createBufferSource();
            boom.buffer = this.noiseBuffer;
            const boomFilter = this.ctx.createBiquadFilter();
            boomFilter.type = 'lowpass';
            boomFilter.frequency.setValueAtTime(220, now + 0.04);
            boomFilter.frequency.exponentialRampToValueAtTime(48, now + 2.2);

            const boomGain = this.ctx.createGain();
            boomGain.gain.setValueAtTime(0.01, now);
            boomGain.gain.linearRampToValueAtTime(0.58 * intensity, now + 0.08);
            boomGain.gain.exponentialRampToValueAtTime(0.001, now + 2.4);

            boom.connect(boomFilter);
            boomFilter.connect(boomGain);
            boomGain.connect(this.master);
            boomGain.connect(this.reverb);
            boom.start(now);
            boom.stop(now + 2.5);
        }

        playMissileLaunch(type = 'hypersonic') {
            if (!this.unlocked) return;
            const now = this.ctx.currentTime;
            const duration = type === 'hypersonic' ? 1.05 : 1.7;

            const osc = this.ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(type === 'hypersonic' ? 1400 : 750, now);
            osc.frequency.exponentialRampToValueAtTime(120, now + duration);

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(type === 'hypersonic' ? 2200 : 1200, now);
            filter.frequency.exponentialRampToValueAtTime(200, now + duration);
            filter.Q.value = 5.0;

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.01, now);
            gain.gain.linearRampToValueAtTime(0.35, now + duration * 0.45);
            gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

            const noise = this.ctx.createBufferSource();
            noise.buffer = this.noiseBuffer;
            const noiseFilter = this.ctx.createBiquadFilter();
            noiseFilter.type = 'highpass';
            noiseFilter.frequency.setValueAtTime(600, now);

            const noiseGain = this.ctx.createGain();
            noiseGain.gain.setValueAtTime(0.01, now);
            noiseGain.gain.linearRampToValueAtTime(0.18, now + duration * 0.4);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

            noise.connect(noiseFilter);
            noiseFilter.connect(noiseGain);
            noiseGain.connect(this.master);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.master);

            osc.start(now);
            noise.start(now);
            osc.stop(now + duration);
            noise.stop(now + duration);
        }

        playExplosion(intensity = 1.0) {
            if (!this.unlocked) return;
            const now = this.ctx.currentTime;

            const snapOsc = this.ctx.createOscillator();
            snapOsc.type = 'triangle';
            snapOsc.frequency.setValueAtTime(450, now);
            snapOsc.frequency.exponentialRampToValueAtTime(60, now + 0.08);
            const snapGain = this.ctx.createGain();
            snapGain.gain.setValueAtTime(0.72 * intensity, now);
            snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
            snapOsc.connect(snapGain);
            snapGain.connect(this.master);
            snapOsc.start(now);
            snapOsc.stop(now + 0.1);

            const sub = this.ctx.createOscillator();
            sub.type = 'sine';
            sub.frequency.setValueAtTime(90, now);
            sub.frequency.exponentialRampToValueAtTime(45, now + 0.25);
            const subGain = this.ctx.createGain();
            subGain.gain.setValueAtTime(0.85 * intensity, now);
            subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
            sub.connect(subGain);
            subGain.connect(this.master);
            sub.start(now);
            sub.stop(now + 0.4);

            const rumbleDur = 2.2;
            const bufferSize = Math.floor(this.ctx.sampleRate * rumbleDur);
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            let b0 = 0;
            let b1 = 0;
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                b0 = 0.98 * b0 + white * 0.05;
                b1 = 0.95 * b1 + b0 * 0.08;
                const env = Math.exp(-i / (this.ctx.sampleRate * 0.7));
                data[i] = b1 * env * 2.4;
            }

            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer;
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(1800 * intensity, now);
            filter.frequency.exponentialRampToValueAtTime(70, now + rumbleDur);

            const noiseGain = this.ctx.createGain();
            noiseGain.gain.setValueAtTime(0.82 * intensity, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, now + rumbleDur);

            noise.connect(filter);
            filter.connect(noiseGain);
            noiseGain.connect(this.master);
            noiseGain.connect(this.reverb);
            noise.start(now);
        }

        playMegaBassDrop(intensity = 1.0) {
            if (!this.unlocked) return;
            const now = this.ctx.currentTime;
            if (this.lastBassDropTime && now - this.lastBassDropTime < 2.5) return;
            this.lastBassDropTime = now;

            const dur = 2.4;
            const subOsc = this.ctx.createOscillator();
            subOsc.type = 'sine';
            subOsc.frequency.setValueAtTime(130, now);
            subOsc.frequency.exponentialRampToValueAtTime(26, now + 1.6);
            subOsc.frequency.linearRampToValueAtTime(18, now + dur);

            const subOsc2 = this.ctx.createOscillator();
            subOsc2.type = 'triangle';
            subOsc2.frequency.setValueAtTime(134, now);
            subOsc2.frequency.exponentialRampToValueAtTime(28, now + 1.6);
            subOsc2.frequency.linearRampToValueAtTime(19, now + dur);

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(380, now);
            filter.frequency.exponentialRampToValueAtTime(42, now + 1.5);
            filter.Q.value = 5.5;

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.01, now);
            gain.gain.linearRampToValueAtTime(0.7 * intensity, now + 0.06);
            gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

            subOsc.connect(filter);
            subOsc2.connect(filter);
            filter.connect(gain);
            gain.connect(this.master);

            subOsc.start(now);
            subOsc2.start(now);
            subOsc.stop(now + dur + 0.05);
            subOsc2.stop(now + dur + 0.05);
        }

        playMassEffectSwell(duration = 5.5) {
            if (!this.unlocked) return;
            const now = this.ctx.currentTime;

            const oscA = this.ctx.createOscillator();
            const oscB = this.ctx.createOscillator();
            oscA.type = 'sawtooth';
            oscB.type = 'sine';

            oscA.frequency.setValueAtTime(45, now);
            oscA.frequency.exponentialRampToValueAtTime(260, now + duration);
            oscB.frequency.setValueAtTime(90, now);
            oscB.frequency.exponentialRampToValueAtTime(520, now + duration);

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(140, now);
            filter.frequency.exponentialRampToValueAtTime(2200, now + duration);
            filter.Q.value = 6;

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.001, now);
            gain.gain.linearRampToValueAtTime(0.3, now + duration * 0.82);
            gain.gain.exponentialRampToValueAtTime(0.001, now + duration + 0.3);

            oscA.connect(filter);
            oscB.connect(filter);
            filter.connect(gain);
            gain.connect(this.master);
            gain.connect(this.reverb);

            oscA.start(now);
            oscB.start(now);
            oscA.stop(now + duration + 0.35);
            oscB.stop(now + duration + 0.35);
        }

        playElectricArc(duration = 0.32) {
            if (!this.unlocked) return;
            const now = this.ctx.currentTime;

            const carrier = this.ctx.createOscillator();
            const mod = this.ctx.createOscillator();
            const modGain = this.ctx.createGain();

            carrier.type = 'sawtooth';
            carrier.frequency.setValueAtTime(140 + Math.random() * 120, now);
            mod.type = 'square';
            mod.frequency.setValueAtTime(48 + Math.random() * 40, now);
            modGain.gain.value = 320;

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 1800;
            filter.Q.value = 1.8;

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

            mod.connect(modGain);
            modGain.connect(carrier.frequency);
            carrier.connect(filter);
            filter.connect(gain);
            gain.connect(this.master);
            gain.connect(this.reverb);

            mod.start(now);
            carrier.start(now);
            mod.stop(now + duration + 0.02);
            carrier.stop(now + duration + 0.02);
        }

        playScreenShatter() {
            if (!this.unlocked) return;
            const now = this.ctx.currentTime;
            this.playExplosion(1.25);

            for (let i = 0; i < 14; i++) {
                const delay = i * 0.028 + Math.random() * 0.02;
                const osc = this.ctx.createOscillator();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(2200 + Math.random() * 4200, now + delay);
                osc.frequency.exponentialRampToValueAtTime(900 + Math.random() * 600, now + delay + 0.14);

                const gain = this.ctx.createGain();
                gain.gain.setValueAtTime(0.14, now + delay);
                gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.16);

                osc.connect(gain);
                gain.connect(this.reverb);
                osc.start(now + delay);
                osc.stop(now + delay + 0.18);
            }
        }

        speakDoom(text) {
            if (this.unlocked) {
                const now = this.ctx.currentTime;
                const dur = Math.max(2.2, text.length * 0.075);

                const sub1 = this.ctx.createOscillator();
                const sub2 = this.ctx.createOscillator();
                sub1.type = 'sawtooth';
                sub2.type = 'triangle';
                sub1.frequency.setValueAtTime(56, now);
                sub1.frequency.linearRampToValueAtTime(48, now + dur);
                sub2.frequency.setValueAtTime(84, now);
                sub2.frequency.linearRampToValueAtTime(72, now + dur);

                const formant = this.ctx.createBiquadFilter();
                formant.type = 'lowpass';
                formant.frequency.setValueAtTime(240, now);
                formant.Q.value = 5.5;

                const g = this.ctx.createGain();
                g.gain.setValueAtTime(0.001, now);
                g.gain.linearRampToValueAtTime(0.26, now + 0.18);
                g.gain.setValueAtTime(0.22, now + dur - 0.35);
                g.gain.exponentialRampToValueAtTime(0.001, now + dur);

                sub1.connect(formant);
                sub2.connect(formant);
                formant.connect(g);
                g.connect(this.master);
                g.connect(this.reverb);

                sub1.start(now);
                sub2.start(now);
                sub1.stop(now + dur + 0.05);
                sub2.stop(now + dur + 0.05);
            }

            if ('speechSynthesis' in window) {
                try {
                    window.speechSynthesis.cancel();
                    const utter = new SpeechSynthesisUtterance(text);
                    utter.pitch = 0.12;
                    utter.rate = 0.78;
                    utter.volume = 0.95;

                    const preferred =
                        this.voices.find((v) => /david|mark|george|daniel|male/i.test(v.name) && /en/i.test(v.lang)) ||
                        this.voices.find((v) => /en/i.test(v.lang));
                    if (preferred) utter.voice = preferred;
                    window.speechSynthesis.speak(utter);
                } catch (_) { }
            }
        }

        stopSpeech() {
            if ('speechSynthesis' in window) {
                try {
                    window.speechSynthesis.cancel();
                } catch (_) { }
            }
        }
    }

    // -------------------------------------------------------------------------
    // 2. VFX Primitives: Lightning, Shrapnel, Mushroom Cloud, Particles, Shake
    // -------------------------------------------------------------------------
    function createLightningBolt(x1, y1, x2, y2, displace = 90, minSeg = 8, branchProb = 0.28) {
        const segments = [];
        function subdivide(ax, ay, bx, by, disp, depth) {
            const dx = bx - ax;
            const dy = by - ay;
            const dist = Math.hypot(dx, dy);
            if (dist < minSeg || depth > 7) {
                segments.push({ x1: ax, y1: ay, x2: bx, y2: by, depth });
                return;
            }
            const mx = (ax + bx) * 0.5 + (Math.random() - 0.5) * disp;
            const my = (ay + by) * 0.5 + (Math.random() - 0.5) * disp * 0.65;

            subdivide(ax, ay, mx, my, disp * 0.54, depth + 1);
            subdivide(mx, my, bx, by, disp * 0.54, depth + 1);

            if (depth >= 1 && depth <= 4 && Math.random() < branchProb) {
                const angle = Math.atan2(dy, dx) + (Math.random() > 0.5 ? 1 : -1) * (0.35 + Math.random() * 0.55);
                const len = dist * (0.35 + Math.random() * 0.3);
                subdivide(mx, my, mx + Math.cos(angle) * len, my + Math.sin(angle) * len, disp * 0.42, depth + 2);
            }
        }
        subdivide(x1, y1, x2, y2, displace, 0);
        return segments;
    }

    function drawLightningBolt(ctx, segments, opts = {}) {
        const { coreColor = '#ffffff', glowColor = '#7de8ff', alpha = 1, baseWidth = 3.2 } = opts;
        if (!segments || !segments.length || alpha <= 0.01) return;
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalCompositeOperation = 'lighter';

        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 24;
        ctx.strokeStyle = glowColor;
        ctx.globalAlpha = alpha * 0.55;
        ctx.lineWidth = baseWidth * 2.8;
        ctx.beginPath();
        for (const s of segments) {
            if (s.depth > 4) continue;
            ctx.moveTo(s.x1, s.y1);
            ctx.lineTo(s.x2, s.y2);
        }
        ctx.stroke();

        ctx.shadowBlur = 10;
        ctx.strokeStyle = coreColor;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = baseWidth;
        ctx.beginPath();
        for (const s of segments) {
            ctx.moveTo(s.x1, s.y1);
            ctx.lineTo(s.x2, s.y2);
        }
        ctx.stroke();
        ctx.restore();
    }

    class Shrapnel {
        constructor(x, y, vx, vy) {
            this.x = x;
            this.y = y;
            this.vx = vx;
            this.vy = vy;
            this.trail = [];
            this.life = 1.0;
            this.decay = 0.012 + Math.random() * 0.015;
            this.size = 2.0 + Math.random() * 2.5;
            this.dead = false;
        }

        update(dtFactor = 1) {
            this.trail.push({ x: this.x, y: this.y, alpha: this.life });
            if (this.trail.length > 8) this.trail.shift();

            this.vy += 0.28 * dtFactor;
            this.vx *= Math.pow(0.985, dtFactor);
            this.vy *= Math.pow(0.985, dtFactor);
            this.x += this.vx * dtFactor;
            this.y += this.vy * dtFactor;

            this.life -= this.decay * dtFactor;
            if (this.life <= 0) this.dead = true;
        }

        draw(ctx) {
            if (this.dead) return;
            ctx.save();
            ctx.strokeStyle = `rgba(255, 120, 20, ${this.life * 0.7})`;
            ctx.lineWidth = this.size * 0.7;
            ctx.beginPath();
            for (let i = 0; i < this.trail.length; i++) {
                const p = this.trail[i];
                if (i === 0) ctx.moveTo(p.x, p.y);
                else ctx.lineTo(p.x, p.y);
            }
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = '#ff6600';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    class MushroomCloud {
        constructor(x, y, scale = 1.0) {
            this.x = x;
            this.y = y;
            this.scale = scale;
            this.age = 0;
            this.maxAge = 160;
            this.dead = false;

            this.nodes = [];
            for (let i = 0; i < 36; i++) {
                const angle = (i / 36) * Math.PI * 2;
                const dist = 5 + Math.random() * 15;
                this.nodes.push({
                    relX: Math.cos(angle) * dist,
                    relY: Math.sin(angle) * dist * 0.6,
                    vx: Math.cos(angle) * (1.2 + Math.random() * 2.2),
                    vy: -2.8 - Math.random() * 3.5,
                    size: 18 + Math.random() * 22,
                    growth: 0.6 + Math.random() * 0.5
                });
            }

            this.stemNodes = [];
            for (let s = 0; s < 18; s++) {
                this.stemNodes.push({
                    relX: (Math.random() - 0.5) * 20,
                    relY: -s * 8,
                    vy: -1.2 - Math.random() * 1.5,
                    size: 14 + Math.random() * 16,
                    growth: 0.35
                });
            }

            this.surgeNodes = [];
            for (let g = 0; g < 24; g++) {
                const dir = g % 2 === 0 ? 1 : -1;
                this.surgeNodes.push({
                    x: (Math.random() - 0.5) * 20,
                    y: (Math.random() - 0.5) * 10,
                    vx: dir * (3.5 + Math.random() * 6.5),
                    vy: -0.2 - Math.random() * 0.8,
                    size: 14 + Math.random() * 18,
                    growth: 0.45
                });
            }
        }

        update(dtFactor = 1) {
            this.age += dtFactor;
            for (const node of this.nodes) {
                node.relX += node.vx * dtFactor;
                node.relY += node.vy * dtFactor;
                node.vy *= Math.pow(0.97, dtFactor);
                node.vx *= Math.pow(0.975, dtFactor);
                node.size += node.growth * dtFactor;
                node.growth *= Math.pow(0.98, dtFactor);
                if (Math.abs(node.relX) > 40) node.vy += 0.05 * dtFactor;
            }
            for (const s of this.stemNodes) {
                s.relY += s.vy * dtFactor;
                s.size += s.growth * dtFactor;
            }
            for (const g of this.surgeNodes) {
                g.x += g.vx * dtFactor;
                g.y += g.vy * dtFactor;
                g.vx *= Math.pow(0.96, dtFactor);
                g.size += g.growth * dtFactor;
            }
            if (this.age >= this.maxAge) this.dead = true;
        }

        draw(ctx) {
            if (this.dead) return;
            ctx.save();
            ctx.translate(this.x, this.y);

            const progress = this.age / this.maxAge;
            let fillStyle;
            let shadowCol;

            if (progress < 0.12) {
                fillStyle = 'rgba(255, 255, 230, 0.95)';
                shadowCol = '#ffaa00';
            } else if (progress < 0.35) {
                const p = (progress - 0.12) / 0.23;
                const alpha = 0.9 - p * 0.15;
                fillStyle = `rgba(${Math.floor(255 - p * 30)}, ${Math.floor(130 - p * 80)}, 20, ${alpha})`;
                shadowCol = '#ff3300';
            } else if (progress < 0.65) {
                const p = (progress - 0.35) / 0.3;
                const alpha = 0.85 - p * 0.35;
                const val = Math.floor(60 - p * 35);
                fillStyle = `rgba(${val + 20}, ${val + 5}, ${val}, ${alpha})`;
                shadowCol = '#221105';
            } else {
                const p = (progress - 0.65) / 0.35;
                const alpha = (1.0 - p) * 0.5;
                fillStyle = `rgba(20, 20, 22, ${alpha})`;
                shadowCol = 'transparent';
            }

            ctx.fillStyle = fillStyle;
            ctx.shadowColor = shadowCol;
            ctx.shadowBlur = progress < 0.4 ? 15 : 0;

            ctx.beginPath();
            for (const s of this.stemNodes) {
                const sr = Math.max(1, s.size * this.scale);
                ctx.moveTo(s.relX + sr, s.relY);
                ctx.arc(s.relX, s.relY, sr, 0, Math.PI * 2);
            }
            ctx.fill();

            ctx.beginPath();
            for (const node of this.nodes) {
                const nr = Math.max(1, node.size * this.scale);
                ctx.moveTo(node.relX * this.scale + nr, node.relY * this.scale);
                ctx.arc(node.relX * this.scale, node.relY * this.scale, nr, 0, Math.PI * 2);
            }
            ctx.fill();

            ctx.fillStyle = `rgba(50, 45, 40, ${Math.max(0, (1 - progress) * 0.6)})`;
            ctx.shadowBlur = 0;
            ctx.beginPath();
            for (const g of this.surgeNodes) {
                const gr = Math.max(1, g.size * this.scale);
                ctx.moveTo(g.x * this.scale + gr, g.y * this.scale);
                ctx.arc(g.x * this.scale, g.y * this.scale, gr, 0, Math.PI * 2);
            }
            ctx.fill();

            if (progress < 0.3) {
                const coreR = Math.max(10, 70 * this.scale);
                const coreGrad = ctx.createRadialGradient(0, -25 * this.scale, 2, 0, -25 * this.scale, coreR);
                coreGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
                coreGrad.addColorStop(0.4, 'rgba(255, 200, 50, 0.8)');
                coreGrad.addColorStop(0.8, 'rgba(255, 80, 0, 0.4)');
                coreGrad.addColorStop(1, 'transparent');
                ctx.fillStyle = coreGrad;
                ctx.beginPath();
                ctx.arc(0, -25 * this.scale, coreR, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
    }

    class ParticleSystem {
        constructor() {
            this.particles = [];
            this.shockwaves = [];
            this.mushroomClouds = [];
            this.shrapnels = [];
        }

        clear() {
            this.particles.length = 0;
            this.shockwaves.length = 0;
            this.mushroomClouds.length = 0;
            this.shrapnels.length = 0;
        }

        spawnMissileSmoke(x, y, missileAngle) {
            const backAngle = missileAngle + Math.PI + (Math.random() - 0.5) * 0.35;
            const ejectSpeed = 1.5 + Math.random() * 3.0;
            const isFireCore = Math.random() < 0.25;

            this.particles.push({
                x,
                y,
                vx: Math.cos(backAngle) * ejectSpeed + (Math.random() - 0.5) * 1.2,
                vy: Math.sin(backAngle) * ejectSpeed + (Math.random() - 0.5) * 1.2,
                size: isFireCore ? 8 + Math.random() * 6 : 12 + Math.random() * 14,
                life: 1,
                alpha: isFireCore ? 0.95 : 0.8,
                decay: 0.007 + Math.random() * 0.008,
                gravity: 0,
                drag: 0.96,
                colorPrefix: isFireCore ? 'rgba(255, 160, 40,' : 'rgba(55, 60, 65,'
            });
        }

        spawnRealisticDetonation(x, y, intensity = 1.0) {
            this.mushroomClouds.push(new MushroomCloud(x, y, intensity));

            const shrapnelCount = Math.floor(34 * intensity);
            for (let i = 0; i < shrapnelCount; i++) {
                const angle = -Math.PI * 0.5 + (Math.random() - 0.5) * Math.PI * 0.9;
                const speed = 8 + Math.random() * 20 * intensity;
                this.shrapnels.push(
                    new Shrapnel(
                        x + (Math.random() - 0.5) * 10,
                        y - 5,
                        Math.cos(angle) * speed,
                        Math.sin(angle) * speed
                    )
                );
            }

            this.shockwaves.push({
                x,
                y,
                radius: 8,
                maxRadius: 380 * intensity,
                alpha: 0.95,
                speed: 18 + Math.random() * 6,
                lineWidth: 8,
                color: '#fff5dd'
            });

            this.shockwaves.push({
                x,
                y,
                radius: 4,
                maxRadius: 260 * intensity,
                alpha: 0.8,
                speed: 11,
                lineWidth: 12,
                color: '#aa8866'
            });
        }

        update(dtFactor = 1, pullCenter = null, pullStrength = 0) {
            for (let i = this.mushroomClouds.length - 1; i >= 0; i--) {
                const mc = this.mushroomClouds[i];
                mc.update(dtFactor);
                if (mc.dead) this.mushroomClouds.splice(i, 1);
            }
            for (let i = this.shrapnels.length - 1; i >= 0; i--) {
                const sh = this.shrapnels[i];
                sh.update(dtFactor);
                if (sh.dead) this.shrapnels.splice(i, 1);
            }
            for (let i = this.shockwaves.length - 1; i >= 0; i--) {
                const sw = this.shockwaves[i];
                sw.radius += sw.speed * dtFactor;
                sw.alpha -= 0.028 * dtFactor;
                sw.lineWidth = Math.max(0.5, sw.lineWidth * Math.pow(0.96, dtFactor));
                if (sw.alpha <= 0 || sw.radius >= sw.maxRadius) {
                    this.shockwaves.splice(i, 1);
                }
            }
            for (let i = this.particles.length - 1; i >= 0; i--) {
                const p = this.particles[i];
                if (pullCenter && pullStrength > 0) {
                    const dx = pullCenter.x - p.x;
                    const dy = pullCenter.y - p.y;
                    const dist = Math.max(25, Math.hypot(dx, dy));
                    const force = (pullStrength * 140) / dist;
                    p.vx += ((dx / dist) * force - (dy / dist) * force * 0.75) * dtFactor;
                    p.vy += ((dy / dist) * force + (dx / dist) * force * 0.75) * dtFactor;
                }
                p.vx *= Math.pow(p.drag, dtFactor);
                p.vy = p.vy * Math.pow(p.drag, dtFactor) + p.gravity * dtFactor;
                p.x += p.vx * dtFactor;
                p.y += p.vy * dtFactor;
                p.size += 0.45 * dtFactor;
                p.life -= p.decay * dtFactor;
                if (p.life <= 0) this.particles.splice(i, 1);
            }
        }

        draw(ctx) {
            for (const mc of this.mushroomClouds) mc.draw(ctx);
            for (const p of this.particles) {
                const alpha = Math.max(0, p.life * p.alpha);
                ctx.save();
                ctx.fillStyle = p.colorPrefix + alpha + ')';
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
            for (const sh of this.shrapnels) sh.draw(ctx);
            for (const sw of this.shockwaves) {
                ctx.save();
                ctx.globalAlpha = Math.max(0, sw.alpha);
                ctx.strokeStyle = sw.color;
                ctx.lineWidth = sw.lineWidth;
                ctx.shadowColor = sw.color;
                ctx.shadowBlur = 20;
                ctx.beginPath();
                ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }
        }
    }

    class CameraShake {
        constructor() {
            this.trauma = 0;
        }
        add(amount) {
            this.trauma = Math.min(1, this.trauma + amount);
        }
        update(dt) {
            this.trauma = Math.max(0, this.trauma - dt * 1.35);
        }
        getOffset() {
            const shake = this.trauma * this.trauma;
            return {
                x: (Math.random() * 2 - 1) * 24 * shake,
                y: (Math.random() * 2 - 1) * 18 * shake
            };
        }
    }

    // -------------------------------------------------------------------------
    // 3. Missiles, Storm & Mass Breach Scene
    // -------------------------------------------------------------------------
    class Missile {
        constructor(startX, startY, targetX, targetY, options = {}) {
            this.startX = startX;
            this.startY = startY;
            this.targetX = targetX;
            this.targetY = targetY;
            this.x = startX;
            this.y = startY;
            this.type = options.type || 'hypersonic';
            this.progress = 0;
            this.baseSpeed = options.speed || (this.type === 'hypersonic' ? 0.014 : 0.009);
            this.accel = options.accel || 1.025;
            this.arcHeight = options.arcHeight || (this.type === 'hypersonic' ? 80 : 260);
            this.dead = false;
            this.onDetonate = options.onDetonate || null;
            this.prevX = startX;
            this.prevY = startY;
            this.angle = 0;
            this.machTime = 0;
        }

        update(particles, dtFactor = 1) {
            if (this.dead) return;
            this.baseSpeed *= Math.pow(this.accel, dtFactor);
            this.progress += this.baseSpeed * dtFactor;
            this.machTime += 0.35 * dtFactor;

            const p = Math.min(1.0, this.progress);
            const invP = 1 - p;

            const ctrlX = this.type === 'hypersonic'
                ? this.startX + (this.targetX - this.startX) * 0.2
                : (this.startX + this.targetX) / 2;
            const ctrlY = Math.min(this.startY, this.targetY) - this.arcHeight;

            this.prevX = this.x;
            this.prevY = this.y;

            this.x = invP * invP * this.startX + 2 * invP * p * ctrlX + p * p * this.targetX;
            this.y = invP * invP * this.startY + 2 * invP * p * ctrlY + p * p * this.targetY;
            this.angle = Math.atan2(this.y - this.prevY, this.x - this.prevX);

            if (particles) {
                particles.spawnMissileSmoke(this.x, this.y, this.angle);
                particles.spawnMissileSmoke((this.x + this.prevX) * 0.5, (this.y + this.prevY) * 0.5, this.angle);
            }

            if (this.progress >= 1.0) {
                this.dead = true;
                if (this.onDetonate) this.onDetonate(this.targetX, this.targetY);
            }
        }

        draw(ctx) {
            if (this.dead) return;
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.angle);

            ctx.save();
            ctx.fillStyle = 'rgba(230, 245, 255, 0.18)';
            ctx.beginPath();
            ctx.moveTo(14, 0);
            ctx.lineTo(-18, -14);
            ctx.lineTo(-24, 0);
            ctx.lineTo(-18, 14);
            ctx.closePath();
            ctx.fill();
            ctx.restore();

            ctx.save();
            const exhaustLen = 28 + Math.sin(this.machTime * 2) * 6;
            const flameGrad = ctx.createLinearGradient(-16, 0, -16 - exhaustLen, 0);
            flameGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
            flameGrad.addColorStop(0.3, 'rgba(255, 170, 30, 0.9)');
            flameGrad.addColorStop(0.7, 'rgba(255, 60, 0, 0.6)');
            flameGrad.addColorStop(1, 'transparent');

            ctx.fillStyle = flameGrad;
            ctx.shadowColor = '#ff5500';
            ctx.shadowBlur = 20;
            ctx.beginPath();
            ctx.moveTo(-16, -4);
            ctx.lineTo(-16 - exhaustLen, 0);
            ctx.lineTo(-16, 4);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = '#ffeedd';
            ctx.shadowBlur = 8;
            for (const dx of [-20, -26, -32]) {
                ctx.beginPath();
                ctx.moveTo(dx + 2, 0);
                ctx.lineTo(dx, -2);
                ctx.lineTo(dx - 2, 0);
                ctx.lineTo(dx, 2);
                ctx.closePath();
                ctx.fill();
            }
            ctx.restore();

            const bodyGrad = ctx.createLinearGradient(0, -5, 0, 5);
            bodyGrad.addColorStop(0, '#758287');
            bodyGrad.addColorStop(0.4, '#a2b0b5');
            bodyGrad.addColorStop(0.7, '#434b4e');
            bodyGrad.addColorStop(1, '#272d30');

            ctx.fillStyle = bodyGrad;
            ctx.beginPath();
            ctx.moveTo(18, 0);
            ctx.bezierCurveTo(12, -4.5, 4, -5, -16, -5);
            ctx.lineTo(-16, 5);
            ctx.bezierCurveTo(4, 5, 12, 4.5, 18, 0);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = '#ffaa00';
            ctx.fillRect(0, -4.8, 4, 9.6);
            ctx.fillStyle = '#111';
            ctx.fillRect(4, -4.8, 3, 9.6);

            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = '#ff6600';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.moveTo(18, 0);
            ctx.lineTo(13, -2.5);
            ctx.lineTo(13, 2.5);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = '#374145';
            ctx.beginPath();
            ctx.moveTo(-10, -5);
            ctx.lineTo(-16, -12);
            ctx.lineTo(-16, -5);
            ctx.closePath();
            ctx.fill();

            ctx.beginPath();
            ctx.moveTo(-10, 5);
            ctx.lineTo(-16, 12);
            ctx.lineTo(-16, 5);
            ctx.closePath();
            ctx.fill();

            ctx.restore();
        }
    }

    class StormAndMissilesScene {
        constructor(particles, shake, audio, triggerFlash) {
            this.particles = particles;
            this.shake = shake;
            this.audio = audio;
            this.triggerFlash = triggerFlash;

            this.rain = [];
            this.missiles = [];
            this.bolts = [];
            this.suckedDebris = [];

            this.lightningFlash = 0;
            this.nextLightningTimer = 0.6;
            this.salvoTimer = 0.3;
            this.volleyCount = 0;
            this.clusterImpactCount = 0;
            this.finalSwarmLaunched = false;
            this.massSwellPlayed = false;
            this.breachFlashPlayed = false;

            this.width = 0;
            this.height = 0;

            this.cycloneRays = Array.from({ length: 22 }, () => ({
                angle: Math.random() * Math.PI * 2,
                speed: 0.15 + Math.random() * 0.55,
                spread: 0.025 + Math.random() * 0.09,
                lenScale: 0.55 + Math.random() * 1.15,
                phase: Math.random() * Math.PI * 2,
                flickerSpeed: 2.5 + Math.random() * 6
            }));
        }

        resize(w, h) {
            this.width = w;
            this.height = h;
            this.rain = Array.from({ length: 160 }, () => ({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                len: 14 + Math.random() * 18,
                speed: 18 + Math.random() * 14
            }));
        }

        reset() {
            this.missiles.length = 0;
            this.bolts.length = 0;
            this.suckedDebris.length = 0;
            this.lightningFlash = 0;
            this.nextLightningTimer = 0.4;
            this.salvoTimer = 0.25;
            this.volleyCount = 0;
            this.clusterImpactCount = 0;
            this.finalSwarmLaunched = false;
            this.massSwellPlayed = false;
            this.breachFlashPlayed = false;
        }

        _spawnLightning(isGreen = false) {
            const startX = this.width * (0.12 + Math.random() * 0.76);
            const endX = startX + (Math.random() - 0.5) * 260;
            const endY = this.height * (0.62 + Math.random() * 0.26);
            const segments = createLightningBolt(startX, -10, endX, endY, 105, 8, 0.32);

            this.bolts.push({ segments, life: 1, flicker: 0, isGreen });
            this.lightningFlash = Math.max(this.lightningFlash, isGreen ? 0.95 : 0.75);
            this.shake.add(isGreen ? 0.35 : 0.2);
            this.audio.playThunder(0.75 + Math.random() * 0.3);
        }

        _spawnHypersonicSalvo(count = 2) {
            for (let i = 0; i < count; i++) {
                setTimeout(() => {
                    if (!this.width) return;
                    const startX = this.width * (0.15 + Math.random() * 0.7);
                    const startY = -40;
                    const targetX = startX + (Math.random() - 0.5) * this.width * 0.35;
                    const targetY = this.height * (0.76 + Math.random() * 0.16);

                    this.audio.playMissileLaunch('hypersonic');
                    this.missiles.push(
                        new Missile(startX, startY, targetX, targetY, {
                            type: 'hypersonic',
                            speed: 0.016 + Math.random() * 0.008,
                            accel: 1.03,
                            arcHeight: 60 + Math.random() * 60,
                            onDetonate: (x, y) => this._onImpact(x, y, 1.2)
                        })
                    );
                }, i * (220 + Math.random() * 200));
            }
        }

        _spawnCruiseSalvo(count = 1) {
            for (let i = 0; i < count; i++) {
                setTimeout(() => {
                    if (!this.width) return;
                    const fromLeft = Math.random() > 0.5;
                    const startX = fromLeft ? -60 : this.width + 60;
                    const startY = this.height * (0.2 + Math.random() * 0.25);
                    const targetX = this.width * (0.2 + Math.random() * 0.6);
                    const targetY = this.height * (0.78 + Math.random() * 0.14);

                    this.audio.playMissileLaunch('cruise');
                    this.missiles.push(
                        new Missile(startX, startY, targetX, targetY, {
                            type: 'cruise',
                            speed: 0.009 + Math.random() * 0.004,
                            accel: 1.018,
                            arcHeight: 200 + Math.random() * 140,
                            onDetonate: (x, y) => this._onImpact(x, y, 1.05)
                        })
                    );
                }, i * (280 + Math.random() * 240));
            }
        }

        _spawnFinalSwarm(count = 7) {
            const hypersonicCount = Math.max(4, count - 2);
            for (let i = 0; i < hypersonicCount; i++) {
                setTimeout(() => {
                    if (!this.width) return;
                    const lane = (i + 0.5) / hypersonicCount;
                    const startX = this.width * (0.1 + lane * 0.8) + (Math.random() - 0.5) * 40;
                    const startY = -45;
                    const targetX = this.width * (0.15 + lane * 0.7) + (Math.random() - 0.5) * 60;
                    const targetY = this.height * (0.72 + Math.random() * 0.18);

                    this.audio.playMissileLaunch('hypersonic');
                    this.missiles.push(
                        new Missile(startX, startY, targetX, targetY, {
                            type: 'hypersonic',
                            speed: 0.018 + Math.random() * 0.005,
                            accel: 1.032,
                            arcHeight: 50 + Math.random() * 45,
                            onDetonate: (x, y) => this._onImpact(x, y, 1.35)
                        })
                    );
                }, i * 55);
            }

            for (let side = 0; side < 2; side++) {
                setTimeout(() => {
                    if (!this.width) return;
                    const fromLeft = side === 0;
                    const startX = fromLeft ? -60 : this.width + 60;
                    const startY = this.height * (0.22 + Math.random() * 0.16);
                    const targetX = this.width * (fromLeft ? 0.36 : 0.64) + (Math.random() - 0.5) * 70;
                    const targetY = this.height * (0.76 + Math.random() * 0.12);

                    this.audio.playMissileLaunch('cruise');
                    this.missiles.push(
                        new Missile(startX, startY, targetX, targetY, {
                            type: 'cruise',
                            speed: 0.013 + Math.random() * 0.003,
                            accel: 1.024,
                            arcHeight: 170 + Math.random() * 80,
                            onDetonate: (x, y) => this._onImpact(x, y, 1.25)
                        })
                    );
                }, side * 80 + 40);
            }
        }

        _onImpact(x, y, intensity = 1.0) {
            this.clusterImpactCount++;
            if (this.triggerFlash) this.triggerFlash(0.65, 75);
            this.particles.spawnRealisticDetonation(x, y, intensity);
            this.audio.playExplosion(intensity);
            this.shake.add(0.65);

            if (this.missiles.length <= 2 && this.clusterImpactCount >= 2) {
                const bassIntensity = Math.min(2.0, 1.0 + (this.clusterImpactCount - 2) * 0.3);
                setTimeout(() => this.audio.playMegaBassDrop(bassIntensity), 160);
                this.clusterImpactCount = 0;
            }
        }

        update(dt, stage, stageElapsed, progress = 0) {
            const dtFactor = Math.min(2.5, dt * 60);
            this.lightningFlash = Math.max(0, this.lightningFlash - dt * 2.8);

            const cx = this.width * 0.5;
            const cy = this.height * 0.45;
            const isMass = stage === 'mass';
            const massPull = isMass ? Math.min(1, stageElapsed / 5.5) : 0;

            for (const r of this.rain) {
                if (massPull > 0.15) {
                    const dx = cx - r.x;
                    const dy = cy - r.y;
                    const dist = Math.max(30, Math.hypot(dx, dy));
                    r.x += ((dx / dist) * 18 * massPull - (dy / dist) * 10 * massPull) * dtFactor;
                    r.y += ((dy / dist) * 18 * massPull + (dx / dist) * 10 * massPull) * dtFactor;
                    if (dist < 36) {
                        r.x = Math.random() * this.width;
                        r.y = Math.random() > 0.5 ? 0 : this.height;
                    }
                } else {
                    r.x -= 3.5 * dtFactor;
                    r.y += r.speed * dtFactor;
                    if (r.y > this.height) {
                        r.y = -20;
                        r.x = Math.random() * (this.width + 100);
                    }
                }
            }

            // Lightning
            if (stage !== 'few_missiles') {
                this.nextLightningTimer -= dt;
                if (this.nextLightningTimer <= 0) {
                    this._spawnLightning(stage === 'mass' || stage === 'doom');
                    this.nextLightningTimer = stage === 'mass'
                        ? 0.55 + Math.random() * 0.75
                        : 1.0 + Math.random() * 1.4;
                }
            }

            for (let i = this.bolts.length - 1; i >= 0; i--) {
                const b = this.bolts[i];
                b.life -= dt * 2.4;
                b.flicker += dt * 40;
                if (b.life <= 0) this.bolts.splice(i, 1);
            }

            // Missile salvos scaled by stage
            if (stage === 'few_missiles') {
                this.salvoTimer -= dt;
                if (this.salvoTimer <= 0) {
                    this.volleyCount++;
                    if (this.volleyCount % 2 === 1) {
                        this._spawnHypersonicSalvo(1 + (Math.random() > 0.65 ? 1 : 0));
                    } else {
                        this._spawnCruiseSalvo(1);
                    }
                    this.salvoTimer = 4.2 + Math.random() * 1.4;
                }
            } else if (stage === 'more_missiles') {
                if (progress >= 0.99 && !this.finalSwarmLaunched) {
                    this.finalSwarmLaunched = true;
                    this._spawnFinalSwarm(10);
                    this.salvoTimer = 2.6;
                } else {
                    this.salvoTimer -= dt;
                    if (this.salvoTimer <= 0) {
                        this.volleyCount++;
                        if (this.volleyCount % 2 === 1) {
                            this._spawnHypersonicSalvo(2 + Math.floor(Math.random() * 2));
                        } else {
                            this._spawnCruiseSalvo(2);
                        }
                        this.salvoTimer = 2.0 + Math.random() * 0.6;
                    }
                }
            } else if (stage === 'mass' && stageElapsed < 2.5) {
                this.salvoTimer -= dt;
                if (this.salvoTimer <= 0) {
                    this.volleyCount++;
                    this._spawnHypersonicSalvo(2);
                    this.salvoTimer = 1.8;
                }
            }

            for (let i = this.missiles.length - 1; i >= 0; i--) {
                const m = this.missiles[i];
                m.update(this.particles, dtFactor);
                if (m.dead) this.missiles.splice(i, 1);
            }

            if (stage === 'mass' && !this.massSwellPlayed) {
                this.massSwellPlayed = true;
                this.audio.playMassEffectSwell(5.5);
            }
            if (stage === 'mass' && stageElapsed > 4.8 && !this.breachFlashPlayed) {
                this.breachFlashPlayed = true;
                this.lightningFlash = 1.0;
                this.shake.add(0.95);
                this.audio.playExplosion(1.25);
                this.audio.playMegaBassDrop(1.7);
            }

            if (stage === 'mass') {
                const progress = Math.max(0, Math.min(1, stageElapsed / 5.5));
                const targetCount = Math.floor(26 + progress * 46);
                while (this.suckedDebris.length < targetCount) {
                    const angle = Math.random() * Math.PI * 2;
                    const maxDist = Math.hypot(this.width, this.height) * 0.58;
                    const dist = maxDist * (0.45 + Math.random() * 0.55);
                    const isSquare = Math.random() > 0.5;
                    const w = 7 + Math.random() * 24;
                    const h = isSquare ? w : 5 + Math.random() * 20;
                    this.suckedDebris.push({
                        angle,
                        dist,
                        maxDist,
                        w,
                        h,
                        rot: Math.random() * Math.PI * 2,
                        vRot: (Math.random() - 0.5) * 8,
                        speedScale: 0.75 + Math.random() * 0.7,
                        edgeGlow: Math.random() > 0.65
                    });
                }

                for (let i = this.suckedDebris.length - 1; i >= 0; i--) {
                    const d = this.suckedDebris[i];
                    const pullBoost = 1 + (1 - d.dist / d.maxDist) * 2.2;
                    d.angle += (1.5 + 240 / Math.max(45, d.dist)) * (0.45 + progress * 0.85) * dt;
                    d.dist -= (135 + progress * 310) * d.speedScale * pullBoost * dt;
                    d.rot += d.vRot * dt;
                    if (d.dist < 18) this.suckedDebris.splice(i, 1);
                }
            } else if (this.suckedDebris.length > 0) {
                this.suckedDebris.length = 0;
            }
        }

        draw(ctx, totalElapsed, stage, stageElapsed) {
            const w = this.width;
            const h = this.height;
            const isMass = stage === 'mass' || stage === 'doom';

            // Semi-transparent sky overlay so the live webpage shows behind until Void
            if (stage !== 'few_missiles') {
                const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
                if (isMass) {
                    skyGrad.addColorStop(0, 'rgba(3, 8, 6, 0.58)');
                    skyGrad.addColorStop(0.6, 'rgba(10, 31, 22, 0.52)');
                    skyGrad.addColorStop(1, 'rgba(9, 20, 13, 0.68)');
                } else {
                    skyGrad.addColorStop(0, 'rgba(4, 6, 8, 0.36)');
                    skyGrad.addColorStop(0.6, 'rgba(11, 16, 22, 0.28)');
                    skyGrad.addColorStop(1, 'rgba(30, 15, 6, 0.44)');
                }
                ctx.fillStyle = skyGrad;
                ctx.fillRect(0, 0, w, h);
            }

            // Thermal missile glow
            for (const m of this.missiles) {
                if (!isNaN(m.x) && !isNaN(m.y)) {
                    const mLight = ctx.createRadialGradient(m.x, m.y, 4, m.x, m.y, 160);
                    mLight.addColorStop(0, 'rgba(255, 140, 20, 0.28)');
                    mLight.addColorStop(0.5, 'rgba(255, 60, 0, 0.12)');
                    mLight.addColorStop(1, 'transparent');
                    ctx.fillStyle = mLight;
                    ctx.beginPath();
                    ctx.arc(m.x, m.y, 160, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            // Mushroom cloud illumination
            for (const mc of this.particles.mushroomClouds) {
                if (mc.age < 45 && !isNaN(mc.x) && !isNaN(mc.y)) {
                    const glowRad = Math.max(15, (1.0 - mc.age / 45) * 320);
                    const mcLight = ctx.createRadialGradient(mc.x, mc.y, 5, mc.x, mc.y, glowRad);
                    mcLight.addColorStop(0, 'rgba(255, 200, 80, 0.35)');
                    mcLight.addColorStop(0.5, 'rgba(255, 80, 0, 0.15)');
                    mcLight.addColorStop(1, 'transparent');
                    ctx.fillStyle = mcLight;
                    ctx.beginPath();
                    ctx.arc(mc.x, mc.y, glowRad, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            // Lightning flash
            if (this.lightningFlash > 0) {
                ctx.fillStyle = isMass
                    ? `rgba(80, 255, 165, ${this.lightningFlash * 0.25})`
                    : `rgba(180, 240, 255, ${this.lightningFlash * 0.32})`;
                ctx.fillRect(0, 0, w, h);
            }

            // Mass Breach singularity & cyclone
            if (stage === 'mass') {
                const progress = Math.max(0, Math.min(1, stageElapsed / 5.5));
                this._drawMassEffect(ctx, w * 0.5, h * 0.45, progress, totalElapsed);
                this._drawSuckedDebris(ctx, w * 0.5, h * 0.45);
            }

            // Lightning bolts
            for (const b of this.bolts) {
                const flickerAlpha = b.life * (0.65 + 0.35 * Math.sin(b.flicker));
                drawLightningBolt(ctx, b.segments, {
                    coreColor: '#ffffff',
                    glowColor: b.isGreen ? '#22ff88' : '#70d6ff',
                    alpha: flickerAlpha,
                    baseWidth: 3.0
                });
            }

            // Missiles
            for (const m of this.missiles) m.draw(ctx);

            // Rain streaks in more_missiles / mass / doom
            if (stage !== 'few_missiles') {
                ctx.strokeStyle = isMass ? 'rgba(130, 255, 195, 0.28)' : 'rgba(140, 180, 210, 0.22)';
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                for (const r of this.rain) {
                    ctx.moveTo(r.x, r.y);
                    ctx.lineTo(r.x - 4, r.y + r.len);
                }
                ctx.stroke();
            }
        }

        _drawMassEffect(ctx, cx, cy, progress, elapsed) {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.globalCompositeOperation = 'lighter';

            for (const ray of this.cycloneRays) {
                const ang = ray.angle + elapsed * ray.speed + Math.sin(elapsed * 2.1 + ray.phase) * 0.12;
                const flicker = 0.45 + 0.55 * Math.sin(elapsed * ray.flickerSpeed + ray.phase);
                const len = (170 + flicker * 140) * ray.lenScale * (0.35 + progress * 1.45);
                const grad = ctx.createLinearGradient(0, 0, Math.cos(ang) * len, Math.sin(ang) * len);
                grad.addColorStop(0, `rgba(34, 255, 136, ${0.44 * progress * flicker})`);
                grad.addColorStop(0.55, `rgba(120, 255, 220, ${0.14 * progress})`);
                grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(Math.cos(ang - ray.spread) * len, Math.sin(ang - ray.spread) * len);
                ctx.lineTo(Math.cos(ang + ray.spread) * len, Math.sin(ang + ray.spread) * len);
                ctx.closePath();
                ctx.fill();
            }

            const armCount = 6;
            const maxR = Math.max(this.width, this.height) * 0.55 * (0.4 + progress * 0.8);
            for (let a = 0; a < armCount; a++) {
                const baseAngle = (a / armCount) * Math.PI * 2 + elapsed * (1.8 + progress * 2.4);
                ctx.save();
                ctx.strokeStyle = a % 2 === 0
                    ? `rgba(34, 255, 136, ${0.55 * progress})`
                    : `rgba(120, 255, 210, ${0.38 * progress})`;
                ctx.lineWidth = 1.6 + (a % 3) * 0.9;
                ctx.beginPath();

                const steps = 42;
                for (let s = 0; s <= steps; s++) {
                    const t = s / steps;
                    const theta = baseAngle + t * Math.PI * 3.1;
                    const wobble = Math.sin(t * 10 - elapsed * 6 + a) * (12 * (1 - t));
                    const r = Math.max(12, maxR * Math.pow(1 - t, 1.55) + wobble);
                    const px = Math.cos(theta) * r;
                    const py = Math.sin(theta) * r * 0.96;
                    if (s === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.stroke();
                ctx.restore();
            }

            for (let arc = 0; arc < 5; arc++) {
                const startR = (75 + arc * 46) * (0.55 + progress * 0.85);
                const baseTheta = arc * 1.25 + elapsed * (1.3 + arc * 0.28) * (0.8 + progress);
                ctx.save();
                ctx.strokeStyle = `rgba(110, 255, 180, ${(0.5 + (arc % 2) * 0.22) * progress})`;
                ctx.lineWidth = 2.0;
                ctx.setLineDash([28 + arc * 8, 16, 8, 22]);
                ctx.beginPath();
                for (let s = 0; s <= 24; s++) {
                    const t = s / 24;
                    const theta = baseTheta + t * Math.PI * 1.15;
                    const r = startR * (1 - t * 0.32) + Math.sin(t * 6 + elapsed * 4) * 5;
                    const px = Math.cos(theta) * r;
                    const py = Math.sin(theta) * r * 0.96;
                    if (s === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.stroke();
                ctx.restore();
            }

            const coreR = 26 + progress * 48;
            const coreGrad = ctx.createRadialGradient(0, 0, coreR * 0.2, 0, 0, coreR * 1.9);
            coreGrad.addColorStop(0, 'rgba(0, 0, 0, 0.98)');
            coreGrad.addColorStop(0.55, `rgba(34, 255, 136, ${0.85 * progress})`);
            coreGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = coreGrad;
            ctx.beginPath();
            ctx.arc(0, 0, coreR * 1.9, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        _drawSuckedDebris(ctx, cx, cy) {
            if (!this.suckedDebris.length) return;
            ctx.save();
            for (const d of this.suckedDebris) {
                const x = cx + Math.cos(d.angle) * d.dist;
                const y = cy + Math.sin(d.angle) * d.dist * 0.96;
                const shrink = Math.min(1, d.dist / 95);
                const alpha = Math.min(0.95, shrink * 1.15);

                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(d.rot);
                ctx.scale(shrink, shrink);
                ctx.globalAlpha = alpha;

                ctx.fillStyle = '#050708';
                ctx.fillRect(-d.w * 0.5, -d.h * 0.5, d.w, d.h);

                ctx.strokeStyle = d.edgeGlow ? 'rgba(34, 255, 136, 0.55)' : 'rgba(255, 255, 255, 0.14)';
                ctx.lineWidth = 1;
                ctx.strokeRect(-d.w * 0.5, -d.h * 0.5, d.w, d.h);
                ctx.restore();
            }
            ctx.restore();
        }
    }

    // -------------------------------------------------------------------------
    // 4. Victor Von Doom Appearance
    // -------------------------------------------------------------------------
    class DoomFinale {
        constructor(shake, audio) {
            this.shake = shake;
            this.audio = audio;
            this.handBolts = [];
            this.arcTimer = 0;
        }

        reset() {
            this.handBolts.length = 0;
            this.arcTimer = 0;
            this.audio.setPlasmaBeamLevel(0, 0);
        }

        update(dt, doomElapsed, totalElapsed, width, height) {
            const t = Math.max(0, doomElapsed);
            const charge1 = Math.min(1, Math.max(0, (t - 1.1) / 2.0));
            const charge2 = Math.min(1, Math.max(0, (t - 3.1) / 2.1));

            const scale = Math.min(width, height) / 760 * 1.13;
            const baseY = height * 0.54 + Math.sin(totalElapsed * 2.2) * 6;
            const g1Raise = Math.min(1, Math.max(0, (t - 0.6) / 1.0));
            const g2Raise = Math.min(1, Math.max(0, (t - 2.7) / 1.0));

            const hand1X = width * 0.5 + (72 + g1Raise * 22) * scale;
            const hand1Y = baseY + (30 - g1Raise * 48) * scale;
            const hand2X = width * 0.5 + (-72 - g2Raise * 22) * scale;
            const hand2Y = baseY + (30 - g2Raise * 48) * scale;

            const totalCharge = Math.min(1, charge1 * 0.45 + charge2 * 0.75);
            this.audio.setPlasmaBeamLevel(totalCharge > 0.05 ? 0.45 + totalCharge * 0.55 : 0, totalCharge);

            if (charge1 > 0.08) {
                this.arcTimer -= dt;
                if (this.arcTimer <= 0) {
                    const count = charge2 > 0.5 ? 3 : 2;
                    for (let i = 0; i < count; i++) {
                        const useSecond = charge2 > 0.1 && (i % 2 === 1 || Math.random() > 0.45);
                        const hx = useSecond ? hand2X : hand1X;
                        const hy = useSecond ? hand2Y : hand1Y;
                        const angle = Math.random() * Math.PI * 2;
                        const reach = (160 + totalCharge * 460) * (0.6 + Math.random() * 0.55);
                        const tx = hx + Math.cos(angle) * reach;
                        const ty = hy + Math.sin(angle) * reach;
                        const segments = createLightningBolt(hx, hy, tx, ty, 65 + totalCharge * 45, 7, 0.35);
                        this.handBolts.push({ segments, life: 1, width: 2.2 + totalCharge * 2.6 });
                    }

                    if (charge2 > 0.15) {
                        const bridge = createLightningBolt(hand1X, hand1Y, hand2X, hand2Y, 48, 6, 0.25);
                        this.handBolts.push({ segments: bridge, life: 1, width: 2.6 + charge2 * 2.2 });
                    }

                    this.arcTimer = 0.065 + (1 - totalCharge) * 0.13;
                    if (Math.random() < 0.6) {
                        this.audio.playElectricArc(0.22 + totalCharge * 0.16);
                    }
                    this.shake.add(0.06 + totalCharge * 0.16);
                }
            }

            for (let i = this.handBolts.length - 1; i >= 0; i--) {
                this.handBolts[i].life -= dt * 5.2;
                if (this.handBolts[i].life <= 0) this.handBolts.splice(i, 1);
            }
        }

        draw(ctx, doomElapsed, totalElapsed, width, height) {
            const t = Math.max(0, doomElapsed);
            const emerge = Math.min(1, t / 1.6);
            const ease = 1 - Math.pow(1 - emerge, 3);
            const charge1 = Math.min(1, Math.max(0, (t - 1.1) / 2.0));
            const charge2 = Math.min(1, Math.max(0, (t - 3.1) / 2.1));

            const cx = width * 0.5;
            const baseY = height * 0.54 + (1 - ease) * 90 + Math.sin(totalElapsed * 2.2) * 6;
            const scale = Math.min(width, height) / 760 * (0.85 + 0.28 * ease);

            ctx.save();

            const aura = ctx.createRadialGradient(cx, baseY - 40 * scale, 20, cx, baseY - 20 * scale, 380 * scale);
            aura.addColorStop(0, `rgba(40, 255, 145, ${0.55 * ease})`);
            aura.addColorStop(0.45, `rgba(12, 120, 68, ${0.32 * ease})`);
            aura.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = aura;
            ctx.beginPath();
            ctx.arc(cx, baseY - 20 * scale, 380 * scale, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalCompositeOperation = 'source-over';

            ctx.translate(cx, baseY);
            ctx.scale(scale, scale);
            ctx.globalAlpha = ease;

            // Cloak
            const wave = Math.sin(totalElapsed * 4.5) * 14;
            const wave2 = Math.cos(totalElapsed * 3.8) * 18;
            const cloakGrad = ctx.createLinearGradient(0, -180, 0, 320);
            cloakGrad.addColorStop(0, '#0a2b19');
            cloakGrad.addColorStop(0.5, '#071b11');
            cloakGrad.addColorStop(1, '#020604');

            ctx.fillStyle = cloakGrad;
            ctx.beginPath();
            ctx.moveTo(-85, -110);
            ctx.quadraticCurveTo(-195 + wave, 30, -230 + wave2, 310);
            ctx.lineTo(-90, 285);
            ctx.lineTo(0, 320);
            ctx.lineTo(110, 290);
            ctx.lineTo(225 - wave2, 310);
            ctx.quadraticCurveTo(185 - wave, 30, 85, -110);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = 'rgba(34, 255, 136, 0.45)';
            ctx.lineWidth = 2.5;
            ctx.stroke();

            // Armored torso
            const armorGrad = ctx.createLinearGradient(-70, -100, 70, 120);
            armorGrad.addColorStop(0, '#5a6870');
            armorGrad.addColorStop(0.45, '#2b3338');
            armorGrad.addColorStop(1, '#101417');

            ctx.fillStyle = armorGrad;
            ctx.beginPath();
            ctx.moveTo(-78, -95);
            ctx.lineTo(78, -95);
            ctx.lineTo(62, 115);
            ctx.lineTo(-62, 115);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = '#0d4728';
            ctx.beginPath();
            ctx.moveTo(-36, -65);
            ctx.lineTo(36, -65);
            ctx.lineTo(28, 165);
            ctx.lineTo(-28, 165);
            ctx.closePath();
            ctx.fill();

            for (const side of [-1, 1]) {
                ctx.fillStyle = '#c8a951';
                ctx.beginPath();
                ctx.arc(side * 52, -72, 13, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#22ff88';
                ctx.beginPath();
                ctx.arc(side * 52, -72, 5, 0, Math.PI * 2);
                ctx.fill();
            }

            // Hood & Metallic Mask
            ctx.fillStyle = '#0b3820';
            ctx.beginPath();
            ctx.moveTo(0, -215);
            ctx.quadraticCurveTo(-78, -195, -72, -102);
            ctx.lineTo(72, -102);
            ctx.quadraticCurveTo(78, -195, 0, -215);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = 'rgba(34, 255, 136, 0.55)';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.fillStyle = '#020403';
            ctx.beginPath();
            ctx.ellipse(0, -142, 42, 52, 0, 0, Math.PI * 2);
            ctx.fill();

            const maskGrad = ctx.createLinearGradient(-32, -180, 32, -105);
            maskGrad.addColorStop(0, '#9aa8b2');
            maskGrad.addColorStop(0.5, '#4b555c');
            maskGrad.addColorStop(1, '#1e2429');
            ctx.fillStyle = maskGrad;
            ctx.beginPath();
            ctx.moveTo(0, -182);
            ctx.lineTo(-30, -162);
            ctx.lineTo(-26, -116);
            ctx.lineTo(0, -102);
            ctx.lineTo(26, -116);
            ctx.lineTo(30, -162);
            ctx.closePath();
            ctx.fill();

            ctx.strokeStyle = '#0a0d0f';
            ctx.lineWidth = 2.4;
            for (let sx = -12; sx <= 12; sx += 6) {
                ctx.beginPath();
                ctx.moveTo(sx, -128);
                ctx.lineTo(sx, -112);
                ctx.stroke();
            }

            ctx.save();
            ctx.shadowColor = '#22ff88';
            ctx.shadowBlur = 18;
            ctx.fillStyle = '#d8ffea';
            for (const side of [-1, 1]) {
                ctx.beginPath();
                ctx.moveTo(side * 8, -152);
                ctx.lineTo(side * 22, -156);
                ctx.lineTo(side * 19, -147);
                ctx.closePath();
                ctx.fill();
            }
            ctx.restore();

            // Dual Armored Gauntlets
            const g1Raise = Math.min(1, Math.max(0, (t - 0.6) / 1.0));
            const g2Raise = Math.min(1, Math.max(0, (t - 2.7) / 1.0));
            const hands = [
                { shoulderX: 68, gx: 72 + g1Raise * 22, gy: 30 - g1Raise * 48, charge: charge1 },
                { shoulderX: -68, gx: -72 - g2Raise * 22, gy: 30 - g2Raise * 48, charge: charge2 }
            ];

            for (const h of hands) {
                ctx.strokeStyle = '#3c464d';
                ctx.lineWidth = 26;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(h.shoulderX, -62);
                ctx.lineTo(h.gx, h.gy);
                ctx.stroke();

                ctx.fillStyle = '#687680';
                ctx.beginPath();
                ctx.arc(h.gx, h.gy, 24, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#22ff88';
                ctx.lineWidth = 2;
                ctx.stroke();

                if (h.charge > 0.05) {
                    ctx.save();
                    ctx.globalCompositeOperation = 'lighter';
                    const coreR = 16 + h.charge * 42 + Math.sin(totalElapsed * 26) * 5;
                    const palmGlow = ctx.createRadialGradient(h.gx, h.gy, 2, h.gx, h.gy, coreR * 2.2);
                    palmGlow.addColorStop(0, '#ffffff');
                    palmGlow.addColorStop(0.28, '#44ff99');
                    palmGlow.addColorStop(0.65, 'rgba(34, 255, 136, 0.35)');
                    palmGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
                    ctx.fillStyle = palmGlow;
                    ctx.beginPath();
                    ctx.arc(h.gx, h.gy, coreR * 2.2, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }
            }

            ctx.restore();

            for (const b of this.handBolts) {
                drawLightningBolt(ctx, b.segments, {
                    coreColor: '#ebfff4',
                    glowColor: '#22ff88',
                    alpha: Math.max(0, b.life),
                    baseWidth: b.width
                });
            }
        }
    }

    // -------------------------------------------------------------------------
    // 5. Screen Shatter & Abyssal Void
    // -------------------------------------------------------------------------
    class ScreenShatter {
        constructor() {
            this.active = false;
            this.shards = [];
            this.cracks = [];
            this.snapshot = null;
            this.timer = 0;
        }

        reset() {
            this.active = false;
            this.shards.length = 0;
            this.cracks.length = 0;
            this.snapshot = null;
            this.timer = 0;
        }

        trigger(sourceCanvas, impactX, impactY) {
            const w = sourceCanvas.width;
            const h = sourceCanvas.height;

            const off = document.createElement('canvas');
            off.width = w;
            off.height = h;
            const offCtx = off.getContext('2d');
            offCtx.fillStyle = 'rgba(4, 10, 8, 0.88)';
            offCtx.fillRect(0, 0, w, h);
            offCtx.drawImage(sourceCanvas, 0, 0);
            this.snapshot = off;

            this.active = true;
            this.timer = 0;
            this.shards.length = 0;
            this.cracks.length = 0;

            const rings = [0, 70, 175, 330, 560, Math.hypot(w, h)];
            const sectors = 16;

            const ringPoints = rings.map((r, rIdx) => {
                const pts = [];
                for (let s = 0; s < sectors; s++) {
                    const baseAngle = (s / sectors) * Math.PI * 2;
                    const jitterAngle = rIdx === 0 ? baseAngle : baseAngle + (Math.random() - 0.5) * 0.22;
                    const jitterR = rIdx === 0 || rIdx === rings.length - 1 ? r : r + (Math.random() - 0.5) * 32;
                    pts.push({
                        x: impactX + Math.cos(jitterAngle) * jitterR,
                        y: impactY + Math.sin(jitterAngle) * jitterR
                    });
                }
                return pts;
            });

            for (let r = 0; r < rings.length - 1; r++) {
                for (let s = 0; s < sectors; s++) {
                    const nextS = (s + 1) % sectors;
                    const p1 = ringPoints[r][s];
                    const p2 = ringPoints[r][nextS];
                    const p3 = ringPoints[r + 1][nextS];
                    const p4 = ringPoints[r + 1][s];

                    this.cracks.push([p1, p4]);
                    this.cracks.push([p4, p3]);

                    this._addShard([p1, p2, p3], impactX, impactY);
                    if (r > 0) this._addShard([p1, p3, p4], impactX, impactY);
                }
            }
        }

        _addShard(poly, ix, iy) {
            const cx = (poly[0].x + poly[1].x + poly[2].x) / 3;
            const cy = (poly[0].y + poly[1].y + poly[2].y) / 3;
            const dx = cx - ix;
            const dy = cy - iy;
            const dist = Math.max(20, Math.hypot(dx, dy));
            const speed = 3.5 + (550 / dist) * 4.5 + Math.random() * 4;

            this.shards.push({
                poly,
                cx,
                cy,
                x: 0,
                y: 0,
                vx: (dx / dist) * speed + (Math.random() - 0.5) * 3,
                vy: (dy / dist) * speed - 2.5 - Math.random() * 3,
                rot: 0,
                vRot: (Math.random() - 0.5) * 0.14,
                scaleX: 1,
                vScaleX: (Math.random() - 0.5) * 0.045,
                alpha: 1
            });
        }

        update(dt) {
            if (!this.active) return;
            this.timer += dt;
            const dtFactor = Math.min(2.5, dt * 60);
            if (this.timer < 0.28) return;

            let anyVisible = false;
            for (const sh of this.shards) {
                sh.vy += 0.34 * dtFactor;
                sh.x += sh.vx * dtFactor;
                sh.y += sh.vy * dtFactor;
                sh.rot += sh.vRot * dtFactor;
                sh.scaleX = Math.cos(this.timer * 3.5 + sh.vScaleX * 40);
                if (this.timer > 1.2) sh.alpha = Math.max(0, sh.alpha - dt * 0.75);
                if (sh.alpha > 0.01) anyVisible = true;
            }
            if (!anyVisible && this.timer > 2.6) this.active = false;
        }

        draw(ctx, width, height) {
            if (!this.active || !this.snapshot) return;
            ctx.clearRect(0, 0, width, height);

            if (this.timer < 0.28) {
                ctx.drawImage(this.snapshot, 0, 0, width, height);
                ctx.save();
                ctx.strokeStyle = 'rgba(220, 255, 240, 0.92)';
                ctx.shadowColor = '#22ff88';
                ctx.shadowBlur = 12;
                ctx.lineWidth = 2.2;
                ctx.beginPath();
                for (const [a, b] of this.cracks) {
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(b.x, b.y);
                }
                ctx.stroke();
                ctx.restore();
                return;
            }

            for (const sh of this.shards) {
                if (sh.alpha <= 0.01) continue;
                ctx.save();
                ctx.globalAlpha = sh.alpha;
                ctx.translate(sh.cx + sh.x, sh.cy + sh.y);
                ctx.rotate(sh.rot);
                ctx.scale(Math.max(0.18, Math.abs(sh.scaleX)), 1);
                ctx.translate(-sh.cx, -sh.cy);

                ctx.beginPath();
                ctx.moveTo(sh.poly[0].x, sh.poly[0].y);
                ctx.lineTo(sh.poly[1].x, sh.poly[1].y);
                ctx.lineTo(sh.poly[2].x, sh.poly[2].y);
                ctx.closePath();
                ctx.clip();

                ctx.drawImage(this.snapshot, 0, 0, width, height);

                ctx.strokeStyle = 'rgba(180, 255, 225, 0.55)';
                ctx.lineWidth = 1.6;
                ctx.stroke();
                ctx.restore();
            }
        }
    }

    class AbyssalVoid {
        constructor() {
            this.stars = [];
            this.fragments = [];
            this.cursorArcs = [];
            this.mouse = { x: -999, y: -999, active: false };
            this.width = 0;
            this.height = 0;
            this.arcCooldown = 0;
        }

        resize(w, h) {
            this.width = w;
            this.height = h;
            this.stars = Array.from({ length: 180 }, () => ({
                x: Math.random() * w,
                y: Math.random() * h,
                z: 0.2 + Math.random() * 0.8,
                r: 0.6 + Math.random() * 1.8,
                hue: Math.random() > 0.7 ? 150 : 210
            }));
            this.fragments = Array.from({ length: 24 }, () => ({
                x: Math.random() * w,
                y: Math.random() * h,
                size: 6 + Math.random() * 18,
                rot: Math.random() * Math.PI * 2,
                vRot: (Math.random() - 0.5) * 0.015,
                vx: (Math.random() - 0.5) * 0.35,
                vy: -0.15 - Math.random() * 0.35
            }));
        }

        setMouse(x, y) {
            this.mouse.x = x;
            this.mouse.y = y;
            this.mouse.active = true;
        }

        update(dt, elapsed, inVoid) {
            const dtFactor = Math.min(2.5, dt * 60);
            const cx = this.width * 0.5;
            const cy = this.height * 0.5;

            for (const s of this.stars) {
                const dx = s.x - cx;
                const dy = s.y - cy;
                s.x += (dx * 0.0005 * s.z + Math.sin(elapsed * 0.4 + s.y * 0.01) * 0.12) * dtFactor;
                s.y += (dy * 0.0005 * s.z + Math.cos(elapsed * 0.4 + s.x * 0.01) * 0.12) * dtFactor;

                if (this.mouse.active && inVoid) {
                    const mdx = s.x - this.mouse.x;
                    const mdy = s.y - this.mouse.y;
                    const mdist = Math.hypot(mdx, mdy);
                    if (mdist < 140 && mdist > 2) {
                        s.x += (mdx / mdist) * 1.6 * dtFactor;
                        s.y += (mdy / mdist) * 1.6 * dtFactor;
                    }
                }

                if (s.x < 0) s.x = this.width;
                if (s.x > this.width) s.x = 0;
                if (s.y < 0) s.y = this.height;
                if (s.y > this.height) s.y = 0;
            }

            for (const f of this.fragments) {
                f.x += f.vx * dtFactor;
                f.y += f.vy * dtFactor;
                f.rot += f.vRot * dtFactor;
                if (f.y < -40) {
                    f.y = this.height + 40;
                    f.x = Math.random() * this.width;
                }
            }

            if (inVoid && this.mouse.active) {
                this.arcCooldown -= dt;
                if (this.arcCooldown <= 0) {
                    const angle = Math.random() * Math.PI * 2;
                    const len = 35 + Math.random() * 75;
                    this.cursorArcs.push({
                        segments: createLightningBolt(
                            this.mouse.x,
                            this.mouse.y,
                            this.mouse.x + Math.cos(angle) * len,
                            this.mouse.y + Math.sin(angle) * len,
                            24,
                            6,
                            0.2
                        ),
                        life: 1
                    });
                    this.arcCooldown = 0.14;
                }
            }

            for (let i = this.cursorArcs.length - 1; i >= 0; i--) {
                this.cursorArcs[i].life -= dt * 3.8;
                if (this.cursorArcs[i].life <= 0) this.cursorArcs.splice(i, 1);
            }
        }

        draw(ctx, elapsed, voidAge = 0) {
            const w = this.width;
            const h = this.height;

            const bg = ctx.createRadialGradient(w * 0.5, h * 0.5, 40, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
            bg.addColorStop(0, '#05140d');
            bg.addColorStop(0.45, '#03060a');
            bg.addColorStop(1, '#000000');
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, w, h);

            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            for (let i = 0; i < 3; i++) {
                const nx = w * 0.5 + Math.cos(elapsed * 0.18 + i * 2.1) * (w * 0.16);
                const ny = h * 0.5 + Math.sin(elapsed * 0.22 + i * 1.7) * (h * 0.14);
                const neb = ctx.createRadialGradient(nx, ny, 10, nx, ny, Math.min(w, h) * 0.42);
                neb.addColorStop(0, i === 1 ? 'rgba(95, 25, 140, 0.09)' : 'rgba(20, 175, 95, 0.08)');
                neb.addColorStop(1, 'rgba(0, 0, 0, 0)');
                ctx.fillStyle = neb;
                ctx.beginPath();
                ctx.arc(nx, ny, Math.min(w, h) * 0.42, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();

            for (const s of this.stars) {
                const twinkle = 0.45 + 0.55 * Math.sin(elapsed * 2 + s.x);
                ctx.fillStyle = `hsla(${s.hue}, 85%, 75%, ${twinkle * 0.75})`;
                ctx.beginPath();
                ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
                ctx.fill();
            }

            for (const f of this.fragments) {
                ctx.save();
                ctx.translate(f.x, f.y);
                ctx.rotate(f.rot);
                ctx.fillStyle = 'rgba(14, 24, 20, 0.75)';
                ctx.strokeStyle = 'rgba(34, 255, 136, 0.25)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(-f.size, -f.size * 0.5);
                ctx.lineTo(f.size * 0.8, -f.size * 0.9);
                ctx.lineTo(f.size, f.size * 0.7);
                ctx.lineTo(-f.size * 0.6, f.size * 0.8);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                ctx.restore();
            }

            if (voidAge > 0.3 && voidAge < 14) {
                const eyeAlpha = Math.max(0, Math.min(1, (voidAge - 0.3) * 0.8)) * Math.max(0, 1 - Math.max(0, voidAge - 7) / 7);
                if (eyeAlpha > 0.01) {
                    ctx.save();
                    ctx.globalAlpha = eyeAlpha * 0.85;
                    ctx.shadowColor = '#22ff88';
                    ctx.shadowBlur = 24;
                    ctx.fillStyle = '#baffda';
                    for (const side of [-1, 1]) {
                        ctx.beginPath();
                        ctx.moveTo(w * 0.5 + side * 14, h * 0.44);
                        ctx.lineTo(w * 0.5 + side * 34, h * 0.433);
                        ctx.lineTo(w * 0.5 + side * 30, h * 0.448);
                        ctx.closePath();
                        ctx.fill();
                    }
                    ctx.restore();
                }
            }

            for (const a of this.cursorArcs) {
                drawLightningBolt(ctx, a.segments, {
                    coreColor: '#e8fff3',
                    glowColor: '#22ff88',
                    alpha: a.life * 0.7,
                    baseWidth: 1.6
                });
            }
        }
    }

    // -------------------------------------------------------------------------
    // 6. Stage Orchestrator for Content Script
    // -------------------------------------------------------------------------
    const MASS_DURATION = 5.5;
    const DOOM_DURATION = 6.0;
    const SHATTER_AT = MASS_DURATION + DOOM_DURATION; // 11.5s into climax

    let rootEl = null;
    let voidCanvas = null;
    let worldCanvas = null;
    let shatterCanvas = null;
    let voidCtx = null;
    let worldCtx = null;
    let shatterCtx = null;
    let flashOverlay = null;
    let statusBanner = null;
    let dialogueBox = null;
    let dialogueText = null;
    let controlsBar = null;
    let closeBtn = null;
    let styleEl = null;

    const audio = new SoundEngine();
    const particles = new ParticleSystem();
    const shake = new CameraShake();
    const shatter = new ScreenShatter();
    const abyssalVoid = new AbyssalVoid();
    const doomFinale = new DoomFinale(shake, audio);

    let flashTimer = null;
    function triggerFlash(opacity = 0.8, durationMs = 140) {
        if (!flashOverlay) return;
        flashOverlay.style.opacity = String(opacity);
        if (flashTimer) clearTimeout(flashTimer);
        flashTimer = setTimeout(() => {
            if (flashOverlay) flashOverlay.style.opacity = '0';
        }, durationMs);
    }

    const stormScene = new StormAndMissilesScene(particles, shake, audio, triggerFlash);

    let currentStage = 'none'; // 'none' | 'few_missiles' | 'more_missiles' | 'climax'
    let currentProgress = 0;
    let rafId = null;
    let totalElapsed = 0;
    let climaxElapsed = 0;
    let lastFrameTime = 0;
    let width = 0;
    let height = 0;

    let line1Spoken = false;
    let line2Spoken = false;
    let shatteredTriggered = false;
    let glitchApplied = false;
    let callbacks = { onCloseTab: null };

    function injectStyles() {
        if (styleEl && document.head && document.head.contains(styleEl)) return;
        styleEl = document.createElement('style');
        styleEl.id = 'doom-scolder-fx-styles';
        styleEl.textContent = `
            #doom-scolder-fx-layer {
                position: fixed;
                inset: 0;
                z-index: 2147483645;
                pointer-events: none;
                overflow: hidden;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            }
            #doom-scolder-fx-layer.climax-blocking {
                pointer-events: auto;
            }
            #doom-scolder-fx-layer.doom-glitch {
                animation: doom-fx-glitch 0.24s steps(2) infinite;
            }
            @keyframes doom-fx-glitch {
                0% { transform: translate(0, 0); filter: hue-rotate(0deg); }
                25% { transform: translate(-4px, 2px); filter: hue-rotate(25deg) contrast(1.25); }
                50% { transform: translate(4px, -2px); filter: hue-rotate(-20deg) saturate(1.4); }
                75% { transform: translate(-2px, -3px); }
                100% { transform: translate(0, 0); filter: none; }
            }
            #doom-scolder-fx-layer canvas {
                position: absolute;
                inset: 0;
                width: 100%;
                height: 100%;
                display: block;
                pointer-events: none;
            }
            #doom-fx-flash {
                position: absolute;
                inset: 0;
                background: #ffffff;
                opacity: 0;
                mix-blend-mode: screen;
                pointer-events: none;
                transition: opacity 0.05s linear;
                z-index: 4;
            }
            #doom-fx-banner {
                position: absolute;
                top: 16px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 6;
                padding: 7px 16px;
                border-radius: 6px;
                background: rgba(17, 17, 20, 0.86);
                border: 1px solid rgba(239, 68, 68, 0.55);
                color: #fca5a5;
                font-size: 11px;
                font-weight: 700;
                letter-spacing: 0.14em;
                text-transform: uppercase;
                box-shadow: 0 0 18px rgba(239, 68, 68, 0.25);
                backdrop-filter: blur(6px);
                pointer-events: none;
                display: none;
            }
            #doom-fx-banner.breach {
                border-color: rgba(34, 255, 136, 0.65);
                color: #86efac;
                box-shadow: 0 0 22px rgba(34, 255, 136, 0.3);
            }
            #doom-fx-dialogue {
                position: absolute;
                bottom: 92px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 7;
                max-width: min(560px, 88vw);
                padding: 12px 22px;
                border-radius: 8px;
                background: rgba(8, 12, 10, 0.9);
                border: 1px solid rgba(34, 255, 136, 0.5);
                box-shadow: 0 0 28px rgba(34, 255, 136, 0.25);
                color: #ecfdf5;
                font-size: 16px;
                font-weight: 700;
                letter-spacing: 0.04em;
                text-align: center;
                display: none;
                pointer-events: none;
            }
            #doom-fx-controls {
                position: absolute;
                bottom: 24px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 8;
                display: none;
                align-items: center;
                gap: 12px;
                padding: 10px 16px;
                border-radius: 10px;
                background: rgba(17, 17, 20, 0.45);
                border: 1px solid rgba(255, 255, 255, 0.06);
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
                backdrop-filter: blur(6px);
                opacity: 0.28;
                transition: opacity 0.22s ease, background 0.22s ease, border-color 0.22s ease, box-shadow 0.22s ease;
            }
            #doom-fx-controls:hover {
                opacity: 1;
                background: rgba(17, 17, 20, 0.92);
                border-color: rgba(255, 255, 255, 0.14);
                box-shadow: 0 12px 32px rgba(0, 0, 0, 0.75);
            }
            #doom-fx-close-btn {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                padding: 9px 18px;
                border-radius: 7px;
                border: 1px solid rgba(255, 255, 255, 0.1);
                background: rgba(39, 39, 42, 0.65);
                color: #a1a1aa;
                font-size: 13px;
                font-weight: 700;
                cursor: pointer;
                transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease, transform 0.12s ease;
            }
            #doom-fx-controls:hover #doom-fx-close-btn {
                border-color: rgba(239, 68, 68, 0.5);
                background: rgba(153, 27, 27, 0.85);
                color: #fef2f2;
            }
            #doom-fx-close-btn:hover {
                border-color: rgba(239, 68, 68, 0.75);
                background: #b91c1c;
                color: #ffffff;
                transform: translateY(-1px);
            }
            #doom-fx-hint {
                color: #a1a1aa;
                font-size: 12px;
                white-space: nowrap;
            }
        `;
        (document.head || document.documentElement).appendChild(styleEl);
    }

    function ensureMount() {
        if (!document.body) return false;
        injectStyles();

        if (rootEl && document.body.contains(rootEl)) return true;

        rootEl = document.createElement('div');
        rootEl.id = 'doom-scolder-fx-layer';

        voidCanvas = document.createElement('canvas');
        voidCanvas.style.zIndex = '1';
        worldCanvas = document.createElement('canvas');
        worldCanvas.style.zIndex = '2';
        shatterCanvas = document.createElement('canvas');
        shatterCanvas.style.zIndex = '3';

        flashOverlay = document.createElement('div');
        flashOverlay.id = 'doom-fx-flash';

        statusBanner = document.createElement('div');
        statusBanner.id = 'doom-fx-banner';

        dialogueBox = document.createElement('div');
        dialogueBox.id = 'doom-fx-dialogue';
        dialogueText = document.createElement('span');
        dialogueBox.appendChild(dialogueText);

        controlsBar = document.createElement('div');
        controlsBar.id = 'doom-fx-controls';

        closeBtn = document.createElement('button');
        closeBtn.id = 'doom-fx-close-btn';
        closeBtn.type = 'button';
        closeBtn.textContent = 'Close Tab';
        closeBtn.addEventListener('click', () => {
            if (typeof callbacks.onCloseTab === 'function') {
                callbacks.onCloseTab();
            }
        });

        const hint = document.createElement('span');
        hint.id = 'doom-fx-hint';
        hint.textContent = "Reset timer. Don't remove the extension like a coward.";

        controlsBar.appendChild(closeBtn);
        controlsBar.appendChild(hint);

        rootEl.appendChild(voidCanvas);
        rootEl.appendChild(worldCanvas);
        rootEl.appendChild(shatterCanvas);
        rootEl.appendChild(flashOverlay);
        rootEl.appendChild(statusBanner);
        rootEl.appendChild(dialogueBox);
        rootEl.appendChild(controlsBar);

        document.body.appendChild(rootEl);

        voidCtx = voidCanvas.getContext('2d');
        worldCtx = worldCanvas.getContext('2d');
        shatterCtx = shatterCanvas.getContext('2d');

        handleResize();
        return true;
    }

    function handleResize() {
        if (!rootEl) return;
        width = window.innerWidth;
        height = window.innerHeight;
        for (const c of [voidCanvas, worldCanvas, shatterCanvas]) {
            if (c) {
                c.width = width;
                c.height = height;
            }
        }
        stormScene.resize(width, height);
        abyssalVoid.resize(width, height);
    }

    window.addEventListener('resize', handleResize);
    window.addEventListener('pointerdown', () => audio.unlock(), { passive: true });
    window.addEventListener('keydown', () => audio.unlock(), { passive: true });
    window.addEventListener('pointermove', (e) => {
        abyssalVoid.setMouse(e.clientX, e.clientY);
    }, { passive: true });

    let activeVoiceAudio = null;

    function stopDubbedVoice() {
        if (activeVoiceAudio) {
            try {
                activeVoiceAudio.pause();
                activeVoiceAudio.currentTime = 0;
            } catch (_) {}
            activeVoiceAudio = null;
        }
    }

    function showDialogue(text, audioPath) {
        if (!dialogueBox || !dialogueText) return;
        dialogueText.textContent = text;
        dialogueBox.style.display = 'block';
        stopDubbedVoice();

        if (audioPath && typeof callbacks.resolveAudio === 'function') {
            Promise.resolve(callbacks.resolveAudio(audioPath))
                .then((src) => {
                    if (!src || currentStage !== 'climax') {
                        audio.speakDoom(text);
                        return;
                    }
                    const el = new Audio(src);
                    el.volume = 0.95;
                    activeVoiceAudio = el;
                    el.play().catch(() => {
                        if (activeVoiceAudio === el) activeVoiceAudio = null;
                        audio.speakDoom(text);
                    });
                })
                .catch(() => audio.speakDoom(text));
        } else {
            audio.speakDoom(text);
        }
    }

    function hideDialogue() {
        if (dialogueBox) dialogueBox.style.display = 'none';
    }

    function updateBannerAndAudio(climaxPhase) {
        if (!statusBanner) return;

        if (currentStage === 'few_missiles') {
            statusBanner.style.display = 'none';
            audio.setRainLevel(0.01);
            audio.setVoidLevel(0);
        } else if (currentStage === 'more_missiles') {
            statusBanner.style.display = 'none';
            audio.setRainLevel(0.025);
            audio.setVoidLevel(0);
        } else if (currentStage === 'climax') {
            if (climaxPhase === 'mass') {
                statusBanner.style.display = 'none';
                audio.setRainLevel(0.04);
                audio.setVoidLevel(0.04);
            } else if (climaxPhase === 'doom') {
                statusBanner.style.display = 'none';
                audio.setRainLevel(0.015);
                audio.setVoidLevel(0.12);
            } else {
                statusBanner.style.display = 'none';
                audio.setRainLevel(0);
                audio.setVoidLevel(0.24);
                audio.setPlasmaBeamLevel(0, 0);
            }
        }
    }

    function getClimaxSubPhase(t) {
        if (t < MASS_DURATION) return 'mass';
        if (t < SHATTER_AT) return 'doom';
        return 'void';
    }

    function loop(now) {
        if (currentStage === 'none') {
            rafId = null;
            return;
        }
        if (!ensureMount()) {
            rafId = requestAnimationFrame(loop);
            return;
        }

        const dt = Math.min(0.05, Math.max(0.001, (now - lastFrameTime) / 1000));
        lastFrameTime = now;
        totalElapsed += dt;

        let renderPhase = currentStage;
        let phaseElapsed = totalElapsed;

        if (currentStage === 'climax') {
            climaxElapsed += dt;
            renderPhase = getClimaxSubPhase(climaxElapsed);
            phaseElapsed = renderPhase === 'mass'
                ? climaxElapsed
                : renderPhase === 'doom'
                    ? climaxElapsed - MASS_DURATION
                    : climaxElapsed - SHATTER_AT;

            updateBannerAndAudio(renderPhase);

            if (renderPhase === 'mass' && climaxElapsed > MASS_DURATION - 0.8 && !glitchApplied) {
                glitchApplied = true;
                rootEl.classList.add('doom-glitch');
            }
            if (renderPhase === 'doom' && glitchApplied && climaxElapsed < SHATTER_AT - 0.2) {
                glitchApplied = false;
                rootEl.classList.remove('doom-glitch');
            }

            if (renderPhase === 'doom' && phaseElapsed >= 1.6 && !line1Spoken) {
                line1Spoken = true;
                showDialogue("Your world's limits... are pathetic.", 'sounds/doom_line1.mp3');
            }

            if (renderPhase === 'void' && !shatteredTriggered) {
                shatteredTriggered = true;
                shatter.trigger(worldCanvas, width * 0.5, height * 0.48);
                audio.playScreenShatter();
                triggerFlash(1.0, 220);
                shake.add(1.0);
                rootEl.classList.add('doom-glitch');
                setTimeout(() => {
                    if (rootEl) rootEl.classList.remove('doom-glitch');
                }, 280);
            }

            if (renderPhase === 'void' && phaseElapsed >= 1.1 && !line2Spoken) {
                line2Spoken = true;
                showDialogue('Kneel before DOOM. Now... witness the VOID.', 'sounds/doom_line2.mp3');
            }
            if (renderPhase === 'void' && phaseElapsed >= 7.2) {
                hideDialogue();
            }
        } else {
            updateBannerAndAudio(currentStage);
        }

        shake.update(dt);
        const offset = shake.getOffset();

        abyssalVoid.update(dt, totalElapsed, renderPhase === 'void');

        if (renderPhase !== 'void') {
            stormScene.update(dt, renderPhase, phaseElapsed, currentProgress);

            const pullCenter = renderPhase === 'mass' ? { x: width * 0.5, y: height * 0.45 } : null;
            const pullStrength = renderPhase === 'mass' ? Math.min(1.6, phaseElapsed / 4.2) : 0;
            particles.update(Math.min(2.5, dt * 60), pullCenter, pullStrength);

            if (renderPhase === 'doom') {
                doomFinale.update(dt, phaseElapsed, totalElapsed, width, height);
            }
        } else {
            shatter.update(dt);
        }

        voidCtx.clearRect(0, 0, width, height);
        if (renderPhase === 'void') {
            abyssalVoid.draw(voidCtx, totalElapsed, phaseElapsed);
        }

        worldCtx.clearRect(0, 0, width, height);
        if (renderPhase !== 'void') {
            worldCtx.save();
            worldCtx.translate(offset.x, offset.y);
            stormScene.draw(worldCtx, totalElapsed, renderPhase, phaseElapsed);
            particles.draw(worldCtx);
            if (renderPhase === 'doom') {
                doomFinale.draw(worldCtx, phaseElapsed, totalElapsed, width, height);
            }
            worldCtx.restore();
        }

        if (shatter.active) {
            shatter.draw(shatterCtx, width, height);
        } else if (renderPhase === 'void') {
            shatterCtx.clearRect(0, 0, width, height);
        }

        rafId = requestAnimationFrame(loop);
    }

    function resetClimaxState() {
        climaxElapsed = 0;
        line1Spoken = false;
        line2Spoken = false;
        shatteredTriggered = false;
        glitchApplied = false;
        shatter.reset();
        doomFinale.reset();
        hideDialogue();
        stopDubbedVoice();
        if (shatterCtx) shatterCtx.clearRect(0, 0, width, height);
        if (rootEl) rootEl.classList.remove('doom-glitch');
    }

    window.DoomEffects = {
        setStage(stage, options = {}) {
            const nextStage = stage || 'none';
            if (typeof options.progress === 'number') {
                currentProgress = options.progress;
            }
            if (typeof options.onCloseTab === 'function') {
                callbacks.onCloseTab = options.onCloseTab;
            }
            if (typeof options.resolveAudio === 'function') {
                callbacks.resolveAudio = options.resolveAudio;
            }

            if (nextStage === 'none') {
                currentStage = 'none';
                if (rafId) {
                    cancelAnimationFrame(rafId);
                    rafId = null;
                }
                audio.silenceAll();
                stormScene.reset();
                particles.clear();
                resetClimaxState();
                if (rootEl) {
                    rootEl.classList.remove('climax-blocking');
                    rootEl.style.display = 'none';
                }
                if (controlsBar) controlsBar.style.display = 'none';
                if (statusBanner) statusBanner.style.display = 'none';
                return;
            }

            if (!ensureMount()) return;
            audio.unlock();
            rootEl.style.display = 'block';

            if (nextStage === 'climax') {
                rootEl.classList.add('climax-blocking');
                if (controlsBar) controlsBar.style.display = 'flex';
            } else {
                rootEl.classList.remove('climax-blocking');
                if (controlsBar) controlsBar.style.display = 'none';
            }

            if (currentStage !== nextStage) {
                const prevStage = currentStage;
                currentStage = nextStage;
                if (nextStage === 'climax' && prevStage !== 'climax') {
                    resetClimaxState();
                }
            }

            if (!rafId) {
                lastFrameTime = performance.now();
                rafId = requestAnimationFrame(loop);
            }
        },

        destroy() {
            this.setStage('none');
            if (rootEl && rootEl.parentNode) {
                rootEl.parentNode.removeChild(rootEl);
            }
            rootEl = null;
        }
    };
})();
