// Headless sanity dump of the test area. Run with: jsc -m tools/dump-level.js
import { buildTestArea } from '../src/levels/test-area.js';
import { T } from '../src/level.js';

const CH = { 0: '.', 1: '#', 2: '/', 3: '\\', 4: '-', 5: '^', 6: 'v', 7: ',', 8: '=' };
const L = buildTestArea();
const from = Number(arguments[0] ?? 0);
const to = Number(arguments[1] ?? 60);
const marks = new Map();
for (const c of L.crystals) marks.set(`${Math.floor(c.x / 16)},${Math.floor(c.y / 16)}`, 'o');
for (const s of L.springs) marks.set(`${Math.floor(s.x / 16)},${Math.floor(s.y / 16)}`, 'B');
for (const c of L.checkpoints) marks.set(`${Math.floor(c.x / 16)},${Math.floor(c.y / 16) - 1}`, 'C');
for (const s of L.signs) marks.set(`${Math.floor(s.x / 16)},${Math.floor(s.y / 16)}`, 'i');
marks.set(`${Math.floor(L.spawn.x / 16)},${Math.floor(L.spawn.y / 16)}`, 'S');

let header = '    ';
for (let x = from; x < to; x++) header += (x % 10 === 0) ? String(Math.floor(x / 10) % 10) : ' ';
print(header);
for (let y = 8; y < L.h; y++) {
  let row = String(y).padStart(3, ' ') + ' ';
  for (let x = from; x < to; x++) {
    row += marks.get(`${x},${y}`) ?? CH[L.get(x, y)];
  }
  print(row);
}
