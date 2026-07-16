/**
 * audio.js — Audio Controls Module
 * Handles background music playback, volume control, and voice note.
 * Logic will be added in Phase 2.
 */

const bgMusic = document.getElementById('bg-music');
const voiceAudio = document.getElementById('voice-audio');

let musicPlaying = false;
let voicePlaying = false;

export function initAudio() {
  bgMusic.volume = 0.3;
  voiceAudio.volume = 0.8;
}

export function playMusic() {
  if (musicPlaying) return;
  const p = bgMusic.play();
  if (p) p.then(() => { musicPlaying = true; }).catch(() => {});
}

export function pauseMusic() {
  bgMusic.pause();
  musicPlaying = false;
}

export function toggleMusic() {
  if (musicPlaying) pauseMusic();
  else playMusic();
}

export function setVolume(vol) {
  bgMusic.volume = Math.max(0, Math.min(1, vol));
}

export function playVoice() {
  if (voicePlaying) return;
  const p = voiceAudio.play();
  if (p) p.then(() => { voicePlaying = true; }).catch(() => {});
}

export function pauseVoice() {
  voiceAudio.pause();
  voicePlaying = false;
}

export function toggleVoice() {
  if (voicePlaying) pauseVoice();
  else playVoice();
}
