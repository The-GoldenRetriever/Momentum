// routes.js — how the course bot (harness.js flatOut) gets round each course
// level, keyed by level id: where its flags are (`starts`, the start first,
// then each flag), and anything it needs telling (tunnels to duck into, shafts
// to climb, zones for hops and dashes). sim.js check 32 proves each route, and
// that every zone is needed; tools/route.js runs one and prints its jumps.
// If you move geometry in a course, move its route with it (or have it mark
// itself: see `marked`).
//
// `topGear: { from, after }` claims the stretch past tile `after` takes top
// gear: held to a plain sprint (one bar, no overfill) from flag `from`, the
// bot must fail.
import { TILE } from '../src/level.js';
import { buildOverpass } from '../src/levels/overpass.js';
import { buildUpdraft } from '../src/levels/updraft.js';
import { buildFurnace } from '../src/levels/furnace.js';
import { buildTidewater } from '../src/levels/tidewater.js';
import { buildStillness } from '../src/levels/stillness.js';
import { buildGlacier } from '../src/levels/glacier.js';
import { buildTutorial } from '../src/levels/tutorial.js';

// A course that marks itself (L.marks: its flags, the edges its fang hops
// leave from, and where each run-up ends) gets its route worked out from
// the geometry: start from the spawn and every flag, hop at each fang, and
// claim top gear for every stretch after a run-up.
function marked(build) {
  const L = build(), m = L.marks;
  const starts = [{ x: L.spawn.x / TILE, y: L.spawn.y / TILE }, ...m.flags.map((f) => ({ x: f.x + 3, y: f.y - 1.1 }))];
  const hops = m.hops.map((x) => ({ at: [x - 2.6, x - 0.4], hop: 10 }));
  return {
    starts,
    zones: [...hops, ...(m.zones ?? [])].sort((a, b) => a.at[0] - b.at[0]),
    tunnels: m.tunnels ?? [],
    topGear: m.runups.map((after, i) => ({ from: starts[i], after })),
  };
}

// The tutorial marks its own gates: a start at every flag, its tunnel and
// shaft, and zones for the moves the bot is not doing anyway (the jump and
// dash up the cliff, the dash off the burst, and V before the water; it rolls
// down the slope already, tapping C at the prompt at the top). Its burst is
// the game's own, so it runs with auto-burst on and the game's slow motion,
// and the clock that makes its par is world time.
function tutorial() {
  const L = buildTutorial(), m = L.marks;
  return {
    starts: [{ x: L.spawn.x / TILE, y: L.spawn.y / TILE }, ...m.flags.map((f) => ({ x: f.x + 1, y: f.y - 1.1 }))],
    zones: [...m.zones].sort((a, b) => a.at[0] - b.at[0]),
    tunnels: m.tunnels,
    shafts: m.shafts,
    warp: true,
    autoBurst: true,
    limit: 100,
  };
}

export const ROUTES = {
  tutorial: tutorial(),
  spire: {
    starts: [{ x: 5, y: 32 }, { x: 48, y: 32.9 }, { x: 138, y: 32.9 }, { x: 228, y: 22.9 }, { x: 333, y: 32.9 }],
    tunnels: [[129, 136], [312, 317]],
    shafts: [[235.5, 241.5, 8]],
  },
  undercroft: {
    starts: [{ x: 4, y: 30 }, ...[103, 190, 261, 356, 407].map((x) => ({ x, y: 30.9 }))],
    tunnels: [[199, 218]],
    zones: [{ at: [132, 134.5], hop: 10 },
            { at: [453, 455.5], hop: 10 }],
    // the crawlway's roof caps every jump, so only top-gear speed carries it:
    // held to a plain sprint (one bar, no overfill) from its station on, it fails
    topGear: { from: { x: 407, y: 30.9 }, after: 415 },
  },
  skyline: {
    starts: [{ x: 4, y: 24 }, ...[103, 190, 262, 357, 444, 507].map((x) => ({ x, y: 24.9 }))],
    zones: [{ at: [132, 134.5], hop: 10 },
            { at: [199, 210], dash: ['right'], vy: -40, exact: true }, { at: [210, 222], dash: ['right'], exact: true },
            { at: [222, 236], dash: ['right'], exact: true },
            { at: [386, 388.5], hop: 10 },
            { at: [453, 468], dash: ['right'], vy: -40 }, { at: [468, 484], dash: ['right'] },
            { at: [516, 526], dash: ['right', 'up'], vy: -40, exact: true }, { at: [526, 536], dash: ['right', 'up'], exact: true },
            { at: [536, 546], dash: ['right', 'up'], exact: true }, { at: [546, 557], dash: ['right', 'up'], exact: true }],
  },
  tidewater: marked(buildTidewater),
  stillness: marked(buildStillness),
  overpass: marked(buildOverpass),
  updraft: marked(buildUpdraft),
  furnace: marked(buildFurnace),
  glacier: marked(buildGlacier),
};
