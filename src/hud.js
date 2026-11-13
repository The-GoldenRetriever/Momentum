// hud.js — speed / flow / dash readouts, sign panels and banners.

import { drawText, textWidth } from './font.js';
import { VIEW_W, VIEW_H } from './render.js';
import { P } from './player.js';
import { keyName } from './input.js';

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
  // Whole hundredths first: 19.9 * 100 is 1989.9999..., which used to show
  // a medal time of 19.90 as 0:19.89. The nudge only rescues float error.
  const all = Math.floor(s * 100 + 1e-6);
  const m = Math.floor(all / 6000);
  const sec = Math.floor(all / 100) % 60;
  const cs = all % 100;
  return `${m}:${String(sec).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

export function drawHud(ctx, game) {
  const p = game.player;

  // ---- flow + speed, bottom left
  const x = 8, y = VIEW_H - 22;
  const rt = game.renderer?.rt ?? 0;
  drawText(ctx, 'flow', x, y - 8, '#6f649c', 1);
  // The bar runs the whole capacity, framed, with a notch at one bar (what
  // sits past it is top gear) and the top-off (BURST_ARM to the top, where a
  // burst is earned) hatched while bursting is on. It shimmers through the
  // top-off, flashes through the wind-up, and pours away in a burst.
  ctx.fillStyle = '#0b0918';
  ctx.fillRect(x - 1, y - 1, barW + 2, 7);
  ctx.fillStyle = '#3b3163';
  ctx.fillRect(x - 1, y - 1, barW + 2, 1);
  ctx.fillStyle = '#1a1530';
  ctx.fillRect(x, y, barW, 5);
  const span = barW - 2;
  const f = Math.round((p.flow / P.FLOW_MAX) * span);
  const gate = Math.round((1 / P.FLOW_MAX) * span);
  const arm = Math.round((P.BURST_ARM / P.FLOW_MAX) * span);
  if (p.autoBurst) {
    ctx.fillStyle = '#2e2850';
    for (let i = arm; i < span; i++) if ((i + 0) % 3 === 0) ctx.fillRect(x + 1 + i, y + 1, 1, 3);
  }
  const base = p.bursting ? '#bff4ff' : p.flow >= 1 ? '#5fd8f0' : p.flow > 0.5 ? '#4fc89c' : '#4a86cc';
  const lit = p.bursting ? '#ffffff' : p.flow >= 1 ? '#bff4ff' : p.flow > 0.5 ? '#9cf0c8' : '#8ab8f0';
  ctx.fillStyle = base;
  ctx.fillRect(x + 1, y + 1, f, 3);
  ctx.fillStyle = lit;
  ctx.fillRect(x + 1, y + 1, f, 1);
  if (f > gate) { ctx.fillStyle = '#e8f8ff'; ctx.fillRect(x + 1 + gate, y + 1, f - gate, 2); }
  if (p.bursting) {                                // pouring away: light running back along it
    for (let i = 0; i < f; i += 6) {
      const k = Math.floor((i + rt * 90) % f);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 1 + k, y + 1, 2, 3);
    }
  }
  if (p.toppingOff) {                              // creeping in: the front of it breathes
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(rt * 9);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + f - 1, y, 3, 5);
    ctx.globalAlpha = 1;
  }
  if (p.burstWind > 0 && Math.floor(rt * 12) % 2 === 0) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, barW, 5); }
  ctx.fillStyle = p.flow >= 1 ? '#0b0a14' : '#443a6e';
  ctx.fillRect(x + 1 + gate, y + 1, 1, 3);
  if (p.flow > P.FLOW_MAX - 0.02) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x + barW - 2, y, 2, 5); }

  const spd = Math.round(Math.abs(p.vx));
  drawText(ctx, `${spd}`.padStart(3, ' '), x + barW + 6, y - 1, spd > 300 ? '#9cf6ff' : '#b9b2d6', 1);
  drawText(ctx, 'px/s', x + barW + 20, y - 1, '#564d80', 1);

  // ---- dash pips: little diamonds, lit while you have one to spend
  for (let i = 0; i < (p.dashLocked ? 0 : p.maxDashes); i++) {   // (no pip until you have a dash)
    const dx = x + 2 + i * 8, dy = y + 9;
    const on = i < p.dashes;
    ctx.fillStyle = on ? '#9cf6ff' : '#2f2950';
    ctx.fillRect(dx + 2, dy, 1, 1); ctx.fillRect(dx + 1, dy + 1, 3, 1); ctx.fillRect(dx, dy + 2, 5, 1);
    ctx.fillRect(dx + 1, dy + 3, 3, 1); ctx.fillRect(dx + 2, dy + 4, 1, 1);
    if (on) { ctx.fillStyle = '#ffffff'; ctx.fillRect(dx + 2, dy + 1, 1, 2); }
  }

  // ---- state chips (only what is currently doing something). The prompts
  // name whatever key is bound now, so a rebind does not leave them lying.
  const inp = game.ui?.input;
  const key = (a, fallback) => {
    const code = inp?.keysFor(a)[0];
    return code ? keyName(code).toLowerCase() : fallback;
  };
  const chips = [];
  if (p.bursting) chips.push(['burst', '#9cf6ff']);
  else if (p.burstWind > 0) chips.push([`burst in ${Math.ceil(p.burstWind)}  ${key('autoburst', 'v')}: stop it`, '#ffffff']);
  else if (p.toppingOff) chips.push(['topping off: hold your speed', '#dff3ff']);
  else if (!p.autoBurst) chips.push([`burst off (${key('autoburst', 'v')})`, '#8a7fc0']);
  if (p.vault) chips.push([p.vault.kind === 'up' ? 'vault' : 'roll', '#ffe6a8']);
  else if (p.slopeRoll || p.rolling > 0) chips.push(['roll', '#ffe6a8']);
  else if (p.cue?.kind === 'up') chips.push([`${key('vault', 'c')}: vault`, '#ffd678']);
  else if (p.rollHere) chips.push([`${key('vault', 'c')}: roll`, '#ffd678']);
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
    // (the title is 10px tall from py + 5, the lines start at py + 20 and are
    //  5px tall on an 8px pitch; with 5px under the last, as over the title)
    const h = 22 + s.lines.length * 8;
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

  if (game.levelInfo) drawText(ctx, `${game.levelIndex + 1} ${game.levelInfo.name}`, 8, 8, '#5d5588', 1);
  if (game.muted) drawText(ctx, 'muted', 8, 16, '#4b4370', 1);
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
    `burst ${p.bursting ? 'on' : p.burstWind > 0 ? `wind ${p.burstWind.toFixed(1)}` : p.autoBurst ? 'auto' : 'off'}  x${game.timeScale.toFixed(2)}  used ${p.bursts}`,
    `fps ${game.fps.toFixed(0)}  parts ${game.fx.parts.length}`,
  ];
  panel(ctx, 6, 28, 190, rows.length * 8 + 8, 0.7);
  rows.forEach((r, i) => drawText(ctx, r, 10, 32 + i * 8, '#8de8b0', 1));
}
