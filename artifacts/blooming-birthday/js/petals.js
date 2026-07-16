/**
 * petals.js — Canvas Petal Engine
 * Handles the full-screen petal/sparkle particle system.
 * Logic will be added in Phase 2.
 */

const canvas = document.getElementById('garden-canvas');
const ctx = canvas.getContext('2d');

let petals = [];
let animationId = null;
let isActive = false;

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

class Petal {
  constructor() {
    this.reset(true);
  }

  reset(initial = false) {
    this.x = Math.random() * window.innerWidth;
    this.y = initial ? Math.random() * window.innerHeight : -20;
    this.size = 4 + Math.random() * 8;
    this.speedY = 0.3 + Math.random() * 0.8;
    this.speedX = (Math.random() - 0.5) * 0.4;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotationSpeed = (Math.random() - 0.5) * 0.02;
    this.swayPhase = Math.random() * Math.PI * 2;
    this.swayAmplitude = 0.5 + Math.random() * 1.5;
    this.opacity = 0.3 + Math.random() * 0.5;
    this.color = Math.random() > 0.5 ? '#FFB7C5' : '#D4AF37';
  }

  update() {
    this.swayPhase += 0.01;
    this.x += this.speedX + Math.sin(this.swayPhase) * this.swayAmplitude * 0.3;
    this.y += this.speedY;
    this.rotation += this.rotationSpeed;

    if (this.y > window.innerHeight + 20) {
      this.reset();
    }
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.globalAlpha = this.opacity;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, this.size * 0.6, this.size, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function init() {
  resize();
  const count = window.innerWidth < 600 ? 25 : 50;
  petals = Array.from({ length: count }, () => new Petal());
}

function loop() {
  if (!isActive) return;
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  petals.forEach((p) => {
    p.update();
    p.draw();
  });
  animationId = requestAnimationFrame(loop);
}

export function start() {
  if (isActive) return;
  isActive = true;
  init();
  loop();
}

export function stop() {
  isActive = false;
  if (animationId) cancelAnimationFrame(animationId);
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
}

export function burst(x, y, count = 20) {
  for (let i = 0; i < count; i++) {
    const p = new Petal();
    p.x = x;
    p.y = y;
    p.speedY = -2 - Math.random() * 3;
    p.speedX = (Math.random() - 0.5) * 4;
    petals.push(p);
  }
  if (petals.length > 200) petals = petals.slice(-200);
}

window.addEventListener('resize', () => {
  if (isActive) resize();
});
