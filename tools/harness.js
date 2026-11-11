// harness.js — what the headless tools share: a key stub with the Input
// interface, a level-plus-player sim on the fixed step, and the course bot.
// DOM-free (jsc's `print`, no console), and importing it runs nothing.

import { TILE } from '../src/level.js';
import { Player } from '../src/player.js';
import { Fx } from '../src/particles.js';
import { updateMechanics } from '../src/mechanics.js';
import { buildTestArea } from '../src/levels/test-area.js';

export const STEP = 1 / 120;

export class Keys {
  constructor() { this.down = new Set(); this.pressed = new Set(); this.released = new Set(); }
  set(list) {
    const next = new Set(list);
    for (const a of next) if (!this.down.has(a)) this.pressed.add(a);
    for (const a of this.down) if (!next.has(a)) this.released.add(a);
    this.down = next;
  }
  step() { this.pressed.clear(); this.released.clear(); }
  held(a) { return this.down.has(a); }
  hit(a) { return this.pressed.has(a); }
  let_go(a) { return this.released.has(a); }
  get moveX() { return (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0); }
  get moveY() { return (this.held('down') ? 1 : 0) - (this.held('up') ? 1 : 0); }
}

export function makeSim(at = { x: 6, y: 26 }, custom = null) {
  const level = custom ?? buildTestArea();
  const fx = new Fx();
  const p = new Player(level, fx);
  p.reset(at.x * TILE, at.y * TILE);
  const keys = new Keys();
  const run = (steps, held = [], onStep = null) => {
    for (let i = 0; i < steps; i++) {
      keys.set(typeof held === 'function' ? held(i) : held);
      p.update(STEP, keys);
      updateMechanics(level, p, STEP);
      keys.step();
      fx.update(STEP);
      if (onStep) onStep(i, p);
    }
  };
  return { level, p, fx, keys, run };
}

// The course bot (sim.js check 32): holds right, taps C at each prompt,
// jumps where the ground runs out, rolls out of hard landings and ducks into
// the tunnels. Where a level asks for more than that it is told so, in
// zones: `hop` (a jump let go after that many steps, for under the fangs),
// `dash` (directions, pressed again and again until a dash starts; `vy`
// waits for the top of a jump). Wall-jump shafts are climbed. `flowCap`
// ([tile, bar]) holds the bar down past a tile, to prove a stretch needs top
// gear; `roll: false` never rolls out of a landing, to prove a stretch needs
// the rolls. `onJump` hears about every takeoff and landing (tools/route.js
// prints them, for placing geometry where the jumps come down).
export function flatOut(build, from, phaseT, { tunnels = [], shafts = [], zones = [], flowCap = null, roll = true, onJump = null } = {}) {
  const sim = makeSim(from, build());
  sim.level.phaseT = phaseT;
  const p = sim.p;
  const inTunnel = (x) => tunnels.some(([a, b]) => x > a - 1.7 && x < b + 0.3);
  const shaftAt = (x, y) => shafts.find(([a, b, top]) => x > a && x < b && y > top + 0.5);
  const used = new Set();
  let hold = 0, letGoAt = -1, fresh = false, side = 1, onWall = 0, stopped = 0, reached = false;
  let step = 0, gap = false, pending = null, dashKeys = [], wasOn = p.grounded, time = 0;
  sim.run(120 * 40, () => {
    step++;
    const x = p.cx / TILE, y = p.footY / TILE;
    let k = ['right'];
    if (hold > 0) { hold--; if (step < letGoAt || (letGoAt < 0 && (p.vy < 0 || hold > 32))) k.push('jump'); }
    const wasGap = gap;
    gap = false;
    if (wasGap) return [...dashKeys];                     // a release between dash presses
    const sh = shaftAt(x, y);
    if (sh) {                                             // climb it
      k = hold > 0 && p.vy < 0 ? ['jump'] : [];
      if (p.grounded) { hold = 30; letGoAt = -1; side = 1; return ['jump', 'right']; }
      if (p.wallDir !== 0) {
        if (++onWall > 10 && p.t.wallLock <= 0) { onWall = 0; hold = 30; letGoAt = -1; side = -p.wallDir; return ['jump', side > 0 ? 'right' : 'left']; }
        return [...k, p.wallDir > 0 ? 'right' : 'left'];
      }
      onWall = 0;
      return [...k, y < sh[2] + 0.2 || side > 0 ? 'right' : 'left'];
    }
    const zi = zones.findIndex((z) => x >= z.at[0] && x < z.at[1]);
    const z = zones[zi];
    if (z && !used.has(zi)) {
      if (z.hop && p.grounded) { used.add(zi); hold = 40; letGoAt = step + z.hop; return ['right', 'jump']; }
      if (z.dash && !p.grounded && p.dashes > 0 && !p.dashing && (z.vy === undefined || p.vy > z.vy)) {
        pending = zi; dashKeys = [...z.dash]; gap = true;
        return [...z.dash, 'dash'];
      }
    }
    if (p.cue && !fresh) k.push('vault');
    fresh = !!p.cue;
    if (roll && ((!p.grounded && p.vy > 350) || p.t.refund > 0)) k.push('vault');   // roll out of a hard landing
    if (p.grounded && hold === 0 && !p.cue && !inTunnel(x) && !(z && z.hop)) {
      const ahead = p.x + p.w + Math.max(6, Math.abs(p.vx) * 0.04);
      if (sim.level.floorUnder(ahead, ahead + 2, p.footY - 1, p.footY + 40) === null) { k.push('jump'); hold = 40; letGoAt = -1; }
    }
    if (inTunnel(x) && p.grounded) k.push('down');
    return k;
  }, (i, pl) => {
    if (flowCap && pl.cx / TILE > flowCap[0]) pl.flow = Math.min(pl.flow, flowCap[1]);
    if (onJump && pl.grounded !== wasOn) onJump({ up: wasOn, x: pl.cx / TILE, y: pl.footY / TILE, vx: pl.vx, flow: pl.flow, step });
    wasOn = pl.grounded;
    if (pl.dashing && pending !== null) { used.add(pending); pending = null; }
    if (reached || pl.dead) return;
    if (pl.grounded && Math.abs(pl.vx) < 60 && !shaftAt(pl.cx / TILE, pl.footY / TILE)) stopped++;
    const g = sim.level.goal;               // touching it, as the game asks, not just passing under it
    if (pl.x + pl.w > g.x && pl.x < g.x + g.w && pl.footY > g.y && pl.y < g.y + g.h) { reached = true; time = step / 120; }
  });
  // `time` is how long it took to touch the goal: a level's par (index.js)
  return { reached: reached && !p.dead, stopped: stopped / 120, at: (p.cx / TILE).toFixed(0), time };
}
