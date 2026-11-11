// undercroft.js — level 3. Underground, and all momentum: the cave floor is
// a spiked pit almost end to end, and you cross it on pillars too small to
// stop on, so every jump is taken at a run and every landing has to be
// carried straight into the next. Fall behind the pace and the gaps are too
// wide; keep it, and the cave goes by in long bounding leaps. Fangs hang over
// some gaps (hop those low), a slide skims a broken tunnel floor, the synced
// phase pit returns in the dark, a long leap with a crystal to spare, and at the end a
// crawlway under a roof so low that only top-gear speed carries you across.
//
// Every section starts on a "station": a flag and, straight after it, a boost
// pad. The pad fires you at one speed and charges your bar, so whether you
// arrived at full tilt or just respawned, what follows is met at the same
// pace, and the pillars can be placed for it.

import { Level, T, TILE } from '../level.js';

const W = 536;           // (with a run-out past the goal for the walk-off)
const H = 44;
const GY = 32;           // row of the main ground surface
const PILLAR = 6;        // a pillar is about a third of a second underfoot at speed
// The crawlway's pillars, as [tiles past the station edge, kind]: 'fang'
// pillars have the roof fanged over the gap after them, 'sand' ones crumble.
const CRAWL = [[10, 'rock'], [24, 'rock'], [37, 'fang'], [49, 'rock'], [62, 'rock'], [75, 'sand'], [88, 'sand']];
const CRAWL_FANG = 7;    // tiles of fanged roof over a 'fang' pillar's gap

export function buildUndercroft() {
  const L = new Level(W, H);
  L.theme = 'cave';
  const ground = (x0, x1, y = GY) => L.rect(x0, y, x1 - x0, H - y);
  const roof = (x0, x1, row) => L.rect(x0, 1, x1 - x0, row - 1);
  const pit = (x0, w) => {
    L.rect(x0, GY, w, H - GY, T.EMPTY);
    L.rect(x0, GY + 4, w, H - GY - 4);
    L.spikes(x0, GY + 3, w);
  };
  const pillars = (xs, w = PILLAR) => { for (const x of xs) ground(x, x + w); };
  // the roof coming down to five tiles over the pillar tops, fanged: a full
  // jump under it is a death, a low hop is not
  const fang = (x0, w) => { L.rect(x0, 1, w, GY - 6); L.spikes(x0, GY - 5, w, 'down'); };
  // a station: flag, then a pad right away, then the edge
  // (placed so the jump that reaches it lands just short of the flag)
  const station = (x0, { sync = null } = {}) => {
    ground(x0, x0 + 10);
    L.checkpoint(x0 + 3, GY);
    L.boost(x0 + 5, GY, 3, +1, sync === null ? {} : { sync });
    return x0 + 10;                        // where the edge is
  };

  // ---- world shell -------------------------------------------------------
  L.rect(0, 0, 2, H);
  L.rect(0, 0, W, 1);

  // ===================================================== A — the pillars
  roof(2, 404, GY - 14);
  ground(2, 21);
  L.spawn = { x: 4 * TILE, y: (GY - 2) * TILE };
  L.sign(5, GY - 1, 'UNDERCROFT', [
    'No floor down here, only pillars too small to stop on.',
    'Keep your speed and take every one in your stride.',
    'Pads charge you up. Fangs overhead: hop low.',
  ]);
  L.boost(14, GY, 3, +1);
  pit(21, 79);
  pillars([38, 59, 80]);

  // ================================================== B — the fanged pillars
  const b = station(100);
  pit(b, 77);
  pillars([b + 19, b + 32]);
  pillars([b + 53], 7);
  fang(b + 24, 8);                         // over the short gap: hop it

  // ================================================= C — the broken tunnel
  const c = station(187);
  L.sign(c - 6, GY - 1, 'UNDERFOOT', [
    'Holes in the tunnel floor: a fast slide skims them.',
  ]);
  ground(c, c + 22);
  L.rect(c + 2, 1, 20, GY - 2);
  L.rect(c + 2, GY - 1, 20, 1, T.LOWCEIL);
  for (const hx of [c + 8, c + 13, c + 18]) pit(hx, 1);
  pit(c + 22, 30);
  pillars([c + 38]);

  // ===================================================== D — the long dark
  const d = station(258, { sync: 0.4 });
  L.sign(d - 6, GY - 1, 'LONG DARK', ['Pad, and do not stop.']);
  pit(d, 85);
  L.phase(d + 17, GY, 7, 1, 0);
  L.phase(d + 35, GY, 11, 1, 1);
  L.crumble(d + 60, GY, 8);

  // ===================================================== E — the leap
  // A long leap off the pad, with a crystal at the top of it: a spare dash
  // for anyone who jumped late, never a requirement. (Crystal chains belong
  // to the skyline.)
  const e = station(353);
  L.sign(e - 6, GY - 1, 'LEAP', ['A long leap. The crystal is a spare dash, if you need one.']);
  pit(e, 43);
  L.crystal(e + 10, GY - 6);
  pillars([e + 19], 6);

  // ===================================================== F — the crawlway
  // The cave's own finale: the roof comes down to four tiles over a run of
  // small pillars, so every jump hits it and has its height cut off. With the
  // height capped, how far a jump carries is down to how fast you are running:
  // top gear clears these gaps, a plain sprint does not, and there is no
  // getting speed back in the air. Halfway along the roof is fanged, so those
  // gaps want a low hop instead, and the last pillars are sand.
  const f = station(404);
  L.sign(f - 7, GY - 1, 'CRAWLWAY', [
    'The roof is down to four tiles. Every jump hits it,',
    'so only speed carries you. Keep top gear the whole way.',
  ]);
  roof(f, W, GY - 4);
  pit(f, CRAWL[CRAWL.length - 1][0] + 6);
  for (const [dx, kind] of CRAWL) {
    if (kind === 'sand') L.crumble(f + dx, GY, 5);
    else pillars([f + dx], 5);
    // the fangs replace the roof's bottom row: five tiles up, the same as every
    // other fang in the game, so a quick hop clears them and a full jump does not
    if (kind === 'fang') L.spikes(f + dx + 5, GY - 5, CRAWL_FANG, 'down');
  }
  const end = f + CRAWL[CRAWL.length - 1][0] + 6;
  ground(end, W);
  L.goal = { x: (end + 6) * TILE, y: (GY - 4) * TILE, w: TILE * 2, h: TILE * 4, hit: false };

  return L;
}
