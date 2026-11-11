// routes.js — how the course bot (harness.js flatOut) gets round each course
// level, keyed by level id: where its flags are (`starts`, the start first,
// then each flag), and anything it needs telling (tunnels to duck into, shafts
// to climb, zones for hops and dashes). sim.js check 32 proves each route, and
// that every zone is needed; tools/route.js runs one and prints its jumps.
// If you move geometry in a course, move its route with it.
//
// `topGear: { from, after }` claims the stretch past tile `after` takes top
// gear: held to a plain sprint (one bar, no overfill) from flag `from`, the
// bot must fail. `rolls: { from }` claims the rolls are needed: run from flag
// `from` without rolling out of landings, the bot must fail.
export const ROUTES = {
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
  overpass: {
    starts: [{ x: 4, y: 24 }, ...[145, 275, 420].map((x) => ({ x, y: 24.9 }))],
    zones: [{ at: [345, 347.6], hop: 10 }, { at: [383, 385.6], hop: 10 }, { at: [490, 492.6], hop: 10 }],
    topGear: [{ from: { x: 4, y: 24 }, after: 60 }, { from: { x: 145, y: 24.9 }, after: 191 },
              { from: { x: 275, y: 24.9 }, after: 327 }, { from: { x: 420, y: 24.9 }, after: 472 }],
  },
  // The momentum courses: no pads, so every section proves it takes top gear
  // from its own flag (bar empty), and the falls prove they take the rolls.
  cascade: {
    starts: [{ x: 4, y: 10 }, { x: 149, y: 34.9 }, { x: 240, y: 26.9 }, { x: 405, y: 58.9 }],
    topGear: [{ from: { x: 4, y: 10 }, after: 62 }, { from: { x: 149, y: 34.9 }, after: 176 },
              { from: { x: 240, y: 26.9 }, after: 291 }, { from: { x: 405, y: 58.9 }, after: 448 }],
    rolls: [{ from: { x: 4, y: 10 } }, { from: { x: 240, y: 26.9 } }, { from: { x: 405, y: 58.9 } }],
  },
  furnace: {
    starts: [{ x: 4, y: 10 }, ...[147, 286, 419].map((x) => ({ x, y: 34.9 }))],
    tunnels: [[468, 504]],
    zones: [{ at: [345, 347.6], hop: 10 }, { at: [371, 373.6], hop: 10 }],
    topGear: [{ from: { x: 4, y: 10 }, after: 62 }, { from: { x: 147, y: 34.9 }, after: 197 },
              { from: { x: 286, y: 34.9 }, after: 335 }, { from: { x: 419, y: 34.9 }, after: 468 }],
    rolls: { from: { x: 4, y: 10 } },
  },
};
