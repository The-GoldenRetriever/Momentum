// sim.js — headless physics harness. Run with a bare JS engine, no DOM needed:
//   jsc --module-file=tools/sim.js
// (or `node tools/sim.js` where node is available)

import { buildTestArea } from '../src/levels/test-area.js';
import { TILE } from '../src/level.js';
import { Player, P } from '../src/player.js';
import { Fx } from '../src/particles.js';

const STEP = 1 / 120;

class Keys {
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

export function makeSim(at = { x: 6, y: 26 }) {
  const level = buildTestArea();
  const fx = new Fx();
  const p = new Player(level, fx);
  p.reset(at.x * TILE, at.y * TILE);
  const keys = new Keys();
  const run = (steps, held = [], onStep = null) => {
    for (let i = 0; i < steps; i++) {
      keys.set(typeof held === 'function' ? held(i) : held);
      p.update(STEP, keys);
      keys.step();
      fx.update(STEP);
      if (onStep) onStep(i, p);
    }
  };
  return { level, p, fx, keys, run };
}

// ---------------------------------------------------------------- checks
let failures = 0;
function check(name, ok, detail = '') {
  if (!ok) failures++;
  print(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}
const embedded = (level, p) => level.boxHitsWall(p.x, p.y, p.w, p.h);

// 1. a ledge in front raises a cue, and JUMP takes it
{
  const { level, p, run } = makeSim({ x: 20, y: 26 });
  let sawCue = false;
  run(200, ['right'], (i, pl) => { if (pl.cue && pl.cue.kind === 'up') sawCue = true; });
  check('ledge raises an up cue while running at it', sawCue,
    `x=${p.x.toFixed(0)} cue=${p.cue && p.cue.kind}`);

  const sim2 = makeSim({ x: 20, y: 26 });
  let vaulted = false, topY = 1e9, spd = 0;
  sim2.run(260, (i) => (sim2.p.cue && sim2.p.cue.kind === 'up' ? ['right', 'vault'] : ['right']),
    (i, pl) => { if (pl.vault) vaulted = true; if (pl.grounded) { topY = Math.min(topY, pl.y); spd = Math.max(spd, Math.abs(pl.vx)); } });
  check('the vault key on the cue plays a vault', vaulted);
  const ledgeTop = 29 * TILE - 14;          // stood on the 1-tile ledge at x=26
  check('the vault ends up on top of the ledge', topY <= ledgeTop + 1,
    `best grounded y=${topY.toFixed(0)} want <= ${ledgeTop}`);
  check('speed survives the vault', spd > 150, `peak ${spd.toFixed(0)}`);
  check('never embedded in rock', !embedded(sim2.level, sim2.p));
}

// 2. running off a step raises a down cue and drops cleanly
{
  const sim = makeSim({ x: 66, y: 22 });
  let sawDown = false, dropped = false;
  sim.run(300, (i) => (sim.p.cue && sim.p.cue.kind === 'down' ? ['right', 'vault'] : ['right']),
    (i, pl) => { if (pl.cue && pl.cue.kind === 'down') sawDown = true; if (pl.rolling > 0) dropped = true; });
  check('descending steps raise a down cue', sawDown);
  check('the vault key on a down cue plays the roll', dropped);
  check('lands below without clipping', !embedded(sim.level, sim.p),
    `x=${(sim.p.x / TILE).toFixed(1)} y=${sim.p.y.toFixed(0)} grounded=${sim.p.grounded} vault=${!!sim.p.vault}`);
}

// 3. slide + JUMP under a low roof must not stand up into the rock
{
  const sim = makeSim({ x: 206, y: 26 });
  let worstH = 0, everStuck = false, insideTunnel = false;
  sim.run(420, (i) => (i > 60 ? ['right', 'down', 'jump'] : ['right']), (i, pl) => {
    const tx = Math.floor(pl.cx / TILE);
    if (tx >= 210 && tx < 224) {
      insideTunnel = true;
      worstH = Math.max(worstH, pl.h);
      if (embedded(sim.level, pl)) everStuck = true;
    }
  });
  check('slide reaches the tunnel', insideTunnel, `x=${(sim.p.x / TILE).toFixed(1)} tiles`);
  check('jump under the low roof never stands up', worstH <= 8, `max h under roof ${worstH}`);
  check('jump under the low roof never clips into rock', !everStuck);
}

// 4. dashing under a low roof must not clip into the block
{
  const sim = makeSim({ x: 206, y: 26 });
  let everStuck = false, worstH = 0, gotThrough = false;
  sim.run(520, (i) => {
    const tx = Math.floor(sim.p.cx / TILE);
    const keys = ['right'];
    if (i > 60) keys.push('down');
    if (tx >= 212 && tx <= 218 && i % 40 === 0) keys.push('dash');
    return keys;
  }, (i, pl) => {
    const tx = Math.floor(pl.cx / TILE);
    if (tx >= 210 && tx < 224) { worstH = Math.max(worstH, pl.h); if (embedded(sim.level, pl)) everStuck = true; }
    if (tx > 224) gotThrough = true;
  });
  check('dash under the low roof keeps the low hitbox', worstH <= 8, `max h ${worstH}`);
  check('dash under the low roof never clips into a block', !everStuck);
  check('the tunnel can still be cleared', gotThrough, `ended at ${(sim.p.x / TILE).toFixed(1)} tiles`);
}

// 5. a plain run over flat ground is undisturbed by the new code
{
  const sim = makeSim({ x: 151, y: 26 });    // the long flat stretch before the dash pit
  sim.run(100, ['right']);
  check('flat running still accelerates', sim.p.vx > 180, `vx=${sim.p.vx.toFixed(0)}`);
  check('flat running stays grounded', sim.p.grounded);
}

// 6. a deadly pit must never offer a drop vault
{
  const sim = makeSim({ x: 26, y: 26 });
  let badCue = null;
  sim.run(200, ['right'], (i, pl) => {
    if (!pl.cue || badCue) return;
    // the only thing that really matters: a prompt must never point at a landing
    // that kills you, or at one with nothing under it
    if (sim.level.boxHitsSpikes(pl.cue.x, pl.cue.y, pl.w, pl.h))
      badCue = `${pl.cue.kind} cue lands on spikes at ${pl.cue.x.toFixed(0)},${pl.cue.y.toFixed(0)}`;
    else if (!sim.level.boxHasGroundUnder(pl.cue.x, pl.cue.y, pl.w, pl.h))
      badCue = `${pl.cue.kind} cue lands on nothing at ${pl.cue.x.toFixed(0)},${pl.cue.y.toFixed(0)}`;
  });
  check('prompts never point at spikes or thin air', !badCue, badCue || '');
}

// 7. the five-step staircase can be run at speed, one vault per step
{
  const sim = makeSim({ x: 41, y: 26 });
  const top = (30 - 5) * TILE - 14;          // the platform at the head of the stairs
  let onTop = false, topSpeed = 0;
  sim.run(330, () => (sim.p.cue && sim.p.cue.kind === 'up' ? ['right', 'vault'] : ['right']),
    (i, pl) => {
      const tx = Math.floor(pl.cx / TILE);
      if (tx >= 59 && tx <= 65 && pl.grounded && pl.y <= top + 1) { onTop = true; topSpeed = Math.max(topSpeed, Math.abs(pl.vx)); }
    });
  check('stairs climbed by vaulting', onTop, `ended x=${(sim.p.x / TILE).toFixed(1)} y=${sim.p.y.toFixed(0)} want y<=${top}`);
  check('still moving at the top', topSpeed > 100, `vx=${topSpeed.toFixed(0)}`);
}

// 8. vaulting works just as well going left
{
  const sim = makeSim({ x: 29, y: 28 });      // on the ground, right of the x=26 ledge
  let vaulted = false, topY = 1e9;
  sim.run(240, () => (sim.p.cue && sim.p.cue.kind === 'up' ? ['left', 'vault'] : ['left']),
    (i, pl) => { if (pl.vault) vaulted = true; if (pl.grounded) topY = Math.min(topY, pl.y); });
  check('vaulting left works too', vaulted && topY <= 29 * TILE - 14 + 1,
    `y=${topY.toFixed(0)} vaulted=${vaulted}`);
}

// 9. the speed economy: a called vault is free, a scuffed drop is not, and a
//    roll — on the lip or just after the landing — hands the speed back.
function ledgeRun(mode) {
  const sim = makeSim({ x: 62, y: 22 });     // the top of the descending staircase
  let before = 0, after = 0, refunded = false;
  sim.run(240, () => {
    const k = ['right'];
    if (mode === 'roll' && sim.p.cue && sim.p.cue.kind === 'down') k.push('vault');
    if (mode === 'late' && sim.p.t.refund > 0) k.push('vault');
    return k;
  }, (i, pl) => {
    if (Math.floor(pl.cx / TILE) <= 66) before = Math.max(before, Math.abs(pl.vx));
    if (Math.floor(pl.cx / TILE) >= 76) after = Math.max(after, Math.abs(pl.vx));
    if (pl.rolling > 0) refunded = true;
  });
  return { before, after, refunded, keep: after / before };
}
{
  const plain = ledgeRun('none');
  const rolled = ledgeRun('roll');
  const late = ledgeRun('late');
  // (the stairs are also a downhill, so everyone gains — what matters is the gap)
  check('rolling down ledges beats stumbling down them', rolled.after > plain.after * 1.05,
    `rolled ${rolled.after.toFixed(0)} vs plain ${plain.after.toFixed(0)} px/s`);
  check('a late roll buys back most of the difference', late.refunded && late.after > plain.after,
    `late ${late.after.toFixed(0)} vs plain ${plain.after.toFixed(0)} px/s`);
}

// 10. a vault up gives back exactly the speed you ran in with, even if you
//     brushed the lip first
{
  const sim = makeSim({ x: 20, y: 26 });
  let approach = 0, exit = 0;
  sim.run(260, () => (sim.p.cue ? ['right', 'vault'] : ['right']), (i, pl) => {
    if (pl.x < 26 * TILE - 16) approach = Math.max(approach, Math.abs(pl.vx));
    if (pl.grounded && pl.y <= 29 * TILE - 14 && pl.x > 26 * TILE) exit = Math.max(exit, Math.abs(pl.vx));
  });
  check('vaulting up loses no speed', exit >= approach - 1,
    `${approach.toFixed(0)} in -> ${exit.toFixed(0)} out`);
}

// 11. pinned under a low roof you move like someone crouched
{
  const sim = makeSim({ x: 206, y: 26 });
  let topUnderRoof = 0, everTall = false;
  sim.run(600, (i) => (i > 60 ? ['right', 'down'] : ['right']), (i, pl) => {
    const tx = Math.floor(pl.cx / TILE);
    if (tx >= 214 && tx < 223 && !pl.sliding && pl.grounded) {
      topUnderRoof = Math.max(topUnderRoof, Math.abs(pl.vx));
      if (pl.h > 8) everTall = true;
    }
  });
  check('a forced duck stays a duck', !everTall);
  check('and moves at crouch speed', topUnderRoof <= 110, `peak ${topUnderRoof.toFixed(0)} (crouch cap 95)`);
}

// 12. an uncalled drop puts you in the air; a called one rolls you off it
{
  const air = (mode) => {
    const sim = makeSim({ x: 66, y: 22 });     // top of the descending staircase
    let airborne = 0, rolled = 0;
    sim.run(200, () => {
      const k = ['right'];
      if (mode === 'roll' && sim.p.cue && sim.p.cue.kind === 'down') k.push('vault');
      return k;
    }, (i, pl) => {
      if (!pl.grounded && !pl.vault) airborne++;
      if (pl.rolling > 0) rolled++;
    });
    return { airborne, rolled };
  };
  const plain = air('none');
  const rolled = air('roll');
  check('stumbling off a ledge gives you airtime', plain.airborne > 20,
    `${plain.airborne} airborne steps of 200`);
  check('rolling off one plays the roll through the drop', rolled.rolled > 20,
    `${rolled.rolled} rolling steps`);
}

// 13. the vault is taken at a run, not from a standing start
{
  const sim = makeSim({ x: 20, y: 26 });
  let approach = 0, x0 = 0, x1 = 0, t = 0, seen = false;
  sim.run(260, () => (sim.p.cue ? ['right', 'vault'] : ['right']), (i, pl) => {
    if (!pl.vault && !seen) approach = Math.max(approach, Math.abs(pl.vx));
    if (pl.vault) { if (!seen) { x0 = pl.x; seen = true; } x1 = pl.x; t = pl.vault.t; }
  });
  const pace = (x1 - x0) / t;
  check('the vault keeps pace with the run', pace >= approach * 0.95,
    `${pace.toFixed(0)} px/s through the vault vs ${approach.toFixed(0)} running in`);
}

// 14. crouching is something you can stop doing
{
  const sim = makeSim({ x: 151, y: 26 });      // open ground, no roof anywhere
  sim.run(60, ['down']);
  const ducked = sim.p.h;
  sim.run(60, []);                             // let go
  check('a crouch in the open stands back up', ducked === 8 && sim.p.h === 14,
    `crouched h=${ducked}, after release h=${sim.p.h}`);
  sim.run(60, ['down', 'right']);
  sim.run(60, ['right']);
  check('and stands up while still running', sim.p.h === 14 && !sim.p.crouching,
    `h=${sim.p.h} crouching=${sim.p.crouching}`);
}

// 15. the tighter ground-glue must not make ramps bumpy
{
  const sim = makeSim({ x: 96, y: 20 });       // the crest above the long down-ramp
  let airborne = 0, onRamp = 0, top = 0, entry = 0;
  sim.run(200, ['right'], (i, pl) => {
    const tx = Math.floor(pl.cx / TILE);
    if (tx === 99 && !entry) entry = Math.abs(pl.vx);
    if (tx >= 99 && tx <= 106) { onRamp++; if (!pl.grounded) airborne++; top = Math.max(top, Math.abs(pl.vx)); }
  });
  check('running down a ramp stays on the ground', onRamp > 20 && airborne <= onRamp * 0.1,
    `${airborne} airborne of ${onRamp} steps on the ramp`);
  check('and the ramp still pays out speed', top > entry * 1.1,
    `${entry.toFixed(0)} in -> ${top.toFixed(0)} px/s at the bottom`);
}

// 16. holding the ledge key takes every descent, not just the first
{
  const sim = makeSim({ x: 66, y: 22 });       // top of the five-step descent
  let starts = 0, wasRolling = false;
  sim.run(400, ['right', 'vault'], (i, pl) => {
    if (pl.rolling > 0 && !wasRolling) starts++;
    wasRolling = pl.rolling > 0;
  });
  check('holding the ledge key rolls ledge after ledge', starts >= 3,
    `${starts} rolls chained down the staircase`);

  const tapped = makeSim({ x: 66, y: 22 });    // ... a single tap only takes one
  let tapStarts = 0, was = false;
  tapped.run(400, (i) => (i < 4 ? ['right', 'vault'] : ['right']), (i, pl) => {
    if (pl.rolling > 0 && !was) tapStarts++;
    was = pl.rolling > 0;
  });
  check('a single tap does not', tapStarts <= 1, `${tapStarts} rolls from one tap`);
}

// The press arms the burst and the world slows; it fires a beat later. Every
// burst test has to sit through that beat, so it gets a name.
const WIND = Math.ceil(P.BURST_WIND * 120);   // steps from the press to the launch

// 17. the burst: full bar only, silly speed, drains, and ends itself
{
  const half = makeSim({ x: 151, y: 26 });
  half.p.flow = 0.5;
  half.run(60, ['right']);
  const couldHalf = half.p.canBurst;
  half.run(20, ['right', 'burst']);
  check('a half-full bar cannot burst', !couldHalf && !half.p.bursting);

  const sim = makeSim({ x: 151, y: 26 });
  sim.p.flow = 1;
  sim.run(60, ['right']);
  const sprint = Math.abs(sim.p.vx);
  sim.run(1, ['right', 'burst']);
  // the whole point of the beat: the world is already warped, you are not gone yet
  check('the press warps time before it fires you',
    sim.p.timeWarped && !sim.p.bursting && Math.abs(Math.abs(sim.p.vx) - sprint) < 12,
    `wind ${(sim.p.burstWind * 1000).toFixed(0)}ms, still at ${Math.abs(sim.p.vx).toFixed(0)} px/s`);
  sim.run(WIND - 2, ['right']);
  check('and it is still only winding up one step short of it', !sim.p.bursting,
    `wind ${(sim.p.burstWind * 1000).toFixed(0)}ms`);
  sim.run(2, ['right']);
  check('a full bar bursts', sim.p.bursting, `flow ${sim.p.flow.toFixed(2)}`);
  check('and it is unbelievably fast', Math.abs(sim.p.vx) > sprint * 2.5,
    `${sprint.toFixed(0)} -> ${Math.abs(sim.p.vx).toFixed(0)} px/s`);

  // the bar is the fuel gauge: it drains at a known rate and ends the burst at 0
  // (measured over a short window — no stretch of this level is long enough to
  //  run a whole burst out without hitting something, which is rather the point)
  const fuel = makeSim({ x: 230, y: 33 });
  fuel.p.flow = 1;
  fuel.run(60, ['right']);
  fuel.p.flow = 1;
  fuel.run(4, ['right', 'burst']);
  fuel.run(WIND, ['right']);
  const at0 = fuel.p.flow;
  fuel.run(30, ['right']);
  const drained = (at0 - fuel.p.flow) / 0.25;
  check('the bar drains while bursting', fuel.p.bursting && Math.abs(drained - 0.3) < 0.08,
    `${drained.toFixed(2)} bar/s — a full bar is ${(1 / drained).toFixed(1)}s of burst`);
  fuel.p.flow = 0.004;
  fuel.run(2, ['right']);
  // (the meter starts refilling the moment the burst lets go of it, so "empty"
  //  means "near zero", not "exactly zero")
  check('and an empty bar ends it', !fuel.p.bursting && fuel.p.flow < 0.02,
    `flow ${fuel.p.flow.toFixed(3)}`);

  const back = makeSim({ x: 151, y: 26 });
  back.p.flow = 1;
  back.run(60, ['right']);
  back.run(4, ['right', 'burst']);
  back.run(WIND, ['right']);
  back.run(6, ['left']);
  check('turning back drops it', !back.p.bursting);
}

// 18. ledge prompts still arrive in time at burst speed
{
  const sim = makeSim({ x: 14, y: 26 });
  sim.p.flow = 1;
  let cueSteps = 0, vaulted = false;
  sim.run(30, ['right']);
  sim.run(6, ['right', 'burst']);
  sim.run(WIND, ['right']);
  sim.run(120, () => (sim.p.cue ? ['right', 'vault'] : ['right']), (i, pl) => {
    if (pl.cue) cueSteps++;
    if (pl.vault) vaulted = true;
  });
  check('a burst still gives you time to read a ledge', cueSteps >= 6,
    `${cueSteps} steps of prompt (${(cueSteps / 120 / P.BURST_SCALE).toFixed(2)}s of real time ` +
    `at x${P.BURST_SCALE})`);
  check('and to take it', vaulted);
}

// 19. the burst stays cashable for a moment after you drop off top speed
{
  const sim = makeSim({ x: 151, y: 26 });
  sim.p.flow = 1;
  sim.run(60, ['right']);
  check('a full-bar sprint is cashable', sim.p.canBurst);

  sim.p.vx = 40;                               // clipped something, speed gone
  sim.run(1, ['right']);
  check('and still is right after losing the speed', sim.p.canBurst,
    `vx=${sim.p.vx.toFixed(0)} window=${sim.p.t.burstReady.toFixed(2)}s`);
  sim.run(50, []);                             // ... but not forever
  check('the window closes', !sim.p.canBurst, `window=${sim.p.t.burstReady.toFixed(2)}s`);

  const late = makeSim({ x: 151, y: 26 });     // and it really does fire in there
  late.p.flow = 1;
  late.run(60, ['right']);
  late.p.vx = 40;
  late.run(1, ['right', 'burst']);
  late.run(WIND, ['right']);           // (no further: any more and 980px/s is in the pit)
  check('a late press still spends it', late.p.bursting,
    `vx=${late.p.vx.toFixed(0)} from a standstill-ish 40`);

  const spent = makeSim({ x: 151, y: 26 });    // spending it must not leave a window open
  spent.p.flow = 1;
  spent.run(60, ['right']);
  spent.run(4, ['right', 'burst']);
  spent.p.flow = 0;
  spent.run(4, ['right']);
  check('an emptied bar cannot immediately re-burst', !spent.p.bursting && !spent.p.canBurst,
    `flow=${spent.p.flow.toFixed(2)} window=${spent.p.t.burstReady.toFixed(2)}s`);
}

// 20. hauling a sprint around plays the brace, facing the new way
{
  const sim = makeSim({ x: 151, y: 26 });
  sim.run(70, ['right']);
  const top = Math.abs(sim.p.vx);
  let skidSteps = 0, faced = 0, anim = false;
  sim.run(60, ['left'], (i, pl) => {
    if (pl.skidding) { skidSteps++; faced = pl.facing; if (pl.anim.name === 'skid') anim = true; }
  });
  check('turning at speed skids', skidSteps > 10 && top > 200,
    `${skidSteps} steps of skid from ${top.toFixed(0)} px/s`);
  check('and plays the skid animation', anim);
  check('facing the way you are turning to', faced === -1, `facing ${faced}`);
  check('it ends once you are going the new way', !sim.p.skidding && sim.p.vx < -100,
    `vx=${sim.p.vx.toFixed(0)} skid=${sim.p.skidding}`);

  const slow = makeSim({ x: 151, y: 26 });     // a gentle turn is just a turn
  slow.run(14, ['right']);
  let slowSkid = false;
  slow.run(40, ['left'], (i, pl) => { if (pl.skidding) slowSkid = true; });
  check('a slow turn does not', !slowSkid);

  const air = makeSim({ x: 151, y: 26 });      // nor does one in mid-air
  air.run(70, ['right']);
  air.run(6, ['right', 'jump']);
  let airSkid = false;
  air.run(30, ['left'], (i, pl) => { if (!pl.grounded && pl.skidding) airSkid = true; });
  check('and neither does turning in the air', !airSkid);
}

// 21. airtime is charged on top of the drop height: taking a real fall on your
//     feet strips most of the run, and a late roll still hands it all back.
function feetFirst(mode) {
  const sim = makeSim({ x: 243, y: 27.1 });    // the low spring platform, 7 tiles up
  sim.run(12);                                 // settle
  sim.p.vx = 300;
  sim.p.flow = 0.6;
  let before = 300, air = 0, cost = 0, landed = -1, after = 0;
  sim.run(150, () => (mode === 'late' && sim.p.t.refund > 0 ? ['right', 'vault'] : ['right']),
    (i, pl) => {
      if (pl.grounded && landed < 0 && pl.airTime === 0) before = Math.abs(pl.vx);
      air = Math.max(air, pl.airTime);
      if (air > 0.1 && pl.grounded && landed < 0) landed = i;
      if (landed > 0 && i === landed + 30) after = Math.abs(pl.vx);
      cost = Math.max(cost, pl.lostSpeed);
    });
  return { before, air, cost, after };
}
{
  const plain = feetFirst('none');
  const late = feetFirst('late');
  check('a long drop taken on your feet is expensive', plain.air > 0.3 && plain.cost > plain.before * 0.4,
    `${plain.air.toFixed(2)}s of air cost ${plain.cost.toFixed(0)} of ${plain.before.toFixed(0)} px/s`);
  check('and rolling out of it still hands the airtime back', late.after > plain.after * 1.1,
    `late ${late.after.toFixed(0)} vs plain ${plain.after.toFixed(0)} px/s`);

  const step = makeSim({ x: 65, y: 24 });      // a 1-tile step is still nearly free
  let stepCost = 0, stepIn = 0;
  step.run(150, ['right'], (i, pl) => {
    if (pl.grounded) stepIn = Math.max(stepIn, Math.abs(pl.vx));
    stepCost = Math.max(stepCost, pl.lostSpeed);
  });
  check('a single step down is still cheap', stepCost < stepIn * 0.12,
    `${stepCost.toFixed(0)} of ${stepIn.toFixed(0)} px/s`);
}

// 22. the dash has a floor under it: touching the ground does not hand it back
//     early, and mashing the key cannot beat the gap
{
  const sim = makeSim({ x: 232, y: 34.1 });     // flat lower floor, nothing in the way
  sim.run(30, ['right']);
  const marks = [];
  let was = false;
  sim.run(150, (i) => (i % 4 === 0 ? ['right', 'dash'] : ['right']),   // mashing
    (i, pl) => {
      if (pl.dashing !== was) { marks.push({ on: pl.dashing, t: i / 120 }); was = pl.dashing; }
    });
  const gap = marks.length >= 3 ? marks[2].t - marks[1].t : 0;
  check('a second dash cannot start inside the gap', gap >= P.DASH_GAP,
    `${(gap * 1000).toFixed(0)}ms between dashes (gap ${(P.DASH_GAP * 1000).toFixed(0)}ms)`);
  check('and a grounded dash never refills itself mid-dash', marks.length >= 3 && marks[1].t - marks[0].t < 0.2,
    `${marks.length} dash edges in 1.25s of mashing`);

  const buf = makeSim({ x: 232, y: 34.1 });     // a press just before it is up still lands
  buf.run(30);
  buf.run(1, ['dash']);
  buf.run(Math.round((P.DASH_TIME + P.DASH_GAP - P.DASH_BUFFER * 0.6) * 120));
  buf.run(1, ['dash']);
  let fired = false;
  buf.run(20, [], (i, pl) => { if (pl.dashing) fired = true; });
  check('an early press is held until the gap is up', fired);

  const crys = makeSim({ x: 232, y: 34.1 });    // a crystal is the one instant refill
  crys.run(30);
  crys.run(1, ['dash']);
  crys.run(Math.round(P.DASH_TIME * 120) + 2);
  crys.p.refillDash();
  crys.run(1, ['dash']);
  check('a crystal still chains straight into another dash', crys.p.dashing,
    `dashes=${crys.p.dashes} cool=${crys.p.t.dashCool.toFixed(2)}`);
}

// 23. a burst and a slide are not mutually exclusive: ducking inside a burst
//     keeps both, which is the only way to take the low rock at 980 px/s
{
  const sim = makeSim({ x: 198, y: 26 });       // the flat run-in to the tunnel
  sim.p.flow = 1;
  sim.run(60, ['right']);
  sim.run(1, ['right', 'burst']);
  sim.run(WIND, ['right']);
  const up = sim.p.bursting;
  sim.run(6, ['right', 'down']);
  check('ducking inside a burst keeps the burst', up && sim.p.bursting && sim.p.sliding,
    `bursting=${sim.p.bursting} sliding=${sim.p.sliding} h=${sim.p.h}`);
  check('and the burst still owns your speed', Math.abs(sim.p.vx) === P.BURST_SPEED,
    `${Math.abs(sim.p.vx).toFixed(0)} px/s`);

  let minH = 99, peak = 0, embeddedIn = 0;
  sim.run(200, ['right', 'down'], (i, pl) => {
    const tx = pl.cx / TILE;
    if (tx >= 210 && tx <= 224) {               // under the low rock
      minH = Math.min(minH, pl.h);
      peak = Math.max(peak, Math.abs(pl.vx));
      if (embedded(sim.level, pl)) embeddedIn++;
    }
  });
  check('the low rock can be taken at burst speed', minH <= P.SLIDE_H && peak > 900 && !embeddedIn,
    `h=${minH} peak=${peak.toFixed(0)} px/s, ${embeddedIn} embedded frames`);
  check('and it comes out the far side', sim.p.cx / TILE > 224, `tile ${(sim.p.cx / TILE).toFixed(0)}`);

  const out = makeSim({ x: 232, y: 34.1 });     // the other order: slide, then cash it
  out.p.flow = 1;
  out.run(60, ['right']);
  out.run(10, ['right', 'down']);
  const slid = out.p.sliding;
  out.run(1, ['right', 'down', 'burst']);
  out.run(WIND, ['right', 'down']);
  check('cashing a burst out of a slide keeps the slide', slid && out.p.bursting && out.p.sliding,
    `sliding=${out.p.sliding} h=${out.p.h}`);
  out.run(20, ['right']);
  check('and letting go of down stands you up without dropping it',
    out.p.bursting && !out.p.sliding && out.p.h === P.H,
    `bursting=${out.p.bursting} h=${out.p.h}`);
}

print(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
