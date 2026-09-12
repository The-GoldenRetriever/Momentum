// main.js — canvas sizing and the fixed-step game loop.

import { Game } from './game.js';
import { P } from './player.js';
import { VIEW_W, VIEW_H } from './render.js';
import { buildArt } from './art.js';
import { Input, keyName } from './input.js';
import { sfx } from './audio.js';

const STEP = 1 / 120;          // physics step; rendering is per animation frame
const MAX_FRAME = 0.25;

buildArt();

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
canvas.width = VIEW_W;
canvas.height = VIEW_H;
ctx.imageSmoothingEnabled = false;

// Fill as much of the window as the aspect ratio allows. Whole-number scaling
// is sharper, so take it whenever it costs less than a sliver of the screen.
function resize() {
  const fit = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
  const whole = Math.max(1, Math.floor(fit));
  const scale = (fit - whole) / fit < 0.08 ? whole : fit;
  canvas.style.width = `${Math.round(VIEW_W * scale)}px`;
  canvas.style.height = `${Math.round(VIEW_H * scale)}px`;
}
window.addEventListener('resize', resize);
document.addEventListener('fullscreenchange', resize);
resize();

const input = new Input(window);
const game = new Game(ctx, input);

// The controls line reads back whatever is actually bound, so it stays honest
// after a trip through the binding screen.
function writeHint() {
  const keys = (action, n = 2) =>
    input.keysFor(action).slice(0, n).map(keyName).join('/').toLowerCase() || 'unbound';
  const hint = document.getElementById('hint');
  if (hint) {
    hint.textContent = `jump ${keys('jump', 3)} \u00b7 dash ${keys('dash')} \u00b7 ` +
      `ledges ${keys('vault')} (hold) \u00b7 burst ${keys('burst', 1)} \u00b7 ` +
      `o controls \u00b7 f fullscreen`;
  }
}
writeHint();

// F toggles fullscreen — the game is meant to be played big.
window.addEventListener('keydown', (e) => {
  if (e.code !== 'KeyF' || game.menu?.open) return;
  e.preventDefault();
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.().catch(() => {});
});

// first gesture unlocks WebAudio
for (const ev of ['pointerdown', 'keydown']) {
  window.addEventListener(ev, () => sfx.tone({ freq: 1, dur: 0.01, gain: 0.0001 }), { once: true });
}

let last = performance.now() / 1000;
let acc = 0;
let fpsAvg = 60;
let scale = 1;                 // eased world time: 1 normally, BURST_SCALE mid-burst

function frame(now) {
  requestAnimationFrame(frame);
  const t = now / 1000;
  let dt = Math.min(MAX_FRAME, t - last);
  last = t;
  fpsAvg += (1 / Math.max(dt, 0.0001) - fpsAvg) * 0.05;
  game.fps = fpsAvg;

  // A burst slows the world down — including the run clock, which only ticks
  // on simulated time. Easing the scale keeps the transition from snapping, and
  // it drops in far faster than it lifts: the whole point of the wind-up beat
  // is that the world is already crawling by the time the burst fires.
  const target = game.player.timeWarped ? P.BURST_SCALE : 1;
  scale += (target - scale) * Math.min(1, dt * (target < scale ? 30 : 9));
  game.timeScale = scale;

  input.poll();
  acc += dt * scale;
  // Slow motion shrinks the simulated step to match, so the world still ticks at
  // ~120Hz of real time however deep the slow-mo goes: bullet time on a fixed
  // step would judder badly. The floor is the scale itself, which keeps one
  // step worth exactly STEP of wall clock — the clock the wind-up counts on.
  const step = STEP * Math.max(scale, P.BURST_SCALE);
  let steps = 0;
  while (acc >= step && steps < 12) {
    // shrinking the step with the scale means one step is always STEP of real
    // time, which is the clock the burst wind-up counts on
    game.update(step, input, STEP);
    acc -= step;
    steps++;
    input.pressed.clear();         // an edge is consumed by exactly one step
    input.released.clear();
  }
  input.flush();
  game.draw(dt * scale, dt);
}
requestAnimationFrame(frame);
