// hud.js — speed / flow / dash readouts, sign panels and banners.

import { drawText, textWidth } from './font.js';
import { VIEW_W, VIEW_H } from './render.js';
import { P } from './player.js';

const barW = 74;

function panel(ctx, x, y, w, h, alpha = 0.82) {
  ctx.fillStyle = `rgba(14,10,26,${alpha})`;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#3b3163';
  ctx.fillRect(x, y, w, 1);
  ctx.fillRect(x, y + h - 1, w, 1);
  ctx.fillRect(x, y, 1, h);
  ctx.fillRect(x + w - 1, y, 1, h);
}

export function fmtTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const cs = Math.floor((s * 100) % 100);
  return `${m}:${String(sec).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

export function drawHud(ctx, game) {
  const p = game.player;

  // ---- flow + speed, bottom left
  const x = 8, y = VIEW_H - 22;
  drawText(ctx, 'flow', x, y - 8, '#6f649c', 1);
  ctx.fillStyle = '#221c3a';
  ctx.fillRect(x, y, barW, 5);
  // The bar runs the whole capacity, with a notch where the burst opens: what
  // sits past the notch is fuel you are carrying, not speed you are running.
  const span = barW - 2;
  const f = Math.round((p.flow / P.FLOW_MAX) * span);
  const gate = Math.round((P.BURST_FLOW_MIN / P.FLOW_MAX) * span);
  ctx.fillStyle = p.flow >= P.BURST_FLOW_MIN ? '#9cf6ff' : p.flow > 0.5 ? '#63e0b0' : '#5b9adf';
  ctx.fillRect(x + 1, y + 1, f, 3);
  if (f > gate) { ctx.fillStyle = '#dff3ff'; ctx.fillRect(x + 1 + gate, y + 1, f - gate, 3); }
  ctx.fillStyle = p.flow >= P.BURST_FLOW_MIN ? '#0b0a14' : '#443a6e';
  ctx.fillRect(x + 1 + gate, y + 1, 1, 3);
  if (p.flow > P.FLOW_MAX - 0.02) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x + barW - 2, y, 2, 5); }

  const spd = Math.round(Math.abs(p.vx));
  drawText(ctx, `${spd}`.padStart(3, ' '), x + barW + 6, y - 1, spd > 300 ? '#9cf6ff' : '#b9b2d6', 1);
  drawText(ctx, 'px/s', x + barW + 20, y - 1, '#564d80', 1);

  // ---- dash pips
  for (let i = 0; i < p.maxDashes; i++) {
    const dx = x + i * 7, dy = y + 9;
    ctx.fillStyle = i < p.dashes ? '#9cf6ff' : '#2f2950';
    ctx.fillRect(dx, dy, 4, 4);
    if (i < p.dashes) { ctx.fillStyle = '#ffffff'; ctx.fillRect(dx + 1, dy + 1, 1, 1); }
  }

  // ---- state chips (only what is currently doing something)
  const chips = [];
  if (p.bursting || p.burstWind > 0) chips.push(['burst', '#9cf6ff']);
  else if (p.canBurst) chips.push(['v: burst ready', '#ffffff']);
  if (p.vault) chips.push([p.vault.kind === 'up' ? 'vault' : 'roll', '#ffe6a8']);
  else if (p.rolling > 0) chips.push(['roll', '#ffe6a8']);
  else if (p.cue) chips.push([p.cue.kind === 'up' ? 'c: vault' : 'c: roll', '#ffd678']);
  else if (p.t.refund > 0) chips.push(['c: roll out', '#ff9ecd']);
  if (p.dashing) chips.push(['dash', '#9cf6ff']);
  if (p.sliding) chips.push(['slide', '#ffd678']);
  if (p.wallDir !== 0) chips.push(['wall', '#cbb9ff']);
  if (p.t.super > 0) chips.push(['super window', '#ff9ecd']);
  if (p.grounded && Math.abs(p.vx) > 300) chips.push(['sprint', '#7dffc4']);
  let cx = x + barW + 44;
  for (const [label, col] of chips) {
    drawText(ctx, label, cx, y - 1, col, 1);
    cx += textWidth(label, 1) + 6;
  }

  // ---- timer, top right
  const t = fmtTime(game.time);
  const tw = textWidth(t, 1);
  const slowed = game.timeScale < 0.92;
  drawText(ctx, t, VIEW_W - 8 - tw, 8,
    game.finished ? '#7dffc4' : slowed ? '#9cf6ff' : '#cbc4e6', 1, '#100b20');
  if (slowed) {
    const lbl = `x${game.timeScale.toFixed(2)}`;
    drawText(ctx, lbl, VIEW_W - 12 - tw - textWidth(lbl, 1), 8, '#63f0ff', 1, '#100b20');
  }
  const sub = `deaths ${p.deaths}`;
  drawText(ctx, sub, VIEW_W - 8 - textWidth(sub, 1), 16, '#5d5588', 1);
  if (game.best) {
    const b = `best ${fmtTime(game.best)}`;
    drawText(ctx, b, VIEW_W - 8 - textWidth(b, 1), 24, '#7a6fb5', 1);
  }

  // ---- sign panel
  if (game.activeSign) {
    const s = game.activeSign;
    const w = Math.max(textWidth(s.title, 2) + 12, ...s.lines.map((l) => textWidth(l, 1) + 16));
    const h = 16 + s.lines.length * 8;
    const px = Math.round((VIEW_W - w) / 2), py = 14;
    panel(ctx, px, py, w, h);
    drawText(ctx, s.title, px + 8, py + 5, '#ffd678', 2);
    s.lines.forEach((line, i) => drawText(ctx, line, px + 8, py + 20 + i * 8, '#b9b2d6', 1));
  }

  // ---- banners
  if (game.banner && game.bannerT > 0) {
    const a = Math.min(1, game.bannerT);
    const w = textWidth(game.banner, 2);
    ctx.globalAlpha = a;
    drawText(ctx, game.banner, Math.round((VIEW_W - w) / 2), VIEW_H / 2 - 30, '#ffffff', 2, '#150f26');
    if (game.bannerSub) {
      const sw = textWidth(game.bannerSub, 1);
      drawText(ctx, game.bannerSub, Math.round((VIEW_W - sw) / 2), VIEW_H / 2 - 16, '#9cf6ff', 1, '#150f26');
    }
    ctx.globalAlpha = 1;
  }

  if (game.muted) drawText(ctx, 'muted', 8, 8, '#4b4370', 1);
  if (game.debug) drawDebug(ctx, game);
}

function drawDebug(ctx, game) {
  const p = game.player;
  const rows = [
    `pos ${p.x.toFixed(1)} ${p.y.toFixed(1)}`,
    `vel ${p.vx.toFixed(1)} ${p.vy.toFixed(1)}`,
    `grounded ${p.grounded ? 1 : 0}  wall ${p.wallDir}  slide ${p.sliding ? 1 : 0}`,
    `flow ${p.flow.toFixed(2)}  top ${Math.round(p.topSpeed)}  dashes ${p.dashes}`,
    `coyote ${p.t.coyote.toFixed(2)} buffer ${p.t.buffer.toFixed(2)} super ${p.t.super.toFixed(2)}`,
    `cue ${p.cue ? `${p.cue.kind} ${Math.round(p.cue.rise)}px` : '-'}  vaults ${p.vaults}`,
    `burst ${p.bursting ? 'on' : p.canBurst ? 'ready' : '-'}  x${game.timeScale.toFixed(2)}  used ${p.bursts}`,
    `fps ${game.fps.toFixed(0)}  parts ${game.fx.parts.length}`,
  ];
  panel(ctx, 6, 28, 190, rows.length * 8 + 8, 0.7);
  rows.forEach((r, i) => drawText(ctx, r, 10, 32 + i * 8, '#8de8b0', 1));
}
