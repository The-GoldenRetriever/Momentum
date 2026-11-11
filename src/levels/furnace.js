// furnace.js — level 7, the last and the hardest: everything the momentum
// courses ask, in one run, deep where the rock runs hot. It opens with falls
// into the cavern that have to be rolled, then the roof comes down: under it
// every jump is cut short, so how far you carry is down to how fast you are
// running, and only top gear clears the gaps. Then a crawl with fangs in the
// roof (hop low), and a vent so low you slide it, over holes that only a fast
// slide skims. No boost pads, and every flag is a long run-up from an empty
// bar: lose your momentum and the furnace takes it from there.

import { Level, T, TILE } from '../level.js';

const W = 590;           // (with a run-out past the goal for the walk-off)
const H = 52;
const DROP = 8;          // rows between one cliff and the next, in the falls
const FALL_GAP = 20;     // where a top-gear jump off one comes down on the next

export function buildFurnace() {
  const L = new Level(W, H);
  L.theme = 'ember';
  // rock from row `y` down to the furnace floor
  const ground = (x0, x1, y) => L.rect(x0, y, x1 - x0, H - 3 - y);
  // the roof coming down so `rows` tiles are left over a floor at `y`
  const roof = (x0, x1, y, rows) => L.rect(x0, 1, x1 - x0, y - rows - 1);
  // a fanged stretch of a four-tile roof: the spikes take its bottom row, so
  // a quick hop still clears them and a full jump does not
  const fangs = (x0, w, y) => L.spikes(x0, y - 5, w, 'down');

  // ---- world shell: a wall, a roof, and a spiked floor under everything ---
  L.rect(0, 0, 2, H);
  L.rect(0, 0, W, 1);
  L.rect(0, H - 2, W, 2);
  L.spikes(2, H - 3, W - 2);

  // ================================================== A — the falls
  let y = 12;
  ground(2, 62, y);
  L.spawn = { x: 4 * TILE, y: (y - 2) * TILE };
  L.sign(5, y - 1, 'FURNACE', [
    'Everything at once. Roll the falls, then the roof comes',
    'down and only speed carries a jump. Hop the fangs, slide',
    'the vent. Every flag is a long run from an empty bar:',
    'keep your momentum, because getting it back is the hard part.',
  ]);
  let x = 62;
  for (let i = 0; i < 3; i++) { x += FALL_GAP; y += DROP; ground(x, x + 7, y); x += 7; }

  // ================================================== B — the low road
  // The roof comes down to five tiles. A jump under it hits it and is cut
  // short, so its length is all speed: top gear clears these, a sprint does not.
  const b = x - 7;
  ground(b, b + 60, y);
  L.checkpoint(b + 8, y);
  L.sign(b + 11, y - 1, 'LOW ROAD', ['The roof cuts every jump short. Only speed carries you.']);
  x = b + 60;
  roof(x - 4, x + 4 * 17 + 4, y, 5);
  for (let i = 0; i < 4; i++) {
    x += 11;
    if (i % 2) L.crumble(x, y, 6); else ground(x, x + 6, y);
    x += 6;
  }

  // ================================================== C — the crawl
  // Down to four tiles, and fangs in it over every other gap.
  const c = x + 11;
  ground(c, c + 60, y);
  L.checkpoint(c + 8, y);
  L.sign(c + 11, y - 1, 'CRAWL', ['Four tiles of room. Hop low where the roof has fangs.']);
  x = c + 60;
  roof(x - 4, x + 5 * 13 + 4, y, 4);
  for (let i = 0; i < 5; i++) {
    if (i % 2) fangs(x - 1, 9, y);
    x += 8;
    ground(x, x + 5, y);
    x += 5;
  }

  // ================================================== D — the vent
  // A slot so low only a slide fits, over holes two tiles wide: slide in at
  // top gear and you skim them, any slower and you drop in. Then two last
  // leaps under the low roof to the goal.
  const d = x + 8;
  ground(d, d + 60, y);
  L.checkpoint(d + 8, y);
  L.sign(d + 11, y - 1, 'VENT', ['Slide it fast, or the holes have you.']);
  x = d + 60;
  ground(x, x + 36, y);
  L.rect(x, 1, 36, y - 2);
  L.rect(x, y - 1, 36, 1, T.LOWCEIL);
  for (let hx = x + 6; hx < x + 34; hx += 6) L.rect(hx, y, 2, H - 3 - y, T.EMPTY);
  x += 36;
  roof(x, W, y, 5);
  ground(x, x + 8, y);                     // a stride to get up out of the slide
  x += 8;
  for (let i = 0; i < 2; i++) { x += 11; ground(x, x + 6, y); x += 6; }
  ground(x + 11, W, y);
  L.goal = { x: (x + 18) * TILE, y: (y - 4) * TILE, w: TILE * 2, h: TILE * 4, hit: false };
  if (x + 11 + 30 > W) throw new Error(`furnace: widen W to ${x + 11 + 30}`);

  return L;
}
