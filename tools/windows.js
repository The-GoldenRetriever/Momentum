// windows.js — how much timing each jump on a course allows: the course bot
// runs it, then every jump it made is pressed again earlier and later, a step
// (1/120 s) at a time, and the span that still lives is that jump's window.
// It is a measure of how hard a level is to a human, jump by jump.
//   jsc -m tools/windows.js -- <level> <from tile x> <from tile y>
import { LEVELS } from '../src/levels/index.js';
import { flatOut } from './harness.js';
import { ROUTES } from './routes.js';

const [n = '5', fx, fy] = arguments;
const lv = LEVELS[Number(n) - 1];
const route = ROUTES[lv.id] ?? {};
const from = fx === undefined ? route.starts[0] : { x: Number(fx), y: Number(fy) };
const base = flatOut(lv.build, from, 0, route);
if (!base.reached) { print(`the bot does not finish from ${from.x}`); }

// where the bot was at each step, to say which jump is which
const xs = [];
flatOut(lv.build, from, 0, { ...route, onJump: (e) => { xs.push(e); } });
const survives = (r, i) => r.reached || (i + 1 < base.presses.length && r.presses.length > i + 1 &&
  r.presses[i + 1] === base.presses[i + 1]);   // (it reached the next jump on cue)
const rows = [];
base.presses.forEach((at, i) => {
  const hop = base.hops[i] || undefined;
  const ok = (d) => {
    const r = flatOut(lv.build, from, 0, { ...route, force: { quiet: [Math.min(at, at + d) - 1, Math.max(at, at + d) + 30], at: at + d, hop } });
    return r.reached;
  };
  let early = 0, late = 0;
  while (early < 30 && ok(-(early + 1))) early++;
  while (late < 30 && ok(late + 1)) late++;
  const where = xs.find((e) => e.up && e.step >= at)?.x ?? 0;
  rows.push({ where, ms: Math.round((early + late + 1) * 1000 / 120), early, late, hop });
});
rows.forEach((r) => print(`${r.hop ? 'hop ' : 'jump'} at tile ${r.where.toFixed(0).padStart(4)}: ${String(r.ms).padStart(3)} ms window (${r.early} steps early, ${r.late} late)`));
const tight = rows.filter((r) => r.ms < 60).length;
print(`${rows.length} jumps; median window ${rows.map((r) => r.ms).sort((a, b) => a - b)[rows.length >> 1]} ms; ${tight} under 60 ms`);
