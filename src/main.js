// main.js — canvas sizing and the fixed-step game loop.

import { Game } from './game.js';
import { VIEW_W, VIEW_H } from './render.js';
import { buildArt } from './art.js';
import { Input } from './input.js';
import { sfx } from './audio.js';

const STEP = 1 / 120;          // physics step; rendering is per animation frame
const MAX_FRAME = 0.25;

buildArt();

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
canvas.width = VIEW_W;
canvas.height = VIEW_H;
ctx.imageSmoothingEnabled = false;

function resize() {
  const scale = Math.max(1, Math.min(
    Math.floor(window.innerWidth / VIEW_W),
    Math.floor(window.innerHeight / VIEW_H),
  ));
  canvas.style.width = `${VIEW_W * scale}px`;
  canvas.style.height = `${VIEW_H * scale}px`;
}
window.addEventListener('resize', resize);
resize();

const input = new Input(window);
const game = new Game(ctx);

// first gesture unlocks WebAudio
for (const ev of ['pointerdown', 'keydown']) {
  window.addEventListener(ev, () => sfx.tone({ freq: 1, dur: 0.01, gain: 0.0001 }), { once: true });
}

let last = performance.now() / 1000;
let acc = 0;
let fpsAvg = 60;

function frame(now) {
  requestAnimationFrame(frame);
  const t = now / 1000;
  let dt = Math.min(MAX_FRAME, t - last);
  last = t;
  fpsAvg += (1 / Math.max(dt, 0.0001) - fpsAvg) * 0.05;
  game.fps = fpsAvg;

  input.poll();
  acc += dt;
  let steps = 0;
  while (acc >= STEP && steps < 8) {
    game.update(STEP, input);
    acc -= STEP;
    steps++;
    input.pressed.clear();         // an edge is consumed by exactly one step
    input.released.clear();
  }
  input.flush();
  game.draw(dt);
}
requestAnimationFrame(frame);
