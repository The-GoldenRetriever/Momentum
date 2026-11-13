// ricochet.js — level 12: a violet night city of pads. Side pads hang in the
// air over gaps no jump crosses, and fire you on at a pace past top gear if
// you jump into them at the right height (high, and they pass under you; low,
// and you pass under them). Red pads face the other way: jump into one and it
// throws you back into the pit you were crossing, so under those you hop low.
// Then a corridor of springs and ceiling pads that bounce you between them
// over spikes, and only top gear carries you from one spring bed to the next.
// No boost pads, and every flag is a long run-up from an empty bar.
//
// The pads are placed for the course bot's top-gear jumps (tools/route.js
// prints where they come down): a jump off an edge at top gear meets a side
// pad six tiles out at four or five tiles up.

import { Level, TILE } from '../level.js';

const H = 60;
const START = 42;        // the surface row the run starts on

export function buildRicochet() {
  const w = course(new Level(1200, H));
  const L = new Level(w, H);
  course(L);
  return L;
}

function course(L) {
  L.theme = 'neon';
  L.marks = { flags: [], hops: [], runups: [], zones: [], tunnels: [] };
  const rock = (x0, x1, top) => L.rect(x0, top, x1 - x0, H - top);
  const spikes = (x0, n, top) => { rock(x0, x0 + n, top + 3); L.spikes(x0, top + 2, n); };

  let x = 2, y = START;
  const run = (n) => { rock(x, x + n, y); x += n; };
  const gap = (g, dy, n) => { x += g; y += dy; run(n); };
  const flag = (title, line) => {
    L.checkpoint(x + 4, y);
    L.sign(x + 7, y - 1, title, [line]);
    L.marks.flags.push({ x: x + 4, y });
  };
  const runup = (n) => { run(n); L.marks.runups.push(x); };
  // a side pad `at` tiles past the current edge, its plate spanning rows up
  // `up` and `up - 1` above the run (so `up` 5 meets a top-gear jump's arc)
  const sidePad = (at, up = 5, dir = 'right') => L.pad(x + at, y - up, dir);

  L.rect(0, 0, 2, H);
  L.spawn = { x: 4 * TILE, y: (y - 2) * TILE };
  L.sign(5, y - 1, 'RICOCHET', [
    'Jump into a cyan pad and it fires you on, faster than you',
    'can run. A red one throws you back: hop low under those.',
    'Pink pads on a roof slam you down. Top gear, all the way.',
  ]);

  // ================================================ A — first pads
  run(24); gap(4, 0, 46);
  L.marks.runups.push(x);
  // one pad: a gap a jump alone comes down short in
  sidePad(6);
  gap(22, 0, 8);
  // and two in a row: nothing else crosses this
  sidePad(6); sidePad(19);
  gap(34, 0, 10);

  // ================================================ B — red pads
  flag('TRAPS', 'Red pads hang over the pits: hop low under them.');
  runup(50);
  for (let i = 0; i < 3; i++) {
    // a pit a top-gear hop clears, and a red pad six rows up over it, right
    // where a full jump would go (a hop passes under it)
    L.marks.zones.push({ at: [x - 2.6, x - 0.4], hop: 8 });
    spikes(x, 7, y);
    L.pad(x + 3, y - 6, 'left');
    x += 7;
    run(6);
  }
  // then a pad over the void, with a red one hung above its line: jump into
  // the cyan one high and it throws you up into the red
  sidePad(6);
  L.pad(x + 16, y - 9, 'left');
  gap(22, 0, 10);

  // ================================================ C — the pinball run
  flag('PINBALL', 'Spring up, slammed down, spring up. Hold top gear.');
  runup(50);
  {
    // a roof four rows over the run, a spring bed, then spikes; a pink pad in
    // the roof over each gap slams you down onto the next bed
    const start = x;
    for (let i = 0; i < 6; i++) {
      rock(x, x + 2, y);
      L.spring(x, y - 1); L.spring(x + 1, y - 1);
      L.pad(x + 3, y - 5, 'down');                    // (on the roof's underside)
      // five tiles a bounce: top gear lands mid-bed, a sprint short of it
      spikes(x + 2, 3, y);
      x += 5;
    }
    L.rect(start - 2, y - 9, x - start + 4, 4);        // the roof
    run(10);
  }

  // ================================================ D — the last of it
  flag('LAST', 'All of it: pads over the void, a red one, the goal.');
  runup(54);
  sidePad(6); sidePad(19);
  L.pad(x + 30, y - 9, 'left');
  gap(36, 0, 8);
  L.marks.zones.push({ at: [x - 2.6, x - 0.4], hop: 8 });
  spikes(x, 7, y);
  L.pad(x + 3, y - 6, 'left');
  x += 7;
  run(34);
  L.goal = { x: (x - 22) * TILE, y: (y - 4) * TILE, w: TILE * 2, h: TILE * 4, hit: false };
  return x;
}
