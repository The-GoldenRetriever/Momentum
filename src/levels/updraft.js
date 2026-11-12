// updraft.js — level 8: up through the northern lights on springs. A spring
// keeps every bit of your run and throws it upward, so the faster you hit
// one the further it carries you: the ledges they reach are spaced for top
// gear, and a plain sprint comes down short of every one. Some springs have
// fangs hung over them, and those you hop clean over instead (two of them a
// stride apart, once). Then a run across the void on spring pads, a spring
// leap that needs a dash at the top of it, a gap that needs two off a
// crystal, and the last ridge. No boost pads, and every flag is a long
// run-up from an empty bar.
//
// A spring sits at the far end of a short pad: land anywhere on the pad, run
// into the spring, and it fires you from the same spot every time. Each gap
// is set where a top-gear launch comes down, a couple of tiles onto the next
// ledge (tools/route.js prints the landings).

import { Level, T, TILE } from '../level.js';

const H = 74;
const START = 58;        // the surface row the run starts on

export function buildUpdraft() {
  // laid out once to find where it ends, then again at exactly that width
  const w = course(new Level(1000, H));
  const L = new Level(w, H);
  course(L);
  return L;
}

function course(L) {
  L.theme = 'aurora';
  L.marks = { flags: [], hops: [], runups: [], zones: [] };
  const rock = (x0, x1, top) => L.rect(x0, top, x1 - x0, H - top);

  let x = 2, y = START;
  // ground at the current height, n tiles of it
  const run = (n) => { rock(x, x + n, y); x += n; };
  // a gap g wide, then ground dy rows off (up is negative), n long
  const gap = (g, dy, n) => { x += g; y += dy; run(n); };
  // a spring pad: n tiles of ground with a spring on the third tile from its
  // end, so a runner meets the spring before the edge
  const pad = (n) => { run(n); L.spring(x - 3, y - 1); };
  // a trap: a spring in the middle of the ground with fangs over it, six rows
  // up: in plain view as you come at it, out of reach of a jump (its head
  // tops out just short), and right in the path of the spring. Hop it: a full
  // jump at top gear would carry you clean off the ground beyond.
  const trap = (before, after) => {
    run(before);
    L.spring(x, y - 1);
    // the spring throws you up and forward: by the time you are six rows up
    // you are four or five tiles on, so that is how far the fangs reach
    L.spikes(x - 1, y - 6, 7, 'down');
    L.rect(x - 1, y - 8, 7, 2);
    L.marks.zones.push({ at: [x - 2.8, x - 0.8], hop: 10 });
    run(after);
  };
  const flag = (title, line) => {
    L.checkpoint(x + 4, y);
    L.sign(x + 7, y - 1, title, [line]);
    L.marks.flags.push({ x: x + 4, y });
  };
  const runup = (n) => { run(n); L.marks.runups.push(x); };

  L.rect(0, 0, 2, H);
  L.spawn = { x: 4 * TILE, y: (y - 2) * TILE };
  L.sign(5, y - 1, 'UPDRAFT', [
    'Springs keep your speed and throw it upward: hit one at',
    'top gear or come down short of the ledge it was aimed at.',
    'Hop the springs with fangs over them. The rest, take.',
  ]);

  // ================================================ A — the first lifts
  run(24); gap(4, 0, 40);
  L.marks.runups.push(x);
  pad(0); gap(15, -6, 8); L.spring(x - 3, y - 1);
  gap(15, -7, 12);
  gap(18, 3, 8);
  gap(17, 3, 8);

  // ================================================ B — the traps
  flag('TRAPS', 'Fangs over a spring: hop it. The rest, take.');
  runup(52);
  // two traps a stride apart: hop, land, hop again
  trap(0, 10); trap(4, 14); L.spring(x - 3, y - 1);
  gap(15, -7, 5);
  trap(2, 14); L.spring(x - 3, y - 1);
  gap(16, -6, 8);
  gap(19, 4, 6);

  // ================================================ C — the void
  flag('VOID', 'Pad to pad across nothing, then dash for it. Keep top gear.');
  runup(52);
  L.spring(x - 3, y - 1);
  gap(16, -6, 6); L.spring(x - 3, y - 1);
  gap(16, -6, 6); L.spring(x - 3, y - 1);
  gap(15, -7, 6); L.spring(x - 3, y - 1);
  // the last pad throws you at a ledge too far for the spring alone: dash
  // right at the top of the arc (the spring handed your dash back) to carry
  L.marks.zones.push({ at: [x + 6, x + 20], dash: ['right'], vy: -40 });
  gap(23, -2, 10);
  // and then a gap no spring helps with: jump, dash at the top of it into the
  // crystal, and dash again off the crystal. Both, or the drop.
  L.marks.zones.push({ at: [x + 4, x + 12], dash: ['right'], vy: -40, exact: true });
  L.crystal(x + 13, y - 5);
  L.marks.zones.push({ at: [x + 12, x + 22], dash: ['right'], exact: true });
  gap(24, 0, 10);

  // ================================================ D — the last ridge
  // Down the far side, girder by girder, with a trap on the way and the last
  // spring up onto the ridge where the goal stands.
  flag('RIDGE', 'Over the last ridge. One more trap. Then up.');
  runup(60);
  gap(19, 4, 6);
  gap(20, 5, 5);
  trap(3, 12); L.spring(x - 3, y - 1);
  gap(15, -7, 5);
  gap(19, 4, 5);
  gap(20, 5, 9); L.spring(x - 3, y - 1);
  gap(16, -6, 34);
  L.goal = { x: (x - 22) * TILE, y: (y - 4) * TILE, w: TILE * 2, h: TILE * 4, hit: false };
  return x;
}
