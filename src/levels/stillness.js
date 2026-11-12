// stillness.js — level 6: the stillness chases you. It waits for you to
// move, then comes on behind you at a little under a sprint and never stops,
// and however far you get ahead it is never more than a screen behind. The
// country it has already passed through is frosted grey and dead still.
// Nothing here is a hard leap on its own; the hard part is that nothing may
// cost you a moment. A ledge you do not call is a wall, and a wall is the end
// of you; a slide drags your speed down while it closes; sand drops you if
// you hesitate. Every flag is a long run-up from an empty bar, with it
// sixteen tiles behind you and coming.

import { Level, T, TILE } from '../level.js';

const H = 48;
const GROUND = 32;

// how fast the Stillness comes on: a bot holding top gear gains on it, and a
// run that loses its momentum anywhere does not
export const STILLNESS_SPEED = 355;

export function buildStillness() {
  const w = course(new Level(1000, H));
  const L = new Level(w, H);
  course(L);
  L.stillness(STILLNESS_SPEED, 16, 24);
  return L;
}

function course(L) {
  L.theme = 'frost';
  L.marks = { flags: [], hops: [], runups: [], zones: [], tunnels: [] };
  let x = 2, y = GROUND;
  const rock = (x0, x1, top) => L.rect(x0, top, x1 - x0, H - top);
  // n tiles of ground, dy rows off the last (up is negative)
  const run = (n, dy = 0) => { y += dy; rock(x, x + n, y); x += n; };
  const gap = (g, dy, n) => { x += g; run(n, dy); };
  const sand = (g, n) => { x += g; L.crumble(x, y, n); x += n; };
  // a low tunnel: only a slide fits, n tiles of it
  const tunnel = (n) => {
    rock(x, x + n, y);
    L.rect(x, 1, n, y - 2);
    L.rect(x, y - 1, n, 1, T.LOWCEIL);
    L.marks.tunnels.push([x, x + n]);
    x += n;
  };
  // fangs over a gap: hop it
  const fangGap = (g, n) => {
    L.rect(x - 1, y - 8, g + 2, 3);
    L.spikes(x - 1, y - 5, g + 2, 'down');
    L.marks.hops.push(x);
    gap(g, 0, n);
  };
  // a spring at the end of the ground just laid, three tiles from its edge
  const spring = () => L.spring(x - 3, y - 1);
  const flag = (title, line) => {
    L.checkpoint(x + 4, y);
    L.sign(x + 7, y - 1, title, [line]);
    L.marks.flags.push({ x: x + 4, y });
  };
  const runup = (n) => { run(n); L.marks.runups.push(x); };
  // ice on the top of the ground just laid (the last n tiles of it): the first
  // taste of it, ahead of the glacier, where letting go means gliding on
  const iced = (n) => L.ice(x - n, y, n);

  L.rect(0, 0, 2, H);

  // ================================================ A — the trail
  L.spawn = { x: 4 * TILE, y: (y - 2) * TILE };
  L.sign(5, y - 1, 'STILLNESS', [
    'A wall of stillness chases you. The moment you move it',
    'comes on behind you, and it does not stop. Neither can',
    'you: a ledge you do not call, a slide held too long, a',
    'moment lost anywhere, and it has you. Keep your speed.',
  ]);
  runup(40);
  run(6, -2); run(8, -2); run(6, 1);
  gap(14, 0, 6); gap(15, 2, 6); run(8, -2);
  sand(14, 6); gap(15, -2, 6);
  run(6, -2); gap(16, 3, 10);

  // ================================================ B — the gorge
  flag('GORGE', 'Down into the gorge and out the far side. Slide the cut.');
  runup(48);
  run(6, 2); run(6, 2); run(8, 2);
  tunnel(16); run(4);
  gap(14, 0, 6); fangGap(8, 6); gap(14, -2, 6);
  run(6, -2); run(10, -2);

  // ================================================ C — the falls
  flag('FALLS', 'Springs up the frozen falls. Hit them at top gear.');
  runup(48);
  spring(); gap(15, -6, 8); spring();
  gap(15, -6, 8);
  gap(18, 4, 6); sand(15, 6); gap(19, 4, 10);

  // ================================================ D — the long run
  flag('LONG RUN', 'The frost has turned to ice. It will not let you stop.');
  runup(48);
  L.sign(x + 2, y - 1, 'ICE', [
    'Ice ahead. Let go on it and you glide on; it is slow to',
    'get going on and slower still to turn round on. It takes',
    'nothing from you. It just will not let you stop.',
  ]);
  gap(14, 0, 6); iced(6); sand(15, 6); fangGap(8, 6); iced(6);
  run(6, -2); iced(6); gap(14, -2, 6); iced(6);
  tunnel(14); run(4);
  gap(15, 0, 6); iced(6); gap(18, 3, 6); iced(6); sand(16, 6);
  gap(15, 0, 34); iced(34);
  L.goal = { x: (x - 22) * TILE, y: (y - 4) * TILE, w: TILE * 2, h: TILE * 4, hit: false };
  return x;
}
