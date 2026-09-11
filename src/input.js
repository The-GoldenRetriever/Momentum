// input.js — keyboard + gamepad, exposed as named actions with press/release edges.

const BINDINGS = {
  left:  ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up:    ['ArrowUp', 'KeyW'],
  down:  ['ArrowDown', 'KeyS'],
  jump:  ['Space', 'KeyZ', 'KeyC'],
  dash:  ['ShiftLeft', 'ShiftRight', 'KeyX', 'KeyJ'],
  respawn: ['KeyR'],
  restart: ['KeyT'],
  mute:  ['KeyM'],
  debug: ['F1'],
};

const PAD = { // standard gamepad button indices
  jump: [0, 3],
  dash: [2, 1, 5, 7],
  left: [14], right: [15], up: [12], down: [13],
};

export class Input {
  constructor(target = window) {
    this.down = new Set();
    this.pressed = new Set();
    this.released = new Set();
    this.padPrev = new Set();

    target.addEventListener('keydown', (e) => {
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
    for (const [action, codes] of Object.entries(BINDINGS)) if (codes.includes(code)) out.push(action);
    return out;
  }

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

  held(a) { return this.down.has(a); }
  hit(a) { return this.pressed.has(a); }
  let_go(a) { return this.released.has(a); }

  get moveX() { return (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0); }
  get moveY() { return (this.held('down') ? 1 : 0) - (this.held('up') ? 1 : 0); }
}
