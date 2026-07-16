/* ============================================================
   ParticleEngine.js — Canvas 2D Particle System
   Handles high-DPI scaling, ambient pollen particles,
   and on-demand burst effects. 60 FPS optimised.
   ============================================================ */

class ParticleEngine {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {Object}            opts
   * @param {number}            [opts.maxParticles=80]
   */
  constructor(canvas, opts = {}) {
    if (!canvas) throw new Error('[ParticleEngine] canvas element required');

    this.canvas  = canvas;
    this.ctx     = canvas.getContext('2d');
    this.opts    = {
      maxParticles:   opts.maxParticles ?? 80,
      gravity:        opts.gravity      ?? 0.012,   // very gentle drift down
      windX:          opts.windX        ?? 0.008,   // slight horizontal drift
    };

    /* ── Internal state ─────────────────────────────────── */
    this.particles  = [];       // active ambient particles
    this.bursts     = [];       // on-demand burst particles (separate pool)
    this._raf       = null;
    this._running   = false;
    this._dpr       = 1;        // set in resize()

    /* ── Colour palette (warm pollen tones) ─────────────── */
    this.palette = [
      { r: 212, g: 175, b:  55, a: 0.70 },   // gold
      { r: 232, g: 180, b: 184, a: 0.60 },   // blush
      { r: 245, g: 233, b: 181, a: 0.65 },   // champagne pale
      { r: 255, g: 255, b: 255, a: 0.45 },   // white baby's breath
      { r: 167, g: 139, b: 192, a: 0.50 },   // lavender
    ];

    this._resize();
    this._bindResize();
  }

  /* ── Setup ──────────────────────────────────────────────── */

  _resize() {
    this._dpr = Math.min(window.devicePixelRatio || 1, 2); // cap at 2× for perf
    const w   = window.innerWidth;
    const h   = window.innerHeight;

    // Physical pixel size
    this.canvas.width  = w * this._dpr;
    this.canvas.height = h * this._dpr;

    // CSS display size
    this.canvas.style.width  = `${w}px`;
    this.canvas.style.height = `${h}px`;

    // Scale context so all draw calls use logical (CSS) coordinates
    this.ctx.scale(this._dpr, this._dpr);

    this.W = w;
    this.H = h;
  }

  _bindResize() {
    let debounce;
    window.addEventListener('resize', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        // Re-scale after resize; particles survive but may be off-canvas briefly
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);  // reset transform
        this._resize();
      }, 150);
    });
  }

  /* ── Particle Factory ───────────────────────────────────── */

  _randomColor() {
    return this.palette[Math.floor(Math.random() * this.palette.length)];
  }

  /**
   * Create one ambient pollen particle.
   * Spawns near the top of the viewport, drifts down with sine wave.
   */
  _spawnAmbient() {
    const c = this._randomColor();
    return {
      type:  'ambient',
      x:     Math.random() * this.W,
      y:     -8 - Math.random() * 40,       // start above viewport
      vx:    (Math.random() - 0.5) * 0.4,
      vy:    0.25 + Math.random() * 0.55,   // gentle downward drift
      r:     1.5 + Math.random() * 2.5,     // radius 1.5–4px
      phase: Math.random() * Math.PI * 2,  // sine wave phase offset
      freq:  0.005 + Math.random() * 0.01, // sine oscillation speed
      amp:   12 + Math.random() * 20,      // sine oscillation width
      c,
      alpha: c.a * (0.4 + Math.random() * 0.6),
      life:  1,                             // 0–1, ambient don't die
    };
  }

  /**
   * Create one burst particle emanating from (cx, cy).
   * @param {number} cx   — origin x
   * @param {number} cy   — origin y
   * @param {Object} opts — { count, color, radius, speed }
   */
  _spawnBurst(cx, cy, opts = {}) {
    const count  = opts.count  ?? 20;
    const speed  = opts.speed  ?? (2.5 + Math.random() * 3);
    const color  = opts.color  ?? this._randomColor();

    const particles = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const spd   = speed * (0.4 + Math.random() * 0.7);
      particles.push({
        type:  'burst',
        x:     cx,
        y:     cy,
        vx:    Math.cos(angle) * spd,
        vy:    Math.sin(angle) * spd,
        r:     (opts.radius ?? 2.5) * (0.5 + Math.random() * 0.7),
        c:     color,
        alpha: 0.9,
        life:  1,       // 1 → 0 as particle dies
        decay: 0.015 + Math.random() * 0.012,
      });
    }
    return particles;
  }

  /* ── Public API ─────────────────────────────────────────── */

  /**
   * Trigger a pollen burst at a specific point.
   * @param {number} cx
   * @param {number} cy
   * @param {Object} [opts]  — count, color {r,g,b,a}, radius, speed
   */
  burst(cx, cy, opts = {}) {
    const newParticles = this._spawnBurst(cx, cy, opts);
    this.bursts.push(...newParticles);
  }

  /**
   * Convenience: gold burst for flower bloom events.
   */
  goldBurst(cx, cy, count = 22) {
    this.burst(cx, cy, {
      count,
      color: { r: 212, g: 175, b: 55, a: 0.85 },
      radius: 3,
      speed: 3.5,
    });
  }

  /**
   * Convenience: blush burst for collection events.
   */
  blushBurst(cx, cy, count = 18) {
    this.burst(cx, cy, {
      count,
      color: { r: 232, g: 180, b: 184, a: 0.80 },
      radius: 2.5,
      speed: 3,
    });
  }

  start() {
    if (this._running) return;
    this._running = true;

    // Seed initial ambient particles spread across viewport
    const seed = Math.round(this.opts.maxParticles * 0.6);
    for (let i = 0; i < seed; i++) {
      const p = this._spawnAmbient();
      p.y = Math.random() * this.H; // distribute vertically at start
      this.particles.push(p);
    }

    this._loop();
  }

  stop() {
    this._running = false;
    if (this._raf) {
      cancelAnimationFrame(this._raf);
      this._raf = null;
    }
  }

  clear() {
    this.particles = [];
    this.bursts = [];
    this.ctx.clearRect(0, 0, this.W, this.H);
  }

  /* ── Render Loop ────────────────────────────────────────── */

  _loop() {
    if (!this._running) return;
    this._raf = requestAnimationFrame(() => this._loop());
    this._update();
    this._draw();
  }

  _update() {
    const { gravity, windX } = this.opts;
    const t = performance.now() * 0.001;  // seconds

    /* Ambient particles */
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      // Sine-wave horizontal drift
      p.x += p.vx + Math.sin(t * p.freq * 60 + p.phase) * p.amp * 0.004;
      p.y += p.vy + gravity;
      p.vx += windX * 0.02;

      // Recycle when off-screen
      if (p.y > this.H + 10 || p.x < -20 || p.x > this.W + 20) {
        this.particles[i] = this._spawnAmbient();
      }
    }

    // Maintain population
    while (this.particles.length < this.opts.maxParticles) {
      this.particles.push(this._spawnAmbient());
    }

    /* Burst particles */
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const p = this.bursts[i];
      p.x  += p.vx;
      p.y  += p.vy;
      p.vx *= 0.96;         // air resistance
      p.vy *= 0.96;
      p.vy += gravity * 2;  // burst particles fall faster
      p.life  -= p.decay;
      p.alpha  = Math.max(0, p.life * p.c.a);

      if (p.life <= 0) {
        this.bursts.splice(i, 1);
      }
    }
  }

  _draw() {
    const { ctx, W, H } = this;
    ctx.clearRect(0, 0, W, H);

    // Draw ambient particles
    for (const p of this.particles) {
      this._drawDot(p);
    }

    // Draw burst particles on top
    for (const p of this.bursts) {
      this._drawDot(p, true);
    }
  }

  _drawDot(p, glow = false) {
    const { ctx } = this;
    const { r, g, b } = p.c;
    const alpha = p.alpha ?? p.c.a;

    ctx.save();
    ctx.globalAlpha = alpha;

    if (glow) {
      // Soft glow for burst particles
      ctx.shadowColor  = `rgba(${r},${g},${b},0.6)`;
      ctx.shadowBlur   = p.r * 3;
    }

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${r},${g},${b},1)`;
    ctx.fill();

    ctx.restore();
  }

  /* ── Debug ──────────────────────────────────────────────── */

  debug() {
    console.log(
      `[ParticleEngine] ambient=${this.particles.length} burst=${this.bursts.length} DPR=${this._dpr} ${this.W}×${this.H}`
    );
  }
}

// Expose globally
window.ParticleEngine = ParticleEngine;
