// render.js — everything that puts pixels on the screen.

import { TILE, T, isSlope } from './level.js';
import { makeCanvas, sprites, ghosts, SPRITE_W, SPRITE_H } from './art.js';
import { drawText, textWidth } from './font.js';

export const VIEW_W = 480;
export const VIEW_H = 270;

const C = {
  sky0: '#0b0816', sky1: '#150e26', sky2: '#221635', sky3: '#33203f',
  moon: '#f3e6c8', moonDim: '#c9b894',
  far: '#191030', mid: '#22163a', near: '#2c1e46', fore: '#150e26',
  rockDeep: '#221d3c',
  edge: '#8477c4', edgeDim: '#5a4f8c',
  moss: '#5cd9a0', mossLit: '#8bf0bf', mossDark: '#2b8f66', mossShade: '#1b6349',
  vine: '#2f9a6d', vineDark: '#1d6b4c', vineLit: '#6ee0a6',
  oneway: '#6a5c9c', onewayLit: '#a294e0', onewayDark: '#3a3162',
  spike: '#dfe4ff', spikeMid: '#9aa2d8', spikeDark: '#6f77ad',
  deco: '#241d3d', decoLit: '#2e2650',
  crystal: '#6fe8ff', crystalDark: '#2aa8cf', crystalLit: '#d8fbff',
  spring: '#ffcb57', springDark: '#c07a25', springLit: '#fff2c4',
  flag: '#ff8ab0', flagOn: '#7dffc4',
  sign: '#8b6a4a', signDark: '#5d442e', signLit: '#b08a62',
  cueUp: '#ffe6a8', cueDown: '#9cf6ff',
};

// Rock gets darker the further it sits from daylight.
const BANDS = [
  { mid: '#585090', lit: '#7869b4', dark: '#403873', vein: '#8d7fd0' },
  { mid: '#494077', lit: '#5e5296', dark: '#342d5e', vein: '#6f62ae' },
  { mid: '#332c58', lit: '#42396e', dark: '#241f43', vein: '#4a4080' },
  { mid: '#282247', lit: '#332c5a', dark: '#1c1834', vein: '#393261' },
];

const BURST_ZOOM = 1.25;        // 480/1.25 and 270/1.25 are both whole numbers,
                               // so the blow-up lands on clean pixel runs

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

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
    this.motes = Array.from({ length: 110 }, (_, i) => ({
      x: hash(i, 1) * level.w * TILE, y: hash(i, 2) * level.h * TILE,
      p: 0.3 + hash(i, 3) * 0.5, s: hash(i, 4) < 0.25 ? 2 : 1, t: hash(i, 5) * 6,
    }));
    this.scarf = null;
    this.time = 0;       // world time — slows down with the world
    this.rt = 0;         // wall-clock time — the burst streaks ride this
    this.zoom = 1;
    // the world is drawn here first whenever it needs magnifying, so the zoom
    // is a nearest-neighbour blow-up of finished pixels rather than a transform
    // (fillRect under a fractional scale would soften every edge)
    this.frame = makeCanvas(VIEW_W, VIEW_H);
    this.frameCtx = this.frame.getContext('2d');
    this.frameCtx.imageSmoothingEnabled = false;
  }

  // ------------------------------------------------------------ static art
  #bakeSky() {
    const c = makeCanvas(VIEW_W, VIEW_H);
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, VIEW_H);
    grad.addColorStop(0, C.sky0);
    grad.addColorStop(0.42, C.sky1);
    grad.addColorStop(0.78, C.sky2);
    grad.addColorStop(1, C.sky3);
    g.fillStyle = grad;
    g.fillRect(0, 0, VIEW_W, VIEW_H);

    // stars, brighter and denser towards the top of the sky
    for (let i = 0; i < 260; i++) {
      const x = Math.floor(hash(i, 9) * VIEW_W);
      const y = Math.floor(Math.pow(hash(i, 10), 1.6) * VIEW_H * 0.8);
      const a = (0.05 + hash(i, 11) * 0.5) * (1 - y / (VIEW_H * 0.9));
      g.fillStyle = `rgba(226,236,255,${a.toFixed(3)})`;
      g.fillRect(x, y, 1, 1);
      if (hash(i, 12) > 0.94) {                 // a few with a faint cross flare
        g.fillStyle = `rgba(226,236,255,${(a * 0.4).toFixed(3)})`;
        g.fillRect(x - 1, y, 1, 1); g.fillRect(x + 1, y, 1, 1);
        g.fillRect(x, y - 1, 1, 1); g.fillRect(x, y + 1, 1, 1);
      }
    }

    // moon with a soft halo and a couple of maria
    const mx = 386, my = 46, r = 13;
    for (let ry = -r - 6; ry <= r + 6; ry++) {
      for (let rx = -r - 6; rx <= r + 6; rx++) {
        const d = Math.hypot(rx, ry);
        if (d > r && d < r + 7) {
          g.fillStyle = `rgba(243,230,200,${(0.05 * (1 - (d - r) / 7)).toFixed(3)})`;
          g.fillRect(mx + rx, my + ry, 1, 1);
        }
      }
    }
    for (let ry = -r; ry <= r; ry++) {
      for (let rx = -r; rx <= r; rx++) {
        const d = Math.hypot(rx, ry);
        if (d > r) continue;
        const shade = hash(rx + 40, ry + 40);
        g.fillStyle = (rx + ry > 8 || shade > 0.88) ? C.moonDim : C.moon;
        g.fillRect(mx + rx, my + ry, 1, 1);
      }
    }

    // thin cloud bands
    for (let i = 0; i < 7; i++) {
      const y = 60 + Math.floor(hash(i, 21) * 110);
      const w = 60 + Math.floor(hash(i, 22) * 150);
      const x = Math.floor(hash(i, 23) * VIEW_W) - w / 2;
      for (let px = 0; px < w; px++) {
        const edge = Math.sin((px / w) * Math.PI);
        if (hash(x + px, y) > 0.35 + edge * 0.3) continue;
        g.fillStyle = `rgba(120,104,170,${(0.05 + edge * 0.07).toFixed(3)})`;
        g.fillRect(x + px, y + (hash(px, i) > 0.7 ? 1 : 0), 1, 1 + (hash(px, i + 3) > 0.8 ? 1 : 0));
      }
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
        else if (t === T.ONEWAY) this.#drawOneWay(g, x, y, tx);
        else if (t === T.SPIKE_UP) this.#drawSpikes(g, x, y, 1, tx);
        else if (t === T.SPIKE_DOWN) this.#drawSpikes(g, x, y, -1, tx);
        else if (t === T.LOWCEIL) this.#drawLowCeil(g, x, y, tx);
        else if (t === T.DECO) this.#drawDeco(g, x, y, tx, ty);
      }
    }
    this.#dress(g, L);            // grass, vines and stalactites, over the seams
    return c;
  }

  #rockFace(g, x, y, w, h, depth = 0, seed = 0) {
    const band = BANDS[Math.min(BANDS.length - 1, depth)];
    g.fillStyle = band.mid;
    g.fillRect(x, y, w, h);
    for (let py = 0; py < h; py++) {
      const wy = y + py;
      for (let px = 0; px < w; px++) {
        const wx = x + px;
        const n = hash(wx, wy + seed);
        let col = null;
        if (n > 0.955) col = band.lit;
        else if (n > 0.86) col = band.dark;
        else if (n > 0.845) col = band.vein;                                  // mineral fleck
        else if (wy % 9 === 0 && hash(wx >> 1, wy) > 0.45) col = band.dark;   // strata
        else if (wy % 9 === 1 && hash(wx >> 1, wy) > 0.72) col = band.lit;
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
    const depth = this.#depthAt(L, tx, ty);
    this.#rockFace(g, x, y, TILE, TILE, depth);

    // a crack running through some of the buried blocks
    if (depth > 0 && hash(tx, ty * 3) > 0.86) {
      const band = BANDS[Math.min(BANDS.length - 1, depth)];
      g.fillStyle = band.dark;
      let cx = x + 2 + Math.floor(hash(tx, ty) * (TILE - 5));
      for (let i = 0; i < TILE - 2; i++) {
        g.fillRect(cx, y + 1 + i, 1, 1);
        if (hash(cx, y + i) > 0.6) cx += hash(cx, i) > 0.5 ? 1 : -1;
        cx = Math.max(x + 1, Math.min(x + TILE - 2, cx));
      }
    }

    if (!up) {                                   // mossy cap
      g.fillStyle = C.mossLit;
      g.fillRect(x, y, TILE, 1);
      g.fillStyle = C.moss;
      g.fillRect(x, y + 1, TILE, 2);
      g.fillStyle = C.mossDark;
      for (let px = 0; px < TILE; px++) {
        const d = hash(tx * 16 + px, ty) > 0.55 ? 1 : 0;
        g.fillRect(x + px, y + 3, 1, 1 + d);
      }
      g.fillStyle = C.mossShade;
      g.fillRect(x, y + 5, TILE, 1);
      for (let px = 0; px < TILE; px++) {
        if (hash(tx * 31 + px, ty * 7) > 0.86) { g.fillStyle = C.moss; g.fillRect(x + px, y - 1, 1, 1); }
      }
    } else {
      g.fillStyle = 'rgba(14,10,26,0.35)';       // ambient occlusion under rock
      g.fillRect(x, y, TILE, 1);
    }

    g.fillStyle = C.rockDeep;
    if (!lf) g.fillRect(x, y, 1, TILE);
    if (!rt) g.fillRect(x + TILE - 1, y, 1, TILE);
    if (!dn) g.fillRect(x, y + TILE - 2, TILE, 2);
    if (!lf) { g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(x + 1, y, 1, TILE); }
    g.fillStyle = C.edge;
    if (!lf && !up) g.fillRect(x, y, 1, 4);
    if (!rt && !up) g.fillRect(x + TILE - 1, y, 1, 4);
    g.fillStyle = C.edgeDim;
    if (!lf && !dn) g.fillRect(x, y + TILE - 3, 1, 3);
    if (!rt && !dn) g.fillRect(x + TILE - 1, y + TILE - 3, 1, 3);
  }

  #drawSlope(g, L, t, tx, ty, x, y) {
    const right = t === T.SLOPE_R;
    for (let px = 0; px < TILE; px++) {
      const localTop = right ? TILE - 1 - px : px;
      const h = TILE - localTop;
      this.#rockFace(g, x + px, y + localTop, 1, h, 0);
      g.fillStyle = C.mossLit;
      g.fillRect(x + px, y + localTop, 1, 1);
      g.fillStyle = C.moss;
      g.fillRect(x + px, y + localTop + 1, 1, 2);
      g.fillStyle = C.mossDark;
      g.fillRect(x + px, y + localTop + 3, 1, 1);
      g.fillStyle = C.mossShade;
      g.fillRect(x + px, y + localTop + 4, 1, 1);
      if (hash(x + px, y) > 0.9) { g.fillStyle = C.moss; g.fillRect(x + px, y + localTop - 1, 1, 1); }
    }
  }

  #drawOneWay(g, x, y, tx) {
    g.fillStyle = C.onewayDark;
    g.fillRect(x, y, TILE, 5);
    g.fillStyle = C.oneway;
    g.fillRect(x, y + 1, TILE, 3);
    g.fillStyle = C.onewayLit;
    g.fillRect(x, y, TILE, 1);
    g.fillStyle = C.onewayDark;
    for (let px = 1; px < TILE; px += 4) g.fillRect(x + px, y + 2, 2, 1);
    g.fillStyle = 'rgba(162,148,224,0.35)';
    for (let px = 0; px < TILE; px++) if (hash(tx * 9 + px, 5) > 0.75) g.fillRect(x + px, y + 4, 1, 1);
  }

  #drawSpikes(g, x, y, dir, tx) {
    const base = dir > 0 ? y + TILE : y;
    for (let i = 0; i < 3; i++) {
      const cx = x + 3 + i * 5;
      const tall = 7 + Math.floor(hash(tx * 7 + i, 3) * 4);
      for (let k = 0; k < tall; k++) {
        const w = Math.max(1, 5 - Math.floor(k * 5 / tall));
        const py = dir > 0 ? base - 3 - k : base + 2 + k;
        g.fillStyle = k < 2 ? C.spike : k < 5 ? C.spikeMid : C.spikeDark;
        g.fillRect(cx - (w >> 1), py, w, 1);
      }
    }
    g.fillStyle = C.spikeDark;
    g.fillRect(x, dir > 0 ? y + TILE - 3 : y, TILE, 3);
    g.fillStyle = C.spikeMid;
    g.fillRect(x, dir > 0 ? y + TILE - 3 : y + 2, TILE, 1);
  }

  #drawLowCeil(g, x, y, tx) {
    this.#rockFace(g, x, y, TILE, 6, 1);
    g.fillStyle = C.edge;
    g.fillRect(x, y, TILE, 1);
    g.fillStyle = C.rockDeep;
    g.fillRect(x, y + 5, TILE, 1);
    for (let px = 0; px < TILE; px++) {
      if (hash(tx * 16 + px, 77) > 0.45) g.fillRect(x + px, y + 6, 1, 1);
      if (hash(tx * 16 + px, 91) > 0.86) g.fillRect(x + px, y + 7, 1, 1);
    }
  }

  #drawDeco(g, x, y, tx, ty) {
    g.fillStyle = C.deco;
    const h = 6 + Math.floor(hash(tx, ty) * 9);
    g.fillRect(x + 2, y + TILE - h, TILE - 4, h);
    g.fillStyle = C.decoLit;
    g.fillRect(x + 3, y + TILE - h, 2, h);
    g.fillStyle = C.deco;
    g.fillRect(x + 1, y + TILE - Math.floor(h / 2), 1, Math.floor(h / 2));
  }

  /** Second pass: things that hang off tiles and cross their seams. */
  #dress(g, L) {
    for (let ty = 0; ty < L.h; ty++) {
      for (let tx = 0; tx < L.w; tx++) {
        const t = L.get(tx, ty);
        const x = tx * TILE, y = ty * TILE;

        // grass tufts along exposed rock tops
        if (t === T.SOLID && !L.blocking(tx, ty - 1) && L.get(tx, ty - 1) === T.EMPTY) {
          for (let i = 0; i < 3; i++) {
            const px = x + 2 + i * 5 + Math.floor(hash(tx * 5 + i, ty) * 2);
            const n = hash(px, ty * 3 + i);
            if (n < 0.45) continue;
            const len = 2 + Math.floor(n * 4);
            const bend = hash(px, ty + 9) > 0.5 ? 1 : -1;
            for (let k = 0; k < len; k++) {
              g.fillStyle = k > len - 2 ? C.mossLit : C.moss;
              g.fillRect(px + (k > len - 3 ? bend : 0), y - 1 - k, 1, 1);
            }
          }
        }

        // vines and stalactites hanging from overhangs
        if (L.blocking(tx, ty) && L.get(tx, ty + 1) === T.EMPTY && ty > 1) {
          const n = hash(tx, ty * 7);
          if (n > 0.72) {
            const len = 4 + Math.floor(n * 14);
            const px = x + 3 + Math.floor(hash(tx, ty) * 9);
            for (let k = 0; k < len; k++) {
              const wob = Math.round(Math.sin(k * 0.5 + tx) * 1.2);
              g.fillStyle = k % 5 === 4 ? C.vineLit : (k % 2 ? C.vine : C.vineDark);
              g.fillRect(px + wob, y + TILE + k, 1, 1);
              if (k % 6 === 3) { g.fillStyle = C.vine; g.fillRect(px + wob + (k % 12 ? 1 : -1), y + TILE + k, 1, 1); }
            }
          } else if (n > 0.62) {
            const len = 3 + Math.floor(hash(tx, ty + 3) * 6);
            const px = x + 4 + Math.floor(hash(tx, ty + 1) * 8);
            for (let k = 0; k < len; k++) {
              const w = Math.max(1, 3 - Math.floor(k * 3 / len));
              g.fillStyle = k < 2 ? BANDS[1].mid : BANDS[2].dark;
              g.fillRect(px - (w >> 1), y + TILE + k, w, 1);
            }
          }
        }

        // the odd glowing crystal buried in deep rock
        if (t === T.SOLID && this.#depthAt(L, tx, ty) >= 2 && hash(tx * 3, ty * 5) > 0.965) {
          const px = x + 5 + Math.floor(hash(tx, ty) * 5), py = y + 5 + Math.floor(hash(ty, tx) * 5);
          g.fillStyle = 'rgba(111,232,255,0.25)';
          g.fillRect(px - 2, py - 2, 5, 5);
          g.fillStyle = C.crystalDark;
          g.fillRect(px - 1, py - 1, 3, 3);
          g.fillStyle = C.crystal;
          g.fillRect(px, py - 1, 1, 3);
          g.fillRect(px - 1, py, 3, 1);
        }
      }
    }
  }

  // -------------------------------------------------------------- dynamics
  updateScarf(p, dt) {
    const anchorX = p.cx - p.facing * 2;
    const anchorY = p.y + (p.sliding ? 3 : 6);
    if (!this.scarf) {
      this.scarf = Array.from({ length: 8 }, () => ({ x: anchorX, y: anchorY, px: anchorX, py: anchorY }));
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
        const seg = 2.4;
        const f = (d - seg) / d;
        b.x -= dx * f; b.y -= dy * f;
      }
    }
  }

  // ----------------------------------------------------------------- frame
  draw(game, dt, realDt = dt) {
    const screen = this.ctx;
    const cam = game.cam, p = game.player, fx = game.fx;
    this.time += dt;
    this.rt += realDt;
    const ox = Math.round(cam.x + fx.shakeX);
    const oy = Math.round(cam.y + fx.shakeY);

    // a burst pushes the camera in towards you
    this.zoom += ((p.timeWarped ? BURST_ZOOM : 1) - this.zoom) * Math.min(1, realDt * 5);
    const zooming = this.zoom > 1.002;
    if (zooming) this.ctx = this.frameCtx;
    const ctx = this.ctx;

    ctx.drawImage(this.sky, 0, 0);
    this.#parallax(ox, oy);

    ctx.drawImage(this.tiles, ox, oy, VIEW_W, VIEW_H, 0, 0, VIEW_W, VIEW_H);

    this.#entities(game, ox, oy);
    this.#particles(fx, ox, oy, false);
    if (!p.dead) {
      this.#shadow(p, ox, oy);
      this.#player(p, ox, oy);
      this.#cue(p, ox, oy);
    }
    this.#particles(fx, ox, oy, true);

    if (zooming) {
      this.ctx = screen;
      this.#blitZoomed(screen, p.cx - ox, p.cy - oy);
    }

    // screen-space effects sit on top, at their own scale
    this.#burstOverlay(p, game.timeScale);
    this.#vignette();
    this.#speedOverlay(p);
  }

  /** Magnify the finished frame about the character, keeping them put. */
  #blitZoomed(out, px, py) {
    const z = this.zoom;
    const sw = Math.round(VIEW_W / z), sh = Math.round(VIEW_H / z);
    const cx = clamp01(px / VIEW_W) * VIEW_W, cy = clamp01(py / VIEW_H) * VIEW_H;
    const sx = Math.max(0, Math.min(VIEW_W - sw, Math.round(cx - cx / z)));
    const sy = Math.max(0, Math.min(VIEW_H - sh, Math.round(cy - cy / z)));
    out.drawImage(this.frame, sx, sy, sw, sh, 0, 0, VIEW_W, VIEW_H);
  }

  /** One seamless strip of ridgeline per parallax layer, baked once. */
  #bakeRidge(l) {
    const c = makeCanvas(l.period, VIEW_H);
    const g = c.getContext('2d');
    const top = new Int16Array(l.period);
    for (let x = 0; x < l.period; x++) {
      const t = (x / l.period) * l.nodes;
      const i = Math.floor(t), f = t - i;
      const a = hash(i % l.nodes, l.seed), b = hash((i + 1) % l.nodes, l.seed);
      const sm = f * f * (3 - 2 * f);
      // a second, finer octave gives the ridges their broken skyline
      const t2 = (x / l.period) * l.nodes * 3;
      const i2 = Math.floor(t2), f2 = t2 - i2;
      const a2 = hash(i2 % (l.nodes * 3), l.seed + 40), b2 = hash((i2 + 1) % (l.nodes * 3), l.seed + 40);
      const sm2 = f2 * f2 * (3 - 2 * f2);
      const hgt = (a + (b - a) * sm) * l.amp + (a2 + (b2 - a2) * sm2) * l.amp * 0.35;
      top[x] = Math.round(l.base - hgt);
    }
    for (let x = 0; x < l.period; x++) {
      const y = top[x];
      g.fillStyle = l.col;
      g.fillRect(x, y, 1, VIEW_H - y);
      g.fillStyle = l.rim;                       // moonlit crest
      g.fillRect(x, y, 1, 1);
      const rising = x > 0 && top[x - 1] > y;
      if (rising) { g.fillStyle = l.rim; g.fillRect(x, y + 1, 1, 1); }
      if (l.snow && y < l.base - l.amp * 0.55) { // snow only on the high ground
        g.fillStyle = l.snowCol;
        g.fillRect(x, y, 1, 1 + (hash(x, l.seed) > 0.5 ? 1 : 0));
        if (hash(x, l.seed + 7) > 0.62) g.fillRect(x, y + 2, 1, 1 + Math.floor(hash(x, 3) * 2));
      }
      if (hash(x, l.seed + 11) > 0.982) {        // scree / crevice
        g.fillStyle = l.shade;
        g.fillRect(x, y + 2, 1, 4 + Math.floor(hash(x, 5) * 10));
      }
    }
    return c;
  }

  #parallax(ox, oy) {
    const { ctx } = this;
    if (!this.ridges) {
      this.layers = [
        { f: 0.06, col: '#1d1438', rim: '#3a2a63', shade: '#151029', base: 150, amp: 74, period: 720, nodes: 9, seed: 2, snow: true, snowCol: 'rgba(214,226,255,0.30)' },
        { f: 0.14, col: '#231843', rim: '#40305f', shade: '#1a1233', base: 182, amp: 58, period: 620, nodes: 11, seed: 5, snow: true, snowCol: 'rgba(206,220,255,0.18)' },
        { f: 0.28, col: '#2a1d4e', rim: '#463465', shade: '#1f1640', base: 214, amp: 44, period: 540, nodes: 13, seed: 8 },
        { f: 0.48, col: '#33235a', rim: '#4d3a72', shade: '#261a46', base: 244, amp: 34, period: 460, nodes: 17, seed: 15 },
      ];
      this.ridges = this.layers.map((l) => this.#bakeRidge(l));
    }

    for (let i = 0; i < this.layers.length; i++) {
      const l = this.layers[i];
      const img = this.ridges[i];
      const dy = Math.round(-oy * l.f * 0.35);
      let dx = Math.round(-(ox * l.f) % l.period);
      if (dx > 0) dx -= l.period;
      for (let x = dx; x < VIEW_W; x += l.period) ctx.drawImage(img, x, dy);
      if (dy > 0) { ctx.fillStyle = l.col; ctx.fillRect(0, VIEW_H + dy - 1, VIEW_W, -dy + 1); }
      ctx.fillStyle = 'rgba(58,42,96,0.13)';      // haze stacking up with distance
      const my = Math.round(l.base + dy);
      if (my < VIEW_H) ctx.fillRect(0, my, VIEW_W, VIEW_H - my);
    }

    for (const m of this.motes) {
      const x = Math.round(m.x - ox * m.p + Math.sin(this.time * 0.6 + m.t) * 6);
      const y = Math.round(m.y - oy * m.p + Math.cos(this.time * 0.5 + m.t) * 5);
      if (x < -4 || x > VIEW_W + 4 || y < -4 || y > VIEW_H + 4) continue;
      const tw = 0.10 + m.p * 0.18 + Math.sin(this.time * 2 + m.t) * 0.06;
      ctx.fillStyle = `rgba(190,210,255,${Math.max(0, tw).toFixed(3)})`;
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
      ctx.fillStyle = C.signDark; ctx.fillRect(x + 6, y + 6, 3, 11);
      ctx.fillStyle = C.sign; ctx.fillRect(x + 6, y + 6, 1, 11);
      ctx.fillStyle = C.signDark; ctx.fillRect(x, y - 2, 16, 10);
      ctx.fillStyle = C.sign; ctx.fillRect(x + 1, y - 1, 14, 8);
      ctx.fillStyle = C.signLit; ctx.fillRect(x + 1, y - 1, 14, 1);
      ctx.fillStyle = C.signDark; ctx.fillRect(x + 1, y + 6, 14, 1);
      drawText(ctx, s.title.slice(0, 3), x + 2, y + 1, '#ffe6b0', 1);
    }

    for (const c of L.checkpoints) {
      const x = Math.round(c.x - ox), y = Math.round(c.y - oy);
      if (x < -30 || x > VIEW_W + 30) continue;
      ctx.fillStyle = '#2a2440'; ctx.fillRect(x - 1, y - 22, 2, 22);
      ctx.fillStyle = '#3c3560'; ctx.fillRect(x - 1, y - 22, 1, 22);
      ctx.fillStyle = c.on ? C.flagOn : '#4a4270';
      ctx.fillRect(x - 3, y - 1, 6, 2);
      const wave = Math.sin(t * 5 + (c.on ? 0 : 2));
      ctx.fillStyle = c.on ? C.flagOn : C.flag;
      for (let i = 0; i < 9; i++) {
        const w = 10 - Math.abs(4 - i) + Math.round(Math.sin(t * 5 - i * 0.6) * 1.4);
        ctx.fillRect(x + 1, y - 22 + i, Math.max(2, w), 1);
      }
      if (c.on) {
        ctx.globalAlpha = 0.25 + Math.sin(t * 3) * 0.1;
        ctx.fillStyle = C.flagOn;
        ctx.fillRect(x - 5, y - 26, 14, 16);
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = 'rgba(255,138,176,0.18)';
        ctx.fillRect(x + 1, y - 22 + Math.round(4 + wave), 10, 1);
      }
    }

    for (const c of L.crystals) {
      const x = Math.round(c.x - ox), y = Math.round(c.y - oy + Math.sin(t * 2.5 + c.x) * 2);
      if (x < -20 || x > VIEW_W + 20) continue;
      if (c.t > 0) {                              // spent: faint husk
        ctx.fillStyle = 'rgba(110,232,255,0.16)';
        for (let i = 0; i < 6; i++) ctx.fillRect(x - 3 + i, y - 4 + Math.abs(i - 3), 1, 8 - Math.abs(i - 3) * 2);
        continue;
      }
      ctx.globalAlpha = 0.16 + Math.sin(t * 3 + c.x) * 0.06;
      ctx.fillStyle = C.crystal;
      ctx.fillRect(x - 8, y - 9, 16, 18);
      ctx.globalAlpha = 1;
      ctx.fillStyle = C.crystalDark;
      for (let i = 0; i < 6; i++) ctx.fillRect(x - 5 + i, y - 6 + Math.abs(i - 3) + 1, 1, 12 - Math.abs(i - 3) * 2);
      ctx.fillStyle = C.crystal;
      for (let i = 1; i < 5; i++) ctx.fillRect(x - 5 + i, y - 5 + Math.abs(i - 3) + 1, 1, 10 - Math.abs(i - 3) * 2);
      ctx.fillStyle = C.crystalLit;
      ctx.fillRect(x - 2, y - 4, 1, 4);
      ctx.fillRect(x - 1, y - 5, 1, 2);
      if (Math.sin(t * 3 + c.x) > 0.9) { ctx.fillRect(x + 4, y - 6, 1, 1); ctx.fillRect(x - 6, y + 4, 1, 1); }
    }

    for (const s of L.springs) {
      const x = Math.round(s.x - ox), y = Math.round(s.y - oy);
      if (x < -20 || x > VIEW_W + 20) continue;
      const squash = s.t > 0 ? Math.min(6, s.t * 60) : 0;
      ctx.fillStyle = C.springDark;
      ctx.fillRect(x + 1, y + 15, 14, 1);
      for (let i = 0; i < 3; i++) {                       // coil
        const cy = y + 12 + squash + i * (2 - squash * 0.2);
        if (cy > y + 15) continue;
        ctx.fillStyle = i % 2 ? C.springDark : C.spring;
        ctx.fillRect(x + 3, Math.round(cy), 10, 1);
      }
      ctx.fillStyle = C.springDark;
      ctx.fillRect(x + 1, y + 9 + squash, 14, 3);
      ctx.fillStyle = C.spring;
      ctx.fillRect(x + 2, y + 8 + squash, 12, 3);
      ctx.fillStyle = C.springLit;
      ctx.fillRect(x + 3, y + 8 + squash, 10, 1);
      if (s.t > 0) {
        ctx.globalAlpha = Math.min(1, s.t * 4) * 0.5;
        ctx.fillStyle = C.springLit;
        ctx.fillRect(x, y + 4 + squash, 16, 2);
        ctx.globalAlpha = 1;
      }
    }

    if (L.goal) {
      const g = L.goal;
      const x = Math.round(g.x - ox), y = Math.round(g.y - oy);
      for (let i = 0; i < g.h; i += 2) {
        const a = 0.22 + 0.26 * Math.sin(t * 4 + i * 0.4);
        ctx.fillStyle = g.hit ? `rgba(125,255,196,${a})` : `rgba(255,214,120,${a})`;
        ctx.fillRect(x, y + i, g.w, 2);
      }
      for (let i = 0; i < 5; i++) {                        // motes rising inside the gate
        const py = y + g.h - ((t * 30 + i * 37) % g.h);
        const px = x + 3 + ((i * 7 + Math.floor(t * 9)) % (g.w - 6));
        ctx.fillStyle = g.hit ? '#7dffc4' : '#ffd678';
        ctx.fillRect(px, Math.round(py), 1, 2);
      }
      ctx.fillStyle = g.hit ? '#7dffc4' : '#ffd678';
      ctx.fillRect(x - 3, y - 5, 3, g.h + 10);
      ctx.fillRect(x + g.w, y - 5, 3, g.h + 10);
      ctx.fillStyle = g.hit ? '#d5ffe9' : '#fff0c4';
      ctx.fillRect(x - 3, y - 5, g.w + 6, 2);
      drawText(ctx, 'GOAL', x - 6, y - 15, '#ffd678', 1, '#2a1e0e');
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

  /** A soft blob under the feet so the character sits in the world. */
  #shadow(p, ox, oy) {
    const surf = this.level.floorUnder(p.x + 1, p.x + p.w - 1, p.footY - 1, p.footY + 46);
    if (surf === null) return;
    const drop = surf - p.footY;
    const a = 0.34 * (1 - drop / 46);
    const w = Math.round(p.w - drop * 0.08);
    const x = Math.round(p.cx - w / 2 - ox), y = Math.round(surf - oy) - 1;
    this.ctx.fillStyle = `rgba(10,7,20,${a.toFixed(3)})`;
    this.ctx.fillRect(x, y, w, 2);
    this.ctx.fillRect(x + 1, y - 1, w - 2, 1);
  }

  #player(p, ox, oy) {
    const { ctx } = this;
    const dir = p.facing > 0 ? 0 : 1;

    for (const g of p.trail) {
      const set = ghosts[g.name] ?? ghosts.idle;
      const img = set[g.facing > 0 ? 0 : 1][Math.min(g.frame, set[0].length - 1)];
      ctx.globalAlpha = Math.max(0, g.life / (g.max ?? 0.22)) * (g.alpha ?? 0.45);
      ctx.drawImage(img, Math.round(g.x + (p.w - SPRITE_W) / 2 - ox), Math.round(g.y + g.h - SPRITE_H - oy));
    }
    ctx.globalAlpha = 1;

    this.#drawScarf(p, ox, oy);

    const set = sprites[p.anim.name] ?? sprites.idle;
    const frames = set[dir];
    const img = frames[Math.min(p.anim.frame, frames.length - 1)];
    const px = Math.round(p.x + (p.w - SPRITE_W) / 2 - ox);
    const py = Math.round(p.y + p.h - SPRITE_H - oy);
    ctx.drawImage(img, px, py);

    if (p.dashes > 0) {                      // dash-ready glint on the belt
      ctx.fillStyle = p.t.dashCool > 0 ? '#5a7fae' : '#9cf6ff';
      ctx.fillRect(px + (dir ? 6 : 8), py + 12, 2, 1);
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
      ctx.fillStyle = hot ? (i < 3 ? '#ef5a5a' : i < 5 ? '#d04a52' : '#b83b4c')
                          : (i < 3 ? '#7a7196' : i < 5 ? '#655d84' : '#575173');
      ctx.fillRect(Math.round(n.x - ox - w / 2), Math.round(n.y - oy - w / 2), w, w);
    }
  }

  /** The prompt: a key cap over the character and a marker on the lip. */
  #cue(p, ox, oy) {
    const c = p.cue;
    const late = !c && p.t.refund > 0;        // missed the lip — roll out of the landing
    if ((!c && !late) || p.vault) return;
    const { ctx } = this;
    const up = c ? c.kind === 'up' : false;
    const col = up ? C.cueUp : C.cueDown;
    const pulse = 0.62 + 0.38 * Math.sin(this.time * 13);

    if (c) {                                   // bracket on the spot you would land
      const lx = Math.round(c.x - ox), ly = Math.round(c.y + p.h - oy);
      ctx.globalAlpha = 0.3 + pulse * 0.35;
      ctx.fillStyle = col;
      ctx.fillRect(lx, ly - 1, 3, 1); ctx.fillRect(lx, ly - 3, 1, 3);
      ctx.fillRect(lx + p.w - 3, ly - 1, 3, 1); ctx.fillRect(lx + p.w - 1, ly - 3, 1, 3);
      ctx.globalAlpha = 1;
    }

    const label = up ? 'VAULT' : 'ROLL';
    const capW = 7;
    const w = capW + 3 + textWidth(label, 1) + 5;
    const bob = Math.round(Math.sin(this.time * 5) * 1.5);
    const x = Math.round(p.cx - w / 2 - ox);
    const y = Math.round(p.y - 23 - oy) + bob;

    ctx.fillStyle = 'rgba(12,9,24,0.86)';
    ctx.fillRect(x, y, w, 12);
    ctx.globalAlpha = 0.45 + pulse * 0.55;
    ctx.fillStyle = col;
    ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + 11, w, 1);
    ctx.fillRect(x, y, 1, 12); ctx.fillRect(x + w - 1, y, 1, 12);
    ctx.globalAlpha = 1;

    // the key cap itself, so the binding is never a mystery
    ctx.fillStyle = col;
    ctx.fillRect(x + 3, y + 2, capW, 8);
    ctx.fillStyle = '#0c0918';
    ctx.fillRect(x + 3, y + 9, capW, 1);
    drawText(ctx, 'C', x + 5, y + 3, '#0c0918', 1);
    drawText(ctx, label, x + capW + 5, y + 3, col, 1);

    // an arrow pointing the way it will take you
    const ax = Math.round(p.cx - ox), ay = up ? y - 4 : y + 15;
    ctx.globalAlpha = 0.4 + pulse * 0.6;
    ctx.fillStyle = col;
    for (let i = 0; i < 3; i++) {
      const wdt = 5 - i * 2;
      ctx.fillRect(ax - (wdt >> 1), up ? ay + i : ay - i, wdt, 1);
    }
    ctx.globalAlpha = 1;
  }

  /** Bullet time: streaks tear past at wall-clock speed while the world crawls,
   *  and the frame edges go cold so it is unmistakable. */
  #burstOverlay(p, timeScale = 1) {
    const t = 1 - clamp01((timeScale - 0.45) / 0.55);     // 0 normal ... 1 fully slowed
    if (t <= 0.01) return;
    const { ctx } = this;
    const dir = Math.sign(p.vx) || 1;

    for (let i = 0; i < 40; i++) {
      const y = Math.floor(hash(i, 71) * VIEW_H);
      const mid = 1 - Math.abs(y - VIEW_H / 2) / (VIEW_H / 2);
      const speed = 620 + hash(i, 72) * 900;
      const span = VIEW_W + 200;
      const phase = (this.rt * speed + hash(i, 73) * span) % span;
      const x = dir > 0 ? VIEW_W + 100 - phase : phase - 100;
      const len = 24 + hash(i, 74) * 90;
      ctx.globalAlpha = t * (0.06 + (1 - mid) * 0.3);
      ctx.fillStyle = hash(i, 75) > 0.7 ? '#ffffff' : '#bff4ff';
      ctx.fillRect(Math.round(x), y, Math.round(len), 1);
    }

    ctx.globalAlpha = t * 0.5;                            // cold frame
    for (let i = 0; i < 22; i++) {
      const a = (1 - i / 22) * 0.055;
      ctx.fillStyle = `rgba(96,214,255,${a.toFixed(4)})`;
      ctx.fillRect(0, i, VIEW_W, 1);
      ctx.fillRect(0, VIEW_H - 1 - i, VIEW_W, 1);
      ctx.fillRect(i, 0, 1, VIEW_H);
      ctx.fillRect(VIEW_W - 1 - i, 0, 1, VIEW_H);
    }
    ctx.globalAlpha = 1;
  }

  /** Corner darkening — cheap, and it pushes the eye to the middle. */
  #vignette() {
    const { ctx } = this;
    for (let i = 0; i < 16; i++) {
      ctx.fillStyle = `rgba(8,6,16,${(0.030 - i * 0.0018).toFixed(4)})`;
      ctx.fillRect(i, i, VIEW_W - i * 2, 1);
      ctx.fillRect(i, VIEW_H - 1 - i, VIEW_W - i * 2, 1);
      ctx.fillRect(i, i, 1, VIEW_H - i * 2);
      ctx.fillRect(VIEW_W - 1 - i, i, 1, VIEW_H - i * 2);
    }
  }

  #speedOverlay(p) {
    const { ctx } = this;
    const f = Math.min(1, p.flow);      // the overfill is fuel; the edges max out at a bar
    if (f > 0.45) {
      const a = (f - 0.45) / 0.55;
      ctx.globalAlpha = a * 0.22;
      ctx.fillStyle = '#63f0ff';
      ctx.fillRect(0, 0, VIEW_W, 2);
      ctx.fillRect(0, VIEW_H - 2, VIEW_W, 2);
      ctx.globalAlpha = a * 0.10;
      ctx.fillRect(0, 2, VIEW_W, 1);
      ctx.fillRect(0, VIEW_H - 3, VIEW_W, 1);
      ctx.globalAlpha = 1;
    }
  }
}
