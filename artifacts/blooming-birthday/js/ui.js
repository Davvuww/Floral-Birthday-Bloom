/**
 * ui.js — UI Interactions Module
 * Handles scene transitions, gift box, letter typing, scrapbook,
 * distance thread, candle blowing, and bouquet collection.
 * Logic will be added in Phase 2.
 */

export const scenes = {
  preloader: document.getElementById('scene-preloader'),
  unboxing: document.getElementById('scene-unboxing'),
  letter: document.getElementById('scene-letter'),
  scrapbook: document.getElementById('scene-scrapbook'),
  distance: document.getElementById('scene-distance'),
  voice: document.getElementById('scene-voice'),
  finale: document.getElementById('scene-finale'),
};

export function showScene(id) {
  Object.values(scenes).forEach((el) => {
    if (el) el.classList.remove('is-active');
  });
  const target = scenes[id];
  if (target) {
    target.classList.add('is-active');
    target.focus({ preventScroll: true });
  }
}

export function updateProgressNav(sceneIndex) {
  document.querySelectorAll('.progress-dot').forEach((dot) => {
    dot.classList.toggle('is-active', Number(dot.dataset.scene) === sceneIndex);
  });
}

export function showPersistentUI() {
  document.getElementById('progress-nav')?.classList.add('is-visible');
  document.getElementById('vase-container')?.classList.add('is-visible');
}
