// cascade.js — level 6. A descent at night down a stair of cliffs, eight
// tiles a step, with nothing between them but the drop. A jump off one cliff
// at top gear comes down on the next; a hard landing taken on your feet costs
// a share of the bar, and the cliffs are spaced for a full one, so every
// landing has to be rolled (C, held through the fall or pressed as you touch)
// or the next cliff is out of reach. Halfway down the descent turns into a
// climb of ledges that only a called vault takes at speed, and the last
// cliffs are sand. No boost pads: the speed you arrive with is all you get.

import { Level, T, TILE } from '../level.js';

const W = 554;           // (with a run-out past the goal for the walk-off)
const H = 90;
const DROP = 8;          // rows between one cliff and the next
const CLIFF = 7;         // a cliff top is a stride or so wide
// How far past the edge a jump at top gear clears, by drop: the cliff after
// it starts where that jump lands about two tiles in.
const GAP = { 0: 15, [DROP]: 20 };

export function buildCascade() {
  const L = new Level(W, H);
  L.theme = 'night';
  // a cliff: rock from row `y` all the way down
  const cliff = (x0, x1, y) => L.rect(x0, y, x1 - x0, H - y);
  // a run of cliffs stepping down from `y`, starting off the edge at `x`;
  // returns where the last one ends and its row
  const descent = (x, y, n) => {
    for (let i = 0; i < n; i++) {
      x += GAP[DROP];
      y += DROP;
      cliff(x, x + CLIFF, y);
      x += CLIFF;
    }
    return { x, y };
  };

  // ---- world shell -------------------------------------------------------
  L.rect(0, 0, 2, H);

  // ================================================== A — the first falls
  let y = 12;
  cliff(2, 62, y);
  L.spawn = { x: 4 * TILE, y: (y - 2) * TILE };
  L.sign(5, y - 1, 'CASCADE', [
    'Down a stair of cliffs, eight tiles a step. Land one on',
    'your feet and it takes a share of your bar, and the next',
    'cliff wants all of it. Roll every landing: hold C through',
    'the fall, or press it as you touch down.',
  ]);
  let at = descent(62, y, 3);

  // ================================================== B — the climb
  // A flag, the run-up, then ledges two tiles high: called, a vault keeps
  // every bit of your speed; uncalled, a ledge is a wall. Top gear, then
  // a gap that wants all of it.
  const b = at.x - CLIFF;
  y = at.y;
  cliff(b, b + 40, y);
  L.checkpoint(b + 10, y);
  L.sign(b + 13, y - 1, 'THE CLIMB', ['Call every vault. A ledge you do not call is a wall.']);
  let x = b + 40;
  for (let i = 0; i < 4; i++) { y -= 2; cliff(x, x + 6, y); x += 6; }
  cliff(x - 6, x + 12, y);
  x += 12;
  cliff(x + GAP[0], x + GAP[0] + CLIFF, y);
  x += GAP[0] + CLIFF;

  // ================================================== C — the long fall
  const c = x - CLIFF;
  cliff(c, c + 64, y);
  L.checkpoint(c + 10, y);
  L.sign(c + 13, y - 1, 'LONG FALL', ['Four cliffs down. Roll them all.']);
  at = descent(c + 64, y, 4);

  // ================================================== D — the sands
  // The bottom of the stair, where the cliffs are sand: roll them and run on,
  // because there is no standing on them either.
  const d = at.x - CLIFF;
  y = at.y;
  cliff(d, d + 56, y);
  L.checkpoint(d + 10, y);
  L.sign(d + 13, y - 1, 'SANDS', ['The last cliffs are sand. Roll, and keep going.']);
  x = d + 56;
  for (let i = 0; i < 2; i++) {
    x += GAP[DROP];
    y += DROP;
    L.crumble(x, y, CLIFF);
    x += CLIFF;
  }
  x += GAP[DROP];
  y += DROP;
  cliff(x, W, y);
  L.goal = { x: (x + 10) * TILE, y: (y - 4) * TILE, w: TILE * 2, h: TILE * 4, hit: false };
  if (x + 30 > W) throw new Error(`cascade: widen W to ${x + 30}`);
  if (y + 3 > H) throw new Error(`cascade: deepen H to ${y + 3}`);

  return L;
}
