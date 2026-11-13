// mire.js — level 13: a drowned forest where the ground is goo. Goo does not
// kill you: it holds you. Set a boot in it and you are dragged down to a
// crawl, your jumps come out weak, and the bar drains away, so one touch and
// the next gap is out of reach. Strips of it lie across the way that only a
// top-gear jump clears; under a low roof a jump hits the roof and comes down
// in it, and only a dash carries; bridges of crumbling sand cross the bog
// that hold at a run and drop you in at anything less. No boost pads, and
// every flag is a long run-up from an empty bar.
//
// The course bot treats goo ahead like a gap (it jumps it); the strips are
// sized for its top-gear jumps (tools/route.js prints where they come down).

import { Level, TILE } from '../level.js';

const H = 56;
const START = 40;        // the surface row the run starts on

export function buildMire() {
  const w = course(new Level(1200, H));
  const L = new Level(w, H);
  course(L);
  return L;
}

function course(L) {
  L.theme = 'swamp';
  L.marks = { flags: [], hops: [], runups: [], zones: [], tunnels: [] };
  const rock = (x0, x1, top) => L.rect(x0, top, x1 - x0, H - top);

  let x = 2, y = START;
  const run = (n) => { rock(x, x + n, y); x += n; };
  // a strip of goo n wide across the way: rock under it, goo on its top
  const goo = (n) => { rock(x, x + n, y); L.goo(x, y, n); x += n; };
  const flag = (title, line) => {
    L.checkpoint(x + 4, y);
    L.sign(x + 7, y - 1, title, [line]);
    L.marks.flags.push({ x: x + 4, y });
  };
  const runup = (n) => { run(n); L.marks.runups.push(x); };
  // A spiked pit only top gear clears, at the end of each stretch of goo:
  // goo does not kill, it holds you, and this is where that costs a life.
  const reckoning = (n = 16) => { rock(x, x + n, y + 4); L.spikes(x, y + 3, n); x += n; run(6); };

  L.rect(0, 0, 2, H);
  L.spawn = { x: 4 * TILE, y: (y - 2) * TILE };
  L.sign(5, y - 1, 'MIRE', [
    'The violet is goo. It will not kill you: it holds you.',
    'One boot in it and you crawl, your jumps come out weak,',
    'and the bar drains away. Never touch it. Jump it all.',
  ]);

  // ================================================ A — first goo
  run(26); goo(9); run(8); goo(12); run(8);
  L.marks.runups.push(x);

  // ================================================ B — the wide strips
  flag('STRIPS', 'Wider now: only top gear clears these. Keep it.');
  runup(50);
  goo(15); run(4); goo(15); run(4); goo(16); run(4);
  reckoning();

  // ================================================ C — under the roof
  flag('LOW', 'A roof too low to jump under: dash over the goo.');
  runup(58);
  {
    // two rows of headroom: a jump bonks on the roof at once and comes down
    // in the goo; a dash along under it carries
    const start = x;
    for (let i = 0; i < 3; i++) {
      L.marks.zones.push({ at: [x - 0.5, x + 4], dash: ['right'] });
      goo(9); run(5);
    }
    L.rect(start - 3, y - 6, x - start + 3, 4);
    run(4);
    reckoning();
  }

  // ================================================ D — the bog bridges
  flag('BOG', 'The bridges hold at a run. At anything less, the bog.');
  runup(50);
  for (const n of [14, 18]) {
    // crumbling sand laid over a goo bed: run straight over, never stop
    rock(x, x + n, y + 1); L.goo(x, y + 1, n);
    L.crumble(x, y, n);
    x += n;
    run(5);
  }
  goo(16); run(4);
  reckoning();

  // ================================================ E — the last of it
  flag('LAKE', 'Over the goo lake on the last of your speed. Goal.');
  runup(54);
  goo(16); run(3); goo(16); run(3); goo(16); run(3);
  reckoning(17);
  run(28);
  L.goal = { x: (x - 22) * TILE, y: (y - 4) * TILE, w: TILE * 2, h: TILE * 4, hit: false };
  return x;
}
