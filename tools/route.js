// route.js — where the course bot's jumps take off and come down on a level,
// for placing geometry under them. Same bot as sim.js check 32, same zones.
//   jsc -m tools/route.js -- <level> <from tile x> <from tile y> [bar cap]
// e.g. `-- 5 4 24` runs level 5 from its spawn; a fourth argument holds the
// bar down to that much (1 = a plain sprint, no top gear) to see what falls short.
import { LEVELS } from '../src/levels/index.js';
import { flatOut } from './harness.js';
import { ROUTES } from './routes.js';

const [n = '1', fx = '4', fy = '24', cap, mode] = arguments;   // `expert` as a fifth: dash the straights
const lv = LEVELS[Number(n) - 1];
const route = ROUTES[lv.id] ?? {};
let up = null;
const r = flatOut(lv.build, { x: Number(fx), y: Number(fy) }, 0, {
  ...route,
  flowCap: cap === undefined || cap === '-' ? null : [0, Number(cap)],
  expert: mode === 'expert',
  onJump: (e) => {
    if (e.up) { up = e; return; }
    const from = up ? `${up.x.toFixed(1)} (${Math.round(Math.abs(up.vx))} px/s, bar ${up.flow.toFixed(2)})` : 'start';
    print(`jump ${from} -> land ${e.x.toFixed(1)} row ${e.y.toFixed(1)} at ${Math.round(Math.abs(e.vx))} px/s, bar ${e.flow.toFixed(2)}, t=${(e.step / 120).toFixed(2)}s`);
    up = null;
  },
});
if (r.blind.length) print(`BLIND: ${r.blind.join('; ')}`);
if (r.chaseMin < Infinity) print(`the Stillness came within ${r.chaseMin.toFixed(1)} tiles`);
if (r.death) print(`died: ${r.death}`);
print(r.reached ? `REACHED the goal in ${r.time.toFixed(2)}s (stopped ${r.stopped.toFixed(2)}s)` : `FAILED at tile ${r.at}`);
