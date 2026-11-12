// tidewater.js — level 5: the glass sea. Water you can run on: it holds
// you up as long as you are running fast and upright across it. Slow below a sprint, slide, or duck on it, and you go
// straight through. So every mistake out here is a death, not a stumble:
// clip a ledge, misjudge a reef, slide a tick too long under an arch and
// come out onto the water short of speed. Rock islets rise out of it (vault
// up onto them), reefs break the surface (jump them, at top gear), fangs hang
// over the short ones (hop those low), and stone arches come down so low you can only slide
// under them: slide on the rock, and be standing, and fast, before the water.
//
// Built as a run of moves from the spawn, like the other momentum courses,
// marking its own route for the course bot (tools/routes.js).

import { Level, T, TILE } from '../level.js';

const H = 42;
const SEA = 30;          // the water's surface row
const BED = 36;          // the sea bed

export function buildTidewater() {
  const w = course(new Level(1000, H));
  const L = new Level(w, H);
  course(L);
  return L;
}

function course(L) {
  L.theme = 'tide';
  L.marks = { flags: [], hops: [], runups: [], zones: [], tunnels: [] };
  let x = 2, y = SEA;              // y: the row the run is on (rock or water)

  // rock from row `top` to the bottom of the world
  const rock = (x0, x1, top) => L.rect(x0, top, x1 - x0, H - top);
  // the sea, with its bed, under [x0, x1)
  const sea = (x0, x1) => { L.water(x0, SEA, x1 - x0, BED - SEA); L.rect(x0, BED, x1 - x0, H - BED); };

  // n tiles of rock at height `top` (the run steps up or down onto it)
  const isle = (n, top = SEA) => { rock(x, x + n, top); x += n; y = top; };
  // n tiles of open water
  const water = (n) => { sea(x, x + n); x += n; y = SEA; };
  // a reef: spiked rock breaking the surface, n wide, jumped from the water
  const reef = (n) => { L.rect(x, SEA + 1, n, H - SEA - 1); L.spikes(x, SEA, n); x += n; };
  // a reef with fangs hung over it, five tiles up: you have to jump the reef,
  // and a full jump meets the fangs, so hop it low
  const fangs = (n) => {
    L.rect(x, SEA + 1, n, H - SEA - 1);
    L.spikes(x, SEA, n);
    L.rect(x - 2, SEA - 8, n + 4, 3);
    L.spikes(x - 2, SEA - 5, n + 4, 'down');
    L.marks.hops.push(x);
    x += n;
  };
  // an arch: rock underfoot for n tiles with a lip of rock so low over it that
  // only a slide fits. The bot slides it (a tunnel in its route).
  const arch = (n) => {
    rock(x, x + n, SEA);
    L.rect(x + 2, 1, n - 4, SEA - 2);
    L.rect(x + 2, SEA - 1, n - 4, 1, T.LOWCEIL);
    L.marks.tunnels.push([x + 2, x + n - 2]);
    x += n;
    y = SEA;
  };
  // a sand bar, n tiles, raised `up` rows out of the water: it will not hold
  const sand = (n, up = 0) => {
    sea(x, x + n);
    L.crumble(x, SEA - up, n, up + 1);
    x += n;
  };
  const flag = (title, line) => {
    L.checkpoint(x + 4, y);
    L.sign(x + 7, y - 1, title, [line]);
    L.marks.flags.push({ x: x + 4, y });
  };
  const runup = (n, top = y) => { isle(n, top); L.marks.runups.push(x); };

  // ---- the shell: a cliff behind you, and the sea bed under everything ----
  L.rect(0, 0, 2, H);

  // ================================================ A — the glass
  isle(0, SEA - 2);
  L.spawn = { x: 4 * TILE, y: (SEA - 4) * TILE };
  L.sign(5, SEA - 3, 'TIDEWATER', [
    'The water holds you up while you run fast and upright',
    'across it. Slow down, slide or duck out there and you',
    'go under.',
    'Reefs: jump them, and hop the ones under fangs. Arches:',
    'slide on the rock, and be up and fast before the water.',
  ]);
  runup(46);
  water(22); isle(7, SEA - 1); water(14);
  reef(13); water(12);
  fangs(8); water(10);
  isle(6, SEA - 2); water(16);
  reef(14); water(8); isle(6, SEA - 1); water(10);
  isle(4);

  // ================================================ B — the arches
  flag('ARCHES', 'Slide on the rock, stand before the water.');
  runup(52);
  arch(18); isle(3); water(18);
  reef(14); water(10);
  arch(20); isle(3); water(12);
  fangs(8); water(12);
  isle(5);

  // ================================================ C — the sandbars
  flag('SANDBARS', 'They crumble under you. Off them and onto the water.');
  runup(52);
  water(10); sand(7, 1); water(12);
  reef(14); sand(6); water(8);
  sand(7, 2); water(10);
  reef(15); water(6); fangs(8); water(8);
  isle(5);

  // ================================================ D — the crossing
  flag('CROSSING', 'All of it, and the far shore. Do not slow down.');
  runup(52);
  arch(18); isle(3); water(14);
  reef(14); water(6); fangs(8); water(10);
  sand(7, 1); water(10);
  reef(15); water(8);
  isle(5, SEA - 1); water(12);
  isle(7, SEA - 2); isle(6, SEA - 4); isle(34, SEA - 6);
  L.goal = { x: (x - 22) * TILE, y: (y - 4) * TILE, w: TILE * 2, h: TILE * 4, hit: false };
  return x;
}
