// spire.js — the second level. No lessons this time, only exams: everything
// the test area teaches, tighter, plus the three pieces of furniture in
// mechanics.js (crumbling blocks, phase blocks, boost pads). Fewer flags, too.
//
// It is meant to be run, not waited through. Nothing on the main line makes
// you stand still, and gaps are spaced for full-speed jumps, so the way to
// play it is flat out. The phase pit is the one place timing matters, and a
// pad in front of it takes care of that (see D).
//
// Rough physics budget it is built against: a full jump rises ~3.8 tiles and
// carries ~7.7 tiles at a standing-start run, ~13 at a full bar, ~19 off a
// boost pad. A full-speed jump that has to gain two tiles lands ~9.5 tiles on.

import { Level, T, TILE } from '../level.js';

const W = 402;           // (with a run-out past the goal for the walk-off)
const H = 44;
const GY = 34;           // row of the main ground surface

export function buildSpire() {
  const L = new Level(W, H);
  const ground = (x0, x1, y = GY) => L.rect(x0, y, x1 - x0, H - y);
  const pit = (x0, w) => {
    L.rect(x0, GY, w, H - GY, T.EMPTY);
    L.rect(x0, GY + 4, w, H - GY - 4);
    L.spikes(x0, GY + 3, w);
  };

  // ---- world shell -------------------------------------------------------
  L.rect(0, 0, 2, H);
  L.rect(0, 0, W, 1);

  // ===================================================== A — the gauntlet
  ground(2, 14);
  L.spawn = { x: 5 * TILE, y: (GY - 2) * TILE };
  L.sign(6, GY - 1, 'THE SPIRE', [
    'No more lessons. Everything you learned, harder,',
    'and three new things on the way up.',
    'Flags are further apart. Mind the spikes.',
  ]);
  pit(14, 4);
  ground(18, 24);
  L.rect(24, GY - 2, 6, H - GY + 2);       // a vault up ...
  pit(30, 6);                              // ... and straight off the far side
  ground(36, 52);                          // room to land a full-speed jump

  // ======================================================== B — crumble
  L.checkpoint(48, GY);
  L.sign(49, GY - 1, 'CRUMBLE', [
    'Sandy blocks give way a moment after you touch them.',
    'Keep moving. They grow back, but not quickly.',
  ]);
  pit(52, 18);
  L.crumble(52, GY, 5);                    // a bridge with bites taken out
  L.crumble(59, GY, 4);
  L.crumble(65, GY, 5);
  ground(70, 74);
  pit(74, 18);
  // Stepping stones, level and wide, two-tile gaps: hop each one at a run, or
  // take a full-speed jump straight onto the second. Either way, no braking.
  L.crumble(76, GY, 6);
  L.crumble(84, GY, 6);
  ground(92, 96);                          // flush, so a top-gear jump that sails
                                           // both stones lands here instead of on a face

  // ========================================================== C — boost
  ground(96, 108);
  L.sign(97, GY - 1, 'BOOST', [
    'Green pads throw you forward faster than you run.',
    'The ground bleeds it off. Jump while it lasts.',
  ]);
  L.boost(101, GY, 4, +1);
  pit(108, 15);                            // a full bar alone falls short
  ground(123, 150);
  L.boost(125, GY, 3, +1);
  L.rect(129, GY - 6, 8, 5);               // pad into a slide under the low rock
  L.rect(129, GY - 1, 8, 1, T.LOWCEIL);
  L.spikes(130, GY - 7, 6);                // no hopping over the top of it

  // ========================================================== D — phase
  // The flag sits right at the tunnel mouth, so you slide through it on the
  // ground: anything airborne at boost speed would sail clean over it.
  L.checkpoint(138, GY);
  L.sign(140, GY - 1, 'PHASE', [
    'Pink and blue blocks take turns being there.',
    'The pad starts their clock. Hit it and keep going:',
    'jump each edge and every block is there to meet you.',
  ]);
  // A spiked pit with one pink and one blue block, each a full boost-speed
  // jump from the last. The pad fires everyone at the same speed, whatever
  // they arrived with, and restarts the phase clock with 1.0s of pink left:
  // you land on the pink, the sets swap while you are in the air, and the
  // blue is there when you come down. No waiting, no braking in the air.
  L.boost(143, GY, 4, +1, { sync: 0.4 });
  pit(148, 48);
  L.phase(163, GY, 7, 1, 0);               // wide, so an early jump still lands
  // Closer, as the pad's speed bleeds off on the pink and in the air. Long,
  // because a burst does not bleed at all and comes down well past the start.
  L.phase(181, GY, 11, 1, 1);
  ground(196, 210);
  // two-tile steps up to the shaft: vault after vault at a run
  for (let i = 0; i < 4; i++) L.rect(210 + i * 3, GY - 2 * (i + 1), 3, H - GY + 2 * (i + 1));
  L.rect(222, GY - 10, 2, H - GY + 10);
  L.rect(224, GY - 11, 12, H - GY + 11);

  // ========================================================== E — shaft
  // Five wide, like the test area's, but the left wall goes soft halfway up:
  // touch the sand and kick off it at once, or there is nothing to kick off.
  // Slipping back only drops you to the floor for another go.
  L.checkpoint(228, GY - 11);
  L.rect(235, GY - 27, 1, 13);             // left wall, doorway at the bottom
  L.crumble(235, GY - 22, 1, 5);
  L.rect(241, GY - 26, 2, H - GY + 26);    // right wall up to the exit
  ground(236, 241, GY - 11);
  L.crystal(238, GY - 18);

  // ========================================================= F — descent
  L.rect(243, GY - 26, 8, H - GY + 26);    // the summit
  L.sign(247, GY - 27, 'DESCENT', [
    'All of it at once, downhill, to the gate.',
    'Fill the bar on the slope. You will want it.',
  ]);
  L.ramp(251, GY - 1, 26, -1, H - 1);      // a long fall turned into speed
  ground(277, 280);
  pit(280, 14);
  L.crumble(280, GY, 14);                  // at speed it holds; slow, it does not
  ground(294, W);
  // One more phase trench at full tilt: stay up top, or vault out of it. The
  // last four tiles are open sky, because a vault needs headroom where it
  // starts: a block over the exit wall would leave you stood against it.
  L.rect(296, GY, 12, 2, T.EMPTY);
  L.phase(296, GY, 4, 1, 0);
  L.phase(300, GY, 4, 1, 1);
  L.boost(309, GY, 2, +1);
  L.rect(312, GY - 6, 6, 5);               // one last slide ...
  L.rect(312, GY - 1, 6, 1, T.LOWCEIL);
  pit(319, 10);                            // ... out over one last pit
  L.crystal(324, GY - 3);

  // ===================================================== G — the crystals
  // A first look at a crystal: it hands your dash back in mid-air. Here it is
  // only a safety net: the pad's leap clears the pit on its own, and the
  // crystal waits at the top of it for anyone who left the edge late and
  // needs a dash to make the far side. (Out on the skyline, crystals are not
  // a net: they are the only way across.)
  L.checkpoint(333, GY);
  L.sign(335, GY - 1, 'CRYSTALS', [
    'A crystal hands your dash back in mid-air.',
    'Here it is just a safety net. On the skyline,',
    'it will be the only thing between you and the sky.',
  ]);
  L.boost(336, GY, 3, +1);
  pit(340, 18);
  L.crystal(350, GY - 6);
  L.goal = { x: 378 * TILE, y: (GY - 4) * TILE, w: TILE * 2, h: TILE * 4, hit: false };

  // ---- scenery -----------------------------------------------------------
  for (let i = 0; i < 90; i++) {
    const tx = 3 + ((i * 37) % (W - 8));
    const ty = GY - 1 - ((i * 13) % 9);
    if (L.get(tx, ty) === T.EMPTY && L.get(tx, ty + 1) === T.SOLID) L.set(tx, ty, T.DECO);
  }

  return L;
}
