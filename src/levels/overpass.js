// overpass.js — level 7: girders at dawn, over a flood.
// Parkour on the girders: no two of them stand at the same height, so the
// run never stops changing level, and every ledge up has to be called (C)
// or it is a wall. Below them all is the flood, gone still like the sea: fall
// short and you hit the water too slow, under a girder too tall to climb,
// and it has you. Halfway along the road itself goes under, and you run the
// flood: off the girders onto the water, across it at full tilt, up onto the
// low girders out of it, over wreckage breaking the surface. No boost pads:
// the speed you carry is the speed you built, and every flag is a long run-up
// from an empty bar.
//
// The course is written as a list of moves, from the spawn to the goal. Each
// gap is set where a top-gear jump off the girder before it comes down, a
// couple of tiles onto the next (tools/route.js prints where they land), and
// past where a plain sprint does. No drop is deeper than the camera can show
// you from the edge.

import { Level, T, TILE } from '../level.js';

const H = 52;
const TOP = 28;          // the surface row the run starts on
const FLOOD = 36;        // the flood's surface, under everything

// [move, ...args]:
//   ['run', n]                   n tiles of girder, at the same height
//   ['step', dy, n]              a ledge dy rows down (+) or up (-), then n tiles
//   ['gap', g, dy, n]            a gap g tiles wide, onto a girder dy rows off, n long
//   ['sand', g, dy, n]           the same, onto a slab of sand that gives way
//   ['fang', g, n]               a gap with a fanged beam over it, onto a girder n long
//   ['skim', n]                  down onto the flood, and n tiles across it
//   ['wreck', n]                 wreckage breaking the flood, n wide: jump it
//   ['fangwreck', n]             wreckage with a fanged beam over it: hop it
//   ['flag', title, line]        a checkpoint here, and the sign for the stretch after it
const COURSE = [
  // ============================================== A — the girders
  ['run', 22], ['step', -1, 8], ['step', 1, 10], ['step', -2, 10], ['step', 2, 12],
  ['gap', 14, -2, 5], ['gap', 18, 3, 5], ['gap', 16, 0, 6], ['step', -2, 6],
  ['gap', 19, 4, 6], ['gap', 13, -3, 9],
  // ============================================== B — the scaffold
  ['flag', 'SCAFFOLD', 'Fangs over the short gaps: hop. Sand will not hold.'],
  ['run', 54], ['step', 1, 6],
  ['fang', 8, 6], ['gap', 18, 3, 5], ['sand', 16, 0, 5], ['fang', 9, 6], ['step', -2, 6],
  ['gap', 14, -2, 5], ['sand', 18, 3, 7],
  // ============================================== C — the flood
  ['flag', 'FLOOD', 'The road goes under. Run the water, flat out, and climb out.'],
  ['run', 56], ['step', 2, 6], ['step', 2, 6],
  ['skim', 14], ['step', -2, 6], ['skim', 12], ['wreck', 12], ['skim', 10],
  ['fangwreck', 8], ['skim', 10], ['step', -2, 6], ['step', -2, 6],
  ['gap', 14, 0, 5], ['skim', 24], ['step', -2, 8], ['step', -2, 6],
  // ============================================== D — the climb
  ['flag', 'CLIMB', 'Up out of the flood to the end of the road. Call every ledge.'],
  ['run', 56],
  ['gap', 14, -2, 5], ['step', -2, 6], ['gap', 13, -3, 5], ['step', -1, 5], ['fang', 9, 5],
  ['gap', 14, -2, 5], ['step', -2, 5], ['sand', 13, -3, 5], ['gap', 13, -3, 30],
];

export function buildOverpass() {
  // walk the course once for its size, then again to build it
  let w = 2, y = TOP, lo = TOP, hi = TOP;
  for (const [m, ...a] of COURSE) {
    if (m === 'run') w += a[0];
    else if (m === 'step') { y += a[0]; w += a[1]; }
    else if (m === 'gap' || m === 'sand') { y += a[1]; w += a[0] + a[2]; }
    else if (m === 'fang') w += a[0] + a[1];
    else if (m === 'skim') { y = FLOOD; w += a[0]; }
    else if (m === 'wreck' || m === 'fangwreck') w += a[0];
    lo = Math.max(lo, y); hi = Math.min(hi, y);
  }
  if (lo > FLOOD || hi < 12) throw new Error(`overpass: the course runs from row ${hi} to ${lo}`);

  const L = new Level(w, H);
  L.theme = 'dawn';
  const girder = (x0, x1, top) => L.rect(x0, top, x1 - x0, H - top);
  // the flood first, under the whole road: everything else stands in it
  L.water(0, FLOOD, w, H - FLOOD - 2);
  L.rect(0, H - 2, w, 2);
  L.rect(0, 0, 2, H);

  // Where the flags, the fang hops and the ends of the run-ups fall, for the
  // course bot's route (tools/routes.js reads them, so retuning a gap here
  // never leaves the route behind).
  L.marks = { flags: [], hops: [], runups: [] };
  let x = 2, afterFlag = true;
  y = TOP;
  L.spawn = { x: 4 * TILE, y: (y - 2) * TILE };
  L.sign(5, y - 1, 'OVERPASS', [
    'No two girders at one height: call every ledge up with',
    'C, or it is a wall. Fall short and the water has you.',
    'Further on the road goes under: run the water flat out,',
    'and climb back out of it.',
  ]);
  const beam = (x0, g, top) => {                // a fanged beam five tiles over `top`
    L.rect(x0 - 1, top - 8, g + 2, 3);
    L.spikes(x0 - 1, top - 5, g + 2, 'down');
    L.marks.hops.push(x0);
  };
  for (const [m, ...a] of COURSE) {
    if (m === 'run') {
      girder(x, x + a[0], y); x += a[0];
      if (afterFlag) L.marks.runups.push(x);
    } else if (m === 'step') { y += a[0]; girder(x, x + a[1], y); x += a[1]; }
    else if (m === 'gap') { x += a[0]; y += a[1]; girder(x, x + a[2], y); x += a[2]; }
    else if (m === 'sand') { x += a[0]; y += a[1]; L.crumble(x, y, a[2]); x += a[2]; }
    else if (m === 'fang') {
      // a full jump under the beam is a death, a low hop is not
      beam(x, a[0], y);
      x += a[0];
      girder(x, x + a[1], y);
      x += a[1];
    } else if (m === 'skim') { y = FLOOD; x += a[0]; }
    else if (m === 'wreck' || m === 'fangwreck') {
      // twisted wreckage just breaking the surface: spikes on a sunken hulk
      L.rect(x, FLOOD + 1, a[0], H - FLOOD - 3);
      L.spikes(x, FLOOD, a[0]);
      if (m === 'fangwreck') beam(x, a[0], FLOOD);
      x += a[0];
    } else if (m === 'flag') {
      // the flag stands on the girder the next run-up begins with
      L.checkpoint(x + 4, y);
      L.sign(x + 7, y - 1, a[0], [a[1]]);
      L.marks.flags.push({ x: x + 4, y });
    }
    afterFlag = m === 'flag';
  }
  // the goal, and the run-out past it (the level ends in an invisible wall)
  L.goal = { x: (x - 24) * TILE, y: (y - 4) * TILE, w: TILE * 2, h: TILE * 4, hit: false };
  return L;
}
