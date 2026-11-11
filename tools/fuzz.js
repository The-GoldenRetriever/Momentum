// fuzz.js — hammer every level with random input and assert the player is
// never left buried in the rock. jsc --module-file=tools/fuzz.js
import { makeSim } from './harness.js';
import { TILE } from '../src/level.js';
import { LEVELS } from '../src/levels/index.js';
import { updateMechanics } from '../src/mechanics.js';

const ACTIONS = ['left', 'right', 'up', 'down', 'jump', 'dash', 'vault'];
let rng = 12345;
const rand = () => ((rng = (rng * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

for (const lv of LEVELS) {
  let stuck = 0, deaths = 0, best = 0, bursts = 0;
  for (let seed = 0; seed < 90; seed++) {
    rng = seed * 7919 + 17;
    const sim = makeSim({ x: 4, y: 24 }, lv.build());
    const startTile = 4 + Math.floor(rand() * (sim.level.w - 12));
    // Spread the starts over the level's whole height too: the spire's later
    // sections sit well above the ground row the test area keeps to.
    const startRow = 3 + Math.floor(rand() * (sim.level.h - 12));
    sim.p.reset(startTile * TILE, startRow * TILE);
    // only fuzz from spawns that are actually in open air
    if (sim.level.boxHitsWall(sim.p.x, sim.p.y, sim.p.w, sim.p.h)) continue;
    let held = ['right'];
    for (let i = 0; i < 2400; i++) {
      if (i % 12 === 0) {
        held = ACTIONS.filter(() => rand() < 0.35);
        if (rand() < 0.6) held.push('right');
      }
      // Force a burst in now and then: burst speed is where tunnelling would show up
      // if it ever could, and random input almost never fills the bar by itself.
      const keys = [...held];
      if (i % 120 === 0) {
        sim.p.flow = 1;
        if (Math.abs(sim.p.vx) > 280) keys.push('burst');
      }
      sim.keys.set(keys);
      sim.p.update(1 / 120, sim.keys);
      updateMechanics(sim.level, sim.p, 1 / 120);
      sim.keys.step();
      if (sim.p.dead) { deaths++; break; }
      // a vault is scripted movement: it is allowed to cut the corner of the lip
      // it is climbing. What matters is that it never *leaves* you inside rock.
      if (!sim.p.vault && sim.level.boxHitsWall(sim.p.x, sim.p.y, sim.p.w, sim.p.h)) {
        stuck++;
        print(`STUCK ${lv.id} seed=${seed} step=${i} tile=${(sim.p.cx / TILE).toFixed(1)} y=${sim.p.y.toFixed(1)} h=${sim.p.h} slide=${sim.p.sliding} dash=${sim.p.dashing} vault=${!!sim.p.vault}`);
        break;
      }
      best = Math.max(best, sim.p.cx / TILE);
      bursts = Math.max(bursts, sim.p.bursts);
    }
  }
  print(`\n${lv.name}: ${stuck === 0 ? 'no embedded frames' : `${stuck} STUCK`} over 90 runs (${deaths} deaths, ${bursts} bursts, furthest tile ${best.toFixed(0)})`);
}
