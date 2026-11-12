// skyline.js — level 4. Islands of rock in a dusk sky with
// nothing at all beneath them: every gap is a fall out of the world. The
// islands are small (too small to stop on) and far apart, so the whole level
// is one long run of leaps taken at speed: sand islands that crumble under
// you, fanged rocks hanging over gaps you have to hop low, a chain of dashes
// across open air, the synced phase crossing, a gap only a dash closes, and
// an ascent to the goal on nothing but crystals. Crystal chains are this
// level's own trick: every other level has crystals, but only as a spare.
//
// Every section starts on a "station": a flag and, straight after it, a
// boost pad. The pad fires you at one speed and charges your bar, so the
// leaps after it are the same whether you arrived at full tilt or just
// respawned; the islands are placed where those leaps come down. (The
// spacings are shared with the undercroft, whose rhythm they were tuned on.)

import { Level, T, TILE } from '../level.js';

const W = 590;           // (with a run-out past the goal for the walk-off)
const H = 44;
const S = 26;            // the islands' surface row

export function buildSkyline() {
  const L = new Level(W, H);
  L.theme = 'dusk';
  // an island: a slab of rock, tapering underneath
  const island = (x0, x1, y = S) => {
    L.rect(x0, y, x1 - x0, 3);
    if (x1 - x0 > 4) L.rect(x0 + 1, y + 3, x1 - x0 - 2, 2);
    if (x1 - x0 > 8) L.rect(x0 + 3, y + 5, x1 - x0 - 6, 2);
  };
  const isles = (xs, w = 6) => { for (const x of xs) island(x, x + w); };
  // a rock hanging in the sky with its underside fanged, five tiles above the
  // islands: a full jump beneath it is a death, a low hop is not
  const fang = (x0, w) => {
    L.rect(x0 + 1, S - 8, w - 2, 1);
    L.rect(x0, S - 7, w, 2);
    L.spikes(x0, S - 5, w, 'down');
  };
  // flag, then a pad right away, then the edge (placed so the leap that
  // reaches it lands just short of the flag)
  const station = (x0, { sync = null } = {}) => {
    island(x0, x0 + 10);
    L.checkpoint(x0 + 3, S);
    L.boost(x0 + 5, S, 3, +1, sync === null ? {} : { sync });
    return x0 + 10;
  };

  // ---- world shell (a wall behind you only: the sky is open all round) ----
  L.rect(0, 0, 2, H);

  // ==================================================== A — the leaps
  island(2, 21);
  L.spawn = { x: 4 * TILE, y: (S - 2) * TILE };
  L.sign(5, S - 1, 'SKYLINE', [
    'Nothing below but sky. The islands are too small to',
    'stop on: take each one in your stride and keep going.',
    'Sand gives way. Under a fanged rock, hop low.',
    'And the crystals: out here they are the only footholds.',
  ]);
  L.boost(12, S, 3, +1);                   // (early enough for the camera to make room for the leap)
  island(38, 44);
  L.crumble(59, S, 6);                     // sand: there is no standing on it
  island(80, 86);

  // ============================================== B — the fanged islands
  const b = station(100);
  isles([b + 19, b + 32]);
  island(b + 53, b + 60);
  fang(b + 24, 8);                         // over the short gap: hop it

  // ================================================== C — the dash chain
  // Right-dashes sink about two tiles each and carry about eleven: jump off
  // the edge, dash at the top, and each crystal hands you the next. Three
  // dashes reach the island; two fall short.
  const c = station(187);
  L.sign(c - 7, S - 1, 'DASH CHAIN', [
    'Jump, dash at the top, and let each crystal hand',
    'you the next dash. Three of them, then land.',
  ]);
  L.crystal(c + 12, S - 6);
  L.crystal(c + 24, S - 4);
  island(c + 39, c + 45);

  // ============================================== D — the long crossing
  // The synced crossing, over nothing: pad, then a full leap off each edge,
  // pink, blue, and a sand block to finish on.
  const d = station(259, { sync: 0.4 });
  L.sign(d - 7, S - 1, 'CROSSING', ['The pad starts the blocks. Do not slow down.']);
  L.phase(d + 17, S, 7, 1, 0);
  L.phase(d + 35, S, 11, 1, 1);
  L.crumble(d + 60, S, 8);

  // ======================================================= E — the fang run
  const e = station(354);
  L.sign(e - 7, S - 1, 'FANG RUN', ['Sand underfoot, a fang over the gap. Hop it low.']);
  L.crumble(e + 19, S, 6);
  island(e + 32, e + 38);
  fang(e + 24, 8);
  L.crumble(e + 53, S, 7);

  // ============================================================ F — the gap
  const f = station(441);
  L.sign(f - 7, S - 1, 'GAP', ['Too wide to leap. Dash at the top, dash again.']);
  L.crystal(f + 14, S - 6);
  island(f + 29, f + 36);

  // ========================================================= G — the ascent
  // The goal hangs seventeen tiles up, with nothing in between but three
  // crystals on the line of a climbing chain: jump, then dash up and right at
  // every one. Each crystal sits two tiles into the dash it refills, so it is
  // always touched mid-dash; four dashes reach the goal, three fall short.
  const g = station(504);
  L.sign(g - 7, S - 1, 'ASCENT', [
    'Up to the goal on crystals alone: jump, then dash',
    'up and right at every one. Four dashes, no ground.',
  ]);
  L.crystal(g + 12, S - 8);
  L.crystal(g + 22, S - 12);
  L.crystal(g + 32, S - 15);               // low enough for a dash that ran low
  island(g + 43, W, S - 17);
  L.goal = { x: (g + 54) * TILE, y: (S - 21) * TILE, w: TILE * 2, h: TILE * 4, hit: false };

  return L;
}
