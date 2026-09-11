// art.js — hand-authored pixel art, built into offscreen canvases at load time.
// Every sprite is a list of strings; one character = one pixel = one palette entry.

export const PAL = {
  '.': null,          // transparent
  k: '#191325',       // outline / deep shadow
  h: '#2b2440',       // hair
  s: '#f6cfa1',       // skin
  S: '#d9a173',       // skin shade
  w: '#ffffff',       // eye glint
  c: '#37c2a7',       // coat
  C: '#21937f',       // coat shade
  b: '#f4b942',       // belt / trim
  p: '#46406b',       // legs
  P: '#2f2a4d',       // legs shade
  r: '#ef5a5a',       // scarf
  R: '#b83b4c',       // scarf shade
};

export const SPRITE_W = 12;
export const SPRITE_H = 16;

// --- character parts ------------------------------------------------------
const HEAD = [
  '............',
  '....kkkk....',
  '...khhhhk...',
  '..khssssk...',
  '..khswswk...',
  '..khssssk...',
  '...kkssk....',
];

const TORSO = [
  '..krrrrrk...',
  '..kcccccck..',
  '.kccCccCcck.',
  '.kcccccccck.',
  '..kbbbbbbk..',
];

const LEGS = {
  stand: ['..kppppppk..', '..kppk.kppk.', '..kppk.kppk.', '..kkk...kkk.'],
  run0:  ['..kppppppk..', '.kppk..kppk.', '.kpk....kpk.', 'kkk......kkk'],
  run1:  ['..kppppppk..', '..kppkkppk..', '..kpkkkkpk..', '..kkk..kkk..'],
  run2:  ['..kppppppk..', '...kppkppk..', '..kkpk.kpk..', '.kkk....kk..'],
  run3:  ['..kppppppk..', '..kppk.kppk.', '...kpk..kpk.', '...kk...kkk.'],
  jump:  ['..kppppppk..', '..kppkkppk..', '.kppk..kppk.', '.kkk....kkk.'],
  fall:  ['..kPppppPk..', '.kppk..kppk.', '.kpk...kppk.', '.kk.....kkk.'],
  wall:  ['..kppppppk..', '..kppk.kppk.', '..kppk..kpk.', '..kkk...kk..'],
};

// Shift a block of rows horizontally (positive = right), keeping width.
function nudge(rows, dx) {
  if (!dx) return rows;
  return rows.map((row) => {
    const pad = '.'.repeat(Math.abs(dx));
    return dx > 0 ? (pad + row).slice(0, SPRITE_W) : (row + pad).slice(-SPRITE_W);
  });
}

function body(legs, { lean = 0, bob = 0 } = {}) {
  const head = nudge(HEAD, lean);
  const torso = nudge(TORSO, Math.sign(lean) * Math.min(Math.abs(lean), 1));
  const rows = [...head, ...torso, ...LEGS[legs]];
  if (bob > 0) return ['.'.repeat(SPRITE_W).repeat(1), ...rows.slice(0, SPRITE_H - 1)];
  return rows;
}

// Poses that are easier to draw whole than to assemble.
const DASH_POSE = [
  '............',
  '............',
  '....kkkk....',
  '...khhhhk...',
  '..khssssk...',
  '..khswswk...',
  '...kkssk....',
  '..krrrrrk...',
  '.kcccccccck.',
  'kccCccCcccck',
  '.kcccccccck.',
  '..kbbbbbbk..',
  '.kppppppppk.',
  'kppk....kppk',
  'kkk......kkk',
  '............',
];

const SLIDE_POSE = [
  '............',
  '............',
  '............',
  '............',
  '............',
  '............',
  '............',
  '............',
  '...kkkk.....',
  '..khhhhk....',
  '..hssswkk...',
  '.krrcccccck.',
  'kccCccCcccck',
  'kppppppppppk',
  '.kkkkkkkkkk.',
  '............',
];

const CROUCH_POSE = [
  '............',
  '............',
  '............',
  '............',
  '............',
  '....kkkk....',
  '...khhhhk...',
  '..khssssk...',
  '..khswswk...',
  '...kkssk....',
  '..krrrrrk...',
  '.kcccccccck.',
  '.kccCccCcck.',
  '..kbbbbbbk..',
  '..kppppppk..',
  '..kkk..kkk..',
];

export const FRAMES = {
  idle: [body('stand'), body('stand', { bob: 1 })],
  run: [
    body('run0', { lean: 1 }),
    body('run1', { lean: 1 }),
    body('run2', { lean: 1 }),
    body('run3', { lean: 1 }),
  ],
  jump: [body('jump', { lean: 1 })],
  fall: [body('fall')],
  wall: [body('wall', { lean: -1 })],
  dash: [DASH_POSE],
  slide: [SLIDE_POSE],
  crouch: [CROUCH_POSE],
};

// --- baking ---------------------------------------------------------------

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return c;
}

function bake(rows, flip) {
  const c = makeCanvas(SPRITE_W, SPRITE_H);
  const ctx = c.getContext('2d');
  for (let y = 0; y < SPRITE_H; y++) {
    const row = (rows[y] ?? '').padEnd(SPRITE_W, '.');
    for (let x = 0; x < SPRITE_W; x++) {
      const col = PAL[row[x]];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(flip ? SPRITE_W - 1 - x : x, y, 1, 1);
    }
  }
  return c;
}

// Solid-colour stamp of a sprite, used for dash afterimages and death bursts.
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
export const ghosts = {};    // same shape, flat white-ish silhouettes

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
