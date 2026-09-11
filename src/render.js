// render.js — everything that puts pixels on the screen.

import { TILE, T, isSlope } from './level.js';
import { makeCanvas, sprites, ghosts, SPRITE_W, SPRITE_H } from './art.js';
import { drawText } from './font.js';

export const VIEW_W = 480;
export const VIEW_H = 270;

const C = {
  sky0: '#0d0a18', sky1: '#171029', sky2: '#241736',
  far: '#1b1230', mid: '#241839', near: '#2e2047',
  rockLit: '#6a5e9c', rockMid: '#4d4478', rockDark: '#3b3460', rockDeep: '#2c2748',
  edge: '#7e6fb8', moss: '#57d199', mossDark: '#2b8f66', mossShade: '#1d6b4c',
  oneway: '#6a5c9c', onewayLit: '#9d8ddb',
  spike: '#cfd4f5', spikeDark: '#7e86bd',
  deco: '#231c3a',
  crystal: '#6fe8ff', crystalDark: '#2aa8cf',
  spring: '#ffcb57', springDark: '#c07a25',
  flag: '#ff8ab0', flagOn: '#7dffc4',
  sign: '#8b6a4a', signDark: '#5d442e',
};

// Rock gets darker the further it sits from daylight.
const BANDS = [
  { mid: '#554a85', lit: '#7264ab', dark: '#3f3768' },
  { mid: '#463d70', lit: '#594d8f', dark: '#332c58' },
  { mid: '#3a3260', lit: '#494078', dark: '#2b2549' },
  { mid: '#2f293f'.replace('3f', '50'), lit: '#3b3466', dark: '#241f3d' },
];

function hash(x, y) {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

export class Renderer {
  constructor(ctx, level) {
    this.ctx = ctx;
    this.level = level;
    this.tiles = this.#bakeTiles(level);
    this.sky = this.#bakeSky();
    this.motes = Array.from({ length: 70 }, (_, i) => ({
      x: hash(i, 1) * level.w * TILE, y: hash(i, 2) * level.h * TILE,
      p: 0.3 + hash(i, 3) * 0.5, s: hash(i, 4) < 0.3 ? 2 : 1, t: hash(i, 5) * 6,
    }));
    this.scarf = null;
    this.time = 0;
  }

  // ------------------------------------------------------------ static art
  #bakeSky() {
    const c = makeCanvas(VIEW_W, VIEW_H);
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, VIEW_H);
    grad.addColorStop(0, C.sky0);
    grad.addColorStop(0.55, C.sky1);
    grad.addColorStop(1, C.sky2);
    g.fillStyle = grad;
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    for (let i = 0; i < 120; i++) {
      const x = Math.floor(hash(i, 9) * VIEW_W), y = Math.floor(hash(i, 10) * VIEW_H * 0.7);
      g.fillStyle = `rgba(255,255,255,${0.05 + hash(i, 11) * 0.16})`;
      g.fillRect(x, y, 1, 1);
    }
    return c;
  }

  #bakeTiles(L) {
    const c = makeCanvas(L.w * TILE, L.h * TILE);
    const g = c.getContext('2d');
    for (let ty = 0; ty < L.h; ty++) {
      for (let tx = 0; tx < L.w; tx++) {
        const t = L.get(tx, ty);
        if (t === T.EMPTY) continue;
        const x = tx * TILE, y = ty * TILE;
        if (t === T.SOLID) this.#drawSolid(g, L, tx, ty, x, y);
        else if (isSlope(t)) this.#drawSlope(g, L, t, tx, ty, x, y);
        else if (t === T.ONEWAY) this.#drawOneWay(g, x, y);
        else if (t === T.SPIKE_UP) this.#drawSpikes(g, x, y, 1);
        else if (t === T.SPIKE_DOWN) this.#drawSpikes(g, x, y, -1);
        else if (t === T.LOWCEIL) this.#drawLowCeil(g, x, y, tx);
        else if (t === T.DECO) this.#drawDeco(g, x, y, tx, ty);
      }
    }
    return c;
  }

  #rockFace(g, x, y, w, h, depth = 0) {
    const band = BANDS[Math.min(BANDS.length - 1, depth)];
    g.fillStyle = band.mid;
    g.fillRect(x, y, w, h);
    for (let py = 0; py < h; py++) {
      const wy = y + py;
      for (let px = 0; px < w; px++) {
        const wx = x + px;
        const n = hash(wx, wy);
        let col = null;
        if (n > 0.93) col = band.lit;
        else if (n > 0.80) col = band.dark;
        else if (wy % 9 === 0 && hash(wx >> 1, wy) > 0.45) col = band.dark;   // strata
        if (col) { g.fillStyle = col; g.fillRect(wx, wy, 1, 1); }
      }
    }
  }

  #depthAt(L, tx, ty) {
    let d = 0;
    while (d < 8 && L.blocking(tx, ty - 1 - d)) d++;
    return d >= 5 ? 3 : d >= 3 ? 2 : d >= 1 ? 1 : 0;
  }

  #drawSolid(g, L, tx, ty, x, y) {
    const up = L.blocking(tx, ty - 1), dn = L.blocking(tx, ty + 1);
    const lf = L.blocking(tx - 1, ty), rt = L.blocking(tx + 1, ty);
    this.#rockFace(g, x, y, TILE, TILE, this.#depthAt(L, tx, ty));

    if (!up) {                                   // mossy cap
      g.fillStyle = C.moss;
      g.fillRect(x, y, TILE, 2);
      g.fillStyle = C.mossDark;
      for (let px = 0; px < TILE; px++) {
        const d = hash(tx * 16 + px, ty) > 0.55 ? 1 : 0;
        g.fillRect(x + px, y + 2, 1, 1 + d);
      }
      g.fillStyle = C.mossShade;
      g.fillRect(x, y + 4, TILE, 1);
      g.fillStyle = C.moss;
      for (let px = 0; px < TILE; px += 1) {
        if (hash(tx * 31 + px, ty * 7) > 0.82) g.fillRect(x + px, y - 1, 1, 1);
      }
    }
    g.fillStyle = C.rockDeep;
    if (!lf) g.fillRect(x, y, 1, TILE);
    if (!rt) g.fillRect(x + TILE - 1, y, 1, TILE);
    if (!dn) g.fillRect(x, y + TILE - 2, TILE, 2);
    g.fillStyle = C.edge;
    if (!lf && !up) g.fillRect(x, y, 1, 3);
    if (!rt && !up) g.fillRect(x + TILE - 1, y, 1, 3);
  }

  #drawSlope(g, L, t, tx, ty, x, y) {
    const right = t === T.SLOPE_R;
    for (let px = 0; px < TILE; px++) {
      const localTop = right ? TILE - 1 - px : px;
      const h = TILE - localTop;
      this.#rockFace(g, x + px, y + localTop, 1, h, 0);
      g.fillStyle = C.moss;
      g.fillRect(x + px, y + localTop, 1, 2);
      g.fillStyle = C.mossDark;
      g.fillRect(x + px, y + localTop + 2, 1, 1);
      g.fillStyle = C.mossShade;
      g.fillRect(x + px, y + localTop + 3, 1, 1);
    }
  }

  #drawOneWay(g, x, y) {
    g.fillStyle = C.oneway;
    g.fillRect(x, y, TILE, 4);
    g.fillStyle = C.onewayLit;
    g.fillRect(x, y, TILE, 1);
    g.fillStyle = '#3a3162';
    for (let px = 2; px < TILE; px += 5) g.fillRect(x + px, y + 3, 2, 1);
  }

  #drawSpikes(g, x, y, dir) {
    const base = dir > 0 ? y + TILE : y;
    for (let i = 0; i < 2; i++) {
      const cx = x + 4 + i * 8;
      for (let k = 0; k < 8; k++) {
        const w = 7 - k;
        const py = dir > 0 ? base - 1 - k : base + k;
        g.fillStyle = k < 3 ? C.spike : C.spikeDark;
        g.fillRect(cx - (w >> 1), py, Math.max(1, w), 1);
      }
    }
    g.fillStyle = C.spikeDark;
    g.fillRect(x, dir > 0 ? y + TILE - 2 : y, TILE, 2);
  }

  #drawLowCeil(g, x, y, tx) {
    this.#rockFace(g, x, y, TILE, 6, 1);
    g.fillStyle = C.edge;
    g.fillRect(x, y, TILE, 1);
    g.fillStyle = C.rockDeep;
    for (let px = 0; px < TILE; px++) {
      if (hash(tx * 16 + px, 77) > 0.45) g.fillRect(x + px, y + 6, 1, 1);
    }
  }

  #drawDeco(g, x, y, tx, ty) {
    g.fillStyle = C.deco;
    const h = 6 + Math.floor(hash(tx, ty) * 8);
    g.fillRect(x + 2, y + TILE - h, TILE - 4, h);
    g.fillStyle = '#2b2347';
    g.fillRect(x + 3, y + TILE - h, 2, h);
  }

  // -------------------------------------------------------------- dynamics
  updateScarf(p, dt) {
    const anchorX = p.cx - p.facing * 2;
    const anchorY = p.y + (p.sliding ? 3 : 6);
    if (!this.scarf) {
      this.scarf = Array.from({ length: 6 }, () => ({ x: anchorX, y: anchorY, px: anchorX, py: anchorY }));
    }
    const s = this.scarf;
    s[0].x = anchorX; s[0].y = anchorY;
    const windX = -p.vx * 0.6 - p.facing * 26;
    const windY = -p.vy * 0.3 + 70;
    for (let i = 1; i < s.length; i++) {
      const n = s[i];
      const vx = (n.x - n.px) * 0.8, vy = (n.y - n.py) * 0.8;
      n.px = n.x; n.py = n.y;
      n.x += vx + windX * dt;
      n.y += vy + windY * dt;
    }
    for (let k = 0; k < 3; k++) {
      for (let i = 1; i < s.length; i++) {
        const a = s[i - 1], b = s[i];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.001;
        const seg = 2.6;
        const f = (d - seg) / d;
        b.x -= dx * f; b.y -= dy * f;
      }
    }
  }

  // ----------------------------------------------------------------- frame
  draw(game, dt) {
    const { ctx } = this;
    const cam = game.cam, p = game.player, fx = game.fx, L = this.level;
    this.time += dt;
    const ox = Math.round(cam.x + fx.shakeX);
    const oy = Math.round(cam.y + fx.shakeY);

    ctx.drawImage(this.sky, 0, 0);
    this.#parallax(ox, oy, p);

    // tiles
    ctx.drawImage(this.tiles, ox, oy, VIEW_W, VIEW_H, 0, 0, VIEW_W, VIEW_H);

    this.#entities(game, ox, oy);
    this.#particles(fx, ox, oy, false);
    if (!p.dead) this.#player(p, ox, oy);
    this.#particles(fx, ox, oy, true);
    this.#speedOverlay(p);
  }

  #parallax(ox, oy, p) {
    const { ctx } = this;
    const layers = [
      { f: 0.15, col: C.far, base: 210, amp: 26, step: 61, seed: 3 },
      { f: 0.3, col: C.mid, base: 232, amp: 20, step: 43, seed: 8 },
      { f: 0.5, col: C.near, base: 254, amp: 14, step: 29, seed: 15 },
    ];
    for (const l of layers) {
      ctx.fillStyle = l.col;
      const shift = ox * l.f;
      const first = Math.floor(shift / l.step) - 1;
      for (let i = 0; i < VIEW_W / l.step + 3; i++) {
        const idx = first + i;
        const x = Math.round(idx * l.step - shift);
        const h = l.amp + hash(idx, l.seed) * l.amp * 2;
        const y = Math.round(l.base - h - oy * l.f * 0.35);
        ctx.fillRect(x, y, l.step + 1, VIEW_H - y);
        ctx.fillRect(x + 4, y - 5, l.step - 8, 6);
      }
    }
    // dust motes
    for (const m of this.motes) {
      const x = Math.round(m.x - ox * m.p + Math.sin(this.time * 0.6 + m.t) * 6);
      const y = Math.round(m.y - oy * m.p + Math.cos(this.time * 0.5 + m.t) * 5);
      if (x < -4 || x > VIEW_W + 4 || y < -4 || y > VIEW_H + 4) continue;
      ctx.fillStyle = `rgba(190,210,255,${0.10 + m.p * 0.18})`;
      ctx.fillRect(x, y, m.s, m.s);
    }
  }

  #entities(game, ox, oy) {
    const { ctx } = this;
    const L = this.level;
    const t = this.time;

    for (const s of L.signs) {
      const x = Math.round(s.x - ox), y = Math.round(s.y - oy);
      if (x < -40 || x > VIEW_W + 40) continue;
      ctx.fillStyle = C.signDark; ctx.fillRect(x + 6, y + 6, 3, 10);
      ctx.fillStyle = C.sign; ctx.fillRect(x + 1, y - 1, 14, 9);
      ctx.fillStyle = C.signDark; ctx.fillRect(x + 1, y + 6, 14, 2);
      drawText(ctx, s.title.slice(0, 3), x + 2, y + 1, '#ffe6b0', 1);
    }

    for (const c of L.checkpoints) {
      const x = Math.round(c.x - ox), y = Math.round(c.y - oy);
      if (x < -30 || x > VIEW_W + 30) continue;
      ctx.fillStyle = '#2a2440'; ctx.fillRect(x - 1, y - 20, 2, 20);
      const wave = Math.sin(t * 5 + (c.on ? 0 : 2)) * 2;
      ctx.fillStyle = c.on ? C.flagOn : C.flag;
      for (let i = 0; i < 7; i++) {
        const w = 9 - Math.abs(3 - i);
        ctx.fillRect(x + 1, y - 20 + i, w, 1);
        if (i === 3) ctx.fillRect(x + 1 + w, y - 20 + i + Math.round(wave * 0.4), 2, 1);
      }
      if (c.on) {
        ctx.fillStyle = 'rgba(125,255,196,0.25)';
        ctx.fillRect(x - 3, y - 24, 3, 3);
      }
    }

    for (const c of L.crystals) {
      const x = Math.round(c.x - ox), y = Math.round(c.y - oy + Math.sin(t * 2.5 + c.x) * 2);
      if (x < -20 || x > VIEW_W + 20) continue;
      if (c.t > 0) {                              // spent: faint husk
        ctx.fillStyle = 'rgba(110,232,255,0.18)';
        ctx.fillRect(x - 3, y - 3, 6, 6);
        continue;
      }
      ctx.fillStyle = C.crystalDark;
      for (let i = 0; i < 6; i++) ctx.fillRect(x - 5 + i, y - 6 + Math.abs(i - 3) + 1, 1, 12 - Math.abs(i - 3) * 2);
      ctx.fillStyle = C.crystal;
      for (let i = 1; i < 5; i++) ctx.fillRect(x - 5 + i, y - 5 + Math.abs(i - 3) + 1, 1, 10 - Math.abs(i - 3) * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - 2, y - 3, 1, 3);
      if (Math.sin(t * 3 + c.x) > 0.9) { ctx.fillRect(x + 4, y - 6, 1, 1); ctx.fillRect(x - 6, y + 4, 1, 1); }
    }

    for (const s of L.springs) {
      const x = Math.round(s.x - ox), y = Math.round(s.y - oy);
      if (x < -20 || x > VIEW_W + 20) continue;
      const squash = s.t > 0 ? Math.min(6, s.t * 60) : 0;
      ctx.fillStyle = C.springDark;
      ctx.fillRect(x + 1, y + 10 + squash, 14, 6 - squash);
      ctx.fillStyle = C.spring;
      ctx.fillRect(x + 2, y + 8 + squash, 12, 3);
      ctx.fillRect(x + 3, y + 12 + squash, 10, 1);
      ctx.fillStyle = '#fff2c4';
      ctx.fillRect(x + 3, y + 8 + squash, 10, 1);
    }

    if (L.goal) {
      const g = L.goal;
      const x = Math.round(g.x - ox), y = Math.round(g.y - oy);
      for (let i = 0; i < g.h; i += 2) {
        const a = 0.25 + 0.25 * Math.sin(t * 4 + i * 0.4);
        ctx.fillStyle = g.hit ? `rgba(125,255,196,${a})` : `rgba(255,214,120,${a})`;
        ctx.fillRect(x, y + i, g.w, 2);
      }
      ctx.fillStyle = g.hit ? '#7dffc4' : '#ffd678';
      ctx.fillRect(x - 2, y - 4, 2, g.h + 8);
      ctx.fillRect(x + g.w, y - 4, 2, g.h + 8);
      drawText(ctx, 'GOAL', x - 6, y - 14, '#ffd678', 1, '#2a1e0e');
    }
  }

  #particles(fx, ox, oy, front) {
    const { ctx } = this;
    for (const p of fx.parts) {
      const isFront = p.size > 1;
      if (isFront !== front) continue;
      const a = Math.min(1, p.life / (p.max * 0.6));
      ctx.globalAlpha = a;
      ctx.fillStyle = p.colour;
      ctx.fillRect(Math.round(p.x - ox), Math.round(p.y - oy), p.size, p.size);
    }
    ctx.globalAlpha = 1;
    for (const l of fx.lines) {
      ctx.globalAlpha = (l.life / l.max) * 0.5;
      ctx.fillStyle = '#dff3ff';
      ctx.fillRect(Math.round(l.x - ox), Math.round(l.y - oy), Math.round(l.len), 1);
    }
    ctx.globalAlpha = 1;
  }

  #player(p, ox, oy) {
    const { ctx } = this;
    const dir = p.facing > 0 ? 0 : 1;

    // afterimages
    for (const g of p.trail) {
      const set = ghosts[g.name] ?? ghosts.idle;
      const img = set[g.facing > 0 ? 0 : 1][Math.min(g.frame, set[0].length - 1)];
      ctx.globalAlpha = Math.max(0, g.life / 0.22) * 0.45;
      ctx.drawImage(img, Math.round(g.x - 1 - ox), Math.round(g.y + g.h - SPRITE_H - oy));
    }
    ctx.globalAlpha = 1;

    this.#drawScarf(p, ox, oy);

    const set = sprites[p.anim.name] ?? sprites.idle;
    const frames = set[dir];
    const img = frames[Math.min(p.anim.frame, frames.length - 1)];
    const px = Math.round(p.x - 1 - ox);
    const py = Math.round(p.y + p.h - SPRITE_H - oy);
    ctx.drawImage(img, px, py);

    if (p.dashes > 0) {                      // dash-ready glint on the belt
      ctx.fillStyle = p.t.dashCool > 0 ? '#5a7fae' : '#9cf6ff';
      ctx.fillRect(px + 5, py + 11, 2, 1);
    }
  }

  #drawScarf(p, ox, oy) {
    const s = this.scarf;
    if (!s) return;
    const { ctx } = this;
    const hot = p.dashes > 0;
    for (let i = s.length - 1; i >= 1; i--) {
      const n = s[i];
      const w = Math.max(1, 4 - Math.floor(i / 2));
      ctx.fillStyle = hot ? (i < 3 ? '#ef5a5a' : '#b83b4c') : (i < 3 ? '#7a7196' : '#575173');
      ctx.fillRect(Math.round(n.x - ox - w / 2), Math.round(n.y - oy - w / 2), w, w);
    }
  }

  #speedOverlay(p) {
    const { ctx } = this;
    const f = p.flow;
    if (f > 0.45) {
      const a = (f - 0.45) / 0.55;
      ctx.globalAlpha = a * 0.22;
      ctx.fillStyle = '#63f0ff';
      ctx.fillRect(0, 0, VIEW_W, 2);
      ctx.fillRect(0, VIEW_H - 2, VIEW_W, 2);
      ctx.globalAlpha = 1;
    }
  }
}
