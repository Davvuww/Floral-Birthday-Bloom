/* ============================================================
   main.js — Application Entry Point
   Initialises GSAP, wires up the ParticleEngine, sets up the
   loading screen, and exposes the global Garden object.
   ============================================================ */

/* ── 1. GSAP Plugin Registration ─────────────────────────── */
// gsap, MotionPathPlugin, TextPlugin loaded via <script> tags in HTML.
// We register here once the DOM is ready.

function registerGSAPPlugins() {
  if (typeof gsap === 'undefined') {
    console.error('[Garden] GSAP not found — ensure CDN scripts loaded before main.js');
    return false;
  }
  gsap.registerPlugin(MotionPathPlugin, TextPlugin);

  // Global GSAP defaults for this project
  gsap.defaults({
    ease:     'power2.out',
    duration: 0.6,
  });

  // Prevent GSAP from fighting with CSS transitions on reduced-motion users
  if (window.BouquetState?.get('isReducedMotion')) {
    gsap.globalTimeline.timeScale(20); // run animations near-instantly
  }

  console.log(`[Garden] GSAP ${gsap.version} ready ✓`);
  return true;
}

/* ── 2. Particle Engine Bootstrap ────────────────────────── */

function initParticleEngine() {
  const canvas = document.getElementById('particle-canvas');
  if (!canvas) {
    console.warn('[Garden] #particle-canvas not found — particles disabled');
    return null;
  }

  const isMobile = window.BouquetState?.get('isMobile') ?? false;
  const maxParticles = isMobile ? 50 : 150;

  const engine = new ParticleEngine(canvas, { maxParticles });
  engine.start();

  // Expose globally so scene modules can trigger bursts
  window.Garden.particles = engine;

  console.log(`[Garden] ParticleEngine started — ${maxParticles} particles ✓`);
  return engine;
}

/* ── 3. Loading Screen ────────────────────────────────────── */

/**
 * Animate the loading bar from 0 to 100% over ~800ms,
 * then fade out the loading screen.
 */
function runLoadingSequence() {
  return new Promise((resolve) => {
    const bar    = document.querySelector('.loading-bar-fill');
    const screen = document.getElementById('loading-screen');

    if (!screen) { resolve(); return; }

    // Simulate asset load progress (actual fonts loaded via CSS @import)
    const stages = [
      { pct: 30, delay: 80  },
      { pct: 60, delay: 200 },
      { pct: 85, delay: 350 },
      { pct: 100, delay: 550 },
    ];

    const tick = (i) => {
      if (i >= stages.length) {
        // All stages done — hold briefly then dissolve
        setTimeout(() => {
          dismissLoadingScreen(screen, resolve);
        }, 250);
        return;
      }
      setTimeout(() => {
        if (bar) bar.style.width = `${stages[i].pct}%`;
        tick(i + 1);
      }, stages[i].delay);
    };

    tick(0);
  });
}

function dismissLoadingScreen(screen, callback) {
  if (!screen) { callback?.(); return; }

  gsap.to(screen, {
    opacity:    0,
    duration:   0.8,
    ease:       'power2.inOut',
    onComplete: () => {
      screen.classList.add('hidden');
      callback?.();
    },
  });
}

/* ── 4. RAF Loop (global tick) ────────────────────────────── */
/*
   GSAP manages its own ticker; we expose a secondary one here for
   any scene logic that needs frame-by-frame callbacks outside GSAP.
   Usage: Garden.onTick(handler) / Garden.offTick(handler)
*/

const _tickHandlers = new Set();
let   _rafHandle    = null;
let   _lastTime     = 0;

function _rafLoop(now) {
  const delta = now - _lastTime;  // ms since last frame
  _lastTime   = now;

  for (const fn of _tickHandlers) {
    try { fn(delta, now); } catch (e) { console.error('[Garden] tick error', e); }
  }

  _rafHandle = requestAnimationFrame(_rafLoop);
}

function startRAFLoop() {
  if (_rafHandle) return;
  _lastTime  = performance.now();
  _rafHandle = requestAnimationFrame(_rafLoop);
}

/* ── 5. Garden Namespace ──────────────────────────────────── */

window.Garden = {
  // Sub-systems (populated after init)
  particles: null,
  state:     null,  // alias → window.BouquetState

  // Tick API
  onTick(fn)  { _tickHandlers.add(fn); },
  offTick(fn) { _tickHandlers.delete(fn); },

  // Convenience: play a GSAP tween with project defaults
  tween(targets, vars) {
    return gsap.to(targets, vars);
  },

  // Convenience: create a GSAP timeline with project defaults
  timeline(vars = {}) {
    return gsap.timeline(vars);
  },

  // Emit a named DOM custom event (for cross-module communication)
  emit(name, detail = {}) {
    document.dispatchEvent(new CustomEvent(`garden:${name}`, { detail }));
  },

  // Listen for a named garden event
  on(name, handler) {
    document.addEventListener(`garden:${name}`, (e) => handler(e.detail));
  },
};

/* ── 6. Boot Sequence ────────────────────────────────────── */

async function boot() {
  console.log('[Garden] Booting…');

  // Wire state alias
  Garden.state = window.BouquetState;

  // Register GSAP plugins
  const gsapReady = registerGSAPPlugins();
  if (!gsapReady) return;

  // Start RAF loop
  startRAFLoop();

  // Init particle engine
  initParticleEngine();

  // Run loading animation then reveal the app
  await runLoadingSequence();

  // Signal to scene logic that the foundation is ready
  Garden.emit('ready');
  console.log('[Garden] Boot complete ✓');
}

/* ── 7. Entry Point ──────────────────────────────────────── */

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  // Already parsed (deferred/async script)
  boot();
}
