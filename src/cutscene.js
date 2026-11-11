// cutscene.js — what plays between a finished level and the next one, when
// you pick "next level": the character walks on from the goal under
// letterbox bars, the picture fades to black, and a loading screen shows a
// white silhouette of them still walking, bottom left, while the next level
// is built behind it.

import { VIEW_W, VIEW_H } from './render.js';
import { sprites, makeCanvas, FRAME_COUNT, SPRITE_W, SPRITE_H } from './art.js';

export const WALK_TIME = 1.8;      // seconds of walking off before the cut
export const WALK_SPEED = 80;      // px/s: a walk, not a run
export const FADE_TIME = 0.45;     // the last part of the walk fades to black
export const LOAD_TIME = 1.6;      // how long the loading screen holds
const BAR_H = 26;                  // letterbox bars, top and bottom
const SIL_SCALE = 2;

/** Black bars sliding in, `k` 0..1. */
export function drawLetterbox(ctx, k) {
  const h = Math.round(BAR_H * k);
  if (h <= 0) return;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, VIEW_W, h);
  ctx.fillRect(0, VIEW_H - h, VIEW_W, h);
}

export function drawFade(ctx, a) {
  if (a <= 0) return;
  ctx.fillStyle = `rgba(0,0,0,${Math.min(1, a).toFixed(3)})`;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

// The run cycle, filled white: made once, the first time it is needed.
let silhouettes = null;
function silhouetteFrames() {
  if (silhouettes) return silhouettes;
  const frames = sprites.run?.[0] ?? sprites.idle[0];
  silhouettes = frames.map((img) => {
    const c = makeCanvas(SPRITE_W, SPRITE_H);
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, SPRITE_W, SPRITE_H);
    return c;
  });
  return silhouettes;
}

/** The loading screen: black, with the character walking in silhouette in
 *  the bottom left corner. `t` is seconds since it came up. */
export function drawLoading(ctx, t) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const frames = silhouetteFrames();
  // the same stride the game walks at, a little slower than a run
  const n = FRAME_COUNT.run ?? frames.length;
  const frame = frames[Math.floor(t / 0.11) % Math.min(n, frames.length)];
  const x = 18, y = VIEW_H - 18 - SPRITE_H * SIL_SCALE;
  const bob = Math.floor(t / 0.11) % 2;     // a step's worth of rise and fall
  ctx.drawImage(frame, x, y - bob, SPRITE_W * SIL_SCALE, SPRITE_H * SIL_SCALE);
}
