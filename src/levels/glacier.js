// glacier.js — level 10: the glacier. Every surface is ice. It never takes
// your speed, but it will not let you stop, it is slow to get going on, and
// turning round on it takes an age, so the one way through is the way the
// other momentum courses ask for: build top gear on the run-up and never give
// it back. Out on the meltwater lake the water holds you only at a full bar's speed,
// and off the icefall the drop is too far for it to hold you at all: dash
// just before you hit the water, or go through it.
//
// Built as a run of moves from the spawn, like the other momentum courses,
// marking its own route for the course bot (tools/routes.js).

import { Level, T, TILE } from '../level.js';

const H = 48;
const GROUND = 30;       // the ice shelf
const LAKE = 33;         // the meltwater's surface: three rows under the shelf
const BED = 40;          // and its bed

export function buildGlacier() {
  const w = course(new Level(1000, H));
  const L = new Level(w, H);
  course(L);
  L.freeze();
  return L;
}

function course(L) {
  L.theme = 'glacier';
  L.marks = { flags: [], hops: [], runups: [], zones: [], tunnels: [] };
  let x = 2, y = GROUND;

  const rock = (x0, x1, top) => L.rect(x0, top, x1 - x0, H - top);
  // n tiles of ground, dy rows off the last (up is negative)
  const run = (n, dy = 0) => { y += dy; rock(x, x + n, y); x += n; };
  const gap = (g, dy, n) => { x += g; run(n, dy); };
  // a low ice cave: only a slide fits, and a slide on ice runs a long way
  const tunnel = (n) => {
    rock(x, x + n, y);
    L.rect(x, 1, n, y - 2);
    L.rect(x, y - 1, n, 1, T.LOWCEIL);
    L.marks.tunnels.push([x, x + n]);
    x += n;
  };
  // icicles over a gap: hop it low
  const fangGap = (g, n) => {
    L.rect(x - 1, y - 8, g + 2, 3);
    L.spikes(x - 1, y - 5, g + 2, 'down');
    L.marks.hops.push(x);
    gap(g, 0, n);
  };
  // the lake, with its bed, under n tiles: the run goes out onto the water
  const lake = (n) => { L.water(x, LAKE, n, BED - LAKE); L.rect(x, BED, n, H - BED); x += n; y = LAKE; };
  // a floe: ice standing `up` rows out of the lake, n wide
  const floe = (n, up = 0) => { rock(x, x + n, LAKE - up); x += n; y = LAKE - up; };
  // shards: spiked ice breaking the surface, n wide, jumped from the water
  const shards = (n) => { L.rect(x, LAKE + 1, n, H - LAKE - 1); L.spikes(x, LAKE, n); x += n; };
  // shards with icicles hung over them: jump the shards, but hop them low
  const fangShards = (n) => {
    L.rect(x, LAKE + 1, n, H - LAKE - 1);
    L.spikes(x, LAKE, n);
    L.rect(x - 2, LAKE - 8, n + 4, 3);
    L.spikes(x - 2, LAKE - 5, n + 4, 'down');
    L.marks.hops.push(x);
    x += n;
  };
  // The icefall: off a shelf six rows over the lake, a top-gear leap comes
  // down from too high for the water to hold you. Dash on the way down, late
  // (falling fast), and it breaks the fall: the water counts from there.
  const icefall = (n) => {
    L.marks.zones.push({ at: [x + 2, x + 30], dash: ['right'], vy: 450 });
    lake(n);
  };
  const flag = (title, line) => {
    L.checkpoint(x + 4, y);
    L.sign(x + 7, y - 1, title, [line]);
    L.marks.flags.push({ x: x + 4, y });
  };
  const runup = (n) => { run(n); L.marks.runups.push(x); };

  L.rect(0, 0, 2, H);

  // ================================================ A — the shelf
  L.spawn = { x: 4 * TILE, y: (y - 2) * TILE };
  L.sign(5, y - 1, 'GLACIER', [
    'All of it is ice. Let go and you glide; it is slow to get',
    'going on and slower to turn round on. It takes nothing',
    'from you, and it gives nothing back once you lose it.',
  ]);
  runup(46);
  gap(14, 0, 6); gap(15, 2, 6); run(8, -2);
  fangGap(8, 6); gap(14, -2, 6);
  run(6, 2); gap(16, 0, 10);

  // ================================================ B — the meltwater
  flag('MELTWATER', 'The lake holds you at a full bar\'s speed. Floes, then shards.');
  runup(48);
  lake(20); floe(7, 1); lake(14);
  shards(13); lake(12);
  fangShards(8); lake(10);
  floe(6, 2); lake(16);
  shards(14); lake(8);
  floe(6, 2); floe(12, 3);

  // ================================================ C — the icefall
  flag('ICEFALL', 'Too high for the water to hold you. Dash before it.');
  runup(48);
  run(6, -1); run(8, -2);
  icefall(36);
  shards(14); lake(10);
  floe(6, 2); floe(8, 3);
  fangGap(8, 6); gap(15, 0, 6);
  gap(18, 2, 6); run(8, -2);

  // ================================================ D — the glacier
  flag('THE GLACIER', 'All of it, on ice. Do not let it slow you down.');
  runup(52);
  tunnel(16); run(4);
  gap(14, 0, 6); fangGap(8, 6);
  run(6, -1); run(8, -2);
  icefall(36);
  fangShards(8); lake(12);
  shards(14); lake(10);
  floe(6, 2); floe(6, 3); run(34, 0);
  L.goal = { x: (x - 22) * TILE, y: (y - 4) * TILE, w: TILE * 2, h: TILE * 4, hit: false };
  return x;
}
