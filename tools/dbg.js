import { buildTestArea } from '../src/levels/test-area.js';
import { Player } from '../src/player.js';
import { Fx } from '../src/particles.js';

const L = buildTestArea();
const fx = new Fx();
const inp = {
  d: new Set(['right']),
  held(a) { return this.d.has(a); }, hit() { return false; }, let_go() { return false; },
  get moveX() { return 1; }, get moveY() { return 0; },
};
const p = new Player(L, fx);
const startX = Number(arguments[0] ?? 41 * 16);
p.reset(startX, 27 * 16);
const dt = 1 / 120;
let last = null;
for (let i = 0; i < 120 * 6; i++) {
  p.update(dt, inp);
  const key = `${p.x.toFixed(1)}|${p.y.toFixed(1)}`;
  if (i % 12 === 0 || (last && Math.abs(p.vx) < 20 && i > 60)) {
    print(`t=${(i * dt).toFixed(2)} x=${p.x.toFixed(1)} y=${p.y.toFixed(1)} vx=${p.vx.toFixed(0)} vy=${p.vy.toFixed(0)} g=${p.grounded ? 1 : 0} tile=(${Math.floor(p.x / 16)},${Math.floor((p.y + p.h) / 16)})`);
    if (last === key && Math.abs(p.vx) < 20) { print('STUCK'); break; }
    last = key;
  }
}
