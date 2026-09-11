// Headless physics smoke test: jsc -m tools/sim.js
import { buildTestArea } from '../src/levels/test-area.js';
import { Player } from '../src/player.js';
import { Fx } from '../src/particles.js';

const L = buildTestArea();
const fx = new Fx();

class FakeInput {
  constructor() { this.d = new Set(); this.p = new Set(); this.r = new Set(); }
  held(a) { return this.d.has(a); }
  hit(a) { return this.p.has(a); }
  let_go(a) { return this.r.has(a); }
  get moveX() { return (this.d.has('right') ? 1 : 0) - (this.d.has('left') ? 1 : 0); }
  get moveY() { return (this.d.has('down') ? 1 : 0) - (this.d.has('up') ? 1 : 0); }
  set(a, on) { if (on) { if (!this.d.has(a)) this.p.add(a); this.d.add(a); } else { if (this.d.has(a)) this.r.add(a); this.d.delete(a); } }
  step() { this.p.clear(); this.r.clear(); }
}

function run(label, { startX, startY, seconds, script }) {
  const p = new Player(L, fx);
  p.reset(startX, startY);
  const inp = new FakeInput();
  const dt = 1 / 120;
  let maxSpeed = 0, airFrames = 0, deaths = 0, stalls = 0, minX = startX, maxX = startX;
  for (let i = 0; i < seconds / dt; i++) {
    script(inp, i * dt, p);
    p.update(dt, inp);
    inp.step();
    fx.update(dt);
    if (p.dead) { deaths++; p.reset(startX, startY); }
    maxSpeed = Math.max(maxSpeed, Math.abs(p.vx));
    if (!p.grounded) airFrames++;
    if (Math.abs(p.vx) < 5 && i > 60) stalls++;
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
  }
  print(`${label.padEnd(26)} x:${p.x.toFixed(0).padStart(5)} y:${p.y.toFixed(0).padStart(4)}` +
        ` vx:${p.vx.toFixed(0).padStart(4)} top:${maxSpeed.toFixed(0).padStart(4)}` +
        ` travelled:${(maxX - minX).toFixed(0).padStart(5)} air:${(airFrames / (seconds / dt) * 100).toFixed(0)}%` +
        ` stalled:${(stalls / (seconds / dt) * 100).toFixed(0)}% deaths:${deaths}`);
  return p;
}

const hold = (a) => (inp) => inp.set(a, true);

// 1. flat sprint: how fast do we get and how far do we go in 6s?
run('flat sprint', { startX: 80, startY: 400, seconds: 6, script: hold('right') });

// 2. staircase up + down at full sprint (section B starts around x=640)
run('stairs up/down', { startX: 41 * 16, startY: 27 * 16, seconds: 8, script: hold('right') });

// 3. same staircase at walking speed (tap to keep it slow)
run('stairs, tapping (stops)', {
  startX: 41 * 16, startY: 27 * 16, seconds: 8,
  script: (inp, t) => inp.set('right', Math.floor(t * 6) % 2 === 0),
});

// 4. slopes
run('slopes', { startX: 82 * 16, startY: 27 * 16, seconds: 8, script: hold('right') });

// 5. wall shaft: run right, jump constantly
run('wall shaft', {
  startX: 120 * 16, startY: 27 * 16, seconds: 10,
  script: (inp, t) => { inp.set('right', true); inp.set('jump', Math.floor(t * 8) % 2 === 0); },
});

// 6. dash gauntlet
run('dash gauntlet', {
  startX: 152 * 16, startY: 27 * 16, seconds: 10,
  script: (inp, t) => {
    inp.set('right', true);
    inp.set('jump', Math.floor(t * 3.1) % 3 === 0);
    inp.set('dash', Math.floor(t * 3.7) % 4 === 0);
  },
});

// 7. slide tunnel
run('slide tunnel', {
  startX: 200 * 16, startY: 27 * 16, seconds: 8,
  script: (inp, t) => { inp.set('right', true); inp.set('down', t > 0.75); },
});

// 7b. slide + jump out of the tunnel
run('slide then jump', {
  startX: 200 * 16, startY: 27 * 16, seconds: 8,
  script: (inp, t) => {
    inp.set('right', true);
    inp.set('down', t > 0.75 && t < 2.4);
    inp.set('jump', t > 2.5 && Math.floor(t * 2) % 2 === 0);
  },
});

// 8. springs
run('springs', {
  startX: 232 * 16, startY: 33 * 16, seconds: 10,
  script: (inp, t) => { inp.set('right', Math.floor(t * 2) % 2 === 0); },
});
