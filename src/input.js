// input.js — keyboard + gamepad, exposed as named actions with press/release edges.
// Keyboard bindings are editable at runtime (see binds.js) and saved per browser.

const STORE_KEY = 'momentum.binds';

export const DEFAULT_BINDS = {
  left:  ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up:    ['ArrowUp', 'KeyW'],
  down:  ['ArrowDown', 'KeyS'],
  // Two comfortable hands: Z/X/C/Space for arrow players, J/K/L for WASD ones.
  // Up/W jump too — they stay bound to `up` so aiming a dash upward still works.
  jump:  ['Space', 'KeyZ', 'KeyJ', 'ArrowUp', 'KeyW'],
  dash:  ['ShiftLeft', 'ShiftRight', 'KeyX', 'KeyK'],
  vault: ['KeyC', 'KeyL'],          // ledges: vault up, roll down (hold to chain)
  burst: ['KeyV', 'Semicolon'],     // cash a full flow bar in for bullet time
  respawn: ['KeyR'],
  restart: ['KeyT'],
  mute:  ['KeyM'],
  debug: ['F1'],
  keys:  ['KeyO', 'Escape'],        // opens the binding screen — not rebindable
};

// The rows the binding screen offers, in the order it lists them. `keys` is
// deliberately absent: the one way back into this screen stays where it is.
export const ACTIONS = [
  ['left', 'move left'],
  ['right', 'move right'],
  ['up', 'look up'],
  ['down', 'crouch / fast fall'],
  ['jump', 'jump'],
  ['dash', 'dash'],
  ['vault', 'vault / roll'],
  ['burst', 'burst'],
  ['respawn', 'respawn'],
  ['restart', 'restart run'],
  ['mute', 'mute'],
  ['debug', 'debug overlay'],
];

export const MAX_KEYS = 5;        // per action, so a row always fits on screen

const NAMES = {
  Space: 'SPACE', Enter: 'ENTER', Tab: 'TAB', Backspace: 'BKSP', Delete: 'DEL',
  ShiftLeft: 'L-SHIFT', ShiftRight: 'R-SHIFT', ControlLeft: 'L-CTRL', ControlRight: 'R-CTRL',
  AltLeft: 'L-ALT', AltRight: 'R-ALT', MetaLeft: 'L-CMD', MetaRight: 'R-CMD',
  CapsLock: 'CAPS', Semicolon: 'SEMI', Quote: 'QUOTE', Comma: 'COMMA', Period: 'DOT',
  Slash: 'SLASH', Backslash: 'BSLASH', BracketLeft: 'L-BRKT', BracketRight: 'R-BRKT',
  Minus: 'MINUS', Equal: 'EQUAL', Backquote: 'TILDE', Home: 'HOME', End: 'END',
  PageUp: 'PG-UP', PageDown: 'PG-DN', Insert: 'INS',
};

/** A short, font-safe label for a key code (the font is uppercase A-Z 0-9). */
export function keyName(code) {
  if (NAMES[code]) return NAMES[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Arrow')) return code.slice(5).toUpperCase();   // UP DOWN LEFT RIGHT
  if (code.startsWith('Numpad')) return `NUM ${code.slice(6).toUpperCase()}`;
  return code.toUpperCase();
}

function cloneBinds(src) {
  const out = {};
  for (const a of Object.keys(DEFAULT_BINDS)) out[a] = (src[a] ?? DEFAULT_BINDS[a]).slice(0, MAX_KEYS);
  return out;
}

// Saved bindings are merged over the defaults, so an action added in a later
// version still arrives with keys on it instead of none.
function loadBinds() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    const clean = {};
    for (const [a, codes] of Object.entries(raw)) {
      if (a in DEFAULT_BINDS && Array.isArray(codes)) {
        clean[a] = codes.filter((c) => typeof c === 'string').slice(0, MAX_KEYS);
      }
    }
    delete clean.keys;
    return cloneBinds(clean);
  } catch {
    return cloneBinds({});
  }
}

const PAD = { // standard gamepad button indices
  jump: [0],
  vault: [3],
  dash: [2, 1, 5, 7],
  burst: [6, 4],
  left: [14], right: [15], up: [12], down: [13],
};

export class Input {
  constructor(target = window) {
    this.down = new Set();
    this.pressed = new Set();
    this.released = new Set();
    this.padPrev = new Set();
    this.binds = loadBinds();
    // While set, every keydown goes here instead of becoming an action — that
    // is how the binding screen reads raw keys, including ones it is editing.
    this.grab = null;

    target.addEventListener('keydown', (e) => {
      if (this.grab) { e.preventDefault(); this.grab(e.code, e.repeat); return; }
      const act = this.#actionsFor(e.code);
      if (act.length) e.preventDefault();
      if (e.repeat) return;
      for (const a of act) { this.down.add(a); this.pressed.add(a); }
    });
    target.addEventListener('keyup', (e) => {
      for (const a of this.#actionsFor(e.code)) { this.down.delete(a); this.released.add(a); }
    });
    target.addEventListener('blur', () => this.down.clear());
  }

  #actionsFor(code) {
    const out = [];
    for (const [action, codes] of Object.entries(this.binds)) if (codes.includes(code)) out.push(action);
    return out;
  }

  // ------------------------------------------------------------- rebinding
  keysFor(action) { return this.binds[action] ?? []; }

  /** Puts `code` at the front of an action's list, trimming the oldest key off
   *  the end once it is full. A key may serve two actions (up also jumps). */
  addKey(action, code) {
    if (!(action in this.binds) || action === 'keys') return false;
    const list = this.binds[action].filter((c) => c !== code);
    list.unshift(code);
    this.binds[action] = list.slice(0, MAX_KEYS);
    this.#save();
    return true;
  }

  removeKey(action, code) {
    if (!(action in this.binds)) return;
    this.binds[action] = this.binds[action].filter((c) => c !== code);
    this.#save();
  }

  clearKeys(action) {
    if (!(action in this.binds) || action === 'keys') return;
    this.binds[action] = [];
    this.#save();
  }

  resetBinds() {
    this.binds = cloneBinds({});
    try { localStorage.removeItem(STORE_KEY); } catch { /* private mode */ }
  }

  #save() {
    const out = { ...this.binds };
    delete out.keys;
    try { localStorage.setItem(STORE_KEY, JSON.stringify(out)); } catch { /* private mode */ }
  }

  // ------------------------------------------------------------------ loop
  // Call once per frame, before the update.
  poll() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const now = new Set();
    for (const pad of pads) {
      if (!pad) continue;
      for (const [action, buttons] of Object.entries(PAD)) {
        if (buttons.some((b) => pad.buttons[b]?.pressed)) now.add(action);
      }
      const [ax, ay] = [pad.axes[0] ?? 0, pad.axes[1] ?? 0];
      if (ax < -0.4) now.add('left');
      if (ax > 0.4) now.add('right');
      if (ay > 0.5) now.add('down');
      if (ay < -0.5) now.add('up');
    }
    for (const a of now) { if (!this.padPrev.has(a)) this.pressed.add(a); this.down.add(a); }
    for (const a of this.padPrev) if (!now.has(a)) { this.down.delete(a); this.released.add(a); }
    this.padPrev = now;
  }

  // Call at the end of a frame.
  flush() { this.pressed.clear(); this.released.clear(); }

  /** Drops every held key — used when the game stops listening for a moment. */
  clear() { this.down.clear(); this.pressed.clear(); this.released.clear(); this.padPrev.clear(); }

  held(a) { return this.down.has(a); }
  hit(a) { return this.pressed.has(a); }
  let_go(a) { return this.released.has(a); }

  get moveX() { return (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0); }
  get moveY() { return (this.held('down') ? 1 : 0) - (this.held('up') ? 1 : 0); }
}
