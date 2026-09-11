// level.js — tile grid, authoring helpers and every collision query the game needs.
// Pure data + math; nothing in here touches the DOM.

export const TILE = 16;

export const T = {
  EMPTY: 0,
  SOLID: 1,
  SLOPE_R: 2,   // "/" — surface rises towards +x
  SLOPE_L: 3,   // "\" — surface falls towards +x
  ONEWAY: 4,    // jump-through platform
  SPIKE_UP: 5,
  SPIKE_DOWN: 6,
  DECO: 7,      // background rock, not collidable
  LOWCEIL: 8,   // stone lip hanging from the ceiling: only a slide fits under it
};

// How far down into its cell a tile is solid: [top, bottom] in pixels.
export const SPAN = { [T.SOLID]: [0, 16], [T.LOWCEIL]: [0, 6] };

export const isSlope = (t) => t === T.SLOPE_R || t === T.SLOPE_L;
export const isSpike = (t) => t === T.SPIKE_UP || t === T.SPIKE_DOWN;

export class Level {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.tiles = new Uint8Array(w * h);
    this.spawn = { x: 4 * TILE, y: 4 * TILE };
    this.crystals = [];
    this.springs = [];
    this.checkpoints = [];
    this.signs = [];
    this.goal = null;
    this.killY = h * TILE + 64;
  }

  get(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return T.EMPTY;
    return this.tiles[ty * this.w + tx];
  }

  set(tx, ty, t) {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return;
    this.tiles[ty * this.w + tx] = t;
  }

  // --- authoring ---------------------------------------------------------
  rect(tx, ty, w, h, t = T.SOLID) {
    for (let y = ty; y < ty + h; y++) for (let x = tx; x < tx + w; x++) this.set(x, y, t);
    return this;
  }

  platform(tx, ty, w) { return this.rect(tx, ty, w, 1, T.ONEWAY); }

  spikes(tx, ty, w, dir = 'up') {
    return this.rect(tx, ty, w, 1, dir === 'up' ? T.SPIKE_UP : T.SPIKE_DOWN);
  }

  /** Staircase of `steps` ledges, each `run` wide and 1 tile tall.
   *  dir  +1 climbs towards +x, -1 descends towards +x. */
  stairs(tx, ty, steps, run, dir, groundY) {
    for (let i = 0; i < steps; i++) {
      const top = dir > 0 ? ty - i : ty - (steps - 1 - i);
      const x = tx + i * run;
      this.rect(x, top, run, groundY - top + 1);
    }
    return this;
  }

  /** Diagonal ramp; fills solid rock underneath down to `floorY`. */
  ramp(tx, ty, len, dir, floorY) {
    for (let i = 0; i < len; i++) {
      const x = tx + i;
      const y = dir > 0 ? ty - i : ty - (len - 1 - i);
      this.set(x, y, dir > 0 ? T.SLOPE_R : T.SLOPE_L);
      for (let fy = y + 1; fy <= floorY; fy++) this.set(x, fy, T.SOLID);
    }
    return this;
  }

  crystal(tx, ty) { this.crystals.push({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2, t: 0 }); return this; }
  spring(tx, ty) { this.springs.push({ x: tx * TILE, y: ty * TILE, t: 0 }); return this; }
  /** ty is the row of the surface the flag stands on. */
  checkpoint(tx, ty) { this.checkpoints.push({ x: tx * TILE + TILE / 2, y: ty * TILE, on: false, t: 0 }); return this; }
  sign(tx, ty, title, lines) { this.signs.push({ x: tx * TILE, y: ty * TILE, title, lines }); return this; }

  // --- collision ---------------------------------------------------------

  /** Surface height (world y) of a tile's walkable top at world x, or null. */
  surfaceY(tx, ty, x) {
    const t = this.get(tx, ty);
    if (t === T.SOLID || t === T.ONEWAY || t === T.SPIKE_UP || t === T.SPIKE_DOWN || t === T.LOWCEIL) return ty * TILE;
    if (t === T.SLOPE_R) return ty * TILE + (TILE - 1 - clamp(Math.floor(x) - tx * TILE, 0, TILE - 1));
    if (t === T.SLOPE_L) return ty * TILE + clamp(Math.floor(x) - tx * TILE, 0, TILE - 1);
    return null;
  }

  blocking(tx, ty) {
    const t = this.get(tx, ty);
    return t === T.SOLID || t === T.LOWCEIL;
  }

  /** Vertical extent of a blocking tile within its own cell. */
  span(t) { return SPAN[t] ?? null; }

  /** Does an axis-aligned box overlap any wall-like tile? Slopes never block sideways. */
  boxHitsWall(x, y, w, h) {
    const x0 = Math.floor(x / TILE), x1 = Math.floor((x + w - 1) / TILE);
    const y0 = Math.floor(y / TILE), y1 = Math.floor((y + h - 1) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (tx < 0 || tx >= this.w) return true;       // level edges are walls
        if (!this.blocking(tx, ty)) continue;
        const [top, bot] = this.span(this.get(tx, ty));
        if (y + h > ty * TILE + top && y < ty * TILE + bot) return true;
      }
    }
    return false;
  }

  /** Is a box resting on something? Used to validate an auto-step landing. */
  boxHasGroundUnder(x, y, w, h) {
    return this.floorUnder(x, x + w, y + h, y + h + 3) !== null;
  }

  /** Highest floor surface whose top lies within [fromY, toY] under the span [xl, xr).
   *  A slope is sampled at its highest point inside the span, so a box climbing a
   *  ramp rides on its leading edge instead of clipping the rock beside it. */
  floorUnder(xl, xr, fromY, toY, opts = {}) {
    const { oneway = true, slopesOnly = false } = opts;
    let best = null;
    const tx0 = Math.floor(xl / TILE), tx1 = Math.floor((xr - 1) / TILE);
    const ty0 = Math.floor(fromY / TILE) - 1, ty1 = Math.floor(toY / TILE) + 1;
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const t = this.get(tx, ty);
        if (t === T.EMPTY || t === T.DECO || t === T.LOWCEIL) continue;
        if (t === T.ONEWAY && !oneway) continue;
        if (slopesOnly && !isSlope(t)) continue;
        if (isSpike(t)) continue;
        let surf;
        if (isSlope(t)) {
          const lo = Math.max(xl, tx * TILE);
          const hi = Math.min(xr - 1, tx * TILE + TILE - 1);
          if (hi < lo) continue;
          surf = this.surfaceY(tx, ty, t === T.SLOPE_R ? hi : lo);
        } else {
          surf = ty * TILE;
        }
        if (surf < fromY - 0.01 || surf > toY + 0.01) continue;
        if (best === null || surf < best) best = surf;
      }
    }
    return best;
  }

  /** Slope tile directly under a point, or null — used for downhill acceleration. */
  slopeUnder(cx, footY) {
    for (let ty = Math.floor((footY - 2) / TILE); ty <= Math.floor((footY + 2) / TILE); ty++) {
      const tx = Math.floor(cx / TILE);
      const t = this.get(tx, ty);
      if (isSlope(t)) {
        const surf = this.surfaceY(tx, ty, cx);
        if (Math.abs(surf - footY) <= 3) return t;
      }
    }
    return null;
  }

  /** Lowest ceiling under a rising box, or null. */
  ceilingAbove(xl, xr, fromY, toY) {
    let best = null;
    const tx0 = Math.floor(xl / TILE), tx1 = Math.floor((xr - 1) / TILE);
    const ty0 = Math.floor(toY / TILE) - 1, ty1 = Math.floor(fromY / TILE) + 1;
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        if (!this.blocking(tx, ty)) continue;
        const bottom = ty * TILE + this.span(this.get(tx, ty))[1];
        if (bottom > fromY + 0.01 || bottom < toY - 0.01) continue;
        if (best === null || bottom > best) best = bottom;
      }
    }
    return best;
  }

  boxHitsSpikes(x, y, w, h) {
    const x0 = Math.floor((x + 2) / TILE), x1 = Math.floor((x + w - 3) / TILE);
    const y0 = Math.floor((y + 2) / TILE), y1 = Math.floor((y + h - 2) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const t = this.get(tx, ty);
        if (t === T.SPIKE_UP) { if (y + h > ty * TILE + 6) return true; }
        else if (t === T.SPIKE_DOWN) { if (y < ty * TILE + TILE - 6) return true; }
      }
    }
    return false;
  }
}

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
