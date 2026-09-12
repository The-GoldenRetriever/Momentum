// art.js — hand-authored pixel art, built into offscreen canvases at load time.
// Every sprite is a list of strings; one character = one pixel = one palette entry.
//
// The sheet is 16x18 so there is room for reaching arms, a feet-first slide and
// the vault poses. Sprites are drawn foot-anchored: row 17 sits on the ground.

export const PAL = {
  '.': null,          // transparent
  k: '#15101f',       // outline
  K: '#241b3a',       // inner shadow
  h: '#3b2f5c',       // hair
  H: '#5a4a8a',       // hair highlight
  s: '#f8d4a8',       // skin
  S: '#d9a375',       // skin shade
  w: '#ffffff',       // eye glint / specular
  e: '#1e1830',       // eye
  c: '#3ac9ad',       // coat
  C: '#1f8f7b',       // coat shade
  L: '#74f0d2',       // coat highlight
  b: '#f4b942',       // belt
  B: '#b8811f',       // belt shade
  p: '#4a4372',       // trousers
  P: '#322c52',       // trousers shade
  n: '#8c6a46',       // boot
  N: '#5c4429',       // boot shade
  r: '#ef5a5a',       // scarf
  R: '#b83b4c',       // scarf shade
  g: '#9cf6ff',       // goggle glass
  G: '#2b2440',       // goggle frame
};

export const SPRITE_W = 16;
export const SPRITE_H = 18;

// --- tiny row helpers -----------------------------------------------------
const BLANK = '.'.repeat(SPRITE_W);

/** Author-time guard: every row must be hand-drawn at exactly SPRITE_W. */
function rows(...list) {
  for (const r of list) {
    if (r.length !== SPRITE_W) throw new Error(`row width ${r.length} != ${SPRITE_W}: "${r}"`);
  }
  return list;
}

/** Paint `top` over `base`; '.' in `top` lets the base show through. */
function over(base, top) {
  return base.map((row, y) => {
    const t = top[y] ?? BLANK;
    let out = '';
    for (let x = 0; x < SPRITE_W; x++) out += t[x] === '.' ? row[x] : t[x];
    return out;
  });
}

/** Shift a block horizontally (positive = right), keeping the width. */
function nudge(block, dx) {
  if (!dx) return block;
  return block.map((row) => {
    const pad = '.'.repeat(Math.abs(dx));
    return dx > 0 ? (pad + row).slice(0, SPRITE_W) : (row + pad).slice(-SPRITE_W);
  });
}

/** Mirror a block left-to-right / top-to-bottom — the roll cycle is one ball
 *  drawing turned four ways, which is both cheaper and steadier than four. */
const flipX = (block) => block.map((row) => [...row].reverse().join(''));
const flipY = (block) => [...block].reverse();

/** Pad a pose out to a full sheet, anchoring its last row at the feet. */
function sheet(list) {
  const out = [...list];
  while (out.length < SPRITE_H) out.unshift(BLANK);
  return out.slice(out.length - SPRITE_H);
}

// --- character parts ------------------------------------------------------
// Head: rows 1-7, torso: rows 8-12, legs: rows 13-17.

const HEAD = {
  level: rows(
    '.......kkkk.....',
    '.....khhhhhhk...',
    '....khHGgggGk...',
    '....khhssssSk...',
    '....khhssewSk...',
    '....khhsssSk....',
    '.....kkSssk.....',
  ),
  up: rows(
    '.......kkkk.....',
    '.....khhhhhhk...',
    '....khHGgggGk...',
    '....khhsssSSk...',
    '....khhsewssk...',
    '....khhssssk....',
    '.....kkSssk.....',
  ),
  down: rows(
    '................',
    '.......kkkkk....',
    '.....khhhhhhk...',
    '....khHGgggGk...',
    '....khhsssSk....',
    '....khhsewSk....',
    '.....kkssskk....',
  ),
  // flat out: the hair is pulled off the forehead and streaming behind, and
  // the chin is down over the goggles. Same face, so the sprint still reads
  // as the same person as the run.
  fast: rows(
    '.......kkkk.....',
    '...kkhhhhhhhk...',
    '..khhhHGgggGk...',
    '..khhhhssssSk...',
    '....khhssewSk...',
    '....khhsssSk....',
    '.....kkSssk.....',
  ),
};

const TORSO = {
  calm: rows(
    '....krrrrrrk....',
    '...kcccLccck....',
    '...kccLccccK....',
    '...kcCcccccK....',
    '...kbbbbbbbk....',
  ),
  // sprint: the scarf is pulled off the shoulder and trailing, and the coat
  // is dragged back with it
  fast: rows(
    '..krrrrrrrrk....',
    '..kkcccLccck....',
    '...kccLccccK....',
    '...kcCcccccK....',
    '...kbbbbbbbk....',
  ),
};

// Arms are painted over the torso rows, so they read as being in front.
const ARMS = {
  idle: rows(
    '................',
    '..kCk......kck..',
    '..kCk......kck..',
    '..kKk......ksk..',
    '...k........k...',
  ),
  fwd: rows(                       // front arm swung forward, back arm behind
    '................',
    '..kCk......kck..',
    '.kCk........kck.',
    '.kKk.........ksk',
    '..k...........k.',
  ),
  back: rows(                      // front arm swung back
    '................',
    '...kCk.....kck..',
    '..kCk......kck..',
    '.kKk......kck...',
    '..k.......ksk...',
  ),
  brace: rows(                     // both arms out, landing / balance
    '................',
    '.kCk.......kck..',
    'kCk.........kck.',
    'kKk..........ksk',
    '.k............k.',
  ),
  up: rows(                        // reaching up and forward
    '..........kck...',
    '..kCk....kck....',
    '..kCk.....kk....',
    '..kKk...........',
    '...k............',
  ),
  wall: rows(
    '................',
    '..kck......kCk..',
    '..ksk......kCk..',
    '...k.......kKk..',
    '............k...',
  ),
  swingF: rows(                    // full drive: lead arm up and out in front
    '............kck.',
    '..kCk......kcck.',
    '.kCk........ksk.',
    'kKk.............',
    '.k..............',
  ),
  swingB: rows(                    // ... and the other half of the same swing
    '..kck...........',
    '.kcck......kCk..',
    '.ksk.......kCk..',
    '...........kKk..',
    '............k...',
  ),
  // sprint pump: lead fist thrown up past the chin, trailing arm straight back
  driveF: rows(
    '...........kck..',
    '..kCk.....kcck..',
    'kCk........ksk..',
    'kKk.............',
    'kk..............',
  ),
  driveB: rows(                    // ... and the recovery half of the same pump
    '..kck...........',
    '.kcck.....kCk...',
    '.ksk.......kCk..',
    '..........kkKk..',
    '...........kk...',
  ),
};

const LEGS = {
  stand: rows(
    '...kpppppppk....',
    '...kppk.kppk....',
    '...kppk.kppk....',
    '...kppk.kppk....',
    '...knnk.knnk....',
  ),
  run0: rows(
    '...kpppppppk....',
    '..kppk...kppk...',
    '.kppk.....kppk..',
    '.knnk......kppk.',
    '.kkk.......knnk.',
  ),
  run1: rows(
    '...kpppppppk....',
    '...kppkkppk.....',
    '...kpk.kppk.....',
    '..knnk..kppk....',
    '..kkk...knnk....',
  ),
  run2: rows(
    '...kpppppppk....',
    '...kppkkppk.....',
    '..kppk..kpk.....',
    '..kppk..knnk....',
    '..knnk...kkk....',
  ),
  run3: rows(
    '...kpppppppk....',
    '..kppk...kppk...',
    '.kppk......kpk..',
    '.kppk......knnk.',
    '.knnk.......kk..',
  ),
  run4: rows(
    '...kpppppppk....',
    '...kppkkppk.....',
    '...kppk.kpk.....',
    '....kppk.knnk...',
    '....knnk..kkk...',
  ),
  run5: rows(
    '...kpppppppk....',
    '..kppk..kppk....',
    '..kppk...kppk...',
    '..knnk...kppk...',
    '..kkk....knnk...',
  ),
  // Sprint: the same six phases with the boots thrown much further round the
  // circle. A long stride reads as speed where a quick one reads as panic.
  spr0: rows(                      // contact: rear toe driving, lead heel down
    '...kpppppppk....',
    '..kppk...kppk...',
    '.kppk......kppk.',
    'kppk........knnk',
    'knnk............',
  ),
  spr1: rows(                      // pass: over the plant, swing knee snapped up
    '...kpppppppk....',
    '..kppkkpppk.....',
    '..kppk..kpk.....',
    '..kppk..knnk....',
    '..knnk..........',
  ),
  spr2: rows(                      // drive: full split, both feet off the floor
    '...kpppppppk....',
    '..kppkkppk......',
    '.kppk...kppk....',
    'kppk.....kppk...',
    'knnk......knnk..',
  ),
  spr3: rows(                      // contact, other foot: rear boot already up
    '...kpppppppk....',
    '..kppk...kppk...',
    '.kppk......kppk.',
    'knnk........kppk',
    '.kk.........knnk',
  ),
  spr4: rows(                      // pass, other foot
    '...kpppppppk....',
    '...kppppkppk....',
    '....knnkkppk....',
    '.........kppk...',
    '.........knnk...',
  ),
  spr5: rows(                      // drive, other foot
    '...kpppppppk....',
    '..kppk..kppk....',
    '.kppk....kppk...',
    'kppk......kppk..',
    'knnk.......knnk.',
  ),
  jump: rows(
    '...kpppppppk....',
    '...kppk.kppk....',
    '..kppk...kppk...',
    '..knnk....kppk..',
    '...kk.....knnk..',
  ),
  fall: rows(
    '...kPppppppk....',
    '..kppk..kppk....',
    '.kppk....kppk...',
    '.kppk.....kppk..',
    '.knnk......knnk.',
  ),
  wall: rows(
    '...kpppppppk....',
    '...kppkkppk.....',
    '...kppk.kppk....',
    '...kppk..kppk...',
    '...knnk..knnk...',
  ),
  tuck: rows(                      // knees up, feet under the hips
    '...kpppppppk....',
    '..kppkkkpppk....',
    '..kppk..kppk....',
    '..knnk..knnk....',
    '...kk....kk.....',
  ),
};

/** Assemble a standing-ish pose out of head + torso + arms + legs.
 *   `drop`  sinks the head into the shoulders — the idle breath.
 *   `sink`  drops the hips towards planted feet — the weight of a footfall.
 *   `lift`  raises the whole body off the ground — the float between strides.
 *  Between them the run gets a hip that rises and falls instead of gliding. */
function body(legs, { arms = 'idle', head = 'level', torso: shirt = 'calm',
                      lean = 0, drop = 0, sink = 0, lift = 0 } = {}) {
  let h = nudge(HEAD[head], lean);
  if (drop) h = [...Array(drop).fill(BLANK), ...h.slice(0, h.length - drop)];
  // the torso follows the head into the lean, but never by more than two —
  // past that the head leads and the body reads as thrown forward
  const torso = nudge(over(TORSO[shirt], ARMS[arms]), Math.sign(lean) * Math.min(Math.abs(lean), 2));
  // one blank row of headroom per pixel of lift, so a float never shaves the
  // top of the head off
  const upper = [...Array(Math.max(1, lift)).fill(BLANK), ...h, ...torso];
  // ... and the knees come up to pay for it, so the sheet still fits 18 rows
  // (the hips shorten, never the boots — a float with no feet reads as a bug)
  const lower = lift > 1 ? LEGS[legs].slice(lift - 1) : LEGS[legs];
  let stack = sink
    ? [...Array(sink).fill(BLANK), ...upper, ...lower.slice(sink)]
    : [...upper, ...lower];
  if (lift) stack = [...stack.slice(lift), ...Array(lift).fill(BLANK)];
  return sheet(stack);
}

// --- poses that are easier to draw whole than to assemble -----------------

const DASH_POSE = sheet(rows(
  '................',
  '................',
  '........kkkk....',
  '......khhhhhk...',
  '.....khHGgggGk..',
  '.....khhssewSk..',
  '..kkkkkSssskk...',
  '.kccrrrrrrrrk...',
  'kcCcccLcccccck..',
  'kKcccccccccccK..',
  '.kkbbbbbbbbbk...',
  '..kppppppppppk..',
  '.kppk......kppk.',
  '.knnk.......knnk',
  '..kk.........kk.',
));

// Feet-first slide: hips on the deck, lead boot thrown out ahead and up, the
// trailing leg folded under, torso laid back with the scarf streaming behind.
const SLIDE_POSE = sheet(rows(
  '....kkkk........',
  '...khhhhhk......',
  '...khHGggGk..kk.',
  '...khhssewk.knnk',
  '..kkkSsskkkkppnk',
  '.krrkcccccckppk.',
  'kRrkcCcccccppkk.',
  '.kkkbbbbcpppnnk.',
  '..kkkkkkkkkkkk..',
));

// Ten rows tall: a duck has to actually fit under the low rock.
const CROUCH_POSE = sheet(rows(
  '......kkkk......',
  '....khhhhhhk....',
  '....khHGgggGk...',
  '....khhsewSk....',
  '...kkkssskkk....',
  '..kCrrrrrrrkck..',
  '..kCcccLccckkck.',
  '...kbbbbbbbk..k.',
  '..kppppppppk....',
  '..knnk..knnk....',
));

// Turning at speed: feet thrown out ahead of you, weight thrown back against
// them, already facing the way you are about to go.
const SKID = [
  sheet(rows(
    '.......kkkk.....',
    '.....khhhhhhk...',
    '....khHGgggGk...',
    '....khhssewSk...',
    '.....kkSsskk....',
    '..kkrrrrrrkk....',
    '.kCkcccLccckck..',
    'kCkkcCcccccKkck.',
    '.k.kbbbbbbbk..k.',
    '...kppppppppk...',
    '..kppk...kppk...',
    '.kppk.....kppk..',
    '.kppk......kppk.',
    'knnnk......kppk.',
    'kkkkk......knnk.',
  )),
  sheet(rows(
    '.......kkkk.....',
    '.....khhhhhhk...',
    '....khHGgggGk...',
    '....khhssewSk...',
    '.....kkSsskk....',
    '...krrrrrrkk....',
    '..kcccLccckck...',
    '.kCkcCcccccKkck.',
    '..kkbbbbbbbk..k.',
    '...kppppppppk...',
    '..kppk..kppk....',
    '.kppk....kppk...',
    '.kppk.....kppk..',
    'knnk......kppk..',
    'kkk.......knnk..',
    '..........kkk...',
  )),
];

// --- vault up: plant a hand on the lip and swing the legs over ------------

const VAULT_UP = [
  // 0 — reach: last stride before the lip, leading arm thrown up and forward
  sheet(rows(
    '................',
    '................',
    '................',
    '.......kkkk.....',
    '.....khhhhhhk.kk',
    '....khHGgggGkksk',
    '....khhssewSkcck',
    '.....kkSsskkcck.',
    '...kkrrrrrrkck..',
    '..kCkcccLcccck..',
    '..kCkcCccccck...',
    '...kkbbbbbbk....',
    '...kppppppppk...',
    '..kppk.....kppk.',
    '..knnk......kppk',
    '...kk........knn',
    '..............kk',
    '................',
  )),
  // 1 — plant: hand locked on the lip, hips rising, knees pulled in tight
  sheet(rows(
    '................',
    '........kkkk....',
    '......khhhhhk...',
    '.....khHGgggGk..',
    '.....khhssewSk..',
    '......kkSsskk...',
    '...kkrrrrrrkk...',
    '..kCkcccLccckcck',
    '..kCkcCcccccKcck',
    '...kkbbbbbbbkcck',
    '...kppppppppkcck',
    '..kppkkkpppkkcck',
    '..kppk..kppk.ssk',
    '..knnk..knnk.kkk',
    '...kk....kk.....',
    '................',
    '................',
    '................',
  )),
  // 2 — swing: weight over the hand, legs scything forward across the lip
  sheet(rows(
    '................',
    '................',
    '................',
    '.....kkkk.......',
    '...khhhhhk......',
    '..khHGgggGk.....',
    '..khhssewSk.....',
    '...kkSsskk......',
    '..krrrrrrkk.....',
    '.kcccLccccck....',
    '.kcCcccccckppkk.',
    '..kbbbbbbkpppnk.',
    '..kppppppkkknnk.',
    '..kppkkcck.kkk..',
    '..knnk.cck......',
    '...kk..ssk......',
    '.......kkk......',
    '................',
  )),
  // 3 — recover: up on the ledge, arms forward, first stride out of it
  sheet(rows(
    '................',
    '.......kkkk.....',
    '.....khhhhhhk...',
    '....khHGgggGk...',
    '....khhssewSk...',
    '.....kkSsskk....',
    '...krrrrrrk.....',
    '..kcccLccckcck..',
    '..kcCccccckkcck.',
    '..kkbbbbbbk..ssk',
    '...kppppppppkkk.',
    '..kppk....kppk..',
    '.kppk......kppk.',
    '.knnk.......knn.',
    '..kk.........kk.',
    '................',
    '................',
    '................',
  )),
];

// --- roll: take the drop as a forward roll and keep every bit of speed -----

// One tucked ball, turned four ways: boots and head travel round the rim, so
// the cycle reads as a body rotating rather than four unrelated drawings.
const BALL = rows(
  '......kkkk......',
  '....kknncckk....',
  '...knnccccbck...',
  '..kcccccccbcck..',
  '..kccccccbbcck..',
  '..kcccrrcbbcck..',
  '..kccrrgggcck...',
  '...kcchssckk....',
  '....kkhsskk.....',
  '......kkkk......',
);

const ROLL_STAGES = [
  // 0 — step off, trailing hand reaching back for the edge
  sheet(rows(
    '................',
    '................',
    '........kkkk....',
    '......khhhhhk...',
    '.....khHGgggGk..',
    '.....khhssewSk..',
    '......kkSsskk...',
    'kk.kkrrrrrrk....',
    'kcckkcccLccck...',
    '.kcckcCcccck....',
    '..kkkbbbbbbk....',
    '.....kpppppppk..',
    '....kppk...kppk.',
    '....kppk....kppk',
    '....knnk.....knn',
    '.....kk.......kk',
    '................',
    '................',
  )),
  // 1 — absorb: knees deep, hand down, already running out of it
  sheet(rows(
    '................',
    '................',
    '................',
    '.......kkkk.....',
    '.....khhhhhhk...',
    '....khHGgggGk...',
    '....khhsssSk....',
    '....khhsewSk....',
    '.....kkssskk....',
    '..kkrrrrrrkk....',
    '.kcckcccLccckk..',
    '.kcckcCccccckcck',
    '..kkkbbbbbbbkcck',
    '..kpppppppppkssk',
    '.kppk......kppkk',
    '.knnk.......knn.',
    '..kk.........kk.',
    '................',
  )),
];

const ROLL = [
  ROLL_STAGES[0],                       // step off the edge and tuck
  sheet(BALL),                          // ... and away it goes, one ball turned
  sheet(flipX(BALL)),                   //     four ways
  sheet(flipY(flipX(BALL))),
  sheet(flipY(BALL)),
  ROLL_STAGES[1],                       // absorb and run out of it
];

export const FRAMES = {
  idle: [
    body('stand', { arms: 'idle' }),
    body('stand', { arms: 'idle', drop: 1 }),
  ],
  // contact, pass, drive — twice over, with the hips dropping onto each
  // footfall and floating between them
  run: [
    body('run0', { arms: 'swingF', lean: 1, sink: 1 }),
    body('run1', { arms: 'fwd', lean: 1 }),
    body('run2', { arms: 'swingB', lean: 2, lift: 1 }),
    body('run3', { arms: 'swingB', lean: 1, sink: 1 }),
    body('run4', { arms: 'back', lean: 1 }),
    body('run5', { arms: 'swingF', lean: 2, lift: 1 }),
  ],
  // Flat out: the long-stride legs, a bigger arm pump, hair and scarf torn
  // backwards, and the body thrown further over the lead foot. The hips sink
  // onto each contact and float two pixels clear through each drive, so the
  // whole figure bounds instead of sliding.
  sprint: [
    body('spr0', { arms: 'driveF', head: 'fast', torso: 'fast', lean: 2, sink: 1 }),
    body('spr1', { arms: 'fwd', head: 'fast', torso: 'fast', lean: 3 }),
    body('spr2', { arms: 'driveB', head: 'fast', torso: 'fast', lean: 3, lift: 2 }),
    body('spr3', { arms: 'driveB', head: 'fast', torso: 'fast', lean: 2, sink: 1 }),
    body('spr4', { arms: 'back', head: 'fast', torso: 'fast', lean: 3 }),
    body('spr5', { arms: 'driveF', head: 'fast', torso: 'fast', lean: 3, lift: 2 }),
  ],
  jump: [body('jump', { arms: 'up', head: 'up', lean: 1 })],
  fall: [body('fall', { arms: 'brace', head: 'down' })],
  wall: [body('wall', { arms: 'wall', lean: -1 })],
  land: [body('tuck', { arms: 'brace', head: 'down', drop: 2 })],
  skid: SKID,
  dash: [DASH_POSE],
  slide: [SLIDE_POSE],
  crouch: [CROUCH_POSE],
  vault: VAULT_UP,
  roll: ROLL,
};

/** How many frames each animation owns — the player uses this to cycle. */
export const FRAME_COUNT = Object.fromEntries(
  Object.entries(FRAMES).map(([k, v]) => [k, v.length]),
);

// --- baking ---------------------------------------------------------------

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return c;
}

function bake(rowsIn, flip) {
  const c = makeCanvas(SPRITE_W, SPRITE_H);
  const ctx = c.getContext('2d');
  for (let y = 0; y < SPRITE_H; y++) {
    const row = (rowsIn[y] ?? '').padEnd(SPRITE_W, '.');
    for (let x = 0; x < SPRITE_W; x++) {
      const col = PAL[row[x]];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(flip ? SPRITE_W - 1 - x : x, y, 1, 1);
    }
  }
  return c;
}

// Solid-colour stamp of a sprite, used for dash afterimages.
function tint(src, colour) {
  const c = makeCanvas(src.width, src.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = colour;
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

export const sprites = {};   // sprites[name][dir 0=right,1=left][frame]
export const ghosts = {};    // same shape, flat cyan silhouettes

export function buildArt() {
  for (const [name, frames] of Object.entries(FRAMES)) {
    sprites[name] = [
      frames.map((f) => bake(f, false)),
      frames.map((f) => bake(f, true)),
    ];
    ghosts[name] = [
      sprites[name][0].map((s) => tint(s, '#9cf6ff')),
      sprites[name][1].map((s) => tint(s, '#9cf6ff')),
    ];
  }
}

export { makeCanvas };
