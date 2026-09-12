// test-area.js — one long playground. Every section isolates a mechanic, and
// every section can be entered at full speed from the one before it.

import { Level, T, TILE } from '../level.js';

const W = 330;
const H = 42;
const GY = 30;           // row of the main ground surface

export function buildTestArea() {
  const L = new Level(W, H);
  const ground = (x0, x1, y = GY) => L.rect(x0, y, x1 - x0, H - y);
  const pit = (x0, w) => {
    L.rect(x0, GY, w, H - GY, T.EMPTY);
    L.rect(x0, GY + 4, w, H - GY - 4);
    L.spikes(x0, GY + 3, w);
  };

  // ---- world shell -------------------------------------------------------
  L.rect(0, 0, 2, H);
  L.rect(W - 2, 0, 2, H);
  L.rect(0, 0, W, 1);

  // ======================================================= A — run & jump
  ground(2, 30);
  L.spawn = { x: 6 * TILE, y: (GY - 4) * TILE };
  L.sign(5, GY - 1, 'RUN', [
    'Arrows or WASD to move. Jump: SPACE, Z or J.',
    'Hold a direction: you keep accelerating.',
    'Top speed grows as the FLOW bar fills.',
  ]);
  L.platform(14, GY - 4, 5);
  L.platform(21, GY - 6, 5);
  L.sign(23, GY - 1, 'VAULT', [
    'Ledges are not climbed for you. C (or L) takes them.',
    'Run at one: a VAULT prompt appears over your head.',
    'Press it while the prompt is up and you go over in',
    'your stride, losing nothing. The window is kind.',
  ]);
  L.rect(26, GY - 1, 2, H - GY + 1);      // first ledge: vault it
  pit(30, 5);
  ground(35, 40);
  L.sign(36, GY - 1, 'FALL', [
    'Down + jump drops through thin platforms.',
    'Hold DOWN in the air to fall faster.',
    'Landing on your feet costs speed, and the longer',
    'you were in the air the more it costs. C on the way',
    'off the lip, or just after landing, keeps all of it.',
  ]);

  // ======================================================== B — auto ledges
  L.sign(41, GY - 1, 'LEDGES', [
    'Five up, five down. Call every one of them with C.',
    'Up is a vault, down is a roll — both keep all of it.',
    'HOLD C on the way down and you roll off every one.',
    'Scuffed a landing? Hit C late and you get it back.',
  ]);
  ground(40, 44);
  L.stairs(44, GY - 1, 5, 3, +1, H - 1);   // five 1-tile steps up
  ground(59, 65, GY - 5);
  L.stairs(65, GY - 1, 5, 3, -1, H - 1);   // five 1-tile steps down
  ground(80, 86);

  // ============================================================ C — slopes
  L.sign(81, GY - 1, 'SLOPES', [
    'Ramps convert height into speed.',
    'Run down the long one and clear the gap.',
  ]);
  L.ramp(86, GY - 1, 8, +1, H - 1);        // up
  ground(94, 99, GY - 8);
  L.ramp(99, GY - 1, 8, -1, H - 1);        // down
  ground(107, 112);
  pit(112, 7);
  ground(119, 126);
  L.checkpoint(120, GY);
  L.crystal(115, GY - 4);

  // ========================================================= D — wall jumps
  L.sign(121, GY - 1, 'WALLS', [
    'Slide down walls, jump off them, climb the shaft.',
    'Hold DOWN on a wall to slide faster.',
  ]);
  // shaft: doorway at ground level on the left, sealed above
  L.rect(126, GY - 18, 1, 15);             // left wall, leaves a 2-tile doorway
  L.rect(132, GY - 18, 2, 18);             // right wall, full height
  ground(126, 132);
  L.crystal(129, GY - 9);
  L.rect(132, GY - 19, 22, 1);             // exit ledge along the top
  L.checkpoint(140, GY - 19);
  L.sign(136, GY - 20, 'HEIGHT', [
    'Dash refills when you touch ground, a wall,',
    'or a blue crystal.',
  ]);
  L.platform(148, GY - 13, 4);
  L.platform(143, GY - 8, 4);

  // ============================================================== E — dash
  ground(150, 162);
  L.sign(152, GY - 1, 'DASH', [
    'SHIFT, X or K dashes in any of 8 directions.',
    'A dash hands off into a run faster than you can run.',
    'Dash, then jump immediately: SUPER (long, low, fast).',
    'Dash diagonally into the floor: WAVEDASH.',
  ]);
  pit(162, 34);
  L.rect(168, GY - 2, 5, 2);
  L.crystal(176, GY - 5);
  L.rect(178, GY - 4, 5, 2);
  L.crystal(186, GY - 6);
  L.rect(189, GY - 2, 5, 2);
  ground(196, 210);
  L.checkpoint(198, GY);

  // ============================================================= F — slide
  L.sign(200, GY - 1, 'SLIDE', [
    'DOWN while moving fast throws you in feet first.',
    'Only a slide fits under the low rock.',
    'A slide keeps its speed — jump out the far side.',
    'Let it die under the rock and you are stuck ducking,',
    'crouch-slow, until the roof lets you stand.',
  ]);
  L.rect(210, GY - 6, 14, 5);              // roof block over the tunnel
  L.rect(210, GY - 1, 14, 1, T.LOWCEIL);   // the low lip itself
  ground(210, 224);
  L.ramp(224, GY + 5, 6, -1, H - 1);       // long run-out down to the lower floor

  // =========================================================== G — springs
  ground(230, 264, GY + 5);
  L.checkpoint(232, GY + 5);
  L.sign(233, GY + 4, 'BOUNCE', [
    'Springs refill your dash and fire you upwards.',
    'Steer in the air — you keep every bit of speed.',
  ]);
  L.spring(238, GY + 4);
  L.platform(242, GY - 2, 5);
  L.spring(245, GY - 3);
  L.platform(250, GY - 9, 5);
  L.crystal(254, GY - 12);
  L.spring(253, GY - 10);
  L.rect(256, GY - 14, 8, 1);
  L.checkpoint(260, GY - 14);

  // ============================================================== H — flow
  L.sign(258, GY - 15, 'FLOW', [
    'Everything at once, downhill, to the gate.',
    'Nothing below needs you to stop. Fill the bar.',
  ]);
  L.ramp(264, GY - 4, 10, -1, H - 1);      // long drop-in ramp
  ground(274, 280, GY - 4);
  L.sign(275, GY - 5, 'BURST', [
    'A full FLOW bar is worth one burst: press V.',
    'You go three times a sprint, and the world — the',
    'clock included — drops into slow motion, so there',
    'is still time to read a ledge and call it.',
    'Clipped something? It stays live a beat longer.',
    'DOWN in a burst still slides — the only way under',
    'the low rock at that speed.',
    'The bar is the fuel gauge. Spend it well.',
  ]);
  L.stairs(280, GY - 1, 4, 2, -1, H - 1);  // rolling 1-tile steps down
  ground(288, 292);
  pit(292, 6);
  ground(298, 320);
  L.rect(304, GY - 1, 2, H - GY + 1);      // one last ledge to vault at full tilt
  L.rect(308, GY - 6, 9, 5);
  L.rect(308, GY - 1, 9, 1, T.LOWCEIL);    // slide finish
  ground(320, W - 2);
  L.goal = { x: 324 * TILE, y: (GY - 4) * TILE, w: TILE * 2, h: TILE * 4, hit: false };

  // ---- scenery -----------------------------------------------------------
  for (let i = 0; i < 90; i++) {
    const tx = 3 + ((i * 37) % (W - 8));
    const ty = GY - 1 - ((i * 13) % 9);
    if (L.get(tx, ty) === T.EMPTY && L.get(tx, ty + 1) === T.SOLID) L.set(tx, ty, T.DECO);
  }

  return L;
}
