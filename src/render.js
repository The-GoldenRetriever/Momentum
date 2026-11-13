// render.js — everything that puts pixels on the screen.

import { TILE, T, isSlope } from './level.js';
import { makeCanvas, sprites, ghosts, SPRITE_W, SPRITE_H } from './art.js';
import { drawText, textWidth } from './font.js';
import { phaseState, M } from './mechanics.js';
import { keyName } from './input.js';

export const VIEW_W = 480;
export const VIEW_H = 270;

const C = {
  oneway: '#6a5c9c', onewayLit: '#a294e0', onewayDark: '#3a3162',
  spike: '#dfe4ff', spikeMid: '#9aa2d8', spikeDark: '#6f77ad',
  deco: '#241d3d', decoLit: '#2e2650',
  crystal: '#6fe8ff', crystalDark: '#2aa8cf', crystalLit: '#d8fbff',
  ice: '#bfe6f7', iceLit: '#f4fcff', iceMid: '#8fcbe6', iceDark: '#5f9ec4',
  spring: '#ffcb57', springDark: '#c07a25', springLit: '#fff2c4',
  flag: '#ff8ab0', flagOn: '#7dffc4',
  sign: '#8b6a4a', signDark: '#5d442e', signLit: '#b08a62',
  cueUp: '#ffe6a8', cueDown: '#9cf6ff',
  crumble: '#9c7656', crumbleLit: '#c99c6e', crumbleDark: '#6b4c36', crumbleCrack: '#3e2a1f',
  phase: ['#ff7ab8', '#8fa8ff'], phaseDeep: ['#4a1d3a', '#232a5c'],
  boost: '#7dffc4', boostDark: '#1b6349',
};

// A level's look: sky, distant ridges, rock and growth. Everything here is
// used while baking, so a theme costs nothing per frame. `bands` darken with
// depth: rock gets darker the further it sits from daylight.
export const THEMES = {
  night: {
    sky: ['#0b0816', '#150e26', '#221635', '#33203f'],
    stars: 1, star: '226,236,255', cloud: '120,104,170', haze: 'rgba(58,42,96,0.13)',
    orb: { x: 386, y: 46, r: 13, lit: '#f3e6c8', dim: '#c9b894', glow: '243,230,200' },
    ridges: [
      { col: '#1d1438', rim: '#3a2a63', shade: '#151029', snow: 'rgba(214,226,255,0.30)' },
      { col: '#231843', rim: '#40305f', shade: '#1a1233', snow: 'rgba(206,220,255,0.18)' },
      { col: '#2a1d4e', rim: '#463465', shade: '#1f1640' },
      { col: '#33235a', rim: '#4d3a72', shade: '#261a46' },
    ],
    bands: [
      { mid: '#585090', lit: '#7869b4', dark: '#403873', vein: '#8d7fd0' },
      { mid: '#494077', lit: '#5e5296', dark: '#342d5e', vein: '#6f62ae' },
      { mid: '#332c58', lit: '#42396e', dark: '#241f43', vein: '#4a4080' },
      { mid: '#282247', lit: '#332c5a', dark: '#1c1834', vein: '#393261' },
    ],
    edge: '#8477c4', edgeDim: '#5a4f8c', rockDeep: '#221d3c',
    moss: '#5cd9a0', mossLit: '#8bf0bf', mossDark: '#2b8f66', mossShade: '#1b6349',
    vine: '#2f9a6d', vineDark: '#1d6b4c', vineLit: '#6ee0a6',
  },
  // underground: no sky worth the name, teal stone, glowing fungus
  cave: {
    sky: ['#04070a', '#071016', '#0b171d', '#0f2026'],
    stars: 0.25, star: '140,255,220', cloud: '40,90,90', haze: 'rgba(20,60,60,0.16)',
    orb: null,
    ridges: [
      { col: '#08141a', rim: '#12303a', shade: '#050d11' },
      { col: '#0b1a21', rim: '#173a44', shade: '#07121a' },
      { col: '#0e2129', rim: '#1c4550', shade: '#091820' },
      { col: '#122830', rim: '#22525c', shade: '#0c1d24' },
    ],
    bands: [
      { mid: '#3c6466', lit: '#548a8a', dark: '#2a4a4c', vein: '#7fd6c4' },
      { mid: '#2f5153', lit: '#426f70', dark: '#213b3d', vein: '#5fb3a4' },
      { mid: '#223c3f', lit: '#2f5153', dark: '#172b2e', vein: '#3f8478' },
      { mid: '#192e31', lit: '#223e41', dark: '#102023', vein: '#2c5f57' },
    ],
    edge: '#6fc2b6', edgeDim: '#3f7f78', rockDeep: '#0f2124',
    moss: '#8ff27a', mossLit: '#d2ffb0', mossDark: '#4ea83e', mossShade: '#2c6b26',
    vine: '#5fd08a', vineDark: '#2e7a4c', vineLit: '#b8ffcf',
  },
  // the sun going down behind the ridges, warm rock, dry grass
  dusk: {
    sky: ['#2a1840', '#6a2c58', '#c4535c', '#f4a35c'],
    stars: 0.35, star: '255,230,210', cloud: '255,190,170', haze: 'rgba(120,50,70,0.12)',
    orb: { x: 120, y: 112, r: 24, lit: '#ffe2a0', dim: '#ffc078', glow: '255,200,140' },
    ridges: [
      { col: '#5a2a4e', rim: '#8a4766', shade: '#47203f' },
      { col: '#4a2244', rim: '#7a3c5c', shade: '#3a1a37' },
      { col: '#3a1b3a', rim: '#64304f', shade: '#2d1530' },
      { col: '#2c1530', rim: '#4f2744', shade: '#221027' },
    ],
    bands: [
      { mid: '#8a5560', lit: '#b0717a', dark: '#683f4a', vein: '#e0a080' },
      { mid: '#704450', lit: '#8f5a66', dark: '#54333d', vein: '#b8806a' },
      { mid: '#53323e', lit: '#6c434f', dark: '#3d242e', vein: '#8a5a52' },
      { mid: '#3e2530', lit: '#51303d', dark: '#2c1a22', vein: '#64403e' },
    ],
    edge: '#e8a28a', edgeDim: '#a86a62', rockDeep: '#2e1a24',
    moss: '#e8c45a', mossLit: '#ffe89a', mossDark: '#b08a32', mossShade: '#7a5a22',
    vine: '#c09a3a', vineDark: '#86642a', vineLit: '#ffe08a',
  },
  // first light: a cold blue sky going pale at the horizon, steel girders,
  // frost on the grass
  dawn: {
    sky: ['#101a33', '#25365c', '#5a6f96', '#d9b8a4'],
    stars: 0.5, star: '220,232,255', cloud: '200,214,240', haze: 'rgba(90,110,150,0.12)',
    orb: { x: 360, y: 150, r: 18, lit: '#fff1d6', dim: '#ffd9a8', glow: '255,226,190' },
    ridges: [
      { col: '#3a4a6e', rim: '#5d7096', shade: '#2e3c5c', snow: 'rgba(235,242,255,0.35)' },
      { col: '#2f3d5e', rim: '#4d6086', shade: '#25314d', snow: 'rgba(225,235,255,0.22)' },
      { col: '#25314d', rim: '#3e5072', shade: '#1c2640' },
      { col: '#1c2640', rim: '#33435f', shade: '#151d33' },
    ],
    bands: [
      { mid: '#5a6a8a', lit: '#7d8fb2', dark: '#43506c', vein: '#a8bce0' },
      { mid: '#48566f', lit: '#5f7091', dark: '#343f54', vein: '#8396bb' },
      { mid: '#353f54', lit: '#46536d', dark: '#262e3f', vein: '#5b6a8a' },
      { mid: '#272f40', lit: '#333d52', dark: '#1b2130', vein: '#414d66' },
    ],
    edge: '#a6b8dc', edgeDim: '#6e7fa2', rockDeep: '#1d2333',
    moss: '#cfe6f2', mossLit: '#ffffff', mossDark: '#8fb0c4', mossShade: '#5d7d92',
    vine: '#9ec4d6', vineDark: '#5f8698', vineLit: '#e8f8ff',
  },
  // high and cold under the northern lights: a green-washed sky, slate rock,
  // pale growth
  aurora: {
    sky: ['#050a14', '#0a1a2a', '#103a3a', '#1f6a52'],
    stars: 1, star: '210,255,235', cloud: '120,255,200', haze: 'rgba(60,200,150,0.10)',
    orb: { x: 92, y: 40, r: 9, lit: '#f2fff8', dim: '#cfe8dc', glow: '200,255,230' },
    ridges: [
      { col: '#14303a', rim: '#2a5a5e', shade: '#0f262e', snow: 'rgba(225,255,245,0.30)' },
      { col: '#112834', rim: '#244e56', shade: '#0c1f29', snow: 'rgba(215,255,240,0.18)' },
      { col: '#0e202c', rim: '#1e424c', shade: '#0a1922' },
      { col: '#0b1923', rim: '#183641', shade: '#08131b' },
    ],
    bands: [
      { mid: '#4c5a6a', lit: '#6a7c8e', dark: '#38424f', vein: '#8ff0c8' },
      { mid: '#3e4a58', lit: '#55657a', dark: '#2d3641', vein: '#6cc8a6' },
      { mid: '#2f3844', lit: '#3e4a59', dark: '#212831', vein: '#4a9a80' },
      { mid: '#232a33', lit: '#2e3742', dark: '#181d24', vein: '#356e5e' },
    ],
    edge: '#9fe8d0', edgeDim: '#5f9c8c', rockDeep: '#1a2028',
    moss: '#a8ffd8', mossLit: '#f0fff8', mossDark: '#5cc8a0', mossShade: '#3a8a6e',
    vine: '#7ae0b8', vineDark: '#3e8a70', vineLit: '#d8fff0',
  },
  // the glass sea at evening: a low gold sun through grey haze, wet dark rock,
  // and water still enough to mirror the sky
  tide: {
    sky: ['#1a2030', '#3a4258', '#7a7480', '#d8b088'],
    stars: 0.2, star: '255,240,220', cloud: '230,210,200', haze: 'rgba(150,140,150,0.14)',
    orb: { x: 330, y: 132, r: 20, lit: '#ffe7b8', dim: '#f2c48a', glow: '255,214,160' },
    ridges: [
      { col: '#4a4c5e', rim: '#6c6c7c', shade: '#3e4050' },
      { col: '#3c3f50', rim: '#5a5c6e', shade: '#323444' },
      { col: '#303344', rim: '#4a4d60', shade: '#272a38' },
      { col: '#252838', rim: '#3c3f52', shade: '#1e202e' },
    ],
    bands: [
      { mid: '#4e5462', lit: '#6c7484', dark: '#3a3f4a', vein: '#9fb4c8' },
      { mid: '#3f4450', lit: '#565d6c', dark: '#2f333c', vein: '#7f93a8' },
      { mid: '#30343e', lit: '#40454f', dark: '#23262e', vein: '#5c6c7e' },
      { mid: '#24272f', lit: '#30343c', dark: '#1a1c22', vein: '#43505e' },
    ],
    edge: '#b8c6d6', edgeDim: '#7a8898', rockDeep: '#1c1f26',
    moss: '#c8d890', mossLit: '#f0f8c8', mossDark: '#8ca060', mossShade: '#5c6c40',
    vine: '#a0b070', vineDark: '#5c6c40', vineLit: '#e0f0b0',
    water: { body: '#4c6680', deep: '#2c3e56', surf: '#e8dcc0', lit: '#fff6dc' },
  },
  // where the Stillness has passed: a pale sky with no wind in it, frost on
  // grey rock, nothing growing
  frost: {
    sky: ['#2a2c40', '#4a4e68', '#7c809c', '#b8bcd4'],
    stars: 0.6, star: '240,244,255', cloud: '230,236,250', haze: 'rgba(200,206,230,0.14)',
    orb: { x: 400, y: 60, r: 14, lit: '#f6f8ff', dim: '#d6dcef', glow: '230,236,255' },
    ridges: [
      { col: '#5a5e78', rim: '#8a8ea8', shade: '#4c5068', snow: 'rgba(245,248,255,0.45)' },
      { col: '#4c5068', rim: '#787c98', shade: '#40445a', snow: 'rgba(240,244,255,0.30)' },
      { col: '#40445a', rim: '#646884', shade: '#363a4e' },
      { col: '#35384c', rim: '#545872', shade: '#2c2f40' },
    ],
    bands: [
      { mid: '#6a6e84', lit: '#8e92aa', dark: '#52566a', vein: '#d0d6ee' },
      { mid: '#585c70', lit: '#747890', dark: '#44475a', vein: '#a8aec8' },
      { mid: '#45485a', lit: '#585c70', dark: '#353846', vein: '#80869e' },
      { mid: '#35384a', lit: '#44475a', dark: '#282a36', vein: '#5e6478' },
    ],
    edge: '#dde2f4', edgeDim: '#9ea4bc', rockDeep: '#262834',
    moss: '#eef2ff', mossLit: '#ffffff', mossDark: '#b8bed8', mossShade: '#868ca6',
    vine: '#c8cee6', vineDark: '#868ca6', vineLit: '#f4f6ff',
  },
  // the glacier: a hard blue sky over blue-white ice and the dark rock under
  // it, snow where anything would grow, and meltwater the colour of glass
  glacier: {
    sky: ['#0c1630', '#1c3460', '#3f6a9c', '#a8d0ea'],
    stars: 0.8, star: '236,248,255', cloud: '220,240,255', haze: 'rgba(190,226,250,0.14)',
    orb: { x: 120, y: 54, r: 11, lit: '#f4fbff', dim: '#cfe4f4', glow: '210,236,255' },
    ridges: [
      { col: '#4e6e96', rim: '#9cc4e4', shade: '#405e84', snow: 'rgba(240,250,255,0.6)' },
      { col: '#3e5a80', rim: '#80a8cc', shade: '#344e70', snow: 'rgba(236,248,255,0.4)' },
      { col: '#304a6c', rim: '#62889e', shade: '#283f5c' },
      { col: '#243a58', rim: '#4a6a88', shade: '#1c304a' },
    ],
    bands: [
      { mid: '#5a7898', lit: '#86a8c8', dark: '#46627e', vein: '#d6f0ff' },
      { mid: '#46607e', lit: '#62809e', dark: '#364c66', vein: '#a8d4f0' },
      { mid: '#34485e', lit: '#46607e', dark: '#283a4c', vein: '#7aa8c8' },
      { mid: '#26364a', lit: '#34485e', dark: '#1c2838', vein: '#5a82a2' },
    ],
    edge: '#dcf2ff', edgeDim: '#94b8d4', rockDeep: '#18222e',
    moss: '#eef8ff', mossLit: '#ffffff', mossDark: '#b4d2e8', mossShade: '#7e9cb8',
    vine: '#bfe0f4', vineDark: '#7e9cb8', vineLit: '#f0faff',
    water: { body: '#2f7aa6', deep: '#1c4c70', surf: '#dcf8ff', lit: '#ffffff' },
  },
  // deep down where the rock runs hot: charcoal stone, glowing seams, ember
  // growth instead of moss
  ember: {
    sky: ['#0a0406', '#1a0709', '#2c0c0c', '#46160e'],
    stars: 0.4, star: '255,150,90', cloud: '140,50,30', haze: 'rgba(120,40,20,0.16)',
    orb: null,
    ridges: [
      { col: '#1e0a0b', rim: '#4a1a12', shade: '#160708' },
      { col: '#240c0c', rim: '#56200f', shade: '#1a0809' },
      { col: '#2c0f0d', rim: '#6a2a12', shade: '#200a0a' },
      { col: '#34120e', rim: '#7a3414', shade: '#270d0b' },
    ],
    bands: [
      { mid: '#4a3a3a', lit: '#66504c', dark: '#352828', vein: '#ff8a3c' },
      { mid: '#3a2d2e', lit: '#4f3d3d', dark: '#291f20', vein: '#d86a2c' },
      { mid: '#2b2122', lit: '#3a2c2d', dark: '#1e1617', vein: '#a04a20' },
      { mid: '#201819', lit: '#2b2021', dark: '#161011', vein: '#6e3218' },
    ],
    edge: '#ff9a52', edgeDim: '#b0582c', rockDeep: '#1a1112',
    moss: '#ff7a2e', mossLit: '#ffd08a', mossDark: '#c04a1a', mossShade: '#7a2a10',
    vine: '#e05a22', vineDark: '#8a3214', vineLit: '#ffb060',
  },
};

// The theme being baked. Only ever read while a Renderer is being built, so
// it is safe for several renderers to exist with different themes.
let TH = THEMES.night;

const BURST_ZOOM = 1.25;        // 480/1.25 and 270/1.25 are both whole numbers,
                               // so the blow-up lands on clean pixel runs

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// The bake only sees rock that is there for good. Crumbling and phase blocks
// come and go, so they are drawn live, and nothing baked (moss caps, vines,
// edges) may lean on them or it would be left hanging when they vanish.
const rock = (L, tx, ty) => { const t = L.get(tx, ty); return t === T.SOLID || t === T.LOWCEIL; };

function hash(x, y) {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

export class Renderer {
  constructor(ctx, level) {
    this.ctx = ctx;
    this.level = level;
    TH = THEMES[level.theme] ?? THEMES.night;
    this.theme = TH;
    this.tiles = this.#bakeTiles(level);
    this.sky = this.#bakeSky();
    this.#bakeRidges();
    this.motes = Array.from({ length: 110 }, (_, i) => ({
      x: hash(i, 1) * level.w * TILE, y: hash(i, 2) * level.h * TILE,
      p: 0.3 + hash(i, 3) * 0.5, s: hash(i, 4) < 0.25 ? 2 : 1, t: hash(i, 5) * 6,
    }));
    this.scarf = null;
    this.shiftX = 0;     // how far the frame draws the body off its last step
    this.shiftY = 0;     // (see Game.draw); the scarf follows it
    this.vaultKey = 'C'; // whatever the vault key is bound to, for the cue's key cap
    // Water is drawn live (its surface never sits still), in the theme's own
    // colours if it has any, taken now while TH is this level's.
    this.waterCol = TH.water ?? { body: '#245f8f', deep: '#173f66', surf: '#9fe0ff', lit: '#e6f8ff' };
    this.hasWater = level.tiles.includes(T.WATER);
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
    grad.addColorStop(0, TH.sky[0]);
    grad.addColorStop(0.42, TH.sky[1]);
    grad.addColorStop(0.78, TH.sky[2]);
    grad.addColorStop(1, TH.sky[3]);
    g.fillStyle = grad;
    g.fillRect(0, 0, VIEW_W, VIEW_H);

    // stars, brighter and denser towards the top of the sky
    for (let i = 0; i < 260 * TH.stars; i++) {
      const x = Math.floor(hash(i, 9) * VIEW_W);
      const y = Math.floor(Math.pow(hash(i, 10), 1.6) * VIEW_H * 0.8);
      const a = (0.05 + hash(i, 11) * 0.5) * (1 - y / (VIEW_H * 0.9));
      g.fillStyle = `rgba(${TH.star},${a.toFixed(3)})`;
      g.fillRect(x, y, 1, 1);
      if (hash(i, 12) > 0.94) {                 // a few with a faint cross flare
        g.fillStyle = `rgba(${TH.star},${(a * 0.4).toFixed(3)})`;
        g.fillRect(x - 1, y, 1, 1); g.fillRect(x + 1, y, 1, 1);
        g.fillRect(x, y - 1, 1, 1); g.fillRect(x, y + 1, 1, 1);
      }
    }

    // moon (or sun) with a soft halo and a couple of maria
    const o = TH.orb;
    if (o) {
      const { x: mx, y: my, r } = o;
      for (let ry = -r - 6; ry <= r + 6; ry++) {
        for (let rx = -r - 6; rx <= r + 6; rx++) {
          const d = Math.hypot(rx, ry);
          if (d > r && d < r + 7) {
            g.fillStyle = `rgba(${o.glow},${(0.05 * (1 - (d - r) / 7)).toFixed(3)})`;
            g.fillRect(mx + rx, my + ry, 1, 1);
          }
        }
      }
      for (let ry = -r; ry <= r; ry++) {
        for (let rx = -r; rx <= r; rx++) {
          const d = Math.hypot(rx, ry);
          if (d > r) continue;
          const shade = hash(rx + 40, ry + 40);
          g.fillStyle = (rx + ry > r * 0.6 || shade > 0.88) ? o.dim : o.lit;
          g.fillRect(mx + rx, my + ry, 1, 1);
        }
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
        g.fillStyle = `rgba(${TH.cloud},${(0.05 + edge * 0.07).toFixed(3)})`;
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
    const band = TH.bands[Math.min(TH.bands.length - 1, depth)];
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
    while (d < 8 && rock(L, tx, ty - 1 - d)) d++;
    return d >= 5 ? 3 : d >= 3 ? 2 : d >= 1 ? 1 : 0;
  }

  #drawSolid(g, L, tx, ty, x, y) {
    const up = rock(L, tx, ty - 1), dn = rock(L, tx, ty + 1);
    const lf = rock(L, tx - 1, ty), rt = rock(L, tx + 1, ty);
    const depth = this.#depthAt(L, tx, ty);
    this.#rockFace(g, x, y, TILE, TILE, depth);

    // a crack running through some of the buried blocks
    if (depth > 0 && hash(tx, ty * 3) > 0.86) {
      const band = TH.bands[Math.min(TH.bands.length - 1, depth)];
      g.fillStyle = band.dark;
      let cx = x + 2 + Math.floor(hash(tx, ty) * (TILE - 5));
      for (let i = 0; i < TILE - 2; i++) {
        g.fillRect(cx, y + 1 + i, 1, 1);
        if (hash(cx, y + i) > 0.6) cx += hash(cx, i) > 0.5 ? 1 : -1;
        cx = Math.max(x + 1, Math.min(x + TILE - 2, cx));
      }
    }

    if (!up && L.isIce(tx, ty)) this.#iceCap(g, tx, ty, x, y);
    else if (!up) {                              // mossy cap
      g.fillStyle = TH.mossLit;
      g.fillRect(x, y, TILE, 1);
      g.fillStyle = TH.moss;
      g.fillRect(x, y + 1, TILE, 2);
      g.fillStyle = TH.mossDark;
      for (let px = 0; px < TILE; px++) {
        const d = hash(tx * 16 + px, ty) > 0.55 ? 1 : 0;
        g.fillRect(x + px, y + 3, 1, 1 + d);
      }
      g.fillStyle = TH.mossShade;
      g.fillRect(x, y + 5, TILE, 1);
      for (let px = 0; px < TILE; px++) {
        if (hash(tx * 31 + px, ty * 7) > 0.86) { g.fillStyle = TH.moss; g.fillRect(x + px, y - 1, 1, 1); }
      }
    } else {
      g.fillStyle = 'rgba(14,10,26,0.35)';       // ambient occlusion under rock
      g.fillRect(x, y, TILE, 1);
    }

    g.fillStyle = TH.rockDeep;
    if (!lf) g.fillRect(x, y, 1, TILE);
    if (!rt) g.fillRect(x + TILE - 1, y, 1, TILE);
    if (!dn) g.fillRect(x, y + TILE - 2, TILE, 2);
    if (!lf) { g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(x + 1, y, 1, TILE); }
    g.fillStyle = TH.edge;
    if (!lf && !up) g.fillRect(x, y, 1, 4);
    if (!rt && !up) g.fillRect(x + TILE - 1, y, 1, 4);
    g.fillStyle = TH.edgeDim;
    if (!lf && !dn) g.fillRect(x, y + TILE - 3, 1, 3);
    if (!rt && !dn) g.fillRect(x + TILE - 1, y + TILE - 3, 1, 3);
  }

  /** A sheet of ice over the rock: glassy, pale, with a glint or two in it and
   *  a ragged underside, so it reads as something you will not stop on. */
  #iceCap(g, tx, ty, x, y) {
    g.fillStyle = C.iceLit;
    g.fillRect(x, y, TILE, 1);
    g.fillStyle = C.ice;
    g.fillRect(x, y + 1, TILE, 3);
    g.fillStyle = C.iceMid;
    g.fillRect(x, y + 4, TILE, 1);
    for (let px = 0; px < TILE; px++) {
      const d = hash(tx * 16 + px, ty * 5);
      g.fillStyle = C.iceMid;
      if (d > 0.45) g.fillRect(x + px, y + 5, 1, 1);
      g.fillStyle = C.iceDark;
      if (d > 0.8) g.fillRect(x + px, y + 6, 1, 1);
    }
    g.fillStyle = C.iceLit;                      // a diagonal glint across some
    if (hash(tx, ty * 9) > 0.55) {
      const gx = x + 3 + Math.floor(hash(tx, ty) * 8);
      g.fillRect(gx, y + 1, 2, 1);
      g.fillRect(gx + 2, y + 2, 1, 1);
    }
  }

  #drawSlope(g, L, t, tx, ty, x, y) {
    const right = t === T.SLOPE_R;
    for (let px = 0; px < TILE; px++) {
      const localTop = right ? TILE - 1 - px : px;
      const h = TILE - localTop;
      this.#rockFace(g, x + px, y + localTop, 1, h, 0);
      g.fillStyle = TH.mossLit;
      g.fillRect(x + px, y + localTop, 1, 1);
      g.fillStyle = TH.moss;
      g.fillRect(x + px, y + localTop + 1, 1, 2);
      g.fillStyle = TH.mossDark;
      g.fillRect(x + px, y + localTop + 3, 1, 1);
      g.fillStyle = TH.mossShade;
      g.fillRect(x + px, y + localTop + 4, 1, 1);
      if (hash(x + px, y) > 0.9) { g.fillStyle = TH.moss; g.fillRect(x + px, y + localTop - 1, 1, 1); }
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
    g.fillStyle = TH.edge;
    g.fillRect(x, y, TILE, 1);
    g.fillStyle = TH.rockDeep;
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
        if (t === T.SOLID && !rock(L, tx, ty - 1) && L.get(tx, ty - 1) === T.EMPTY && !L.isIce(tx, ty)) {
          for (let i = 0; i < 3; i++) {
            const px = x + 2 + i * 5 + Math.floor(hash(tx * 5 + i, ty) * 2);
            const n = hash(px, ty * 3 + i);
            if (n < 0.45) continue;
            const len = 2 + Math.floor(n * 4);
            const bend = hash(px, ty + 9) > 0.5 ? 1 : -1;
            for (let k = 0; k < len; k++) {
              g.fillStyle = k > len - 2 ? TH.mossLit : TH.moss;
              g.fillRect(px + (k > len - 3 ? bend : 0), y - 1 - k, 1, 1);
            }
          }
        }

        // vines and stalactites hanging from overhangs
        if (rock(L, tx, ty) && L.get(tx, ty + 1) === T.EMPTY && ty > 1) {
          const n = hash(tx, ty * 7);
          if (n > 0.72) {
            const len = 4 + Math.floor(n * 14);
            const px = x + 3 + Math.floor(hash(tx, ty) * 9);
            for (let k = 0; k < len; k++) {
              const wob = Math.round(Math.sin(k * 0.5 + tx) * 1.2);
              g.fillStyle = k % 5 === 4 ? TH.vineLit : (k % 2 ? TH.vine : TH.vineDark);
              g.fillRect(px + wob, y + TILE + k, 1, 1);
              if (k % 6 === 3) { g.fillStyle = TH.vine; g.fillRect(px + wob + (k % 12 ? 1 : -1), y + TILE + k, 1, 1); }
            }
          } else if (n > 0.62) {
            const len = 3 + Math.floor(hash(tx, ty + 3) * 6);
            const px = x + 4 + Math.floor(hash(tx, ty + 1) * 8);
            for (let k = 0; k < len; k++) {
              const w = Math.max(1, 3 - Math.floor(k * 3 / len));
              g.fillStyle = k < 2 ? TH.bands[1].mid : TH.bands[2].dark;
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
    // the key cap over a ledge cue names whatever the vault key is bound to
    const vk = game.ui?.input?.keysFor('vault')[0];
    this.vaultKey = vk ? keyName(vk) : 'C';
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
    if (p.sinking && !this.hideActors) this.#sinking(p, ox, oy);
    else if (!p.dead && !this.hideActors) {
      this.#shadow(p, ox, oy);
      this.#player(p, ox, oy);
      this.#cue(p, ox, oy);
    }
    this.#particles(fx, ox, oy, true);
    if (this.level.chase && !this.hideActors) this.#stillness(this.level.chase, ox);

    if (zooming) {
      this.ctx = screen;
      this.#blitZoomed(screen, p.cx - ox, p.cy - oy);
    }

    // screen-space effects sit on top, at their own scale
    this.#burstOverlay(p, game.timeScale);
    this.#vignette();
    if (!this.hideActors) this.#speedOverlay(p);   // not over the title's scenery
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

  #bakeRidges() {
    const shape = [
      { f: 0.06, base: 150, amp: 74, period: 720, nodes: 9, seed: 2 },
      { f: 0.14, base: 182, amp: 58, period: 620, nodes: 11, seed: 5 },
      { f: 0.28, base: 214, amp: 44, period: 540, nodes: 13, seed: 8 },
      { f: 0.48, base: 244, amp: 34, period: 460, nodes: 17, seed: 15 },
    ];
    this.layers = shape.map((l, i) => {
      const c = TH.ridges[i];
      return { ...l, col: c.col, rim: c.rim, shade: c.shade, snow: !!c.snow, snowCol: c.snow };
    });
    this.ridges = this.layers.map((l) => this.#bakeRidge(l));
  }

  #parallax(ox, oy) {
    const { ctx } = this;

    for (let i = 0; i < this.layers.length; i++) {
      const l = this.layers[i];
      const img = this.ridges[i];
      const dy = Math.round(-oy * l.f * 0.35);
      let dx = Math.round(-(ox * l.f) % l.period);
      if (dx > 0) dx -= l.period;
      for (let x = dx; x < VIEW_W; x += l.period) ctx.drawImage(img, x, dy);
      if (dy > 0) { ctx.fillStyle = l.col; ctx.fillRect(0, VIEW_H + dy - 1, VIEW_W, -dy + 1); }
      ctx.fillStyle = this.theme.haze;            // haze stacking up with distance
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

    this.#furniture(L, ox, oy);
    if (this.hasWater) this.#water(L, ox, oy);

    for (const s of L.signs) {
      const x = Math.round(s.x - ox), y = Math.round(s.y - oy);
      if (x < -100 || x > VIEW_W + 100) continue;
      ctx.fillStyle = C.signDark; ctx.fillRect(x + 6, y + 6, 3, 11);
      ctx.fillStyle = C.sign; ctx.fillRect(x + 6, y + 6, 1, 11);
      // The board is as wide as its title, centred on the post: it used to be
      // a fixed three letters wide, so every title was cut to its first three.
      const bw = textWidth(s.title, 1) + 4, bx = x + 8 - Math.round(bw / 2);
      ctx.fillStyle = C.signDark; ctx.fillRect(bx, y - 2, bw, 10);
      ctx.fillStyle = C.sign; ctx.fillRect(bx + 1, y - 1, bw - 2, 8);
      ctx.fillStyle = C.signLit; ctx.fillRect(bx + 1, y - 1, bw - 2, 1);
      ctx.fillStyle = C.signDark; ctx.fillRect(bx + 1, y + 6, bw - 2, 1);
      drawText(ctx, s.title, bx + 2, y + 1, '#ffe6b0', 1);
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

  /** The blocks and pads that change while you play (mechanics.js). */
  /** The Stillness: everything behind its front washed pale and stopped
   *  dead, motes hanging where they froze, the front itself a crystal edge
   *  that will not hold still. Behind you and out of sight, a cold glow on
   *  the left of the screen grows as it closes. */
  #stillness(ch, ox) {
    const { ctx } = this;
    const fx = Math.round(ch.x - ox);
    if (fx > 0) {
      const w = Math.min(VIEW_W, fx);
      ctx.fillStyle = 'rgba(206,216,236,0.58)';
      ctx.fillRect(0, 0, w, VIEW_H);
      ctx.fillStyle = '#ffffff';                 // frozen motes, fixed in the world
      for (let gx = Math.floor(ox / 22); gx * 22 - ox < w; gx++) {
        for (let gy = 0; gy < VIEW_H / 22 + 1; gy++) {
          if (hash(gx, gy) < 0.7) continue;
          const mx = gx * 22 - ox + Math.floor(hash(gy, gx) * 20), my = gy * 22 + Math.floor(hash(gx + 9, gy) * 20);
          if (mx < w - 2) ctx.fillRect(mx, my, 1, 1);
        }
      }
      for (let y = 0; y < VIEW_H; y += 3) {     // the front, glittering
        const j = Math.floor(hash(Math.floor(y / 3), Math.floor(this.rt * 14)) * 7);
        ctx.fillStyle = j > 4 ? '#ffffff' : '#e4ecfa';
        ctx.fillRect(fx - j, y, j + 1, 3);
      }
    } else {
      const k = clamp01(1 - (ox - ch.x) / 280);
      for (let i = 0; i < 18 && k > 0; i++) {
        ctx.fillStyle = `rgba(226,234,250,${(k * 0.4 * (1 - i / 18)).toFixed(3)})`;
        ctx.fillRect(i, 0, 1, VIEW_H);
      }
    }
  }

  /** Water: a body in the theme's blues, and a surface that keeps moving, so
   *  it reads as something you cannot stand still on. */
  #water(L, ox, oy) {
    const { ctx } = this;
    const W = this.waterCol, t = this.time;
    const tx0 = Math.max(0, Math.floor(ox / TILE)), tx1 = Math.min(L.w - 1, Math.floor((ox + VIEW_W) / TILE));
    const ty0 = Math.max(0, Math.floor(oy / TILE)), ty1 = Math.min(L.h - 1, Math.floor((oy + VIEW_H) / TILE));
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        if (L.get(tx, ty) !== T.WATER) continue;
        const x = tx * TILE - ox, y = ty * TILE - oy;
        const top = L.waterTop(tx, ty);
        ctx.fillStyle = top ? W.body : W.deep;
        ctx.fillRect(x, y + (top ? 2 : 0), TILE, TILE - (top ? 2 : 0));
        if (!top) continue;
        // the surface: a lit line riding a slow swell, flecks of light on it
        for (let i = 0; i < TILE; i += 2) {
          const wx = tx * TILE + i;
          const dy = Math.round(Math.sin(wx * 0.19 + t * 3.1) * 1.1 + Math.sin(wx * 0.07 - t * 1.7) * 0.8);
          ctx.fillStyle = W.surf;
          ctx.fillRect(x + i, y + 1 + dy, 2, 1);
          ctx.fillStyle = W.body;
          ctx.fillRect(x + i, y + 2 + dy, 2, 2);
          if (hash(Math.floor(wx / 2), Math.floor(t * 2.5)) > 0.93) {
            ctx.fillStyle = W.lit;
            ctx.fillRect(x + i, y + dy, 1, 1);
          }
        }
        if (hash(tx, ty) > 0.6) {                // a slow glint below the surface
          ctx.globalAlpha = 0.18 + 0.12 * Math.sin(t * 1.3 + tx);
          ctx.fillStyle = W.surf;
          ctx.fillRect(x + 3 + Math.floor(hash(tx, 3) * 8), y + 7, 4, 1);
          ctx.globalAlpha = 1;
        }
      }
    }
  }

  #furniture(L, ox, oy) {
    const { ctx } = this;
    const t = this.time;
    const onScreen = (x, y) => x > -TILE && x < VIEW_W + TILE && y > -TILE && y < VIEW_H + TILE;

    for (const c of L.crumbles) {
      let x = c.tx * TILE - ox, y = c.ty * TILE - oy;
      if (!onScreen(x, y)) continue;
      if (c.state === 'gone') {
        // a ghost of the block, firming up just before it grows back
        ctx.globalAlpha = c.t < 0.4 ? 0.55 : 0.18;
        ctx.fillStyle = C.crumbleLit;
        for (let i = 0; i < TILE; i += 3) {
          ctx.fillRect(x + i, y, 1, 1); ctx.fillRect(x + i, y + TILE - 1, 1, 1);
          ctx.fillRect(x, y + i, 1, 1); ctx.fillRect(x + TILE - 1, y + i, 1, 1);
        }
        ctx.globalAlpha = 1;
        continue;
      }
      if (c.state === 'shaking') {               // rattling loose
        x += Math.round((hash(c.tx, Math.floor(t * 40)) - 0.5) * 3);
        y += Math.round((hash(c.ty, Math.floor(t * 40) + 7) - 0.5) * 2);
      }
      ctx.fillStyle = C.crumbleDark; ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = C.crumble; ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 3);
      ctx.fillStyle = C.crumbleLit; ctx.fillRect(x + 1, y + 1, TILE - 2, 1);
      ctx.fillStyle = C.crumbleCrack;            // the same cracks every time
      for (let i = 0; i < 3; i++) {
        let cx = x + 3 + Math.floor(hash(c.tx * 3 + i, c.ty) * 10);
        const len = 4 + Math.floor(hash(c.tx, c.ty * 3 + i) * 7);
        const cy = y + 2 + Math.floor(hash(c.ty + i, c.tx) * 6);
        for (let k = 0; k < len; k++) {
          ctx.fillRect(cx, cy + k, 1, 1);
          if (hash(cx, cy + k) > 0.55) cx += hash(k, cx) > 0.5 ? 1 : -1;
        }
      }
      if (c.state === 'shaking' && Math.random() < 0.3) {
        ctx.fillStyle = C.crumbleLit;            // grit trickling off the bottom
        ctx.fillRect(x + 2 + Math.floor(Math.random() * 12), y + TILE + Math.floor(Math.random() * 4), 1, 1);
      }
    }

    if (L.phases.length) {
      const { left } = phaseState(L);
      const warn = left < M.PHASE_WARN;
      const blink = Math.floor(t * 16) % 2 === 0;
      for (const b of L.phases) {
        const x = b.tx * TILE - ox, y = b.ty * TILE - oy;
        if (!onScreen(x, y)) continue;
        const col = C.phase[b.group];
        if (b.on) {
          ctx.globalAlpha = warn && blink ? 0.45 : 1;
          ctx.fillStyle = C.phaseDeep[b.group]; ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = col;
          ctx.fillRect(x, y, TILE, 1); ctx.fillRect(x, y + TILE - 1, TILE, 1);
          ctx.fillRect(x, y, 1, TILE); ctx.fillRect(x + TILE - 1, y, 1, TILE);
          ctx.globalAlpha *= 0.5;
          for (let i = 3; i < TILE * 2; i += 5) {       // diagonal hatching
            for (let k = 0; k < TILE - 2; k++) {
              const px = i - k;
              if (px > 0 && px < TILE - 1) ctx.fillRect(x + px, y + 1 + k, 1, 1);
            }
          }
          ctx.globalAlpha = 1;
        } else {
          // an outline of where it will be, brightening as its turn comes round
          ctx.globalAlpha = warn ? 0.7 : 0.25;
          ctx.fillStyle = col;
          for (let i = 0; i < TILE; i += 2) {
            ctx.fillRect(x + i, y, 1, 1); ctx.fillRect(x + i + 1, y + TILE - 1, 1, 1);
            ctx.fillRect(x, y + i + 1, 1, 1); ctx.fillRect(x + TILE - 1, y + i, 1, 1);
          }
          ctx.globalAlpha = 1;
        }
      }
    }

    for (const b of L.boosts) {
      const x = Math.round(b.x - ox), y = Math.round(b.y - oy);
      if (x > VIEW_W + 10 || x + b.w < -10 || y < -10 || y > VIEW_H + 10) continue;
      ctx.fillStyle = C.boostDark; ctx.fillRect(x, y - 3, b.w, 3);
      const shift = Math.floor(t * 24) % 8;          // chevrons racing the way it fires
      for (let i = -8; i < b.w + 8; i += 8) {
        const cx = x + i + (b.dir > 0 ? shift : 7 - shift);
        for (let k = 0; k < 3; k++) {
          const px = cx + (b.dir > 0 ? -Math.abs(k - 1) : Math.abs(k - 1));
          if (px < x || px > x + b.w - 2) continue;
          ctx.fillStyle = C.boost;
          ctx.fillRect(px, y - 3 + k, 2, 1);
        }
      }
      ctx.globalAlpha = 0.2 + (b.t > 0 ? 0.3 : 0) + Math.sin(t * 6) * 0.06;
      ctx.fillStyle = C.boost; ctx.fillRect(x, y - 6, b.w, 3);
      ctx.globalAlpha = 1;
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

  #player(p, ox, oy, alpha = 1) {
    const { ctx } = this;
    const dir = p.facing > 0 ? 0 : 1;

    for (const g of p.trail) {
      const set = ghosts[g.name] ?? ghosts.idle;
      const img = set[g.facing > 0 ? 0 : 1][Math.min(g.frame, set[0].length - 1)];
      ctx.globalAlpha = Math.max(0, g.life / (g.max ?? 0.22)) * (g.alpha ?? 0.45);
      ctx.drawImage(img, Math.round(g.x + (p.w - SPRITE_W) / 2 - ox), Math.round(g.y + g.h - SPRITE_H - oy));
    }
    ctx.globalAlpha = alpha;

    this.#drawScarf(p, ox, oy);

    const set = sprites[p.anim.name] ?? sprites.idle;
    const frames = set[dir];
    const img = frames[Math.min(p.anim.frame, frames.length - 1)];
    const px = Math.round(p.x + (p.w - SPRITE_W) / 2 - ox);
    const py = Math.round(p.y + p.h - SPRITE_H - oy);
    ctx.drawImage(img, px, py);

    if (p.dashes > 0 && !p.dashLocked) {     // dash-ready glint on the belt
      ctx.fillStyle = p.t.dashCool > 0 ? '#5a7fae' : '#9cf6ff';
      ctx.fillRect(px + (dir ? 6 : 8), py + 12, 2, 1);
    }
    ctx.globalAlpha = 1;
  }

  /** In the water: what is above the surface is drawn as it is, and what is
   *  below it shows faintly through the water, so you watch yourself wade and
   *  sink instead of standing in front of it. */
  #sinking(p, ox, oy) {
    const { ctx } = this;
    const sy = Math.round(p.sinkSurface + 2 - oy);   // where the drawn body of water starts
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, VIEW_W, sy); ctx.clip();
    this.#player(p, ox, oy);
    ctx.restore();
    ctx.save();
    ctx.beginPath(); ctx.rect(0, sy, VIEW_W, VIEW_H - sy); ctx.clip();
    this.#player(p, ox, oy, p.struggle > 0 && p.struggle < 0.15 ? p.struggle * 2 : 0.3);
    this.#cue(p, ox, oy);              // a bank in reach: C pulls you out
    ctx.restore();
  }

  #drawScarf(p, ox, oy) {
    const s = this.scarf;
    if (!s) return;
    const { ctx } = this;
    const hot = p.dashes > 0 && !p.dashLocked;
    for (let i = s.length - 1; i >= 1; i--) {
      const n = s[i];
      const w = Math.max(1, 4 - Math.floor(i / 2));
      ctx.fillStyle = hot ? (i < 3 ? '#ef5a5a' : i < 5 ? '#d04a52' : '#b83b4c')
                          : (i < 3 ? '#7a7196' : i < 5 ? '#655d84' : '#575173');
      ctx.fillRect(Math.round(n.x + this.shiftX - ox - w / 2), Math.round(n.y + this.shiftY - oy - w / 2), w, w);
    }
  }

  /** The prompt: a key cap over the character and a marker on the lip. */
  #cue(p, ox, oy) {
    // A ledge up gets a prompt (one you do not call is a wall), and so does a
    // downhill, where a roll runs away with you. A ledge down costs nothing to
    // run off, so a roll there is never asked for.
    const c = p.cue;
    const roll = p.rollHere;
    if (p.vault || (!roll && (!c || c.kind !== 'up'))) return;
    const { ctx } = this;
    const up = !roll;
    const col = up ? C.cueUp : C.cueDown;
    const pulse = 0.62 + 0.38 * Math.sin(this.time * 13);

    if (c && up) {                             // bracket on the spot you would land
      const lx = Math.round(c.x - ox), ly = Math.round(c.y + p.h - oy);
      ctx.globalAlpha = 0.3 + pulse * 0.35;
      ctx.fillStyle = col;
      ctx.fillRect(lx, ly - 1, 3, 1); ctx.fillRect(lx, ly - 3, 1, 3);
      ctx.fillRect(lx + p.w - 3, ly - 1, 3, 1); ctx.fillRect(lx + p.w - 1, ly - 3, 1, 3);
      ctx.globalAlpha = 1;
    }

    const label = up ? 'VAULT' : 'ROLL';
    const capW = textWidth(this.vaultKey, 1) + 3;
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
    drawText(ctx, this.vaultKey, x + 5, y + 3, '#0c0918', 1);
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
