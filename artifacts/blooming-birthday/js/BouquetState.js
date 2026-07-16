/* ============================================================
   BouquetState.js — Single Source of Truth
   Immutable-style state manager with subscriber notifications.
   All scene logic reads/writes through this; never mutate directly.
   ============================================================ */

class BouquetState {
  constructor() {
    /* ── Initial State ─────────────────────────────────────── */
    this._state = {
      // Navigation
      scene: 0,               // 0-6 scene index
      sceneHistory: [],       // for potential back-navigation

      // Flower collection
      flowersCollected: 0,    // total count (0-6)
      flowersUnlocked: [],    // array of flower indices collected

      // Audio
      isAudioUnlocked: false, // user tapped to allow audio
      isMusicPlaying: false,
      isMuted: false,
      volume: 0.6,

      // Interaction flags
      userInteracted: false,   // any tap/click registered
      hasBlownCandle: false,   // mic gesture detected on finale
      candlesLit: 3,           // candles remaining

      // Timing
      sessionStartedAt: null,  // Date.now() when garden first opened
      lastInteractionAt: null,

      // Feature flags
      isReducedMotion: false,
      isMobile: false,
      isHighDPI: false,
    };

    /* ── Subscribers ───────────────────────────────────────── */
    // Map of eventName → Set of callbacks
    this._subscribers = new Map();

    /* ── Flower Definitions ────────────────────────────────── */
    // Ground truth for all flower metadata. SceneManager references this.
    this.FLOWERS = [
      {
        index: 0,
        key:   'rose',
        name:  'Mawar',
        meaning: 'Cinta yang tulus dan mendalam',
        scene: 2,            // unlocked in which scene
        color: '#C97D83',
      },
      {
        index: 1,
        key:   'tulip',
        name:  'Tulip',
        meaning: 'Keanggunan dan keindahan sejati',
        scene: 3,
        color: '#E8B4B8',
      },
      {
        index: 2,
        key:   'peony',
        name:  'Peoni',
        meaning: 'Kemakmuran dan kebahagian',
        scene: 3,
        color: '#F2D0D3',
      },
      {
        index: 3,
        key:   'babysBreath',
        name:  "Baby's Breath",
        meaning: 'Ikatan yang melampaui jarak',
        scene: 4,
        color: '#FFFFFF',
      },
      {
        index: 4,
        key:   'lavender',
        name:  'Lavender',
        meaning: 'Ketenangan dan kesetiaan',
        scene: 5,
        color: '#A78BC0',
      },
      {
        index: 5,
        key:   'daisy',
        name:  'Daisy',
        meaning: 'Keceriaan dan semangat baru',
        scene: 5,
        color: '#F5E9B5',
      },
    ];

    /* ── Boot Checks ───────────────────────────────────────── */
    this._detectEnvironment();
  }

  /* ── Environment Detection ─────────────────────────────── */

  _detectEnvironment() {
    const isMobile = window.matchMedia('(max-width: 768px)').matches
      || ('ontouchstart' in window);
    const isHighDPI = window.devicePixelRatio > 1;
    const isReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    // Direct assignment during construction — no subscribers exist yet
    Object.assign(this._state, {
      isMobile,
      isHighDPI,
      isReducedMotion,
      sessionStartedAt: Date.now(),
    });
  }

  /* ── Core get / set ────────────────────────────────────── */

  get(key) {
    return this._state[key];
  }

  getAll() {
    // Return a shallow copy to discourage mutation
    return { ...this._state };
  }

  /**
   * Update one or more state keys.
   * Emits 'change' for every key that actually changed,
   * then emits a batched 'update' with all changed keys.
   *
   * @param {Object} partial  — keys/values to merge
   */
  set(partial) {
    const changed = {};

    for (const [key, value] of Object.entries(partial)) {
      if (this._state[key] !== value) {
        this._state[key] = value;
        changed[key] = value;
        this._emit(`change:${key}`, value);
      }
    }

    if (Object.keys(changed).length > 0) {
      this._emit('update', changed);
    }
  }

  /* ── Flower Collection ─────────────────────────────────── */

  /**
   * Collect a flower by index.
   * Safe to call multiple times — idempotent.
   * @param {number} index — 0-5
   * @returns {boolean} true if this was a new collection
   */
  collectFlower(index) {
    const already = this._state.flowersUnlocked.includes(index);
    if (already) return false;

    const updated = [...this._state.flowersUnlocked, index];
    this.set({
      flowersUnlocked: updated,
      flowersCollected: updated.length,
      lastInteractionAt: Date.now(),
    });

    this._emit('flower:collected', {
      index,
      flower: this.FLOWERS[index],
      total: updated.length,
    });

    return true;
  }

  hasFlower(index) {
    return this._state.flowersUnlocked.includes(index);
  }

  isComplete() {
    return this._state.flowersCollected >= this.FLOWERS.length;
  }

  /* ── Scene Navigation ──────────────────────────────────── */

  goToScene(index) {
    const prev = this._state.scene;
    if (prev === index) return;

    this.set({
      scene: index,
      sceneHistory: [...this._state.sceneHistory, prev],
    });

    this._emit('scene:change', { from: prev, to: index });
  }

  /* ── Audio ─────────────────────────────────────────────── */

  unlockAudio() {
    if (this._state.isAudioUnlocked) return;
    this.set({ isAudioUnlocked: true });
    this._emit('audio:unlocked');
  }

  /* ── Pub/Sub ────────────────────────────────────────────── */

  /**
   * Subscribe to an event.
   * @param {string}   event   — e.g. 'flower:collected', 'change:scene'
   * @param {Function} handler — called with the event payload
   * @returns {Function} unsubscribe function
   */
  on(event, handler) {
    if (!this._subscribers.has(event)) {
      this._subscribers.set(event, new Set());
    }
    this._subscribers.get(event).add(handler);

    // Return an unsubscribe function
    return () => this.off(event, handler);
  }

  off(event, handler) {
    const set = this._subscribers.get(event);
    if (set) set.delete(handler);
  }

  _emit(event, payload) {
    const set = this._subscribers.get(event);
    if (!set || set.size === 0) return;
    for (const handler of set) {
      try {
        handler(payload);
      } catch (err) {
        console.error(`[BouquetState] Handler error for "${event}":`, err);
      }
    }
  }

  /* ── Debug ─────────────────────────────────────────────── */

  debug() {
    console.group('[BouquetState] Current State');
    console.table(this._state);
    console.log('Flowers:', this._state.flowersUnlocked.map(
      i => this.FLOWERS[i]?.name
    ));
    console.groupEnd();
  }
}

/* ── Singleton export ──────────────────────────────────────── */
// Instantiated once here; imported modules receive the same instance.
const state = new BouquetState();

// Expose to window for cross-module access without a bundler
window.BouquetState = state;
