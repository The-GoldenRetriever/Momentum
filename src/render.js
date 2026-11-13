// render.js — everything that puts pixels on the screen.

import { TILE, T, isSlope } from './level.js';
import { makeCanvas, sprites, ghosts, ghostsSoft, SPRITE_W, SPRITE_H } from './art.js';
import { drawText, textWidth } from './font.js';
import { phaseState, M } from './mechanics.js';
import { keyName } from './input.js';
import { P } from './player.js';

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
    flowers: ['#ff8ab0', '#ffd678', '#a8c8ff'], ambient: 'fireflies', trees: true,
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
    flowers: ['#9cf6ff', '#d2ffb0'], ambient: 'spores', underground: true,
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
    flowers: ['#ff9a6a', '#ffd678'], ambient: 'dust', trees: true,
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
    ambient: 'motes', trees: true,
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
    flowers: ['#a8ffd8', '#d0b8ff'], ambient: 'snow', trees: true, aurora: true,
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
    flowers: ['#ffe7b8', '#f6a0a0'], ambient: 'mist',
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
    ambient: 'snow', trees: true,
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
    ambient: 'snow', trees: true,
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
    ambient: 'embers', seams: true, underground: true,
  },
  // Ricochet: a city's afterglow in a violet night, stone laced with cyan
  // light, pink on every edge
  neon: {
    sky: ['#06020e', '#12062a', '#2a0b48', '#561466'],
    stars: 0.5, star: '255,200,255', cloud: '255,90,216', haze: 'rgba(120,30,140,0.12)',
    orb: { x: 360, y: 70, r: 16, lit: '#ff9ae8', dim: '#d860c0', glow: '255,120,230' },
    ridges: [
      { col: '#2a0c40', rim: '#7a2a90', shade: '#1c0830' },
      { col: '#220a36', rim: '#6a2280', shade: '#170628' },
      { col: '#1a082c', rim: '#5a1c70', shade: '#120520' },
      { col: '#140622', rim: '#4a1660', shade: '#0e0418' },
    ],
    bands: [
      { mid: '#2c2652', lit: '#423a78', dark: '#1c1838', vein: '#5ff2ff' },
      { mid: '#241f44', lit: '#342d62', dark: '#16132c', vein: '#40c8e0' },
      { mid: '#1c1836', lit: '#29234e', dark: '#110e22', vein: '#2a90a8' },
      { mid: '#16132a', lit: '#201c3c', dark: '#0d0b1a', vein: '#1e6a80' },
    ],
    edge: '#ff5ad8', edgeDim: '#a03a90', rockDeep: '#0e0b1c',
    moss: '#5ff2ff', mossLit: '#d8ffff', mossDark: '#1f9ab4', mossShade: '#126478',
    vine: '#ff5ad8', vineDark: '#a02a8a', vineLit: '#ffb0f0',
    flowers: ['#ff5ad8', '#ffe066'], ambient: 'neon', seams: true,
  },
  // The mire: a drowned forest at dusk, mud-green rock, goo where you would
  // put your feet, will-o'-wisps
  swamp: {
    sky: ['#070d0a', '#122018', '#26392a', '#56603a'],
    stars: 0.3, star: '230,255,200', cloud: '160,190,120', haze: 'rgba(80,110,60,0.16)',
    orb: { x: 110, y: 96, r: 14, lit: '#e8f0b0', dim: '#b8c888', glow: '220,240,160' },
    ridges: [
      { col: '#1c2a1c', rim: '#3e5a34', shade: '#142014' },
      { col: '#182418', rim: '#36502e', shade: '#111c11' },
      { col: '#141f14', rim: '#2e4628', shade: '#0e170e' },
      { col: '#101910', rim: '#263c22', shade: '#0b130b' },
    ],
    bands: [
      { mid: '#4a4630', lit: '#625e40', dark: '#332f20', vein: '#8a9a4a' },
      { mid: '#3e3a28', lit: '#524d36', dark: '#2a271a', vein: '#6f7c3c' },
      { mid: '#312e20', lit: '#413d2b', dark: '#211f15', vein: '#55602e' },
      { mid: '#262418', lit: '#333021', dark: '#191710', vein: '#424a24' },
    ],
    edge: '#a8b870', edgeDim: '#6e7a48', rockDeep: '#1a1810',
    moss: '#6fae44', mossLit: '#b8e878', mossDark: '#3e7424', mossShade: '#264a16',
    vine: '#5a9a3a', vineDark: '#30601e', vineLit: '#a8e070',
    flowers: ['#e8d070', '#c08ad8'], ambient: 'wisps', trees: true,
    goo: { body: '#9a4ad8', lit: '#e0a8ff', dark: '#4a1a78', bubble: '#f0d0ff' },
  },
  // The gale: a storm coming in over slate hills, rain driving sideways,
  // lightning
  storm: {
    sky: ['#0a0e16', '#161e2c', '#283444', '#4a586a'],
    stars: 0, star: '220,230,255', cloud: '150,170,200', haze: 'rgba(90,110,140,0.16)',
    orb: null,
    ridges: [
      { col: '#283444', rim: '#4a5c74', shade: '#1e2836' },
      { col: '#222c3a', rim: '#40506a', shade: '#19222e' },
      { col: '#1c2430', rim: '#36445a', shade: '#141b25' },
      { col: '#161d27', rim: '#2c384a', shade: '#10161e' },
    ],
    bands: [
      { mid: '#4e5662', lit: '#6a7482', dark: '#383e48', vein: '#9ab0c8' },
      { mid: '#424852', lit: '#59616e', dark: '#2f343c', vein: '#7a8ea6' },
      { mid: '#343941', lit: '#454b55', dark: '#24282e', vein: '#5c6c80' },
      { mid: '#282c33', lit: '#353a42', dark: '#1b1e23', vein: '#44505e' },
    ],
    edge: '#b4c4d8', edgeDim: '#74849a', rockDeep: '#1c1f25',
    moss: '#6a9a6a', mossLit: '#a8d0a0', mossDark: '#3e6a44', mossShade: '#28462e',
    vine: '#5a8a5e', vineDark: '#34583a', vineLit: '#9ac89a',
    ambient: 'rain', trees: true, lightning: true,
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

// '#rrggbb' -> [r, g, b], a mix of two, and back to a colour the canvas takes
const rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => { const A = rgb(a), B = rgb(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
// ... and as the 32-bit pixel an ImageData buffer wants (little-endian ABGR)
const px32 = (h) => { const [r, g, b] = rgb(h); return (255 << 24 | b << 16 | g << 8 | r) >>> 0; };

// A position's own random number in [0, 1). Integer mixing throughout: the
// old one multiplied in floating point, lost bits, and for a fixed y and a
// small run of x never came up over about 0.7, so every 'one in so many'
// detail (stalactites, pines, flares) all but never happened.
function hash(x, y) {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul((y | 0) + 0x9e3779b9, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Soft round glows, one per colour and size, made once and drawn additively.
const glows = new Map();
function glowSprite(col, r) {
  const key = col + r;
  if (!glows.has(key)) {
    const c = makeCanvas(r * 2, r * 2), g = c.getContext('2d');
    const [R, G, B] = rgb(col);
    const grad = g.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0, `rgba(${R},${G},${B},0.55)`);
    grad.addColorStop(0.35, `rgba(${R},${G},${B},0.22)`);
    grad.addColorStop(1, `rgba(${R},${G},${B},0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, r * 2, r * 2);
    glows.set(key, c);
  }
  return glows.get(key);
}

// What drifts through the air of each theme (see Renderer.#ambient): how many,
// which way, how fast, their colours, and whether they glow.
const AMBIENT = {
  fireflies: { n: 16, cols: ['#d8ff8a', '#fff2a0'], glow: true, drift: [8, -2], wander: 14, blink: true, low: true },
  spores: { n: 24, cols: ['#8ff2e0', '#c8fff0'], glow: true, drift: [3, -9], wander: 6 },
  dust: { n: 26, cols: ['#ffd8a8', '#ffc490'], drift: [-10, 2], wander: 5, faint: true },
  motes: { n: 20, cols: ['#fff4dc', '#dce8ff'], glow: true, drift: [-6, -3], wander: 6, faint: true },
  snow: { n: 55, cols: ['#ffffff', '#e6f2ff'], drift: [-8, 22], wander: 9 },
  mist: { n: 24, cols: ['#ffffff', '#dde8f0'], drift: [-14, -2], wander: 4, faint: true },
  embers: { n: 36, cols: ['#ff9a3c', '#ffd070', '#ff6a2a'], glow: true, drift: [4, -30], wander: 10, blink: true },
  neon: { n: 30, cols: ['#ff5ad8', '#5ff2ff', '#ffe066'], glow: true, drift: [-12, -4], wander: 8, blink: true },
  wisps: { n: 18, cols: ['#c8ff8a', '#d8a8ff'], glow: true, drift: [5, -3], wander: 18, blink: true, low: true },
  // rain is drawn as streaks, slanting with the wind (see #ambient)
  rain: { n: 120, cols: ['#a8c0e0', '#d0e0f4'], drift: [-120, 520], wander: 0, streak: true },
};

export class Renderer {
  constructor(ctx, level) {
    this.ctx = ctx;
    this.level = level;
    TH = THEMES[level.theme] ?? THEMES.night;
    this.theme = TH;
    this.tiles = this.#bakeTiles(level);
    this.sky = this.#bakeSky();
    this.#bakeRidges();
    // the air: each theme's own drift (snow, embers, fireflies ...), in screen
    // space with a little parallax, wrapping round the view
    this.amb = AMBIENT[TH.ambient] ?? AMBIENT.motes;
    this.motes = Array.from({ length: this.amb.n }, (_, i) => ({
      x: hash(i, 1) * (VIEW_W + 40), y: hash(i, 2) * (VIEW_H + 40),
      p: 0.35 + hash(i, 3) * 0.8, s: hash(i, 4) < 0.3 ? 2 : 1, t: hash(i, 5) * 6,
      col: this.amb.cols[i % this.amb.cols.length],
    }));
    this.aurora = !!TH.aurora;
    this.lightning = TH.lightning ? { next: 3 + hash(level.w, 1) * 4, flash: 0 } : null;
    this.gooCol = TH.goo ?? { body: '#9a4ad8', lit: '#e0a8ff', dark: '#4a1a78', bubble: '#f0d0ff' };
    this.gooTops = [];
    for (let ty = 1; ty < level.h; ty++) for (let tx = 0; tx < level.w; tx++)
      if (level.isGoo(tx, ty) && level.get(tx, ty - 1) !== T.SOLID) this.gooTops.push([tx, ty]);
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
    // a glow along the horizon, for the ridges to stand dark against
    const glow = g.createLinearGradient(0, VIEW_H * 0.45, 0, VIEW_H);
    glow.addColorStop(0, 'rgba(0,0,0,0)');
    glow.addColorStop(1, mix(TH.sky[3], '#ffffff', 0.18) + '66');
    g.fillStyle = glow;
    g.fillRect(0, 0, VIEW_W, VIEW_H);

    // Underground there is no sky: a far wall of great dim boulders instead
    if (TH.underground) {
      // (lifted a little, so the cave roof's teeth hang dark against it)
      g.fillStyle = `${TH.ridges[1].rim}30`;
      g.fillRect(0, 0, VIEW_W, VIEW_H);
      const wall = TH.ridges[0].col, lit = TH.ridges[0].rim;
      for (let y = 0; y < VIEW_H; y++) {
        const row = Math.floor(y / 22), ry = y % 22;
        for (let x = 0; x < VIEW_W; x++) {
          const sx = x + Math.floor(hash(row, 5) * 40);
          const k = Math.floor(sx / 34), lx = sx % 34;
          if (ry === 0 || lx === 0) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x, y, 1, 1); }
          else if (ry === 1 || lx === 1) { g.fillStyle = `${lit}22`; g.fillRect(x, y, 1, 1); }
          else if (hash(k, row) > 0.6 && hash(x, y) > 0.7) { g.fillStyle = `${wall}55`; g.fillRect(x, y, 1, 1); }
        }
      }
    }

    // stars, brighter and denser towards the top of the sky
    for (let i = 0; i < (TH.underground ? 0 : 260 * TH.stars); i++) {
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
    const W = L.w * TILE, H = L.h * TILE;
    const c = makeCanvas(W, H);
    const g = c.getContext('2d');
    // The rock itself goes in pixel by pixel, straight into a buffer (millions
    // of fillRects took seconds); everything drawn over it comes after.
    const img = g.createImageData(W, H);
    this.buf = new Uint32Array(img.data.buffer);
    this.bufW = W;
    // courses of uneven height (4 to 8 pixels), as natural rock lies
    this.course = new Int32Array(H);      // course index of each pixel row
    this.courseY = new Int8Array(H);      // ... how far down it, and its height
    this.courseH = new Int8Array(H);
    for (let y = 0, r = 0; y < H; r++) {
      const h = 4 + Math.floor(hash(r, 77) * 5);
      for (let k = 0; k < h && y < H; k++, y++) { this.course[y] = r; this.courseY[y] = k; this.courseH[y] = h; }
    }
    this.pal = TH.bands.map((b) => ({
      dark: px32(b.dark), dark2: px32(mix(b.mid, b.dark, 0.55)), mid: px32(b.mid),
      midDim: px32(mix(b.mid, b.dark, 0.25)), mid2: px32(mix(b.mid, b.lit, 0.35)),
      lit: px32(b.lit), vein: px32(b.vein),
    }));
    for (let ty = 0; ty < L.h; ty++) {
      for (let tx = 0; tx < L.w; tx++) {
        const t = L.get(tx, ty), x = tx * TILE, y = ty * TILE;
        if (t === T.SOLID) this.#rockFace(x, y, TILE, TILE, this.#depthAt(L, tx, ty));
        else if (t === T.LOWCEIL) this.#rockFace(x, y, TILE, 6, 1);
        else if (isSlope(t)) {
          for (let px = 0; px < TILE; px++) {
            const top = t === T.SLOPE_R ? TILE - 1 - px : px;
            this.#rockFace(x + px, y + top, 1, TILE - top, 0);
          }
        }
      }
    }
    g.putImageData(img, 0, 0);
    this.buf = this.course = this.courseY = this.courseH = null;
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

  /** Rock, into the bake buffer: courses of stones seven pixels high, each
   *  stone its own width, lit along its top and left and shadowed along its
   *  bottom and right, with rounded corners and the odd fleck. The pattern
   *  runs in world pixels, so it carries across tile seams. Deeper rock is
   *  calmer: less light on the stones, softer mortar. */
  #rockFace(x, y, w, h, depth = 0) {
    const d = Math.min(this.pal.length - 1, depth);
    const P = this.pal[d];
    const buf = this.buf, W = this.bufW;
    const seams = !!TH.seams;
    for (let py = 0; py < h; py++) {
      const wy = y + py;
      const row = this.course[wy], ry = this.courseY[wy], last = this.courseH[wy] - 1;
      const off = Math.floor(hash(row, 991) * 23);
      // stones 7 to 21 wide, and now and then a long slab
      const cw = 14, jit = (k) => (hash(k, row * 7 + 3) > 0.86 ? 0 : 1) * (Math.floor(hash(k, row * 7 + 5) * 9) - 4);
      for (let px = 0; px < w; px++) {
        const wx = x + px, sx = wx + off;
        let k = Math.floor(sx / cw), start = k * cw + jit(k);
        if (sx < start) { k--; start = k * cw + jit(k); }
        const lx = sx - start, sw = (k + 1) * cw + jit(k + 1) - start;
        const n = hash(wx * 3 + 7, wy * 5 + 1);
        let col;
        // (kept quiet on purpose: soft mortar, a lit edge only near the
        // surface, few flecks; the stones are a texture, not a feature)
        if (ry === 0 || lx === 0) col = seams && hash(wx >> 1, wy >> 1) > 0.82 ? P.vein : d >= 1 ? P.midDim : P.dark2;
        else if (ry === 1) col = d === 0 ? P.mid2 : P.mid;
        else if ((ry === last || lx === sw - 1) && d === 0) col = P.midDim;
        else if (n > 0.992) col = d === 0 ? P.lit : P.mid2;
        else if (n < 0.008) col = P.dark2;
        else if (n > 0.988) col = P.vein;
        else {
          const tint = hash(k, row);
          col = tint > 0.85 && d === 0 ? P.mid2 : tint < 0.15 ? P.midDim : P.mid;
        }
        buf[wy * W + wx] = col;
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

    // a crack running through some of the buried blocks
    if (depth > 0 && hash(tx, ty * 3) > 0.96) {
      const band = TH.bands[Math.min(TH.bands.length - 1, depth)];
      g.fillStyle = band.dark;
      let cx = x + 2 + Math.floor(hash(tx, ty) * (TILE - 5));
      for (let i = 0; i < TILE - 2; i++) {
        g.fillRect(cx, y + 1 + i, 1, 1);
        if (hash(cx, y + i) > 0.6) cx += hash(cx, i) > 0.5 ? 1 : -1;
        cx = Math.max(x + 1, Math.min(x + TILE - 2, cx));
      }
    }

    if (!up && L.isGoo(tx, ty)) this.#gooCap(g, tx, ty, x, y, lf, rt);
    else if (!up && L.isIce(tx, ty)) this.#iceCap(g, tx, ty, x, y);
    else if (!up) {                              // grassy cap, ragged underneath
      g.fillStyle = TH.mossLit;
      g.fillRect(x, y, TILE, 1);
      g.fillStyle = TH.moss;
      g.fillRect(x, y + 1, TILE, 3);
      for (let px = 0; px < TILE; px++) {
        const hang = Math.floor(hash(tx * 16 + px, ty) * 3);
        g.fillStyle = TH.mossDark;
        g.fillRect(x + px, y + 4, 1, 1 + hang);
        g.fillStyle = TH.mossShade;
        g.fillRect(x + px, y + 5 + hang, 1, 1);
        if (hash(tx * 31 + px, ty * 7) > 0.8) { g.fillStyle = TH.moss; g.fillRect(x + px, y - 1, 1, 1); }
        
      }
      // grass spilling over an open side, and the odd flower
      for (const [open, sx] of [[!lf, x - 1], [!rt, x + TILE]]) {
        if (!open) continue;
        const len = 2 + Math.floor(hash(sx, ty) * 4);
        g.fillStyle = TH.moss; g.fillRect(sx, y, 1, len);
        g.fillStyle = TH.mossDark; g.fillRect(sx, y + len, 1, 1);
      }
      const fl = TH.flowers;
      if (fl && hash(tx * 7, ty * 11) > 0.86) {
        const fx = x + 2 + Math.floor(hash(tx, ty * 5) * 12);
        g.fillStyle = TH.mossDark; g.fillRect(fx, y - 2, 1, 2);
        g.fillStyle = fl[Math.floor(hash(tx * 3, ty) * fl.length)];
        g.fillRect(fx - 1, y - 3, 3, 1); g.fillRect(fx, y - 4, 1, 3);
        g.fillStyle = '#fff6d0'; g.fillRect(fx, y - 3, 1, 1);
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

  /** Goo over the rock: a thick, glossy, sagging layer that hangs over its
   *  edges in drips, a highlight along its top, bubbles caught in it. Its
   *  colours are the theme's, or a sickly violet. */
  #gooCap(g, tx, ty, x, y, lf, rt) {
    const G = TH.goo ?? { body: '#9a4ad8', lit: '#e0a8ff', dark: '#4a1a78', bubble: '#f0d0ff' };
    g.fillStyle = G.lit; g.fillRect(x, y - 1, TILE, 1);
    g.fillStyle = G.body; g.fillRect(x, y, TILE, 5);
    for (let px = 0; px < TILE; px++) {
      const sag = 1 + Math.floor(hash(tx * 16 + px, ty * 3) * 3);
      g.fillStyle = G.body; g.fillRect(x + px, y + 5, 1, sag);
      g.fillStyle = G.dark; g.fillRect(x + px, y + 5 + sag, 1, 1);
      if (hash(tx * 7 + px, ty) > 0.88) { g.fillStyle = G.lit; g.fillRect(x + px, y, 1, 1); }
    }
    if (hash(tx, ty * 5) > 0.5) {                // a bubble caught in it
      const bx = x + 3 + Math.floor(hash(tx, ty) * 9);
      g.fillStyle = G.bubble; g.fillRect(bx, y + 2, 2, 1); g.fillRect(bx, y + 3, 1, 1);
    }
    for (const [open, sx] of [[!lf, x - 1], [!rt, x + TILE]]) {   // drooling over a side
      if (!open) continue;
      const len = 3 + Math.floor(hash(sx, ty) * 6);
      g.fillStyle = G.body; g.fillRect(sx, y - 1, 1, len);
      g.fillStyle = G.dark; g.fillRect(sx, y - 1 + len, 1, 1);
    }
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
        if (t === T.SOLID && this.#depthAt(L, tx, ty) >= 2 && hash(tx * 3, ty * 5) > 0.995) {
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
  /** Squash and stretch: a jump pulls the body tall for a moment, a landing
   *  flattens it (the harder, the more), and both spring back. */
  #squashStep(p, dt) {
    const was = this.sqGround ?? p.grounded;
    if (p.grounded && !was) this.sq = -(0.1 + clamp01((this.sqVy ?? 0) / 640) * 0.24);
    else if (!p.grounded && was && p.vy < -150) this.sq = 0.18;
    this.sqGround = p.grounded;
    this.sqVy = p.vy;
    this.sq = (this.sq ?? 0) * (1 - Math.min(1, dt * 12));
    // turning round: squeezed thin for a moment, as the body swings through
    if (this.sqFacing !== undefined && p.look !== this.sqFacing) this.turn = 1;
    this.sqFacing = p.look;
    this.turn = (this.turn ?? 0) * (1 - Math.min(1, dt * 18));
  }

  updateScarf(p, dt) {
    this.#squashStep(p, dt);
    const anchorX = p.cx - p.look * 2;
    const anchorY = p.y + (p.sliding ? 3 : 6);
    if (!this.scarf) {
      this.scarf = Array.from({ length: 10 }, () => ({ x: anchorX, y: anchorY, px: anchorX, py: anchorY }));
    }
    const s = this.scarf;
    s[0].x = anchorX; s[0].y = anchorY;
    // the wind of your own running, and a flutter that grows with speed (each
    // link a little out of step with the last, so it ripples down the length)
    const sp = Math.min(1, Math.abs(p.vx) / 420);
    this.flutter = (this.flutter ?? 0) + dt;
    let windX = -p.vx * 0.6 - p.look * 26;
    let windY = -p.vy * 0.3 + 70 - sp * 30;
    if (p.sinking) {                           // in the water it floats, swaying
      windX = Math.sin(this.flutter * 2.2) * 30 - p.look * 10;
      windY = -40;
    } else if (p.windAy < 0) {                 // an updraft streams it straight up
      windX = Math.sin(this.flutter * 9) * 50;
      windY = -260;
    } else {                                   // and a gale blows it its way
      windX += p.windAx * 0.12;
      windY += p.windAy * 0.08;
    }
    for (let i = 1; i < s.length; i++) {
      const n = s[i];
      const vx = (n.x - n.px) * 0.8, vy = (n.y - n.py) * 0.8;
      n.px = n.x; n.py = n.y;
      n.x += vx + windX * dt;
      n.y += vy + (windY + Math.sin(this.flutter * 22 - i * 0.9) * 60 * sp * (i / s.length)) * dt;
    }
    for (let k = 0; k < 3; k++) {
      for (let i = 1; i < s.length; i++) {
        const a = s[i - 1], b = s[i];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.001;
        const seg = 2.1 + sp * 0.9;              // it streams out longer at speed
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
    if (this.aurora) this.#auroraSky();
    this.#parallax(ox, oy);
    if (this.lightning) this.#lightning(realDt);

    ctx.drawImage(this.tiles, ox, oy, VIEW_W, VIEW_H, 0, 0, VIEW_W, VIEW_H);

    this.#entities(game, ox, oy);
    this.#ambient(ox, oy);
    this.#particles(fx, ox, oy, false);
    if (p.sinking && !this.hideActors) this.#sinking(p, ox, oy);
    else if (p.dead && p.deathCause === 'water' && !this.hideActors) this.#drowned(p, ox, oy);
    else if (!p.dead && !this.hideActors) {
      this.#shadow(p, ox, oy);
      this.#player(p, ox, oy);
      if (p.onGoo) this.#gooBoots(p, ox, oy);
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

  /** One seamless strip of ridgeline per parallax layer, baked once. Far
   *  layers sit in the horizon's haze, near ones are dark; each has a lit
   *  crest, a shaded side where the ground falls away to the right, and (on a
   *  theme with trees) pines along the nearer crests. Underground, the far
   *  layers hang from the top instead: a cave roof full of stalactites. */
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
      let hgt = (a + (b - a) * sm) * l.amp + (a2 + (b2 - a2) * sm2) * l.amp * 0.35;
      if (l.hang) {                              // stalactites: sharp, narrow drops
        const sp = hash(Math.floor(x / 5), l.seed + 9);
        if (sp > 0.7) hgt += (sp - 0.7) * l.amp * 2.2 * (1 - Math.abs((x % 5) - 2) / 3);
      }
      top[x] = Math.round(l.hang ? l.base + hgt : l.base - hgt);
    }
    const dither = (x, y) => ((x + y) & 1) === 0;
    for (let x = 0; x < l.period; x++) {
      const y = top[x];
      if (l.hang) {                              // rock from the top down to y
        g.fillStyle = l.col; g.fillRect(x, 0, 1, y);
        g.fillStyle = l.rim; g.fillRect(x, y - 1, 1, 1);
        if (top[(x + 1) % l.period] < y - 1) { g.fillStyle = l.shade; g.fillRect(x, y - 6, 1, 5); }
        continue;
      }
      g.fillStyle = l.col;
      g.fillRect(x, y, 1, VIEW_H - y);
      // the side turned from the light: where the ground falls to the right
      const next = top[(x + 1) % l.period], prev = top[(x + l.period - 1) % l.period];
      // shaded down to a depth that follows the slope over a few columns,
      // so the dark side reads as a face, not as stripes
      const ahead = top[(x + 3) % l.period] - top[(x + l.period - 3) % l.period];
      if (ahead > 0) {
        const deep = Math.min(30, Math.round(3 + ahead * 2.2));
        g.fillStyle = l.shade;
        g.fillRect(x, y + 1, 1, deep - 2);
        for (let k = deep - 2; k < deep + 2; k++) if (dither(x, y + k)) g.fillRect(x, y + k, 1, 1);
      }
      g.fillStyle = l.rim;                       // the lit crest
      g.fillRect(x, y, 1, 1);
      if (prev > y) g.fillRect(x, y + 1, 1, 1);
      if (l.snow && y < l.base - l.amp * 0.55) { // snow only on the high ground
        g.fillStyle = l.snowCol;
        g.fillRect(x, y, 1, 1 + (hash(x, l.seed) > 0.5 ? 1 : 0));
        if (hash(x, l.seed + 7) > 0.62) g.fillRect(x, y + 2, 1, 1 + Math.floor(hash(x, 3) * 2));
      }
    }
    if (l.trees) {                               // pines along the crest
      for (let x = 3; x < l.period - 3; x++) {
        // in clumps: a stand every so often, trees close together within it
        if (hash(Math.floor(x / 18), l.seed + 49) < 0.45 || hash(x, l.seed + 50) < 0.72) continue;
        const h = l.treeH[0] + Math.floor(hash(x, l.seed + 51) * l.treeH[1]);
        const y = Math.min(top[x - 1], top[x], top[x + 1]) + 2;
        for (let k = 0; k < h; k++) {
          const w = Math.max(1, Math.round(((k + 1) / h) * (h * 0.42)) | 1);
          g.fillStyle = l.tree;
          g.fillRect(x - (w >> 1), y - h + k, w, 1);
        }
        g.fillStyle = l.rim; g.fillRect(x, y - h, 1, 1);
        g.fillStyle = l.tree; g.fillRect(x, y, 1, 2);
      }
    }
    return c;
  }

  #bakeRidges() {
    const under = !!TH.underground;
    const shape = [
      { f: 0.06, base: under ? 34 : 150, amp: under ? 52 : 74, period: 720, nodes: 9, seed: 2, hang: under },
      { f: 0.14, base: under ? 22 : 182, amp: under ? 64 : 58, period: 620, nodes: 11, seed: 5, hang: under },
      { f: 0.28, base: 214, amp: 44, period: 540, nodes: 13, seed: 8, treeH: [8, 7] },
      { f: 0.48, base: 244, amp: 34, period: 460, nodes: 17, seed: 15, treeH: [12, 10] },
    ];
    // The farthest range is a little lighter than the sky behind it, lit haze,
    // and each nearer one steps darker, so they stack up as silhouettes
    // against a dark sky and a bright one alike. (They used to run the other
    // way, lightest nearest, and melted into the sky.)
    const skyAt = (y) => {
      const t = y / VIEW_H;
      return t < 0.42 ? mix(TH.sky[0], TH.sky[1], t / 0.42)
           : t < 0.78 ? mix(TH.sky[1], TH.sky[2], (t - 0.42) / 0.36) : mix(TH.sky[2], TH.sky[3], (t - 0.78) / 0.22);
    };
    const night = '#06040c';
    const far = mix(skyAt(shape[0].base - shape[0].amp * 0.5), mix(TH.sky[3], '#ffffff', 0.25), 0.4);
    const near = mix(TH.ridges[3].shade, night, 0.35);
    const step = [0, 0.38, 0.66, 0.88];
    this.layers = shape.map((l, i) => {
      const c = TH.ridges[i];
      const col = l.hang ? mix(c.col, night, 0.6 + i * 0.25) : mix(far, near, step[i]);
      return {
        ...l, col, rim: l.hang ? mix(col, c.rim, 0.9) : mix(col, mix(c.rim, '#ffffff', 0.25), 0.55), shade: mix(col, night, 0.3),
        snow: !!c.snow, snowCol: c.snow, trees: !!TH.trees && !under && i >= 2, tree: mix(col, night, 0.4),
      };
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
      if (l.hang) {                               // a cave roof: rock fills in above it
        if (dy > 0) { ctx.fillStyle = l.col; ctx.fillRect(0, 0, VIEW_W, dy); }
        continue;
      }
      if (dy < 0) { ctx.fillStyle = l.col; ctx.fillRect(0, VIEW_H + dy - 1, VIEW_W, -dy + 1); }
      ctx.fillStyle = this.theme.haze;            // haze stacking up with distance
      const my = Math.round(l.base + dy);
      if (my < VIEW_H) ctx.fillRect(0, my, VIEW_W, VIEW_H - my);
    }

  }

  /** The storm: every few seconds the sky goes white for a moment, a fork of
   *  lightning stands over the hills, and it fades. Drawn over the sky and the
   *  ridges, under everything you play on. */
  #lightning(realDt) {
    const Lt = this.lightning, { ctx } = this;
    Lt.next -= realDt;
    if (Lt.next <= 0) {
      Lt.flash = 1; Lt.next = 4 + Math.random() * 5;
      Lt.x = 60 + Math.random() * (VIEW_W - 120); Lt.seed = Math.floor(Math.random() * 1000);
    }
    if (Lt.flash <= 0) return;
    ctx.globalAlpha = Lt.flash * 0.35;
    ctx.fillStyle = '#e8f0ff';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.globalAlpha = Lt.flash;
    ctx.fillStyle = '#ffffff';
    let bx = Lt.x;
    for (let y = 0; y < 150; y += 3) {             // the fork, jagged on its way down
      bx += (hash(y, Lt.seed) - 0.5) * 8;
      ctx.fillRect(Math.round(bx), y, 1, 3);
      if (hash(y, Lt.seed + 1) > 0.94) for (let k = 0; k < 12; k++) ctx.fillRect(Math.round(bx + k), y + k, 1, 1);
    }
    ctx.globalAlpha = 1;
    Lt.flash = Math.max(0, Lt.flash - realDt * 5);
  }

  /** Northern lights: curtains of green and violet swaying high in the sky. */
  #auroraSky() {
    const { ctx } = this;
    const t = this.rt;
    ctx.globalCompositeOperation = 'lighter';
    for (let band = 0; band < 2; band++) {
      for (let x = 0; x < VIEW_W; x += 2) {
        const y = 30 + band * 26 + Math.sin(x * 0.012 + t * 0.25 + band * 2) * 16 + Math.sin(x * 0.037 - t * 0.4) * 6;
        const len = 26 + Math.sin(x * 0.05 + t * 0.6 + band) * 12;
        const a = 0.05 + 0.04 * Math.sin(x * 0.02 + t * 0.9 + band * 3);
        if (a <= 0) continue;
        for (let k = 0; k < len; k += 2) {
          const f = k / len;
          ctx.fillStyle = band ? `rgba(160,110,255,${(a * (1 - f) * 0.8).toFixed(3)})` : `rgba(90,255,180,${(a * (1 - f)).toFixed(3)})`;
          ctx.fillRect(x, Math.round(y + k), 2, 2);
        }
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  /** The air: drifting with the world's clock (so a burst slows it too),
   *  carried a little by the camera, wrapping round the view. */
  #ambient(ox, oy) {
    const { ctx } = this;
    const A = this.amb, t = this.time, W = VIEW_W + 40, H = VIEW_H + 40;
    const wrap = (v, m) => ((v % m) + m) % m;
    for (const m of this.motes) {
      let x = wrap(m.x + A.drift[0] * m.p * t - ox * m.p * 0.6 + Math.sin(t * 0.7 + m.t) * A.wander, W) - 20;
      let y = wrap(m.y + A.drift[1] * m.p * t - oy * m.p * 0.6 + Math.cos(t * 0.5 + m.t) * A.wander * 0.6, H) - 20;
      if (A.low && y < VIEW_H * 0.35) y = VIEW_H * 0.35 + (y + 20) * 0.6;   // fireflies keep near the ground
      let a = A.faint ? 0.25 + m.p * 0.2 : 0.45 + m.p * 0.35;
      if (A.blink) a *= 0.35 + 0.65 * Math.max(0, Math.sin(t * 2.3 + m.t * 3));
      if (a < 0.03) continue;
      x = Math.round(x); y = Math.round(y);
      if (A.streak) {                             // rain: a slanting streak
        ctx.globalAlpha = 0.18 + m.p * 0.2;
        ctx.fillStyle = m.col;
        const len = 5 + Math.round(m.p * 6);
        for (let k = 0; k < len; k++) ctx.fillRect(x - Math.round(k * 0.23), y - k, 1, 1);
        continue;
      }
      if (A.glow) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = a * 0.8;
        ctx.drawImage(glowSprite(m.col, 6), x - 6, y - 6);
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.globalAlpha = a;
      ctx.fillStyle = m.col;
      ctx.fillRect(x, y, m.s, m.s);
    }
    ctx.globalAlpha = 1;
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
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.7 + Math.sin(t * 3) * 0.2;
        ctx.drawImage(glowSprite(C.flagOn, 18), x - 13, y - 36);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
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
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.75 + Math.sin(t * 3 + c.x) * 0.25;
      ctx.drawImage(glowSprite(C.crystal, 16), x - 16, y - 16);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
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
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.8 + Math.sin(t * 2) * 0.15;
      ctx.drawImage(glowSprite(g.hit ? '#7dffc4' : '#ffd678', 44), x + g.w / 2 - 44, y + g.h / 2 - 44);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
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
        if (top) {                                // lighter just under the skin
          ctx.globalAlpha = 0.18;
          ctx.fillStyle = W.surf;
          ctx.fillRect(x, y + 4, TILE, 2);
          ctx.globalAlpha = 0.08;
          ctx.fillRect(x, y + 6, TILE, 4);
          ctx.globalAlpha = 1;
        }
        // light wandering through the body in slow horizontal streaks
        for (let k = 0; k < 2; k++) {
          const sy = (tx * 7 + ty * 3 + k * 9 + Math.floor(t * 5)) % TILE;
          if (top && sy < 6) continue;
          ctx.globalAlpha = 0.07 + 0.05 * Math.sin(t * 1.7 + tx + k);
          ctx.fillStyle = W.surf;
          ctx.fillRect(x + Math.floor(hash(tx, ty * 3 + k) * 9), y + sy, 3 + Math.floor(hash(ty, tx + k) * 5), 1);
        }
        ctx.globalAlpha = 1;
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

    // bounce pads: a framed plate with chevrons running the way it throws you,
    // cyan for a pad that helps, red for a trap, magenta for a slam
    const padCol = { right: ['#5ff2ff', '#1a6a80'], left: ['#ff5a5a', '#7a1c24'], down: ['#ff6ad8', '#781c66'] };
    for (const b of L.pads) {
      let x = Math.round(b.x - ox), y = Math.round(b.y - oy);
      if (x < -40 || x > VIEW_W + 40 || y < -40 || y > VIEW_H + 40) continue;
      const [lit, deep] = padCol[b.dir];
      const kick = b.t > M.PAD_REST - 0.1 ? 2 : 0;             // recoil as it fires
      if (b.dir === 'right') x -= kick; else if (b.dir === 'left') x += kick; else y -= kick;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.55 + (b.t > 0 ? 0.4 : 0) + Math.sin(t * 5 + b.x) * 0.1;
      ctx.drawImage(glowSprite(lit, 16), Math.round(x + b.w / 2 - 16), Math.round(y + b.h / 2 - 16));
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#0c0816'; ctx.fillRect(x - 1, y - 1, b.w + 2, b.h + 2);
      ctx.fillStyle = deep; ctx.fillRect(x, y, b.w, b.h);
      if (b.dir !== 'down') {
        // a side pad hangs in open air: metal caps top and bottom with a light
        // blinking in each, so it reads as a thing hovering there, not a sign
        // in the sky behind
        for (const cy of [y - 3, y + b.h + 1]) {
          ctx.fillStyle = '#0c0816'; ctx.fillRect(x - 3, cy - 1, b.w + 6, 4);
          ctx.fillStyle = '#4a4262'; ctx.fillRect(x - 2, cy, b.w + 4, 2);
          ctx.fillStyle = '#8a82a8'; ctx.fillRect(x - 2, cy, b.w + 4, 1);
          ctx.fillStyle = Math.sin(t * 6 + b.x * 0.1 + cy) > 0 ? lit : deep;
          ctx.fillRect(x + b.w / 2 - 1, cy + 1, 2, 1);
        }
      }
      const shift = Math.floor(t * 18) % 6;
      ctx.fillStyle = lit;
      if (b.dir === 'down') {
        for (let i = -6; i < b.w + 6; i += 6) for (let k = 0; k < 3; k++) {
          const px = x + i + k, py = y + 1 + ((k === 1 ? 1 : 0) + shift) % 4;
          if (px >= x && px < x + b.w && py < y + b.h) ctx.fillRect(px, py, 1, 1);
        }
        ctx.fillRect(x, y + b.h - 1, b.w, 1);
      } else {
        const d = b.dir === 'right' ? 1 : -1;
        for (let j = -6; j < b.h + 6; j += 6) for (let k = 0; k < 3; k++) {
          const py = y + j + k + (d > 0 ? shift : 5 - shift);
          const px = x + 2 + (k === 1 ? d : 0) + (d > 0 ? 1 : 2);
          if (py >= y && py < y + b.h) ctx.fillRect(px, py, 2, 1);
        }
        ctx.fillRect(d > 0 ? x + b.w - 1 : x, y, 1, b.h);
      }
    }

    // goo: bubbles swelling and popping on its top
    if (this.gooTops.length) {
      const Gc = this.gooCol;
      for (const [gx, gy] of this.gooTops) {
        const x = gx * TILE - ox, y = gy * TILE - oy;
        if (x < -TILE || x > VIEW_W || y < -TILE || y > VIEW_H + TILE) continue;
        const ph = (t * 0.8 + hash(gx, gy)) % 1;
        if (ph > 0.6) continue;
        const r = ph < 0.5 ? Math.floor(ph * 6) : 3;
        const bx = x + 3 + Math.floor(hash(gx * 3, gy) * 10), by = y - 1 - r;
        ctx.fillStyle = ph < 0.5 ? Gc.lit : Gc.bubble;
        if (ph < 0.5) { ctx.fillRect(bx - r, by, r * 2 + 1, 1); ctx.fillRect(bx - r, by - r, 1, r); ctx.fillRect(bx + r, by - r, 1, r); ctx.fillRect(bx - r + 1, by - r, r * 2 - 1, 1); }
        else { ctx.fillRect(bx - 2, by - 2, 1, 1); ctx.fillRect(bx + 2, by - 3, 1, 1); ctx.fillRect(bx, by - 4, 1, 1); }
      }
    }

    // wind: streaks blowing through it, the way it pushes. It has to read at a
    // glance from twenty tiles off, at a run, in the rain: a tailwind is pale
    // blue and a headwind amber (the colour of a warning), an updraft is a
    // lit column rising off a vent in the floor, a downdraft a darker column
    // of air falling.
    for (const w of L.winds) {
      const x0 = Math.round(w.x - ox), y0 = Math.round(w.y - oy);
      if (x0 > VIEW_W || x0 + w.w < 0 || y0 > VIEW_H || y0 + w.h < 0) continue;
      const mag = Math.hypot(w.ax, w.ay) || 1;
      const ux = w.ax / mag, uy = w.ay / mag;
      const column = Math.abs(uy) > 0.5;
      // the floor under a column, where its vent is (or its downdraft lands)
      let floor = w.y + w.h;
      if (column) {
        const cx = Math.floor((w.x + w.w / 2) / TILE);
        for (let ty = Math.floor(w.y / TILE); ty < Math.ceil((w.y + w.h) / TILE); ty++) {
          if (L.get(cx, ty) === T.SOLID) { floor = ty * TILE; break; }
        }
      }
      const top = w.y, depth = floor - top;
      if (column) {
        // the air itself: a soft band, brightest at the floor for an updraft,
        // shadowed for a downdraft
        ctx.globalCompositeOperation = uy < 0 ? 'lighter' : 'source-over';
        ctx.fillStyle = uy < 0 ? '#5fa8d8' : '#03060c';
        for (let k = 0; k < depth; k += 4) {
          const f = uy < 0 ? k / depth : 0.5 + 0.5 * (1 - k / depth);
          const ry = Math.round(top + k - oy);
          // three widths stacked, so the column has soft sides, not a box's
          for (const [inset, share] of [[0, 0.3], [4, 0.35], [10, 0.35]]) {
            if (w.w - inset * 2 <= 0) continue;
            ctx.globalAlpha = (uy < 0 ? 0.16 : 0.2) * f * share;
            ctx.fillRect(x0 + inset, ry, w.w - inset * 2, 4);
          }
        }
        ctx.globalCompositeOperation = 'source-over';
        if (uy > 0) {
          // a downdraft's streaks would pass for more of the rain: chevrons
          // sinking down it say which way it pulls
          ctx.fillStyle = '#c4d2ea';
          for (let cx = x0 + 8; cx < x0 + w.w - 4; cx += 24) {
            for (let j = 0; j < 3; j++) {
              const f = ((t * 50 + j * depth / 3 + (cx - x0) * 0.7) % depth) / depth;
              const cy = Math.round(top + f * depth - oy);
              if (L.get(Math.floor((cx + ox) / TILE), Math.floor((cy + oy) / TILE)) === T.SOLID) continue;
              ctx.globalAlpha = 0.4 * Math.sin(f * Math.PI);
              for (let k = 0; k < 4; k++) { ctx.fillRect(cx - k, cy - k, 1, 1); ctx.fillRect(cx + k, cy - k, 1, 1); }
            }
          }
          ctx.globalAlpha = 1;
        }
        if (uy < 0) {
          // the vent: a grate across the floor with a breath of light over it
          const fy = Math.round(floor - oy);
          ctx.globalAlpha = 1;
          ctx.fillStyle = '#1a222e'; ctx.fillRect(x0 + 1, fy, w.w - 2, 2);
          ctx.fillStyle = '#8fd0ff';
          for (let gx = 3; gx < w.w - 2; gx += 4) ctx.fillRect(x0 + gx, fy, 2, 1);
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t * 9);
          ctx.drawImage(glowSprite('#8fd0ff', 18), x0 + w.w / 2 - 18, fy - 14);
          ctx.globalCompositeOperation = 'source-over';
        }
      }
      const n = Math.min(90, Math.round((w.w * (column ? depth : w.h)) / (column ? 260 : 520)));
      const col = column ? (uy < 0 ? '#d8f2ff' : '#8a9cb8') : (ux > 0 ? '#bfe6ff' : '#ffc890');
      const span = column ? depth : w.w;
      for (let i = 0; i < n; i++) {
        const sp = (column ? 200 : 260) + hash(i, 7) * 200;
        const along = ((hash(i, 3) * 1000 + t * sp) % span) / span;
        const fwd = (ux > 0 || uy > 0) ? along : 1 - along;
        const sway = column ? Math.sin(t * 3 + i) * 2 : Math.sin(t * 2 + i * 1.7) * 1.5;
        const px = column ? w.x + 1 + hash(i, 1) * (w.w - 2) + sway : w.x + fwd * w.w;
        const py = column ? top + fwd * depth : w.y + hash(i, 2) * w.h + sway;
        // (wind blows through the air, not the rock its box runs into)
        if (L.get(Math.floor(px / TILE), Math.floor(py / TILE)) === T.SOLID) continue;
        // fade in and out along the way, so no streak pops at the box's edge
        const a = Math.sin(along * Math.PI);
        const len = (column ? 8 : 12) + Math.floor(hash(i, 5) * (column ? 10 : 18));
        ctx.fillStyle = col;
        // (an updraft's streaks go on additively, two pixels wide, with a bright
        //  head: the rain falls in thin vertical streaks too, and these must
        //  not read as more of it)
        const up = column && uy < 0;
        if (up) ctx.globalCompositeOperation = 'lighter';
        for (let k = 0; k < len; k++) {
          ctx.globalAlpha = a * (up ? 0.7 : column ? 0.5 : 0.75) * (1 - 0.75 * k / len);
          ctx.fillRect(Math.round(px - ux * k - ox), Math.round(py - uy * k - oy), up && k < len / 2 ? 2 : 1, 1);
        }
        if (up) {
          ctx.globalAlpha = a;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(Math.round(px - ox), Math.round(py - oy), 2, 2);
          ctx.globalCompositeOperation = 'source-over';
        }
        // and now and then a scrap carried in it, tumbling
        if (!column && i % 7 === 0) {
          ctx.globalAlpha = a * 0.9;
          ctx.fillStyle = '#7f9a62';
          const flip = Math.floor(t * 10 + i) % 2;
          ctx.fillRect(Math.round(px - ox) + 3, Math.round(py - oy) - 2, flip ? 2 : 1, flip ? 1 : 2);
        }
      }
      ctx.globalAlpha = 1;
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
      const x = Math.round(p.x - ox), y = Math.round(p.y - oy);
      if (p.glow) {                               // sparks light the air round them
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = a * 0.5;
        ctx.drawImage(glowSprite(p.colour, 5), x - 5, y - 5);
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.globalAlpha = a;
      ctx.fillStyle = p.colour;
      ctx.fillRect(x, y, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    if (front) {
      // shockwaves: a ring of pixels swelling out (an ellipse on the ground)
      ctx.globalCompositeOperation = 'lighter';
      for (const r of fx.rings) {
        const k = 1 - r.life / r.max, rad = 2 + (r.r - 2) * (1 - (1 - k) * (1 - k));
        const ry = r.flat ? rad * 0.3 : rad;
        ctx.globalAlpha = (1 - k) * 0.85;
        ctx.fillStyle = r.colour;
        const n = Math.max(12, Math.round(rad * 4));
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          ctx.fillRect(Math.round(r.x - ox + Math.cos(a) * rad), Math.round(r.y - oy + Math.sin(a) * ry), 1, 1);
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
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
    const dir = p.look > 0 ? 0 : 1;

    // afterimages: cyan off a dash or a burst, a softer violet off a sprint
    const ghostSet = p.bursting || p.dashing ? ghosts : ghostsSoft;
    for (const g of p.trail) {
      const set = ghostSet[g.name] ?? ghostSet.idle;
      const img = set[g.facing > 0 ? 0 : 1][Math.min(g.frame, set[0].length - 1)];
      ctx.globalAlpha = Math.max(0, g.life / (g.max ?? 0.22)) * (g.alpha ?? 0.45);
      ctx.drawImage(img, Math.round(g.x + (p.w - SPRITE_W) / 2 - ox), Math.round(g.y + g.h - SPRITE_H - oy));
    }
    ctx.globalAlpha = alpha;
    // a burst gathering: an aura that grows as the top-off creeps in, and
    // throbs through the wind-up
    const gather = p.burstWind > 0 ? 0.55 + 0.35 * Math.sin(this.rt * 22)
                 : p.toppingOff ? ((p.flow - P.BURST_ARM) / (P.FLOW_MAX - P.BURST_ARM)) * 0.45 : 0;
    if (gather > 0.02) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = alpha * gather;
      ctx.drawImage(glowSprite('#dff3ff', 18), Math.round(p.cx - 18 - ox), Math.round(p.cy - 18 - oy));
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = alpha;
    }
    // lit up while it is pouring on the speed: a dash, a burst
    if (p.bursting || p.dashing) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = alpha * (p.bursting ? 0.75 + Math.sin(this.rt * 18) * 0.15 : 0.6);
      ctx.drawImage(glowSprite('#9cf6ff', 22), Math.round(p.cx - 22 - ox), Math.round(p.cy - 22 - oy));
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = alpha;
    }

    this.#drawScarf(p, ox, oy);

    const set = sprites[p.anim.name] ?? sprites.idle;
    const frames = set[dir];
    const img = frames[Math.min(p.anim.frame, frames.length - 1)];
    const px = Math.round(p.x + (p.w - SPRITE_W) / 2 - ox);
    const py = Math.round(p.y + p.h - SPRITE_H - oy);
    // squash and stretch, about the feet (not while a vault, roll or slide
    // plays its own frames), and a dash stretches you along it
    let sx = 1, sy = 1;
    if (p.dashing) { const d = p.dashDir; sx = 1 + Math.abs(d.x) * 0.22; sy = 1 + Math.abs(d.y) * 0.22 - Math.abs(d.x) * 0.12; }
    else if (!p.vault && !p.sliding && !(p.rolling > 0) && Math.abs(this.sq ?? 0) > 0.02) { sy = 1 + this.sq; sx = 1 - this.sq * 0.8; }
    if ((this.turn ?? 0) > 0.05 && !p.dashing) sx *= 1 - this.turn * 0.35;
    if (sx === 1 && sy === 1) ctx.drawImage(img, px, py);
    else {
      const dw = Math.round(SPRITE_W * sx), dh = Math.round(SPRITE_H * sy);
      ctx.drawImage(img, px + Math.round((SPRITE_W - dw) / 2), py + SPRITE_H - dh, dw, dh);
    }

    if (p.dashes > 0 && !p.dashLocked) {     // dash-ready glint on the belt
      ctx.fillStyle = p.t.dashCool > 0 ? '#5a7fae' : '#9cf6ff';
      ctx.fillRect(px + (dir ? 6 : 8), py + 12, 2, 1);
    }
    ctx.globalAlpha = 1;
  }

  /** In the water: what is above the surface is drawn as it is, and what is
   *  below it shows faintly through the water, so you watch yourself wade and
   *  sink instead of standing in front of it. */
  /** In goo the boots go under: a lip of it drawn over your feet, heaped
   *  where you push through and wobbling, so it reads as held, not standing. */
  #gooBoots(p, ox, oy) {
    const { ctx } = this, G = this.gooCol;
    const fy = Math.round(p.footY - oy), x0 = Math.round(p.x - ox) - 3, w = p.w + 6;
    const lead = Math.sign(p.vx);
    for (let i = 0; i < w; i++) {
      // a bow wave heaped on the leading side, and a wobble that runs along it
      const heap = lead ? Math.max(0, (lead > 0 ? i / w : 1 - i / w) - 0.5) * 5 : 0;
      const h = 2 + Math.round(heap + Math.sin(this.time * 14 + i * 0.9) * 0.6);
      ctx.fillStyle = G.body; ctx.fillRect(x0 + i, fy - h, 1, h);
      ctx.fillStyle = G.lit; ctx.fillRect(x0 + i, fy - h, 1, 1);
    }
  }

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

  /** The scarf: a ribbon, not a string of beads. Each link is stroked from the
   *  one before it, tapering from three pixels to one, banded in two reds
   *  with a lit upper edge, and the tail splits in two. Grey while the dash is
   *  spent (or not yours yet), red while you have one. */
  /** Gone under: the last of the figure, one hand still up, sinking away
   *  through the water and fading, while the bubbles come up past it. */
  #drowned(p, ox, oy) {
    const { ctx } = this;
    const k = clamp01(1 - p.deadTimer / 0.45);
    const img = (sprites.drown ?? sprites.idle)[p.look > 0 ? 0 : 1][0];
    const sy = Math.round(p.sinkSurface + 2 - oy);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, sy, VIEW_W, VIEW_H - sy); ctx.clip();
    ctx.globalAlpha = 0.32 * (1 - k);
    ctx.drawImage(img, Math.round(p.x + (p.w - SPRITE_W) / 2 - ox), Math.round(p.y + p.h - SPRITE_H - oy + k * 18));
    ctx.restore();
  }

  #drawScarf(p, ox, oy) {
    const s = this.scarf;
    if (!s) return;
    const { ctx } = this;
    const hot = p.dashes > 0 && !p.dashLocked;
    const pal = hot ? ['#ef5a5a', '#d04a52', '#ff9a8a', '#a8344a'] : ['#7a7196', '#655d84', '#a49cc0', '#4e4868'];
    const sx = this.shiftX - ox, sy = this.shiftY - oy;
    for (let i = s.length - 1; i >= 1; i--) {
      const a = s[i - 1], b = s[i];
      const w = i < 2 ? 3 : i < 6 ? 2 : 1;
      const band = Math.floor(i / 2) % 2;
      const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)));
      for (let k = 0; k <= steps; k++) {
        const x = Math.round(a.x + (b.x - a.x) * (k / steps) + sx - w / 2);
        const y = Math.round(a.y + (b.y - a.y) * (k / steps) + sy - w / 2);
        ctx.fillStyle = i === s.length - 1 ? pal[3] : pal[band];
        ctx.fillRect(x, y, w, w);
        if (w > 1) { ctx.fillStyle = pal[2]; ctx.fillRect(x, y, w, 1); }
      }
    }
    // the forked tail: a second, shorter tip off the second-last link
    const t = s[s.length - 2], e = s[s.length - 1];
    ctx.fillStyle = pal[3];
    ctx.fillRect(Math.round(t.x + (e.x - t.x) * 0.6 + sx), Math.round(t.y + (e.y - t.y) * 0.6 + sy + 2), 1, 1);
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
