// harness.js — what the headless tools share: a key stub with the Input
// interface, a level-plus-player sim on the fixed step, and the course bot.
// DOM-free (jsc's `print`, no console), and importing it runs nothing.

import { TILE } from '../src/level.js';
import { Player, P } from '../src/player.js';
import { Fx } from '../src/particles.js';
import { updateMechanics, resetMechanics } from '../src/mechanics.js';
import { buildTestArea } from '../src/levels/test-area.js';
import { Camera } from '../src/camera.js';

// the game's view, in pixels (render.js has these too, but it needs a DOM)
export const VIEW_W = 480, VIEW_H = 270;

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

// `warp` runs the game's clock as main.js does: the world slows with the
// player's wind-up and burst (eased the same way), each step is STEP of real
// time and STEP x scale of world time. Without it every step is a full STEP of
// world time, slow motion or not, which is all most checks need; a check that
// cares where a wind-up's seconds of real time put you wants it on.
export function makeSim(at = { x: 6, y: 26 }, custom = null, { warp = false } = {}) {
  const level = custom ?? buildTestArea();
  const fx = new Fx();
  const p = new Player(level, fx);
  // Off unless a check asks for it: the course bot's runs (and so par) are
  // run without bursts, and most checks want a full bar to stay a full bar.
  p.autoBurst = false;
  p.reset(at.x * TILE, at.y * TILE);
  resetMechanics(level, p.x);          // (the Stillness, if any, starts behind you)
  const keys = new Keys();
  let scale = 1;
  const run = (steps, held = [], onStep = null) => {
    for (let i = 0; i < steps; i++) {
      keys.set(typeof held === 'function' ? held(i) : held);
      let dt = STEP;
      if (warp) {
        const target = p.warp;
        const rate = target >= scale ? 9 : p.bursting ? 30 : 8;
        scale += (target - scale) * Math.min(1, STEP * rate);
        dt = STEP * Math.max(scale, P.BURST_SCALE);
      }
      p.update(dt, keys, STEP);
      updateMechanics(level, p, dt);
      keys.step();
      fx.update(dt);
      if (onStep) onStep(i, p);
    }
  };
  return { level, p, fx, keys, run, get scale() { return scale; } };
}

// The course bot (sim.js check 32): holds right, taps C at each prompt,
// jumps where the ground runs out and ducks into
// the tunnels. Where a level asks for more than that it is told so, in
// zones: `hop` (a jump let go after that many steps, for under the fangs),
// `jump` (a full jump right there, ground ahead or not), `slide` (duck and
// slide the whole zone, never jumping in it),
// `dash` (directions, pressed again and again until a dash starts; `vy`
// waits for the top of a jump), `roll` (C held down the slope in it),
// `dive` (DOWN held all through it, no jumping: off a ledge into a dive, and
// the roll and slide it lands in), `vault` (never jump in it: a ledge across a gap, where the edge comes
// before the prompt does, and C at the prompt is the way over), `steady`
// (nothing but running: the expert dashes in no zone, so it keeps it too) and
// `autoburst` (V, once, as it comes in). Wall-jump shafts are climbed.
// `noVault` never presses C at a prompt (to prove a ledge needs it).
// `autoBurst` is where V's switch starts (off, as makeSim leaves it) and
// `warp` runs the game's slow motion (see makeSim): a route with a burst in
// it wants both, or its wind-up would take seconds of world time. `flowCap`
// ([tile, bar]) holds the bar down past a tile, to prove a stretch needs top
// gear. `onJump` hears about every takeoff and landing (tools/route.js
// prints them, for placing geometry where the jumps come down). `expert` also
// chains dashes down the straights, as a good player would: the gold medal
// is set from its time.
//
// The game's camera follows the bot the whole way, to catch blind falls: a
// landing has to be on screen at the moment you commit to the jump (takeoff,
// or the last wall kick, dash or spring before it, since those re-aim you),
// and stay on screen from the top of the arc down. Each one that is not comes
// back in `blind`.
export function flatOut(build, from, phaseT, { tunnels = [], shafts = [], zones = [], flowCap = null, onJump = null, force = null, expert = false, onStep = null, pause = null, warp = false, autoBurst = false, limit = 40, noVault = false } = {}) {
  const sim = makeSim(from, build(), { warp });
  sim.level.phaseT = phaseT;
  const p = sim.p;
  p.autoBurst = autoBurst;
  // level floor and open air for the next ten tiles (the expert's dash check)
  const clearAhead = () => {
    const L = sim.level;
    for (let d = 8; d <= 160; d += 8) {
      const ax = p.x + p.w + d;
      if (L.floorUnder(ax, ax + 2, p.footY - 2, p.footY + 2) === null) return false;
      if (L.boxHitsWall(p.x + d, p.y - 2, p.w, p.h + 1)) return false;
    }
    return true;
  };
  const inTunnel = (x) => tunnels.some(([a, b]) => x > a - 1.7 && x < b + 0.3);
  const shaftAt = (x, y) => shafts.find(([a, b, top]) => x > a && x < b && y > top + 0.5);
  const used = new Set();
  const cam = new Camera(VIEW_W, VIEW_H, sim.level);
  cam.snapTo(p.cx, p.cy);
  const blind = [];
  let air = null;                  // the jump in progress: where the view was when it was committed to
  let hold = 0, letGoAt = -1, fresh = false, side = 1, onWall = 0, stopped = 0, reached = false;
  let step = 0, gap = false, pending = null, dashKeys = [], wasOn = p.grounded, time = 0;
  const presses = [];              // the steps the bot chose to jump on, for tools/windows.js
  let dashedLast = false;          // (expert: a dash press needs a release before the next)
  let chaseMin = Infinity;         // the closest the Stillness came, in tiles
  const hopAt = new Map();         // ... and how long it held each one, if it let go early
  let clock = 0;                   // world time: the run clock, which slow motion slows too
  sim.run(120 * limit, () => {
    step++;
    // `pause` ([step, n]): let go of everything for n steps, as a player who
    // hesitates would (the Stillness check uses it)
    if (pause && step >= pause[0] && step < pause[0] + pause[1]) return [];
    const x = p.cx / TILE, y = p.footY / TILE;
    let k = ['right'];
    // (the hold counts world time: in slow motion a player holds the key as
    //  long as the jump takes, not for a fixed number of their own frames)
    if (hold > 0) { hold = Math.max(0, hold - (warp ? Math.max(sim.scale, P.BURST_SCALE) : 1)); if (step < letGoAt || (letGoAt < 0 && (p.vy < 0 || hold > 32))) k.push('jump'); }
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
    // `force` ({ quiet: [from, to], at, hop }) takes one jump out of the bot's
    // hands: no jumping of its own inside `quiet`, and a press at step `at`.
    if (force && step === force.at) { hold = 40; letGoAt = force.hop ? step + force.hop : -1; presses.push(step); return ['right', 'jump']; }
    const quiet = force && step >= force.quiet[0] && step <= force.quiet[1];
    const zi = zones.findIndex((z) => x >= z.at[0] && x < z.at[1]);
    const z = zones[zi];
    if (z && !used.has(zi)) {
      if (z.hop && p.grounded && !quiet) { used.add(zi); hold = 40; letGoAt = step + z.hop; presses.push(step); hopAt.set(step, z.hop); return ['right', 'jump']; }
      if (z.jump && p.grounded && !quiet) { used.add(zi); hold = 40; letGoAt = -1; presses.push(step); return ['right', 'jump']; }
      if (z.autoburst) { used.add(zi); return ['right', 'autoburst']; }
      if (z.dash && !p.grounded && p.dashes > 0 && !p.dashing && (z.vy === undefined || p.vy > z.vy)) {
        pending = zi; dashKeys = [...z.dash]; gap = true;
        return [...z.dash, 'dash'];
      }
    }
    if (p.cue && !fresh && !noVault) k.push('vault');
    fresh = !!p.cue;
    if (z && z.roll && !k.includes('vault')) k.push('vault');
    const ducking = inTunnel(x) || !!(z && z.slide);
    if (p.grounded && hold === 0 && !p.cue && !ducking && !(z && (z.hop || z.vault || z.dive)) && !quiet) {
      const ahead = p.x + p.w + Math.max(6, Math.abs(p.vx) * 0.04);
      // no floor ahead, or spikes where your boots would go (a reef): jump
      const spikes = sim.level.boxHitsSpikes(ahead - 2, p.y + 10, 6, p.h);   // (boots and below)
      // goo ahead is as good as a gap: never set foot in it
      const goo = sim.level.gooUnder(ahead, ahead + 2, p.footY) && !p.onGoo;
      if (spikes || goo || sim.level.floorUnder(ahead, ahead + 2, p.footY - 1, p.footY + 40) === null) { k.push('jump'); hold = 40; letGoAt = -1; presses.push(step); }
    }
    if (ducking && p.grounded) k.push('down');
    if (z && z.dive && x >= (z.edge ?? z.at[0]) - 0.3) k.push('down');   // dive, roll and slide through
    // The expert chains dashes down every straight it can see: about an eighth
    // faster than running, and what a good player does on a run-up. Only on
    // level ground with ten clear tiles ahead, so it never meets an edge,
    // a wall or a roof mid-dash.
    if (expert && !dashedLast && p.grounded && !p.dashing && p.dashes > 0 && p.t.dashCool <= 0 &&
        hold === 0 && !p.cue && !ducking && !z && k.length === 1 && clearAhead() &&
        // a dash covers ten tiles: never start one that would run into a zone
        // (it would carry the bot through a hop it had to make, onto a trap spring)
        !zones.some((zz) => zz.at[0] > x && zz.at[0] - x < 12)) k.push('dash');
    dashedLast = k.includes('dash');
    return k;
  }, (i, pl) => {
    if (flowCap && pl.cx / TILE > flowCap[0]) pl.flow = Math.min(pl.flow, flowCap[1]);
    if (onJump && pl.grounded !== wasOn) onJump({ up: wasOn, x: pl.cx / TILE, y: pl.footY / TILE, vx: pl.vx, flow: pl.flow, step });
    wasOn = pl.grounded;
    if (pl.dashing && pending !== null) { used.add(pending); pending = null; }
    const dt = warp ? STEP * Math.max(sim.scale, P.BURST_SCALE) : STEP;
    clock += dt;
    cam.follow(pl, dt);
    if (onStep) onStep(pl, step, sim.level);
    if (!pl.dead && !pl.grounded) {
      // a kick, a dash or a spring re-aims the jump: it is committed to anew
      // (a bounce pad is a re-aim as well: it throws you on far faster, or down)
      const reaim = pl.wallDir !== 0 || pl.dashing || (air && pl.vy < air.vy - 200) ||
                    (air && (Math.abs(pl.vx) > air.sp + 120 || pl.vy > air.vy + 300));
      if (!air || reaim) air = { at: { x: cam.x, y: cam.y }, from: pl.cx / TILE, apex: null, vy: pl.vy, sp: Math.abs(pl.vx) };
      air.vy = pl.vy;
      air.sp = Math.abs(pl.vx);
      if (!air.apex && pl.vy >= 0 && !pl.dashing) air.apex = [];
      if (air.apex) air.apex.push({ x: cam.x, y: cam.y });
    } else if (air && !pl.dead && pl.grounded) {
      const lx = pl.cx, ly = pl.footY;
      const seen = (v, mx, my) => lx >= v.x + mx && lx <= v.x + VIEW_W - mx && ly >= v.y + my && ly <= v.y + VIEW_H - my;
      const off = (v, mx, my) => {               // how far outside the view, for tuning
        const dx = Math.max(v.x + mx - lx, lx - (v.x + VIEW_W - mx), 0), dy = Math.max(v.y + my - ly, ly - (v.y + VIEW_H - my), 0);
        return dx ? `${Math.round(dx)}px ${lx > v.x + VIEW_W / 2 ? 'right' : 'left'}` : `${Math.round(dy)}px ${ly > v.y + VIEW_H / 2 ? 'below' : 'above'}`;
      };
      if (!seen(air.at, 8, 4)) blind.push(`${air.from.toFixed(0)}->${(lx / TILE).toFixed(0)} unseen at takeoff (${off(air.at, 8, 4)})`);
      else if (air.apex && air.apex.some((v) => !seen(v, 8, 8)))
        blind.push(`${air.from.toFixed(0)}->${(lx / TILE).toFixed(0)} lost from view on the way down (${off(air.apex.find((v) => !seen(v, 8, 8)), 8, 8)})`);
      air = null;
    } else if (pl.dead) air = null;
    if (sim.level.chase?.on && !reached && !pl.dead) chaseMin = Math.min(chaseMin, (pl.x - sim.level.chase.x) / TILE);
    if (reached || pl.dead) return;
    if (pl.grounded && Math.abs(pl.vx) < 60 && !shaftAt(pl.cx / TILE, pl.footY / TILE)) stopped++;
    const g = sim.level.goal;               // touching it, as the game asks, not just passing under it
    // (and like the game, the goal stops the Stillness: once there, it has lost)
    if (pl.x + pl.w > g.x && pl.x < g.x + g.w && pl.footY > g.y && pl.y < g.y + g.h) { reached = true; time = clock; g.hit = true; }
  });
  // `time` is how long it took to touch the goal: a level's par (index.js)
  return { reached: reached && !p.dead, stopped: stopped / 120, at: (p.cx / TILE).toFixed(0), time, blind, chaseMin, death: p.deathCause ?? null, presses, hops: presses.map((s) => hopAt.get(s) ?? 0) };
}
