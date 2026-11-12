// Headless sanity dump of a level. Run with: jsc -m tools/dump-level.js -- <from> <to> [level]
// where [level] is a 1-based index into levels/index.js (default 1, the test area).
import { LEVELS } from '../src/levels/index.js';
import { T } from '../src/level.js';

const CH = { 0: '.', 1: '#', 2: '/', 3: '\\', 4: '-', 5: '^', 6: 'v', 7: ',', 8: '=', 9: '~', 10: 'a', 11: 'w' };
const L = LEVELS[Number(arguments[2] ?? 1) - 1].build();
const from = Number(arguments[0] ?? 0);
const to = Number(arguments[1] ?? 60);
const marks = new Map();
for (const b of L.phases) if (b.group === 1) marks.set(`${b.tx},${b.ty}`, 'b');   // the set that starts hidden
for (const b of L.boosts) for (let x = b.x / 16; x < (b.x + b.w) / 16; x++) marks.set(`${x},${b.y / 16 - 1}`, b.dir > 0 ? '>' : '<');
for (const c of L.crystals) marks.set(`${Math.floor(c.x / 16)},${Math.floor(c.y / 16)}`, 'o');
for (const s of L.springs) marks.set(`${Math.floor(s.x / 16)},${Math.floor(s.y / 16)}`, 'B');
for (const c of L.checkpoints) marks.set(`${Math.floor(c.x / 16)},${Math.floor(c.y / 16) - 1}`, 'C');
for (const s of L.signs) marks.set(`${Math.floor(s.x / 16)},${Math.floor(s.y / 16)}`, 'i');
marks.set(`${Math.floor(L.spawn.x / 16)},${Math.floor(L.spawn.y / 16)}`, 'S');

let header = '    ';
for (let x = from; x < to; x++) header += (x % 10 === 0) ? String(Math.floor(x / 10) % 10) : ' ';
print(header);
for (let y = 2; y < L.h; y++) {
  let row = String(y).padStart(3, ' ') + ' ';
  for (let x = from; x < to; x++) {
    row += marks.get(`${x},${y}`) ?? CH[L.get(x, y)];
  }
  print(row);
}
