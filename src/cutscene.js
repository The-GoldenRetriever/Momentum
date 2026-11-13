// cutscene.js — what plays between a finished level and the next one, when
// you pick "next level": the character walks on from the goal under
// letterbox bars, through the level's invisible end wall and off the edge of
// the screen (the camera stops at the edge, they do not), the picture fades
// to black, and a loading screen introduces the next level (its name, blurb,
// medals, a tip, its shape in miniature) while it is built behind it.

import { VIEW_W, VIEW_H } from './render.js';
import { sprites, makeCanvas, FRAME_COUNT, SPRITE_W, SPRITE_H } from './art.js';
import { drawText, textWidth } from './font.js';
import { T, isSlope } from './level.js';
import { stride } from './player.js';

export const WALK_SPEED = 120;     // px/s: a brisk walk, not a run. The run-out
                                   // past a goal is about twenty tiles, so this
                                   // has them off screen in two or three seconds
export const WALK_MAX = 6;         // ... and if something stops them, cut anyway
export const OFF_EDGE = 6;         // px past the edge, box and all, before the
                                   // fade starts: the sprite has gone by then
export const FADE_TIME = 0.4;      // then the picture fades to black
export const LOAD_TIME = 2.4;      // how long the loading screen holds (time
                                   // to read it; jump or enter skips it once
                                   // the level is ready)
const BAR_H = 26;                  // letterbox bars, top and bottom
const SIL_SCALE = 1;               // the silhouette at the sprite's own size: a
                                   // small figure in the corner, not a centrepiece

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

// A cycle (run or sprint), filled white: made once each, when first needed.
const silhouettes = {};
function silhouetteFrames(name) {
  if (silhouettes[name]) return silhouettes[name];
  const frames = sprites[name]?.[0] ?? sprites.idle[0];
  silhouettes[name] = frames.map((img) => {
    const c = makeCanvas(SPRITE_W, SPRITE_H);
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, SPRITE_W, SPRITE_H);
    return c;
  });
  return silhouettes[name];
}

// A line of advice under each loading screen, one picked each time.
export const TIPS = [
  'Hold your speed through the top-off: lose any and it starts over.',
  'V switches bursting off and on. The water and the big gaps want it off.',
  'A dash fills no bar. Running does.',
  'Water holds you at a full bar\'s speed, or a burst\'s, and nothing slower.',
  'Coming down costs nothing. Land running.',
  'C takes a ledge in your stride. On a downhill, C rolls.',
  'Slide under the low rock, and be on your feet by the far side.',
  'A respawn means an empty bar: the run-up after a flag is there to refill it.',
  'Gold is par or better. An expert run always earns it.',
  'The bar holds more than one bar: the overfill is top gear.',
];

/** The level in miniature, one pixel a tile, in a single colour: the shape of
 *  what is coming, drifting behind the loading screen's text. */
export function levelMap(L, colour) {
  const c = makeCanvas(L.w, L.h);
  const g = c.getContext('2d');
  g.fillStyle = colour;
  for (let ty = 0; ty < L.h; ty++) {
    for (let tx = 0; tx < L.w; tx++) {
      const t = L.get(tx, ty);
      if (t === T.SOLID || t === T.LOWCEIL || isSlope(t)) g.fillRect(tx, ty, 1, 1);
    }
  }
  return c;
}

/** The loading screen. The next level's sky, very dim, with its shape drifting
 *  across it; its number, name (typed out), difficulty and blurb; your best
 *  time and the medals to beat; a tip; and the character running in white
 *  silhouette along a bar that fills as the level is built. `t` is seconds
 *  since it came up; `info` (from Game) carries the theme, map, best and
 *  medals, and the tip. */
export function drawLoading(ctx, t, index = null, lv = null, info = null) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const fade = (from, len = 0.35) => Math.max(0, Math.min(1, (t - from) / len));
  const th = info?.theme;
  if (th) {
    // the level's own sky, held down to a glow at the horizon
    ctx.globalAlpha = 0.42 * fade(0, 0.5);
    const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    grad.addColorStop(0, '#000000');
    grad.addColorStop(0.55, th.sky[1]);
    grad.addColorStop(1, th.sky[3]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.globalAlpha = 1;
  }
  if (info?.map) {
    // the map, scaled to fill the width with room to drift
    const m = info.map, scale = Math.max(1, (VIEW_W * 1.25) / m.width);
    const w = Math.round(m.width * scale), h = Math.round(m.height * scale);
    const x = Math.round(-((t * 12) % Math.max(1, w - VIEW_W)) - 10), y = VIEW_H - h + 8;
    ctx.globalAlpha = 0.16 * fade(0.05, 0.6);
    ctx.drawImage(m, x, y, w, h);
    ctx.globalAlpha = 1;
  }
  const mid = (str, y, col, sc, a) => {
    if (a <= 0) return;
    ctx.globalAlpha = a;
    drawText(ctx, str, Math.round((VIEW_W - textWidth(str, sc) + sc) / 2), y, col, sc);
    ctx.globalAlpha = 1;
  };
  if (lv) {
    const accent = th?.edge ?? '#8a80b0';
    const top = Math.round(VIEW_H / 2 - 44);
    mid(`level ${index + 1}`, top, '#8a80b0', 1, fade(0.05));
    // the name types itself out, a letter at a time
    const shown = lv.name.slice(0, Math.floor(Math.max(0, t - 0.12) / 0.035));
    if (shown) {
      const full = textWidth(lv.name, 3);
      drawText(ctx, shown, Math.round((VIEW_W - full + 3) / 2), top + 12, '#ffffff', 3);
    }
    // an underline in the level's colour, drawn out from the middle
    const ul = Math.round((textWidth(lv.name, 3) / 2 + 8) * fade(0.25, 0.4));
    if (ul > 0) { ctx.fillStyle = accent; ctx.fillRect(VIEW_W / 2 - ul, top + 32, ul * 2, 1); }
    mid('*'.repeat(lv.difficulty ?? 1), top + 38, '#ff9ecd', 1, fade(0.35));
    (lv.blurb ?? []).forEach((line, i) => mid(line, top + 52 + i * 9, '#b9b2d6', 1, fade(0.45 + i * 0.08)));
    if (info?.medals) {
      const y = top + 52 + (lv.blurb?.length ?? 0) * 9 + 10;
      const parts = info.medals.map((m) => [`${m.name} ${fmt(m.time)}`, m.colour]);
      const best = info.best ? [`best ${fmt(info.best)}`, '#7dffc4'] : ['no time yet', '#6f649c'];
      const all = [best, ...parts];
      const gap = 14, total = all.reduce((a, [str]) => a + textWidth(str, 1), 0) + gap * (all.length - 1);
      let x = Math.round((VIEW_W - total) / 2);
      ctx.globalAlpha = fade(0.6);
      for (const [str, col] of all) { drawText(ctx, str, x, y, col, 1); x += textWidth(str, 1) + gap; }
      ctx.globalAlpha = 1;
    }
    if (info?.tip) mid(info.tip, VIEW_H - 40, '#6f649c', 1, fade(0.75));
  }
  // The runner, on a bar that fills as the level is built. It runs as the
  // game would at the pace it crosses the bar: the same cycle (at this pace,
  // the sprint), the same cadence, its own hip rise and fall (the frames
  // carry it: nothing is added), and the scarf streaming behind, as in play.
  const barX = 14, barY = VIEW_H - 14, barW = VIEW_W - 28;
  const loadTime = info?.loadTime ?? 1.6;
  const pace = (barW - SPRITE_W) / loadTime;
  const { name, rate } = stride(pace);
  const frames = silhouetteFrames(name);
  const n = Math.min(FRAME_COUNT[name] ?? frames.length, frames.length);
  const frame = frames[Math.floor(t / rate) % n];
  const k = Math.min(1, t / loadTime);
  ctx.fillStyle = '#1c1830';
  ctx.fillRect(barX, barY, barW, 1);
  ctx.fillStyle = th?.edge ?? '#9cf6ff';
  ctx.fillRect(barX, barY, Math.round(barW * k), 1);
  const rx = barX + Math.round((barW - SPRITE_W) * k);
  const ry = barY - SPRITE_H * SIL_SCALE;
  ctx.drawImage(frame, rx, ry, SPRITE_W * SIL_SCALE, SPRITE_H * SIL_SCALE);
  // the scarf, from where the game ties it (two pixels behind the middle of
  // the body, six down from the top of the hitbox), streaming back and
  // rippling down its length as it does at speed
  // (a ribbon, stroked link to link as the game draws it, not a row of dots)
  ctx.fillStyle = '#ffffff';
  const ax = rx + SPRITE_W / 2 - 2, ay = ry + 4 + 6;
  const link = (i) => [ax - i * 2.8, ay + Math.sin(t * 22 - i * 0.9) * i * 0.25 + i * 0.2];
  for (let i = 1; i < 10; i++) {
    const w = i < 2 ? 3 : i < 6 ? 2 : 1;
    const [x0, y0] = link(i - 1), [x1, y1] = link(i);
    for (let k = 0; k <= 3; k++) {
      ctx.fillRect(Math.round(x0 + (x1 - x0) * k / 3 - w / 2), Math.round(y0 + (y1 - y0) * k / 3 - w / 2), w, w);
    }
  }
  // dust kicked off the heels
  for (let i = 0; i < 5; i++) {
    const age = ((t * 3 + i * 0.2) % 1);
    ctx.globalAlpha = (1 - age) * 0.5;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.round(rx + 2 - age * 18), Math.round(barY - 2 - age * 5 + (i % 2)), 1, 1);
  }
  ctx.globalAlpha = 1;
}

// 0:12.34, as the HUD writes a time
function fmt(s) {
  const all = Math.floor(s * 100 + 1e-6);
  return `${Math.floor(all / 6000)}:${String(Math.floor(all / 100) % 60).padStart(2, '0')}.${String(all % 100).padStart(2, '0')}`;
}
