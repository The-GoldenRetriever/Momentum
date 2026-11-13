// gale.js — level 14: a storm over slate hills, and the wind is the course.
// A tailwind carries you past your own top speed and stretches a jump across
// a gap no still air would let you clear; a headwind holds you down to far
// less than your legs could do, so its pits want every bit of top gear you
// bring into it; updrafts lift you up cliff faces in their chimneys, and
// downdrafts drag every jump short. Rain the whole way, and lightning. No
// boost pads, and every flag is a long run-up from an empty bar.
//
// Wind moves your top speed and pushes you towards the new one (Level.wind):
// a gale of 700 against you takes 175 off it, one of 900 behind you adds 225.
// The gaps are set for the course bot's jumps through each (tools/route.js
// prints where they come down).

import { Level, TILE } from '../level.js';

const H = 64;
const START = 46;        // the surface row the run starts on

export function buildGale() {
  const w = course(new Level(1200, H));
  const L = new Level(w, H);
  course(L);
  return L;
}

function course(L) {
  L.theme = 'storm';
  L.marks = { flags: [], hops: [], runups: [], zones: [], tunnels: [] };
  const rock = (x0, x1, top) => L.rect(x0, top, x1 - x0, H - top);
  const spikes = (x0, n, top) => { rock(x0, x0 + n, top + 3); L.spikes(x0, top + 2, n); };

  let x = 2, y = START;
  const run = (n) => { rock(x, x + n, y); x += n; };
  const gap = (g, dy, n) => { x += g; y += dy; run(n); };
  const flag = (title, line) => {
    L.checkpoint(x + 4, y);
    L.sign(x + 7, y - 1, title, [line]);
    L.marks.flags.push({ x: x + 4, y });
  };
  const runup = (n) => { run(n); L.marks.runups.push(x); };
  // wind over tiles [x0, x0 + w), from `up` rows above the run to six below
  // it (so an arc dipping under the edge it left stays in it)
  const gust = (x0, w, ax, up = 12, ay = 0) => L.wind(x0, y - up, w, up + 7, ax, ay);

  L.rect(0, 0, 2, H);
  L.spawn = { x: 4 * TILE, y: (y - 2) * TILE };
  L.sign(5, y - 1, 'GALE', [
    'Wind behind you carries you faster than you can run, and',
    'further. Wind against you holds you back: bring top gear',
    'into it. Updrafts lift you. Downdrafts drag you down.',
  ]);

  // ================================================ A — the tailwind
  run(24); gap(4, 0, 30);
  // a tailwind from here on over the gap: run into it, leap with it
  gust(x - 22, 44, 500);
  L.marks.runups.push(x);
  gap(20, 0, 12);

  // ================================================ B — the headwind
  flag('HEADWIND', 'It holds you back. Every pit wants all your speed.');
  runup(50);
  {
    const start = x;
    for (let i = 0; i < 4; i++) { spikes(x, 7, y); x += 7; run(5); }
    gust(start - 4, x - start + 4, -700);
    run(6);
  }

  // ================================================ C — the chimneys
  flag('UPDRAFT', 'Into the updraft at the cliff foot: up, and over.');
  runup(46);
  for (let i = 0; i < 2; i++) {
    // an updraft at the foot of a cliff ten rows high: it lifts you up the
    // face and you run on over the top
    gust(x - 3, 4, 0, 14, -2600);
    y -= 10;
    run(14);
  }
  gap(5, 4, 10);

  // ================================================ D — the downdraft
  flag('DOWNDRAFT', 'It drags every jump down. Leave from the very edge.');
  runup(50);
  {
    const start = x;
    for (let i = 0; i < 3; i++) { spikes(x, 9, y); x += 9; run(5); }
    gust(start - 2, x - start + 2, 0, 12, 900);
    run(6);
  }

  // ================================================ E — the eye of it
  flag('EYE', 'Up, along, over. The storm all at once.');
  runup(52);
  gust(x - 3, 4, 0, 14, -2600);
  y -= 10;
  // (the updraft throws you a long way on before you land: room to run after)
  run(30);
  gust(x - 20, 38, 450);
  gap(19, 0, 34);
  L.goal = { x: (x - 22) * TILE, y: (y - 4) * TILE, w: TILE * 2, h: TILE * 4, hit: false };
  return x;
}
