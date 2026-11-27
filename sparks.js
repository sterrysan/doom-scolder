// sparks.js - Broken-Electronic Electric Arcs & Physics Sparks Engine

(function (root) {
    function createSparkController(canvas, options = {}) {
        if (!canvas) return { setMode() {}, destroy() {} };
        const ctx = canvas.getContext('2d');
        const getAnchors = typeof options.getAnchors === 'function' ? options.getAnchors : null;

        let mode = 'safe'; // 'safe' | 'warn' | 'angry'
        let rafId = null;
        let lastFrameMs = 0;
        let nextBurstAt = 0;
        let destroyed = false;

        const sparks = [];
        const arcs = [];
        const flashes = [];

        function resizeIfNeeded() {
            const rect = canvas.getBoundingClientRect();
            const w = Math.max(1, Math.round(rect.width || canvas.clientWidth || 320));
            const h = Math.max(1, Math.round(rect.height || canvas.clientHeight || 400));
            if (canvas.width !== w || canvas.height !== h) {
                canvas.width = w;
                canvas.height = h;
            }
        }

        function defaultAnchors() {
            const w = canvas.width || 320;
            const h = canvas.height || 400;
            return [
                { x: w * 0.5, y: h * 0.36, r: Math.min(w, h) * 0.24 },
                { x: w * 0.5, y: h * 0.12, r: 16 }
            ];
        }

        function buildJaggedArc(x1, y1, x2, y2, roughness, depth) {
            let pts = [{ x: x1, y: y1 }, { x: x2, y: y2 }];
            let disp = roughness;
            for (let d = 0; d < depth; d++) {
                const next = [pts[0]];
                for (let i = 0; i < pts.length - 1; i++) {
                    const a = pts[i];
                    const b = pts[i + 1];
                    const mx = (a.x + b.x) / 2 + (Math.random() - 0.5) * disp;
                    const my = (a.y + b.y) / 2 + (Math.random() - 0.5) * disp;
                    next.push({ x: mx, y: my }, b);
                }
                pts = next;
                disp *= 0.55;
            }
            return pts;
        }

        function spawnBurst() {
            resizeIfNeeded();
            const cRect = canvas.getBoundingClientRect();
            const anchors = (getAnchors ? getAnchors(cRect) : null) || defaultAnchors();
            if (!anchors.length) return;

            const anchor = anchors[Math.floor(Math.random() * anchors.length)];
            const angle = Math.random() * Math.PI * 2;
            const r = anchor.r || 20;
            const ox = anchor.x + Math.cos(angle) * r;
            const oy = anchor.y + Math.sin(angle) * r;

            const isAngry = mode === 'angry';
            const arcLen = isAngry ? (26 + Math.random() * 54) : (16 + Math.random() * 28);
            const arcAngle = angle + (Math.random() - 0.5) * 1.4;
            const tx = ox + Math.cos(arcAngle) * arcLen;
            const ty = oy + Math.sin(arcAngle) * arcLen;

            const arcColors = isAngry
                ? ['#ff3b3b', '#ff7b00', '#7dd3fc']
                : ['#fbbf24', '#ff8c00'];
            const color = arcColors[Math.floor(Math.random() * arcColors.length)];

            arcs.push({
                pts: buildJaggedArc(ox, oy, tx, ty, isAngry ? 22 : 14, 3),
                color,
                life: 1.0,
                decay: isAngry ? (0.08 + Math.random() * 0.06) : (0.11 + Math.random() * 0.06),
                width: isAngry ? 2.2 : 1.6
            });

            // Optional secondary branch arc in angry mode
            if (isAngry && Math.random() < 0.6) {
                const bx = tx + (Math.random() - 0.5) * 44;
                const by = ty + (Math.random() - 0.5) * 44;
                arcs.push({
                    pts: buildJaggedArc(tx, ty, bx, by, 14, 2),
                    color: '#ff4d4d',
                    life: 0.9,
                    decay: 0.12,
                    width: 1.5
                });
            }

            // Flash glow at short-circuit origin
            flashes.push({
                x: ox,
                y: oy,
                radius: isAngry ? 24 : 15,
                color,
                life: 1.0
            });

            // Eject incandescent sparks with velocity + gravity
            const sparkCount = isAngry ? (7 + Math.floor(Math.random() * 9)) : (3 + Math.floor(Math.random() * 4));
            for (let i = 0; i < sparkCount; i++) {
                const sa = arcAngle + (Math.random() - 0.5) * 1.8;
                const speed = (isAngry ? 110 : 75) + Math.random() * (isAngry ? 210 : 110);
                sparks.push({
                    x: ox,
                    y: oy,
                    px: ox,
                    py: oy,
                    vx: Math.cos(sa) * speed,
                    vy: Math.sin(sa) * speed - (isAngry ? 45 : 25),
                    life: 1.0,
                    decay: 1.2 + Math.random() * 1.4,
                    size: (isAngry ? 1.5 : 1.1) + Math.random() * 1.2,
                    hot: isAngry
                });
            }
        }

        function scheduleNextBurst(now) {
            if (mode === 'angry') {
                nextBurstAt = now + 120 + Math.random() * 460;
            } else if (mode === 'warn') {
                nextBurstAt = now + 900 + Math.random() * 1800;
            } else {
                nextBurstAt = Infinity;
            }
        }

        function step(now) {
            if (destroyed) return;
            if (mode === 'safe' && sparks.length === 0 && arcs.length === 0 && flashes.length === 0) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                rafId = null;
                return;
            }

            if (document.visibilityState !== 'visible') {
                lastFrameMs = now;
                rafId = requestAnimationFrame(step);
                return;
            }

            resizeIfNeeded();
            const dt = lastFrameMs ? Math.min(0.05, (now - lastFrameMs) / 1000) : 0.016;
            lastFrameMs = now;

            if (mode !== 'safe' && now >= nextBurstAt) {
                spawnBurst();
                scheduleNextBurst(now);
            }

            const w = canvas.width;
            const h = canvas.height;
            ctx.clearRect(0, 0, w, h);

            // 1. Origin flashes
            for (let i = flashes.length - 1; i >= 0; i--) {
                const f = flashes[i];
                f.life -= dt * 7.5;
                if (f.life <= 0) {
                    flashes.splice(i, 1);
                    continue;
                }
                const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.radius);
                g.addColorStop(0, `rgba(255, 255, 255, ${f.life * 0.75})`);
                g.addColorStop(0.35, f.color + Math.round(f.life * 160).toString(16).padStart(2, '0'));
                g.addColorStop(1, 'rgba(0, 0, 0, 0)');
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
                ctx.fill();
            }

            // 2. Jagged electric arcs
            ctx.save();
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            for (let i = arcs.length - 1; i >= 0; i--) {
                const a = arcs[i];
                a.life -= a.decay;
                if (a.life <= 0) {
                    arcs.splice(i, 1);
                    continue;
                }

                // Colored outer corona
                ctx.beginPath();
                ctx.strokeStyle = a.color;
                ctx.globalAlpha = Math.max(0, a.life * 0.9);
                ctx.lineWidth = a.width * 2.1;
                ctx.shadowColor = a.color;
                ctx.shadowBlur = 12;
                ctx.moveTo(a.pts[0].x, a.pts[0].y);
                for (let j = 1; j < a.pts.length; j++) {
                    ctx.lineTo(a.pts[j].x, a.pts[j].y);
                }
                ctx.stroke();

                // White-hot inner filament
                ctx.beginPath();
                ctx.strokeStyle = '#ffffff';
                ctx.globalAlpha = Math.max(0, a.life);
                ctx.lineWidth = Math.max(0.8, a.width * 0.65);
                ctx.shadowBlur = 4;
                ctx.moveTo(a.pts[0].x, a.pts[0].y);
                for (let j = 1; j < a.pts.length; j++) {
                    ctx.lineTo(a.pts[j].x, a.pts[j].y);
                }
                ctx.stroke();
            }
            ctx.restore();

            // 3. Incandescent flying sparks with gravity & floor bounce
            ctx.save();
            ctx.lineCap = 'round';
            for (let i = sparks.length - 1; i >= 0; i--) {
                const s = sparks[i];
                s.px = s.x;
                s.py = s.y;
                s.vy += 420 * dt; // gravity
                s.vx *= (1 - 1.4 * dt); // air drag
                s.x += s.vx * dt;
                s.y += s.vy * dt;

                if (s.y >= h - 2 && s.vy > 0) {
                    s.y = h - 2;
                    s.vy = -s.vy * 0.42;
                    s.vx *= 0.72;
                }

                s.life -= s.decay * dt;
                if (s.life <= 0) {
                    sparks.splice(i, 1);
                    continue;
                }

                // Color cools as life drops: white -> gold -> orange -> red
                let strokeCol;
                if (s.life > 0.72) {
                    strokeCol = '#fffbeb';
                } else if (s.life > 0.45) {
                    strokeCol = s.hot ? '#fde047' : '#fcd34d';
                } else if (s.life > 0.22) {
                    strokeCol = '#fb923c';
                } else {
                    strokeCol = '#ef4444';
                }

                ctx.beginPath();
                ctx.globalAlpha = Math.min(1, s.life * 1.1);
                ctx.strokeStyle = strokeCol;
                ctx.lineWidth = s.size;
                ctx.shadowColor = strokeCol;
                ctx.shadowBlur = 6;
                ctx.moveTo(s.px, s.py);
                ctx.lineTo(s.x, s.y);
                ctx.stroke();
            }
            ctx.restore();

            rafId = requestAnimationFrame(step);
        }

        function setMode(nextMode) {
            if (destroyed) return;
            const prev = mode;
            mode = nextMode || 'safe';

            if (mode !== 'safe') {
                if (prev !== mode) {
                    const now = performance.now();
                    nextBurstAt = now + 40;
                    spawnBurst();
                    scheduleNextBurst(now);
                }
                if (!rafId) {
                    lastFrameMs = performance.now();
                    rafId = requestAnimationFrame(step);
                }
            }
        }

        function destroy() {
            destroyed = true;
            if (rafId) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
            sparks.length = 0;
            arcs.length = 0;
            flashes.length = 0;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }

        return { setMode, destroy };
    }

    root.DoomSparks = { createSparkController };
})(typeof self !== 'undefined' ? self : window);
