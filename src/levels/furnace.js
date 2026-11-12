// furnace.js — level 9, the last and the hardest: under the roof, deep where
// the rock runs hot, with the stillness right behind you. Almost the whole way there is rock a few tiles over
// your head, and a jump that meets it is cut short, so how far you carry is
// down to how fast you are running and nothing else: the gaps are measured
// for top gear under each height of roof, and the roof keeps changing, so
// you have to read it as well as the gap. Where the roof has fangs a jump
// that touches it is a death (hop low), the vents are so low you slide them,
// over holes only a fast slide skims, and the floors crumble. And the
// stillness chases you the whole way (see mechanics.js): it comes on at a
// little under top gear the whole way, so nothing may cost you a moment. No
// boost pads, and every flag is a long run-up from an empty bar.
//
// Gaps by headroom (tools/route.js prints where the jumps land): under four
// tiles a top-gear jump carries about nine past the edge and a sprint about
// seven and a half; under five, twelve against ten; under six, sixteen against
// thirteen. Every stretch has gaps a sprint falls into.

import { Level, T, TILE } from '../level.js';

const H = 44;
const FLOOR = 32;        // the surface row (the furnace floor is far below)

// The stillness chasing you here comes on at a
// little under top gear, and never more than twenty-two tiles back: a vent's
// drag on your slide brings it within a third of a second of you.
export const FURNACE_STILLNESS = 375;

export function buildFurnace() {
  const w = course(new Level(1000, H));
  const L = new Level(w, H);
  course(L);
  L.stillness(FURNACE_STILLNESS, 16, 22);
  return L;
}

function course(L) {
  L.theme = 'ember';
  L.marks = { flags: [], hops: [], runups: [], zones: [], tunnels: [] };
  const y = FLOOR;
  // rock from the surface down to the spiked furnace floor
  const ground = (x0, x1) => L.rect(x0, y, x1 - x0, H - 3 - y);
  // the roof over [x0, x1) with `room` tiles of headroom (null: the cave's
  // own roof, far overhead)
  const roof = (x0, x1, room) => { if (room) L.rect(x0, 1, x1 - x0, y - room - 1); };

  let x = 2, room = null;
  const run = (n) => { ground(x, x + n); roof(x, x + n, room); x += n; };
  const gap = (g, n) => { roof(x, x + g, room); x += g; run(n); };
  const sand = (g, n) => { roof(x, x + g + n, room); x += g; L.crumble(x, y, n); x += n; };
  // fangs: the roof's bottom row over a gap, and the stride either side of it,
  // turned to spikes. A low hop still clears them; a full jump does not.
  const fangGap = (g, n) => {
    const x0 = x;
    L.marks.hops.push(x0);
    gap(g, n);
    L.spikes(x0 - 2, y - room - 1, g + 4, 'down');     // (after the roof it replaces)
  };
  // a vent: a slot so low only a slide fits, `n` long, over holes two tiles
  // wide every six. The course bot slides it (a tunnel in its route).
  const vent = (n) => {
    ground(x, x + n);
    L.rect(x, 1, n, y - 2);
    L.rect(x, y - 1, n, 1, T.LOWCEIL);
    for (let hx = x + 6; hx < x + n - 2; hx += 6) L.rect(hx, y, 2, H - 3 - y, T.EMPTY);
    L.marks.tunnels.push([x, x + n]);
    x += n;
  };
  const flag = (title, line) => {
    L.checkpoint(x + 4, y);
    L.sign(x + 7, y - 1, title, [line]);
    L.marks.flags.push({ x: x + 4, y });
  };
  const runup = (n) => { run(n); L.marks.runups.push(x); };

  // ---- the shell: a wall behind you, the cave roof, a spiked floor below ----
  L.rect(0, 0, 2, H);
  L.rect(0, 0, 1000, 1);
  L.rect(0, H - 2, 1000, 2);
  L.spikes(2, H - 3, 998);

  // ================================================ A — the low road
  L.spawn = { x: 4 * TILE, y: (y - 2) * TILE };
  L.sign(5, y - 1, 'FURNACE', [
    'The roof is low and keeps changing: a jump that meets it',
    'is cut short, so only speed carries you. Fangs in the roof:',
    'hop low. Vents: slide them fast. And the stillness is',
    'behind you the whole way: do not stop. Not once.',
  ]);
  runup(60);
  room = 6; run(4);
  gap(14, 7);
  room = 5; gap(10, 6); sand(10, 6);
  room = 4; gap(8, 5); gap(8, 5);
  room = 6; gap(14, 10);
  room = null; vent(30); run(8);

  // ================================================ B — the crawl
  flag('CRAWL', 'Four tiles of room. Hop where the roof has fangs.');
  runup(56);
  room = 4; run(4);
  gap(8, 5); fangGap(8, 5); sand(8, 5); fangGap(8, 5); gap(8, 5); sand(8, 5); fangGap(8, 6);
  room = null; run(4);

  // ================================================ C — the vents
  flag('VENTS', 'Slide in at top gear and do not stand up.');
  runup(56);
  vent(36); run(6);
  room = 5; gap(10, 6);
  room = null; vent(30); run(6);
  room = 6; gap(14, 6); sand(14, 6);
  room = null; run(4);

  // ================================================ D — the bellows
  flag('BELLOWS', 'Six, five, four: the roof comes down on you. Keep top gear.');
  runup(56);
  room = 6; run(4); gap(14, 6);
  room = 5; gap(10, 5); fangGap(10, 5);
  room = 4; gap(8, 5); sand(8, 5); fangGap(8, 5);
  room = 5; gap(10, 5); sand(10, 5);
  room = 6; gap(14, 34);
  L.goal = { x: (x - 22) * TILE, y: (y - 4) * TILE, w: TILE * 2, h: TILE * 4, hit: false };
  return x;
}
