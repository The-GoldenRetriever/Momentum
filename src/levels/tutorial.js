// tutorial.js — level 1: every move, one at a time, and each one is the only
// way past its own gate. Run and jump, vault, slide, wall jump, roll down a
// slope, dash, burst, and V (auto-burst off) for the water at the end.
//
// The gates are built so the move they teach cannot be dodged:
//   * vault: two-tile ledges with spikes at their feet, so there is no floor
//     at the face to lean on and climb (the mantle), and spikes hung from the
//     roof just over the height a vault climbs to: a full jump is death, and
//     only a hop cut to within a few pixels of the vault's height gets up
//   * slide: spike gaps inside a tunnel too low to jump in: a slide crosses
//     them, a crouch drops in
//   * wall jump: a sealed shaft, far taller than any jump
//   * roll: a gap past what running down the slope can clear
//   * dash: a cliff past a jump's reach, and no second wall to kick between
//   * burst: a gap past top gear with a dash, which a burst with one clears
//   * V: a sea run at a full bar's speed. A burst carries you over it while
//     it lasts, but it burns the bar, and once it is spent you slow below
//     that speed and go through, far from either shore. (A chain of dashes,
//     each one paying back a little bar, can still carry a good player.)
// The dash and the burst are handed over only at their own sections
// (Level.dashFrom, burstFrom): before them, a dash would carry you past the
// slide's gaps and the roll's, and a burst would go off unexplained (and
// carry you over the roll's gap too).
//
// It marks its own route for the course bot (tools/routes.js), and sim.js
// proves every gate needs its move.

import { Level, T, TILE } from '../level.js';

const H = 48;
const GY = 38;           // the row the run starts on

export function buildTutorial() {
  const w = course(new Level(1200, H));
  const L = new Level(w, H);
  course(L);
  return L;
}

function course(L) {
  L.theme = 'dawn';
  L.marks = { flags: [], zones: [], tunnels: [], shafts: [], sections: {} };
  const m = L.marks;
  // rock from row `top` to the bottom of the world
  const rock = (x0, x1, top) => L.rect(x0, top, x1 - x0, H - top);
  // a spiked pit [x0, x0 + w) under a run on row `top`
  const pit = (x0, w, top) => { rock(x0, x0 + w, top + 4); L.spikes(x0, top + 3, w); };
  // a flag at tile x on the surface `row`; the bot starts a run from each
  const flag = (tx, row) => { L.checkpoint(tx, row); m.flags.push({ x: tx, y: row }); };

  L.rect(0, 0, 2, H);
  let x = 2, y = GY;

  // ============================================================ run, jump
  rock(x, 16, y);
  L.spawn = { x: 5 * TILE, y: (y - 4) * TILE };
  L.sign(4, y - 1, 'MOVE', [
    'Arrows or WASD to run. Hold it: you keep speeding up,',
    'and the FLOW bar (bottom left) fills while you do.',
    'A fuller bar is a faster top speed.',
  ]);
  pit(16, 3, y);
  rock(19, 27, y);
  L.sign(20, y - 1, 'JUMP', [
    'SPACE, Z or J jumps. The faster you run, the higher',
    'and further it carries you. Take the long one at a run.',
  ]);
  pit(27, 6, y);
  x = 33;
  rock(x, x + 12, y);
  x += 12;

  // =============================================================== vault
  L.sign(36, y - 1, 'VAULT', [
    'C (or L) takes a ledge: run at it, and when the VAULT',
    'prompt shows over your head, press it. You go over in',
    'your stride. Spikes at their feet, spikes on the roof:',
    'do not jump here. Vault.',
  ]);
  m.sections.vault = x;
  for (let i = 0; i < 3; i++) {
    // The approach (the ledge before, or the floor) and the gap sit under
    // spikes hung from a roof: their points start 8px over the head of a
    // vault at the top of its climb (which is the ledge's height, exactly),
    // and a jump has to get its feet to within 7px of the lip. A full jump
    // goes into the points; only a hop cut to a 15px band of height lands.
    // The roof steps up with each ledge, so a ledge's top is the next
    // approach, with the same room over it to vault from.
    // (rock all the way up: an overhang, not a slab hung in the sky)
    const from = i === 0 ? x - 4 : x - 6;
    L.rect(from, 0, x + 2 - from, y - 4);
    L.spikes(from, y - 4, x + 2 - from, 'down');
    pit(x, 2, y);
    rock(x + 2, x + 8, y - 2);
    m.zones.push({ at: [x - 3, x + 2], vault: true });   // (the bot: wait for the prompt, never jump)
    x += 8;
    y -= 2;
  }
  // The roof runs on a few tiles over the last ledge too, as it does over the
  // others, or a late jump off the lip of the last gap, rising past the face
  // with its feet just over the top, would come up into open sky instead.
  L.rect(x - 6, 0, 8, y - 4);
  L.spikes(x - 6, y - 4, 8, 'down');
  // a flag (or a slip in the tunnel sends you back up the vault steps every
  // time), and a run-up long enough to come into the tunnel at a sprint from it
  rock(x, x + 44, y);
  flag(x + 3, y);
  x += 44;

  // =============================================================== slide
  L.sign(x - 20, y - 1, 'SLIDE', [
    'DOWN while running fast throws you into a slide, feet',
    'first. Only a slide fits under the low rock, and only',
    'a fast one carries over the gaps in there: crouch',
    'through slowly and you drop in. Come in at a sprint.',
  ]);
  m.sections.slide = x;
  {
    const n = 16;
    rock(x, x + n, y);
    L.rect(x, y - 7, n, 6);
    L.rect(x, y - 1, n, 1, T.LOWCEIL);
    for (const g of [5, 11]) { L.rect(x + g, y, 2, H - y, T.EMPTY); pit(x + g, 2, y); }
    m.tunnels.push([x, x + n]);
    x += n;
  }
  rock(x, x + 10, y);
  flag(x + 3, y);
  x += 10;

  // ================================================================ dive
  // Run off the ledge, dive (DOWN in the air: head first, and low) through
  // the window in the wall across the drop, roll as you land in the tunnel
  // behind it, and slide on out of it fast enough to clear the pit beyond.
  // The window's mouth is tall, but the tunnel past it is a slide's height:
  // come in upright and you meet its lip and stop, and from a crawl the pit
  // is too wide. (The mouth takes a dive off the ledge at anything from about
  // 280 px/s, a run up from the flag, to a burst's 560.)
  rock(x, x + 22, y);
  L.sign(x + 3, y - 1, 'DIVE', [
    'DOWN in the air, at a run, is a DIVE: head first, and as',
    'low as a slide. Run off the ledge and dive through the',
    'window. You land in a roll; keep DOWN held and it turns',
    'into a slide. Come out fast: the pit after is wide.',
  ]);
  x += 22;
  m.sections.dive = x;
  {
    const W = 12;                               // the wall: mouth, then tunnel
    L.rect(x, y, 4, H - y, T.EMPTY);            // the drop, spiked far below
    pit(x, 4, y + 3);
    rock(x + 4, x + 4 + W, y - 10);             // the wall ...
    // ... its mouth, four tall from the ledge's own height and four deep:
    // room for a dive to come down in and roll, but at speed no time to get
    // low once you are down unless you already are
    L.rect(x + 4, y, 4, 4, T.EMPTY);
    L.rect(x + 8, y + 3, W - 4, 1, T.LOWCEIL);  // ... and the tunnel, a slide high
    m.zones.push({ at: [x - 3, x + 4 + W], dive: true, edge: x });   // (the bot: no jump off it, DOWN from the edge on)
    x += 4 + W;
    y += 4;
    pit(x, 10, y);                              // too wide from a crawl
    x += 10;
  }
  rock(x, x + 10, y);
  flag(x + 3, y);
  x += 10;

  // =========================================================== wall jump
  // the test area's shaft: a doorway at the bottom on the left, sealed above,
  // the way out along the top of the right wall
  const SH = 16;
  m.sections.shaft = x;
  L.sign(x - 5, y - 1, 'WALLS', [
    'Jump at a wall and you cling to it, sliding down.',
    'JUMP again kicks you off it, up and away: kick from',
    'wall to wall to climb the shaft. Hold DOWN to slide',
    'faster. There is no other way up.',
  ]);
  L.rect(x, y - SH, 1, SH - 3);            // left wall, a three-tile doorway under it
  L.rect(x + 6, y - SH, 2, SH);            // right wall
  rock(x, x + 6, y);
  m.shafts.push([x + 0.5, x + 6.5, y - SH - 1]);
  x += 6;
  y -= SH + 1;
  L.rect(x, y, 2, 1);                      // the lip of the way out
  rock(x + 2, x + 12, y);
  flag(x + 4, y);
  x += 12;

  // ================================================================ roll
  m.sections.roll = x;
  L.sign(x - 6, y - 1, 'ROLL', [
    'Running down a slope gives you a little speed. Press C',
    'on the way down and you ROLL: it gives you a lot, well',
    'past your top speed, and you keep it off the bottom.',
    'Running it will not clear the gap. Rolling it will.',
  ]);
  {
    const len = 16;
    L.ramp(x, y + len - 1, len, -1, H - 1);
    x += len;
    y += len;
  }
  rock(x, x + 3, y);
  x += 3;
  pit(x, 17, y);                   // (a roll clears it by two tiles; a run falls two short)
  m.sections.rollGap = x;
  x += 17;
  rock(x, x + 12, y);
  flag(x + 2, y);
  // the dash is yours from this flag on
  L.dashFrom = (x + 1) * TILE;
  x += 12;

  // ================================================================ dash
  L.sign(x - 7, y - 1, 'DASH', [
    'Here is your dash: SHIFT, X or K, in any of 8 directions.',
    'It comes back when you land. The cliff is past any jump:',
    'jump, then dash up (hold UP, or UP and RIGHT) at the top.',
  ]);
  m.sections.dash = x;
  {
    const CL = 9;               // (eight was within 10px of a climb by kicking off the face alone)
    rock(x, x + 14, y - CL);
    m.zones.push({ at: [x - 3.2, x - 2.2], jump: true });
    m.zones.push({ at: [x - 2.2, x + 1], dash: ['up'], vy: -60 });
    y -= CL;
  }
  flag(x + 3, y);
  x += 14;

  // =============================================================== burst
  L.sign(x - 8, y - 1, 'BURST', [
    'Near the top of the bar it creeps: TOPPING OFF. Hold',
    'your speed, lose none of it, or it starts over. Full,',
    'the world slows a moment, then you BURST: faster',
    'than anything, in slow motion, until the bar runs dry.',
    'Just run: a dash fills no bar. Burst, then dash over',
    'the chasm. (Bursting must be on: V turns it on and off.)',
  ]);
  m.sections.burst = x;
  L.burstFrom = x * TILE;
  // (the bot: run it, never dash it, as the sign says; see the chasm below)
  m.zones.push({ at: [x, x + 231], steady: true });
  // (from the flag, a run held at top speed tops the bar off and bursts some
  // fifty tiles short of the edge, and is still bursting when it gets there;
  // a run that dashes down it covers more ground filling the bar and bursts
  // later, about fifteen short; a slower one bursts sooner, and a burst lasts
  // about eighty tiles. Lose speed on the way and it all comes later.)
  rock(x, x + 231, y);
  x += 231;
  pit(x, 29, y);
  m.sections.burstGap = x;
  m.zones.push({ at: [x + 6, x + 22], dash: ['right'], vy: 200 });
  x += 29;
  rock(x, x + 14, y);
  flag(x + 3, y);
  x += 14;

  // =============================================================== water
  L.sign(x - 9, y - 1, 'WATER', [
    'Water holds you up while you run at least as fast as',
    'a full bar runs. A burst will carry you, but it burns',
    'the bar, and when it ends you slow down and sink far',
    'from shore: press V to switch burst OFF, and run.',
  ]);
  m.sections.water = x;
  m.zones.push({ at: [x - 8, x - 6], autoburst: true });
  // a long run to the water: a burst off the chasm burns the bar, and it has
  // to be back to one (to a full bar's speed) by the shore
  rock(x, x + 100, y);
  x += 100;
  {
    const n = 280, depth = 6;      // (an auto-burst run sinks ~260 in at most)
    L.water(x, y, n, depth);
    rock(x, x + n, y + depth);
    m.sections.sea = [x, x + n];
    x += n;
  }
  rock(x, x + 34, y);
  L.goal = { x: (x + 10) * TILE, y: (y - 4) * TILE, w: TILE * 2, h: TILE * 4, hit: false };
  x += 34;                         // (the last twenty: a run-out past the goal for the walk-off)

  // ---- scenery
  for (let i = 0; i < 120; i++) {
    const tx = 3 + ((i * 37) % (x - 8));
    for (let ty = 2; ty < H - 1; ty++) {
      if (L.get(tx, ty) === T.EMPTY && L.get(tx, ty + 1) === T.SOLID && L.get(tx, ty - 1) === T.EMPTY && (i * 13 + ty) % 3 === 0) { L.set(tx, ty, T.DECO); break; }
    }
  }
  return x;
}
