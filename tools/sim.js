// sim.js — headless physics harness. Run with a bare JS engine, no DOM needed:
//   jsc --module-file=tools/sim.js
// (or `node tools/sim.js` where node is available)

import { buildTestArea } from '../src/levels/test-area.js';
import { Level, T, TILE } from '../src/level.js';
import { P } from '../src/player.js';
import { updateMechanics, resetMechanics, phaseState, M } from '../src/mechanics.js';
import { buildSpire } from '../src/levels/spire.js';
import { buildUndercroft } from '../src/levels/undercroft.js';
import { buildSkyline } from '../src/levels/skyline.js';
import { LEVELS, medalTimes } from '../src/levels/index.js';
import { makeSim, flatOut } from './harness.js';
import { ROUTES } from './routes.js';

export { makeSim };   // (fuzz.js used to import it from here)

// ---------------------------------------------------------------- checks
let failures = 0;
function check(name, ok, detail = '') {
  if (!ok) failures++;
  print(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}
const embedded = (level, p) => level.boxHitsWall(p.x, p.y, p.w, p.h);
// Springs live in mechanics.js and so fire in these sims too. The checks set
// up around section G's floors are not about springs, so they run without them.
const springless = () => { const L = buildTestArea(); L.springs.length = 0; return L; };

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
  check('and it is well past a sprint', Math.abs(sim.p.vx) > sprint * 1.5,
    `${sprint.toFixed(0)} -> ${Math.abs(sim.p.vx).toFixed(0)} px/s`);

  // a dash is the one thing that outruns a burst, and only inside one
  // (on open ground of its own: at 1000 px/s the test area runs out fast)
  let burstDash = 0, plainDash = 0;
  const open = makeSim({ x: 6, y: 19 }, new Level(200, 30).rect(0, 20, 200, 10));
  open.p.flow = 1;
  open.run(80, ['right']);
  open.run(1, ['right', 'burst']);
  open.run(WIND, ['right']);
  open.run(1, ['right', 'dash']);
  open.run(Math.ceil(P.DASH_TIME * 120) + 4, ['right'], (i, pl) => { if (pl.dashing) burstDash = Math.max(burstDash, Math.abs(pl.vx)); });
  const calm = makeSim({ x: 151, y: 26 });
  calm.run(30, ['right']);
  calm.run(1, ['right', 'dash']);
  calm.run(8, ['right'], (i, pl) => { if (pl.dashing) plainDash = Math.max(plainDash, Math.abs(pl.vx)); });
  check('a dash inside a burst outruns the burst', burstDash === P.BURST_DASH && P.BURST_DASH > P.BURST_SPEED,
    `${burstDash.toFixed(0)} px/s against a burst of ${P.BURST_SPEED}`);
  check('but a dash outside one is the same dash it always was', plainDash === P.DASH_SPEED,
    `${plainDash.toFixed(0)} px/s`);
  check('and the burst carries on after it', open.p.bursting && Math.abs(open.p.vx) === P.BURST_SPEED,
    `bursting=${open.p.bursting} at ${Math.abs(open.p.vx).toFixed(0)} px/s`);

  // the bar is the fuel gauge: it drains at a known rate and ends the burst at 0
  // (measured over a short window — no stretch of this level is long enough to
  //  run a whole burst out without hitting something, which is rather the point)
  const fuel = makeSim({ x: 230, y: 33 }, springless());
  fuel.p.flow = 1;
  fuel.run(60, ['right']);
  fuel.p.flow = 1;
  fuel.run(4, ['right', 'burst']);
  fuel.run(WIND, ['right']);
  const at0 = fuel.p.flow;
  fuel.run(30, ['right']);
  const drained = (at0 - fuel.p.flow) / 0.25;
  check('the bar drains while bursting', fuel.p.bursting && Math.abs(drained - P.BURST_DRAIN) < 0.08,
    `${drained.toFixed(2)} bar/s — a full bar is ${(1 / drained).toFixed(1)}s of burst`);
  fuel.p.flow = 0.002;
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
  late.run(WIND, ['right']);           // (no further: any more and burst speed is in the pit)
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
  const sim = makeSim({ x: 243, y: 27.1 }, springless());    // the low spring platform, 7 tiles up
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
  const sim = makeSim({ x: 232, y: 34.1 }, springless());     // flat lower floor, nothing in the way
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

  const buf = makeSim({ x: 232, y: 34.1 }, springless());     // a press just before it is up still lands
  buf.run(30);
  buf.run(1, ['dash']);
  buf.run(Math.round((P.DASH_TIME + P.DASH_GAP - P.DASH_BUFFER * 0.6) * 120));
  buf.run(1, ['dash']);
  let fired = false;
  buf.run(20, [], (i, pl) => { if (pl.dashing) fired = true; });
  check('an early press is held until the gap is up', fired);

  const crys = makeSim({ x: 232, y: 34.1 }, springless());    // a crystal is the one instant refill
  crys.run(30);
  crys.run(1, ['dash']);
  crys.run(Math.round(P.DASH_TIME * 120) + 2);
  crys.p.refillDash();
  crys.run(1, ['dash']);
  check('a crystal still chains straight into another dash', crys.p.dashing,
    `dashes=${crys.p.dashes} cool=${crys.p.t.dashCool.toFixed(2)}`);
}

// 23. a burst and a slide are not mutually exclusive: ducking inside a burst
//     keeps both, which is the only way to take the low rock at burst speed
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
  check('the low rock can be taken at burst speed', minH <= P.SLIDE_H && peak > P.BURST_SPEED - 50 && !embeddedIn,
    `h=${minH} peak=${peak.toFixed(0)} px/s, ${embeddedIn} embedded frames`);
  check('and it comes out the far side', sim.p.cx / TILE > 224, `tile ${(sim.p.cx / TILE).toFixed(0)}`);

  const out = makeSim({ x: 232, y: 34.1 }, springless());     // the other order: slide, then cash it
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

// 24. a wall never ends a burst. It is bought and paid for with a full bar, so
//     it costs you the ground and nothing else: pinned against rock it keeps
//     burning, and only the bar running dry puts it out.
{
  const ground = () => new Level(80, 30).rect(0, 20, 80, 10);
  // a one-tile ledge with a wall standing right behind it
  const pocket = (wallH) => ground().rect(40, 19, 3, 1).rect(43, 20 - wallH, 2, wallH);

  const burstAt = (level) => {
    const sim = makeSim({ x: 6, y: 19 }, level);
    sim.p.flow = 1;
    sim.run(80, ['right']);
    sim.run(1, ['right', 'burst']);
    sim.run(WIND, ['right']);
    return sim;
  };

  // head-on, no vault in it at all
  const head = burstAt(ground().rect(40, 12, 2, 8));
  const fuelIn = head.p.flow;
  let hitAt = 0;
  head.run(120, ['right'], (i, pl) => { if (!hitAt && pl.t.bump > 0) hitAt = i; });
  check('a burst run straight into a wall survives it', hitAt > 0 && head.p.bursting,
    `hit at step ${hitAt}, flow ${head.p.flow.toFixed(2)}`);
  // (a second of burning is all that should have gone; a wall's cut would be far more)
  check('and the wall does not take the fuel either',
    Math.abs(head.p.flow - (fuelIn - P.BURST_DRAIN)) < 0.05,
    `flow ${fuelIn.toFixed(2)} -> ${head.p.flow.toFixed(2)}`);

  // the same wall met halfway up a vault, which is a climb you cannot steer
  const dead = burstAt(pocket(8));              // too tall to jump: a real dead end
  let pinned = 0, flowIn = 0, burstIn = false;
  dead.run(200, () => (dead.p.cue ? ['right', 'vault'] : ['right']), (i, pl) => {
    if (!pinned && pl.vaults > 0 && pl.t.bump > 0) { pinned = i; flowIn = pl.flow; burstIn = pl.bursting; }
  });
  check('a vault into a wall keeps the burst, fuel and all',
    pinned > 0 && burstIn && flowIn > 0.6, `flow ${flowIn.toFixed(2)} on contact`);
  dead.run(Math.ceil(120 / P.BURST_DRAIN), ['right']);   // a whole bar's worth
  check('it is the bar, not the wall, that finally ends it',
    !dead.p.bursting && dead.p.flow < 0.02, `flow ${dead.p.flow.toFixed(2)}`);

  // ... and a wall you can get over hands the whole burst back. (At burst speed
  //  the vault usually chains straight over a wall this short; if it pins you
  //  instead, the jump has to get you out. Either way you come out bursting.)
  const out = burstAt(pocket(2));
  let jumpAt = 0, cleared = null;
  out.run(300, (i) => {
    const k = ['right'];
    if (out.p.cue) k.push('vault');
    if (!jumpAt && out.p.vaults > 0 && out.p.t.bump > 0) jumpAt = i;
    if (jumpAt && i >= jumpAt + 2 && i <= jumpAt + 4) k.push('jump');
    return k;
  }, (i, pl) => {
    if (!cleared && pl.cx / TILE > 46) cleared = { on: pl.bursting, vx: Math.abs(pl.vx) };
  });
  check('getting out of the pocket picks the speed straight back up',
    cleared && cleared.on && cleared.vx > P.BURST_SPEED - 50,
    cleared ? `bursting=${cleared.on} at ${cleared.vx.toFixed(0)} px/s past the wall`
            : `never cleared the wall (pinned at step ${jumpAt})`);

  // ... but a wall is not a ladder. The burst pins you against it every step,
  // so a wall jump that kept the burst put you straight back on the wall for
  // another: mashing jump climbed forever, and each kick's flow kept it fuelled.
  const climb = burstAt(ground().rect(40, 0, 2, 20));
  const floorY = climb.p.footY;
  let peakY = floorY, kicked = false;
  climb.run(400, (i) => (i % 12 < 2 ? ['right', 'jump'] : ['right']), (i, pl) => {
    peakY = Math.min(peakY, pl.footY);
    if (pl.t.wallLock > 0) kicked = true;
  });
  check('a wall jump spends the burst, so a wall cannot be climbed on one',
    kicked && !climb.p.bursting && (floorY - peakY) / TILE < 5,
    `rose ${((floorY - peakY) / TILE).toFixed(1)} tiles, bursting=${climb.p.bursting}`);
}

// 25. the bar holds more than one bar: the overfill is a top gear on the run
//     and burst fuel at once, and a burst cashed off a topped-up bar runs
//     proportionally longer. (On a flat
//     plain of its own — no stretch of the test area is long enough to run a
//     full tank out without meeting something.)
{
  const plain = () => new Level(400, 30).rect(0, 20, 400, 10);

  const sim = makeSim({ x: 6, y: 19 }, plain());
  sim.run(600, ['right']);
  check('flow fills past a bar on running alone', sim.p.flow > 1,
    `flow ${sim.p.flow.toFixed(2)} of ${P.FLOW_MAX}`);
  check('and stops at the cap', sim.p.flow <= P.FLOW_MAX + 1e-6, `flow ${sim.p.flow.toFixed(2)}`);
  const gear = P.RUN_BASE + P.RUN_FLOW + P.RUN_OVER;
  check('and holding top speed tops the run up past a sprint, into top gear',
    Math.abs(sim.p.topSpeed - gear) < 0.001 && Math.abs(sim.p.vx) > gear - 10 && Math.abs(sim.p.vx) < gear + 10,
    `top ${Math.round(sim.p.topSpeed)} px/s at ${Math.abs(sim.p.vx).toFixed(0)} (a bar alone is ${P.RUN_BASE + P.RUN_FLOW})`);

  // a full tank is FLOW_MAX / BURST_DRAIN of burst
  const burn = (flow) => {
    const t = makeSim({ x: 6, y: 19 }, plain());
    t.p.flow = flow;
    t.run(200, ['right'], () => { t.p.flow = flow; });   // held there while it winds up
    t.run(1, ['right', 'burst']);
    t.run(WIND, ['right']);
    let steps = 0;
    t.run(1200, ['right'], (i, pl) => { if (pl.bursting) steps++; });
    return steps / 120;
  };
  const full = burn(P.FLOW_MAX);
  const bar = burn(1);
  check('a topped-up bar is a longer burst',
    Math.abs(full - P.FLOW_MAX / P.BURST_DRAIN) < 0.2 && full > bar * 1.4,
    `${full.toFixed(2)}s on a full tank vs ${bar.toFixed(2)}s on one bar`);
}

// 25b. your dash only comes back on the ground (or from a crystal or a
//      spring): sliding down a wall no longer hands it back
{
  const shaft = new Level(40, 40).rect(0, 30, 40, 10).rect(20, 0, 2, 30);
  const sim = makeSim({ x: 14, y: 20 }, shaft);         // in the air beside a wall
  sim.run(1, ['right', 'dash']);
  let onWall = 0, back = false;
  sim.run(200, ['right'], (i, pl) => {
    if (pl.wallDir !== 0) onWall++;
    if (!pl.grounded && pl.dashes > 0) back = true;
  });
  check('a wall does not hand your dash back', onWall > 10 && !back, `${onWall} steps on the wall, dash back in the air: ${back}`);
  check('but the ground does', sim.p.grounded && sim.p.dashes === sim.p.maxDashes);
}

// 25c. momentum: a long fall from a jump costs speed on landing unless you
//      roll out of it, and jumps grow with speed faster than speed does
{
  // off a tall step: run, jump at the lip, and come down nine tiles lower
  const drop = () => new Level(200, 50).rect(0, 20, 30, 30).rect(30, 29, 170, 21);
  const land = (roll) => {
    const sim = makeSim({ x: 10, y: 19 }, drop());
    sim.p.flow = 1;
    let jumped = false, landed = -1, before = 0, low = Infinity, flow = 0;
    sim.run(420, (i) => {
      const k = ['right'];
      if (!jumped && sim.p.cx / TILE > 29) jumped = true;
      if (jumped && landed < 0 && (sim.p.grounded || sim.p.vy < 0)) k.push('jump');   // a full jump
      // the roll: C held into the landing and through the moment after it
      if (roll && ((!sim.p.grounded && sim.p.vy > 300) || sim.p.t.refund > 0)) k.push('vault');
      return k;
    }, (i, pl) => {
      if (jumped && landed < 0 && !pl.grounded) before = Math.abs(pl.vx);
      if (jumped && landed < 0 && pl.grounded && pl.cx / TILE > 31) landed = i;
      if (landed >= 0 && i <= landed + 3) low = Math.min(low, Math.abs(pl.vx));
      if (landed >= 0 && i === landed + 30) flow = pl.flow;
    });
    return { before, low, flow };
  };
  // (held right wins raw speed back in a moment either way; what lasts is the
  //  bar, and with it top gear)
  const feet = land(false), rolled = land(true);
  check('a long fall from a jump costs speed and flow landed on your feet', feet.low < feet.before * 0.75,
    `${feet.before.toFixed(0)} -> ${feet.low.toFixed(0)} px/s on touchdown, bar ${feet.flow.toFixed(2)} after`);
  check('and rolling out of it keeps them', rolled.low > rolled.before * 0.95 && rolled.flow > feet.flow + 0.2,
    `${rolled.before.toFixed(0)} -> ${rolled.low.toFixed(0)} px/s rolled, bar ${rolled.flow.toFixed(2)} (on your feet ${feet.flow.toFixed(2)})`);

  const leap = (vx, flow) => {
    const sim = makeSim({ x: 10, y: 19 }, new Level(400, 30).rect(0, 20, 400, 10));
    sim.run(5, []);
    sim.p.vx = vx; sim.p.flow = flow;
    const x0 = sim.p.x;
    let land = 0;
    sim.run(300, (i) => (i === 0 ? ['right', 'jump'] : ['right', 'jump']), (i, pl) => { pl.flow = flow; if (!land && i > 3 && pl.grounded) land = pl.x; });
    return (land - x0) / TILE;
  };
  const slow = leap(190, 0), fast = leap(410, 1.6);
  check('a jump at top gear carries much further than its speed alone would', fast / slow > (410 / 190) * 1.05,
    `${slow.toFixed(1)} tiles at 190 px/s, ${fast.toFixed(1)} at 410 (speed ratio ${(410 / 190).toFixed(2)}, distance ratio ${(fast / slow).toFixed(2)})`);
}

// 26. crumbling blocks: stand on one and it goes from under you a beat later;
//     it grows back on its own, but never into the player
{
  const lvl = new Level(40, 30).rect(0, 20, 40, 10).rect(10, 20, 6, 10, T.EMPTY).crumble(12, 16, 2);
  const sim = makeSim({ x: 12.2, y: 14 }, lvl);
  let landedAt = -1, goneAt = -1;
  sim.run(200, [], (i, pl) => {
    if (landedAt < 0 && pl.grounded) landedAt = i;
    if (goneAt < 0 && sim.level.get(12, 16) === T.EMPTY) goneAt = i;
  });
  const beat = (goneAt - landedAt) / 120;
  check('a crumbling block gives way a beat after you land on it',
    landedAt >= 0 && Math.abs(beat - M.CRUMBLE_DELAY) < 0.03 && sim.p.footY > 17 * TILE,
    `gone ${beat.toFixed(2)}s after landing, foot at row ${(sim.p.footY / TILE).toFixed(1)}`);

  // grows back after CRUMBLE_BACK ... unless you are standing in its cell
  const c = sim.level.crumbles[0];
  sim.p.reset(12 * TILE + 3, 16 * TILE + 1);       // inside the empty cell
  sim.p.vy = 0;
  const p = sim.p;
  for (let i = 0; i < 400; i++) { p.x = 12 * TILE + 3; p.y = 16 * TILE + 1; p.vy = 0; updateMechanics(sim.level, p, 1 / 120); }
  check('and never grows back into the player', c.state === 'gone' && sim.level.get(12, 16) === T.EMPTY, c.state);
  p.x = 30 * TILE;
  updateMechanics(sim.level, p, 1 / 120);
  check('it grows back once you are clear', c.state === 'idle' && sim.level.get(12, 16) === T.CRUMBLE, c.state);

  sim.level.crumbles[1].state = 'gone'; sim.level.set(13, 16, T.EMPTY);
  resetMechanics(sim.level);
  check('a respawn puts every crumbled block back', sim.level.get(13, 16) === T.CRUMBLE);
}

// 27. phase blocks: the two sets swap every PHASE_HALF, and a block whose turn
//     comes round while you stand in its cell waits for you to leave
{
  const lvl = new Level(40, 30).rect(0, 20, 40, 10).phase(10, 16, 2, 1, 0).phase(20, 16, 2, 1, 1);
  const sim = makeSim({ x: 30, y: 19 }, lvl);
  const solid = () => [sim.level.get(10, 16) === T.PHASE, sim.level.get(20, 16) === T.PHASE];
  const before = solid();
  sim.run(Math.ceil(M.PHASE_HALF * 120) + 1, []);
  const after = solid();
  check('phase blocks take turns', before[0] && !before[1] && !after[0] && after[1],
    `before ${before} after ${after} (active ${phaseState(sim.level).active})`);

  // park the player inside one of set 0's cells (the box fits inside column
  // 10, so its neighbour in column 11 is free to come back on time)
  const p = sim.p;
  for (let i = 0; i < Math.ceil(M.PHASE_HALF * 120) + 4; i++) {
    p.x = 10 * TILE + 3; p.y = 16 * TILE + 1;
    updateMechanics(sim.level, p, 1 / 120);
  }
  check('a phase block never appears around the player',
    phaseState(sim.level).active === 0 && sim.level.get(10, 16) === T.EMPTY && sim.level.get(11, 16) === T.PHASE);
  p.x = 30 * TILE;
  updateMechanics(sim.level, p, 1 / 120);
  check('it appears as soon as you are out of it', sim.level.get(10, 16) === T.PHASE);
}

// 28. boost pads raise you to BOOST_SPEED in their direction, never slow a
//     faster run down, and fire their own way whichever way you meet them
{
  const lvl = () => new Level(80, 30).rect(0, 20, 80, 10).boost(20, 20, 3, +1);
  const slow = makeSim({ x: 14, y: 19 }, lvl());
  let peak = 0;
  slow.run(80, ['right'], (i, pl) => { peak = Math.max(peak, pl.vx); });
  check('a boost pad throws you forward', Math.abs(peak - M.BOOST_SPEED) < 1, `peak ${peak.toFixed(0)} px/s`);

  const fast = makeSim({ x: 14, y: 19 }, lvl());
  fast.run(2, []);
  let low = Infinity;
  fast.run(40, ['right'], (i, pl) => { if (i === 0) pl.vx = 700; if (pl.cx / TILE > 20 && pl.cx / TILE < 23) low = Math.min(low, pl.vx); });
  check('but never slows a faster run', low > M.BOOST_SPEED, `${low.toFixed(0)} px/s over the pad`);

  // a dash off a pad keeps the pad's speed: it used to hand off at DASH_END
  // and so dashing off a boost slowed you down
  const off = makeSim({ x: 14, y: 19 }, lvl());
  let left = 0, dashed = false;
  off.run(150, (i) => (off.p.cx / TILE > 23.5 && off.p.cx / TILE < 25 && !dashed && i % 2 ? ['right', 'dash'] : ['right']),
    (i, pl) => { if (pl.dashing) dashed = true; if (pl.cx / TILE > 32 && !left) left = Math.abs(pl.vx); });
  check('a dash off a boost pad hands back the pad\'s speed, not less', dashed && left > P.DASH_END + 100,
    `${left.toFixed(0)} px/s after the dash (hand-off floor ${P.DASH_END})`);

  const back = makeSim({ x: 26, y: 19 }, lvl());
  let thrown = 0;
  back.run(60, ['left'], (i, pl) => { thrown = Math.max(thrown, pl.vx); });
  check('and fires its own way even when you run onto it backwards', Math.abs(thrown - M.BOOST_SPEED) < 1,
    `thrown back at ${thrown.toFixed(0)} px/s`);
}

// 29. every level hangs together (flags on rock, spawn in the open, a goal),
//     and the spire's boost pit cannot be cleared without the pad in front of it
{
  for (const lv of LEVELS) {
    const L = lv.build();
    const flagsOk = L.checkpoints.every((c) => L.blocking(Math.floor(c.x / TILE), c.y / TILE) &&
                                                !L.blocking(Math.floor(c.x / TILE), c.y / TILE - 1));
    const spawnOk = !L.boxHitsWall(L.spawn.x, L.spawn.y, P.W, P.H);
    const m = lv.par ? medalTimes(lv).map((t) => t.time) : [];
    check(`${lv.name}: has a par time, and gold beats silver beats bronze beats it`,
      m.length === 3 && m[0] < m[1] && m[1] < m[2] && m[2] < lv.par, `par ${lv.par}, medals ${m.join(' / ')}`);
    check(`${lv.name}: every flag stands on rock with room above it, the spawn is in open air, there is a goal`,
      flagsOk && spawnOk && !!L.goal, `flags ${flagsOk}, spawn ${spawnOk}, goal ${!!L.goal}`);
  }

  const leap = (fromTile, padOn) => {
    const lvl = buildSpire();
    if (!padOn) lvl.boosts.length = 0;
    const sim = makeSim({ x: fromTile, y: 33 }, lvl);
    sim.p.flow = 1;
    sim.run(200, (i) => (sim.p.cx / TILE > 106.6 && sim.p.cx / TILE < 114 ? ['right', 'jump'] : ['right']),
      (i, pl) => { if (i < 3) pl.vx = 330; pl.flow = Math.min(pl.flow, 1); });   // a sprint, no top gear
    return !sim.p.dead && sim.p.cx / TILE > 123;
  };
  // (top gear carries it without the pad, and that is the point of top gear)
  check('the boost pit is a pad jump: a plain sprint alone falls short', leap(97, true) && !leap(97, false),
    `with pad ${leap(97, true)}, without ${leap(97, false)}`);
}

// 30. a vault at speed is a quick vault: the climb is over before the stride
//     reaches the face, so it never slides up through the corner of the rock,
//     and a burst up a staircase never meets the next step mid-vault and stalls
{
  const climb = (burst) => {
    const sim = makeSim({ x: 36, y: 29 });        // the run-in to the five steps up
    sim.p.flow = 1;
    sim.run(30, ['right']);
    if (burst) { sim.run(1, ['right', 'burst']); sim.run(WIND, ['right']); }
    let fresh = false, clip = 0, slowest = Infinity, vaults = null;
    sim.run(300, () => {
      const k = ['right'];
      if (sim.p.cue && !fresh) k.push('vault');    // one tap per prompt, like a player
      fresh = !!sim.p.cue;
      return k;
    }, (i, pl) => {
      const x = pl.cx / TILE;
      if (x > 59 && vaults === null) vaults = pl.vaults;     // the five steps up, not the rolls after
      if (x < 44 || x > 59) return;
      slowest = Math.min(slowest, Math.abs(pl.vx));
      if (pl.vault && embedded(sim.level, pl)) clip++;
    });
    return { vaults, clip, slowest };
  };
  const b = climb(true);
  check('a burst runs the staircase without stalling on a step', b.vaults === 5 && b.slowest >= P.BURST_SPEED - 30,
    `${b.vaults} vaults, slowest ${b.slowest.toFixed(0)} px/s`);
  check('and never climbs through the rock it is vaulting', b.clip === 0, `${b.clip} steps inside rock`);
  const r = climb(false);
  check('nor does a sprint', r.vaults === 5 && r.clip === 0, `${r.vaults} vaults, ${r.clip} steps inside rock`);

  // the tallest lip there is, at a sprint: this one used to clip at any speed
  const tall = makeSim({ x: 6, y: 19 }, new Level(80, 30).rect(0, 20, 80, 10).rect(30, 18, 40, 2));
  tall.p.flow = 1;
  let inside = 0, fresh = false;
  tall.run(200, () => { const k = ['right']; if (tall.p.cue && !fresh) k.push('vault'); fresh = !!tall.p.cue; return k; },
    (i, pl) => { if (pl.vault && embedded(tall.level, pl)) inside++; });
  check('a two-tile vault at a sprint stays out of the rock', tall.p.vaults === 1 && inside === 0,
    `${tall.p.vaults} vaults, ${inside} steps inside rock`);
}

// 31. a roll down a ramp tumbles down it: the edge scanner offers a roll at
//     the top of a slope, and that roll used to switch the snap off and send
//     you sailing clear of the ramp. Off a real ledge it must still let go.
{
  // run the stretch [x0, x1) calling rolls one of three ways; count the steps
  // spent in the air, and how far above the ground they got
  const tumble = (level, at, x0, x1, how, burst = false) => {
    const sim = makeSim(at, level);
    sim.p.flow = 1;
    if (burst) { sim.run(30, ['right']); sim.run(1, ['right', 'burst']); sim.run(WIND, ['right']); }
    let air = 0, high = 0, fresh = false;
    sim.run(600, () => {
      const k = ['right'];
      if (how === 'hold') k.push('vault');
      if (how === 'tap' && sim.p.cue && !fresh) k.push('vault');
      fresh = !!sim.p.cue;
      return k;
    }, (i, pl) => {
      const x = pl.cx / TILE;
      if (x < x0 || x >= x1 || pl.vault) return;
      if (!pl.grounded) air++;
      const surf = sim.level.floorUnder(pl.x + 1, pl.x + pl.w - 1, pl.footY - 1, pl.footY + 64);
      if (surf !== null) high = Math.max(high, surf - pl.footY);
    });
    return { air, high, rolls: sim.p.vaults };
  };
  for (const how of ['tap', 'hold']) {
    const r = tumble(buildTestArea(), { x: 90, y: 21 }, 98.5, 112, how);
    check(`a roll down the test area's ramp stays on it (${how})`, r.rolls > 0 && r.air === 0,
      `${r.rolls} rolls, ${r.air} steps airborne, up to ${r.high.toFixed(0)}px above the slope`);
  }
  const b = tumble(buildSpire(), { x: 243.5, y: 7.9 }, 250.5, 280, 'hold', true);
  check('and so does one in a burst down the spire\'s long ramp', b.rolls > 0 && b.air === 0,
    `${b.rolls} rolls, ${b.air} steps airborne, up to ${b.high.toFixed(0)}px above the slope`);

  // the five steps down are real ledges: a held roll still drops off each one
  const steps = tumble(buildTestArea(), { x: 58, y: 24 }, 64, 80, 'hold');
  check('but a roll off a real ledge still leaves the ground', steps.rolls >= 4 && steps.air > 0,
    `${steps.rolls} rolls, ${steps.air} steps airborne`);
}

// 32. the course levels are meant to be run, not waited through: a bot that
//     holds right, taps C at each prompt, jumps where the ground runs out and
//     ducks into the tunnels gets from the start (and from every flag, bar
//     empty) to the goal without dying and all but without stopping, however
//     the phase blocks happen to be timed when it arrives. Where a level asks
//     for more than that it is told so, in zones: `hop` (a jump let go after
//     that many steps, for under the fangs), `dash` (directions, pressed
//     again and again until a dash starts; `vy` waits for the top of a jump).
//     Wall-jump shafts are climbed. And every zone has to earn its place:
//     without it, the run must fail.
{
  // the routes (flags, tunnels, zones) live in routes.js, shared with route.js
  const courses = LEVELS.filter((lv) => ROUTES[lv.id])
    .map((lv) => [lv.name, lv.build, ROUTES[lv.id].starts, ROUTES[lv.id]]);
  for (const [name, build, starts, route] of courses) {
    const runs = [];
    for (const from of starts)
      for (const phaseT of [0, 0.9, 1.8]) runs.push({ from: from.x, phaseT, ...flatOut(build, from, phaseT, route) });
    const bad = runs.filter((r) => !r.reached || r.stopped > 0.5);
    // crystal chains are the skyline's own trick: everywhere else a crystal is
    // a spare, so every other course is finished without the bot dashing once
    if (name !== 'skyline') {
      check(`${name}: finished without a single dash (crystals are only a spare here)`,
        !(route.zones ?? []).some((z) => z.dash) && bad.length === 0);
    }
    check(`${name} runs flat out from the start and from every flag`, bad.length === 0,
      bad.length ? bad.map((r) => `from ${r.from} @${r.phaseT}: ${r.reached ? `stopped ${r.stopped.toFixed(2)}s` : `stuck at tile ${r.at}`}`).join('; ')
                 : `${runs.length} runs, longest stop ${Math.max(...runs.map((r) => r.stopped)).toFixed(2)}s`);
    // each special move is needed: drop it and the run from the flag before it
    // fails. Dash zones that run on one into the next are one move (a chain,
    // or a dash with a second one to fall back on) and are dropped together.
    const zones = route.zones ?? [];
    const moves = [];
    zones.forEach((z, zi) => {
      const last = moves[moves.length - 1];
      if (z.dash && last && zones[last[last.length - 1]].dash && zones[last[last.length - 1]].at[1] === z.at[0]) last.push(zi);
      else moves.push([zi]);
    });
    for (const move of moves) {
      const z = zones[move[0]];
      const from = [...starts].reverse().find((f) => f.x < z.at[0]);
      const r = flatOut(build, from, 0, { ...route, zones: zones.filter((_, j) => !move.includes(j)) });
      check(`${name}: the ${z.hop ? 'hop' : move.length > 1 ? 'dashes' : 'dash'} at tile ${z.at[0]} ${move.length > 1 ? 'are' : 'is'} needed`,
        !r.reached, `without: ${r.reached ? 'still made it' : `stopped at tile ${r.at}`}`);
      // a crystal chain marked `exact` needs every link: one dash short fails
      if (move.length > 1 && zones[move[0]].exact) {
        const short = flatOut(build, from, 0, { ...route, zones: zones.filter((_, j) => j !== move[move.length - 1]) });
        check(`${name}: the crystal chain at tile ${z.at[0]} needs all ${move.length} dashes`, !short.reached,
          `one short: ${short.reached ? 'still made it' : `stopped at tile ${short.at}`}`);
      }
    }
    // `topGear` (one or a list): held to a plain sprint, one bar and no
    // overfill, from that flag on, the bot falls short. Speed is the only way.
    for (const { from, after } of [].concat(route.topGear ?? [])) {
      const full = flatOut(build, from, 0, route);
      const sprint = flatOut(build, from, 0, { ...route, flowCap: [after, 1] });
      check(`${name}: the stretch from tile ${after} takes top gear, not just a sprint`, full.reached && !sprint.reached,
        `in top gear: ${full.reached ? 'made it' : `stopped at ${full.at}`}; on a sprint: ${sprint.reached ? 'still made it' : `stopped at ${sprint.at}`}`);
    }
    // `rolls` (one or a list): never rolling out of a landing from that flag
    // on, the bot falls short. Every hard landing taken on your feet costs
    // speed the next gap does not forgive.
    for (const { from } of [].concat(route.rolls ?? [])) {
      const stiff = flatOut(build, from, 0, { ...route, roll: false });
      check(`${name}: from the flag at tile ${from.x}, the landings have to be rolled`, !stiff.reached,
        `on its feet: ${stiff.reached ? 'still made it' : `stopped at ${stiff.at}`}`);
    }
  }
}

// 33. the spire's phase pit is spiked, and taken in one go: the pad in front
//     of it fires everyone at one speed and restarts the phase clock, so a
//     full jump off each edge lands on a block that is there, whenever you
//     arrived. Without the restart, plenty of arrival times would die.
{
  const cross = (phaseT, synced) => {
    const lvl = buildSpire();
    if (!synced) for (const b of lvl.boosts) b.sync = null;
    const sim = makeSim({ x: 138, y: 32.9 }, lvl);        // the flag, bar empty
    sim.level.phaseT = phaseT;
    let hold = 0;
    sim.run(600, () => {
      const p = sim.p;
      const k = ['right'];
      if (hold > 0) { hold--; if (p.vy < 0 || hold > 32) k.push('jump'); }
      const ahead = p.x + p.w + Math.max(6, Math.abs(p.vx) * 0.04);
      if (p.grounded && hold === 0 && sim.level.floorUnder(ahead, ahead + 2, p.footY - 1, p.footY + 40) === null) {
        k.push('jump'); hold = 40;
      }
      return k;
    });
    return !sim.p.dead && sim.p.cx / TILE > 197;
  };
  const times = Array.from({ length: 14 }, (_, i) => i * 0.2);
  const made = times.filter((t) => cross(t, true)).length;
  const blind = times.filter((t) => cross(t, false)).length;
  check('the phase pit is crossed in one go whenever you arrive', made === times.length,
    `${made}/${times.length} arrival times`);
  check('and that is the pad\'s doing: without its clock restart, arrivals die', blind < times.length,
    `${blind}/${times.length} would make it unsynced`);
  const L = buildSpire();
  let spiked = true;
  for (let x = 148; x < 196; x++) if (L.get(x, 37) !== T.SPIKE_UP) spiked = false;
  check('and the pit under it is spiked all the way across', spiked);
}

// 34. the end of every level is an invisible wall: run at it flat out and you
//     stop at the edge, alive. Opened for the walk-off after the goal, the
//     same run carries on past the edge, off screen, on ground that is still
//     there, and nobody dies doing it.
{
  const bad = [];
  for (const lv of LEVELS) {
    const L = lv.build();
    let top = 0;                                // the surface of the last column
    while (top < L.h && !L.blocking(L.w - 1, top)) top++;
    const sim = makeSim({ x: L.w - 12, y: top - 1.1 }, L);
    let furthest = 0;
    sim.run(240, ['right'], (i, p) => { furthest = Math.max(furthest, p.x + p.w); });
    // (within the pixel any wall allows: boxHitsWall rounds the box to whole pixels)
    if (furthest >= L.w * TILE + 1 || sim.p.dead) bad.push(`${lv.id}: closed, reached ${(furthest / TILE).toFixed(2)}${sim.p.dead ? ' and died' : ''}`);
    L.exitOpen = true;
    sim.run(240, ['right']);
    if (sim.p.dead || sim.p.x < L.w * TILE + 32 || !sim.p.grounded) bad.push(`${lv.id}: open, ended at ${(sim.p.x / TILE).toFixed(1)} dead=${sim.p.dead}`);
  }
  check('every level ends in an invisible wall, and the walk-off goes through it', bad.length === 0,
    bad.length ? bad.join('; ') : `${LEVELS.length} levels`);
}

print(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
