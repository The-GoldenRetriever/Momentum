// invariants.js — random input from all over every level (the tops of rock,
// water and ice), asserting on every step what should never happen, where
// fuzz.js only asks that the player is never buried in rock:
//   jsc -m tools/invariants.js
// It found the glitches the scripted checks could not see: wading through a
// reef's spikes, a glide pose that outlived the glide, and vaults and rolls
// paying out a dash's speed, or paying it out backwards.
import { makeSim } from './harness.js';
import { TILE, T } from '../src/level.js';
import { LEVELS } from '../src/levels/index.js';
import { updateMechanics } from '../src/mechanics.js';
import { P } from '../src/player.js';

const ACTIONS = ['left', 'right', 'up', 'down', 'jump', 'dash', 'vault', 'burst'];
let rng = 1;
const rand = () => ((rng = (rng * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const bad = new Map();
const flag = (k, where) => { if (!bad.has(k)) bad.set(k, where); };
let sinks = 0, pulls = 0, glides = 0;

for (const lv of LEVELS) {
  const L0 = lv.build();
  const spots = [];
  for (let x = 0; x < L0.w; x++) for (let y = 1; y < L0.h; y++) {
    if (L0.waterTop(x, y) || (L0.blocking(x, y) && !L0.blocking(x, y - 1))) { spots.push([x, y]); break; }
  }
  for (let seed = 0; seed < 250; seed++) {
    rng = seed * 7919 + lv.id.length;
    const sim = makeSim({ x: 4, y: 24 }, lv.build());
    const [sx, sy] = spots[Math.floor(rand() * spots.length)];
    sim.p.reset(sx * TILE, (sy - 1 - Math.floor(rand() * 12)) * TILE - P.H);
    if (sim.level.boxHitsWall(sim.p.x, sim.p.y, sim.p.w, sim.p.h)) continue;
    sim.p.vx = (rand() * 2 - 1) * 450;
    sim.p.flow = rand() * 1.6;
    let held = [], dry = 0, sunkFor = 0, spiky = 0, pullFor = 0, wet = 0, wasS = false, wasPull = false;
    for (let i = 0; i < 1500; i++) {
      if (i % 10 === 0) { held = ACTIONS.filter(() => rand() < 0.3); if (rand() < 0.5) held.push('right'); }
      if (i % 90 === 0) sim.p.flow = Math.max(sim.p.flow, 1.2);   // (bursts, and the water, want a bar)
      sim.keys.set(held);
      sim.p.update(1 / 120, sim.keys);
      updateMechanics(sim.level, sim.p, 1 / 120);
      sim.keys.step();
      const p = sim.p, L = sim.level;
      const where = `${lv.id} seed ${seed} step ${i} tile ${(p.cx / TILE).toFixed(1)},${(p.footY / TILE).toFixed(1)}`;
      if ([p.x, p.y, p.vx, p.vy].some((v) => !Number.isFinite(v))) flag('position or speed is not a number', where);
      if (p.sinking && !wasS) sinks++;
      if (p.vault?.pull && !wasPull) pulls++;
      if (p.anim.name === 'glide') glides++;
      wasS = p.sinking; wasPull = !!p.vault?.pull;
      if (p.dead) break;
      const nearWater = L.boxInWater(p.x - 2, p.y - 2, p.w + 4, p.h + 4) ||
        [0, 1, 2].some((d) => L.get(Math.floor(p.cx / TILE), Math.floor(p.footY / TILE) + d) === T.WATER);
      dry = p.sinking && !nearWater ? dry + 1 : 0;
      if (dry > 10) flag('sinking out of the water', where);
      sunkFor = p.sinking ? sunkFor + 1 : 0;
      if (sunkFor > 480) flag('sinking for ever', where);
      if (p.struggle > P.STRUGGLE_TIME + 0.05) flag('struggling for ever', where);
      if (p.sinking && p.grounded) flag('grounded while wading', where);
      spiky = L.boxHitsSpikes(p.x, p.y, p.w, p.h) ? spiky + 1 : 0;
      if (spiky > 2) flag(`alive in spikes${p.sinking ? ' (wading)' : ''}`, where);
      if (p.anim.name === 'glide' && (!p.grounded || p.bursting)) flag('glide pose off the ice, or in a burst', where);
      pullFor = p.vault?.pull ? pullFor + 1 : 0;
      if (pullFor > 120) flag('pull-out stuck', where);
      wet = !p.sinking && !p.vault && L.boxInWater(p.x, p.y, p.w, p.h) ? wet + 1 : 0;
      if (wet > 3) flag('under the water and not sinking', where);
      if (!p.vault && L.boxHitsWall(p.x, p.y, p.w, p.h)) flag(`embedded${p.sinking ? ' (wading)' : ''}`, where);
      // Past a burst and a slope roll (560, 530) only a dash, or a burst, goes faster.
      if (Math.abs(p.vx) > 600 && !p.dashing && !p.bursting) flag(`runaway speed (${Math.abs(p.vx).toFixed(0)} px/s)`, where);
    }
  }
}
print(`coverage: ${sinks} times into the water, ${pulls} pull-outs, ${glides} steps gliding`);
for (const [k, v] of bad) print(`BROKEN ${k}: ${v}`);
print(bad.size ? `\n${bad.size} INVARIANT(S) BROKEN` : '\nno invariant broken');
