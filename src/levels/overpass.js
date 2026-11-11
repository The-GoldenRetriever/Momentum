// overpass.js — level 5, the first of the momentum courses. Girders over a
// drop, at first light, and no boost pads anywhere: every bit of speed you
// carry is speed you built and kept. Each section opens on a flag and a long
// run-up (respawn there and the bar is empty: a death costs you your
// momentum, not just your place) and then asks for top gear, with gaps a
// plain sprint falls short of. Fumble a landing, let go of the stick, or
// clip a ledge, and the next gap is simply too wide.

import { Level, T, TILE } from '../level.js';

const W = 578;           // (with a run-out past the goal for the walk-off)
const H = 40;
const S = 26;            // the girders' surface row

export function buildOverpass() {
  const L = new Level(W, H);
  L.theme = 'dawn';
  // a span of girder: solid all the way down, the drop either side of it
  const span = (x0, x1, y = S) => L.rect(x0, y, x1 - x0, H - y);
  const spans = (xs, w) => { for (const x of xs) span(x, x + w); };
  // a fanged girder hanging five tiles over the deck: a full jump under it
  // is a death, a low hop is not
  const fang = (x0, w) => {
    L.rect(x0, S - 8, w, 3);
    L.spikes(x0, S - 5, w, 'down');
  };

  // ---- world shell -------------------------------------------------------
  L.rect(0, 0, 2, H);

  // ================================================ A — the widening gaps
  // A long run-up with two easy hops in it, then gaps that open wider and
  // wider. The last of them is past what a plain sprint can clear.
  span(2, 30);
  L.spawn = { x: 4 * TILE, y: (S - 2) * TILE };
  L.sign(5, S - 1, 'OVERPASS', [
    'No boost pads from here on. Every bit of speed is yours',
    'to build, and yours to lose. Run the whole way up, keep',
    'the stick held, roll the hard landings: the gaps only',
    'get wider, and a sprint is not enough for the last ones.',
  ]);
  span(34, 60);
  // each gap a tile wider than the last, every girder as short as the one
  // before: from here a jump is taken at the edge or not at all
  let x = 60;
  for (const gap of [12, 13, 14, 15]) { span(x + gap, x + gap + 7); x += gap + 7; }

  // ================================================ B — the sand bridge
  const b = x - 7;                         // the last girder runs on into the flag's
  span(b, b + 56);
  L.checkpoint(b + 10, S);
  L.sign(b + 13, S - 1, 'SAND BRIDGE', ['It will not hold you. Do not stop to find out.']);
  x = b + 56;
  for (const gap of [14, 15, 15]) { L.crumble(x + gap, S, 7); x += gap + 7; }

  // ================================================ C — the fangs
  const c = x + 15;
  span(c, c + 56);
  L.checkpoint(c + 4, S);
  L.sign(c + 7, S - 1, 'FANGS', ['Hop low under the fangs, and land it running.']);
  x = c + 56;
  // full leap, low hop, full leap, low hop: the fangs hang over the short
  // gaps, where a jump at top gear would carry you up into them
  for (const gap of [15, 8, 15, 8]) {
    span(x + gap, x + gap + 7);
    if (gap === 8) fang(x - 1, gap + 1);
    x += gap + 7;
  }

  // ================================================ D — the gauntlet
  // All of it at once, with the goal at the far end.
  const d = x + 15;
  span(d, d + 56);
  L.checkpoint(d + 4, S);
  L.sign(d + 7, S - 1, 'GAUNTLET', ['Everything at once, and top gear the whole way.']);
  x = d + 56;
  L.crumble(x + 15, S, 7); x += 22;
  span(x + 8, x + 15); fang(x - 1, 9); x += 15;
  L.crumble(x + 15, S, 7); x += 22;
  span(x + 15, W);
  L.goal = { x: (x + 24) * TILE, y: (S - 4) * TILE, w: TILE * 2, h: TILE * 4, hit: false };
  if (x + 15 + 32 > W) throw new Error(`overpass: widen W to ${x + 15 + 32}`);

  return L;
}
