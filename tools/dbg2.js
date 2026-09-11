import { buildTestArea } from '../src/levels/test-area.js';
import { Player } from '../src/player.js';
import { Fx } from '../src/particles.js';

const L = buildTestArea();
const fx = new Fx();
function mk(keys) {
  return {
    d: new Set(keys), p: new Set(), r: new Set(),
    held(a) { return this.d.has(a); }, hit(a) { return this.p.has(a); }, let_go(a) { return this.r.has(a); },
    get moveX() { return (this.d.has('right') ? 1 : 0) - (this.d.has('left') ? 1 : 0); },
    get moveY() { return (this.d.has('down') ? 1 : 0) - (this.d.has('up') ? 1 : 0); },
  };
}
const which = arguments[0];
const dt = 1 / 120;

if (which === 'mantle') {
  const p = new Player(L, fx); p.reset(741, 466);
  const inp = mk(['right']);
  for (let i = 0; i < 120 * 2; i++) {
    p.update(dt, inp);
    if (i % 10 === 0) print(`t=${(i * dt).toFixed(2)} x=${p.x.toFixed(1)} y=${p.y.toFixed(1)} vx=${p.vx.toFixed(0)} mantle=${p.t.mantle.toFixed(2)} bump=${p.bumpDir}`);
  }
}

if (which === 'slide') {
  const p = new Player(L, fx); p.reset(200 * 16, 27 * 16);
  const inp = mk(['right']);
  for (let i = 0; i < 120 * 6; i++) {
    if (i * dt > 1.0) inp.d.add('down');
    p.update(dt, inp);
    if (i % 12 === 0) print(`t=${(i * dt).toFixed(2)} x=${p.x.toFixed(1)} tile=${Math.floor(p.x / 16)} y=${p.y.toFixed(1)} h=${p.h} vx=${p.vx.toFixed(0)} slide=${p.sliding ? 1 : 0} g=${p.grounded ? 1 : 0}`);
  }
}

if (which === 'slide2') {
  const p = new Player(L, fx); p.reset(3350.3, 472); p.h = 8; p.vx = 25;
  const inp = mk(['right', 'down']);
  for (let i = 0; i < 6; i++) {
    p.update(dt, inp);
    print(`i=${i} x=${p.x.toFixed(2)} y=${p.y.toFixed(1)} h=${p.h} vx=${p.vx.toFixed(1)} bump=${p.bumpDir} slide=${p.sliding?1:0} crouch=${p.crouching?1:0} g=${p.grounded?1:0}`);
  }
  const t0 = L.boxHitsWall(3352, 472, 10, 8);
  const t1 = L.boxHitsWall(3352, 466, 10, 14);
  print(`hitAt(3352,472,h8)=${t0} hitAt(3352,466,h14)=${t1}`);
}

if (which === 'mantle2') {
  const p = new Player(L, fx); p.reset(690, 466);
  const inp = mk(['right']);
  for (let i = 0; i < 120 * 2; i++) {
    p.update(dt, inp);
    if (i % 10 === 0) print(`t=${(i*dt).toFixed(2)} x=${p.x.toFixed(1)} y=${p.y.toFixed(1)} vx=${p.vx.toFixed(0)} mantle=${p.t.mantle.toFixed(2)} bump=${p.bumpDir}`);
  }
}
