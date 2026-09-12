// binds.js — the key-binding screen: pick a row, press the key you want on it.
// It reads raw key codes through Input's `grab` hook, so its own navigation
// keys can never be rebound out from under it.

import { drawText, textWidth } from './font.js';
import { VIEW_W, VIEW_H } from './render.js';
import { ACTIONS, MAX_KEYS, keyName } from './input.js';

const ROW_H = 9;
const PAD_X = 10;
const COL = 128;                  // where the key column starts, inside the panel
const W = 300;
const H = 24 + ACTIONS.length * ROW_H + 24;
const X = Math.round((VIEW_W - W) / 2);
const Y = Math.round((VIEW_H - H) / 2);

const HELP = [
  'up/down: row   enter: add key   bksp: drop last',
  'del: clear row   r: defaults   esc: back to run',
];

export class BindMenu {
  constructor(input) {
    this.input = input;
    this.open = false;
    this.sel = 0;
    this.capturing = false;
    this.note = '';               // one-line feedback under the list
    this.noteT = 0;
    this.blink = 0;
  }

  toggle() { this.open ? this.close() : this.show(); }

  show() {
    this.open = true;
    this.capturing = false;
    this.input.clear();           // nothing stays held across the pause
    this.input.grab = (code, repeat) => this.#key(code, repeat);
  }

  close() {
    this.open = false;
    this.capturing = false;
    this.input.grab = null;
    this.input.clear();
  }

  #say(msg) { this.note = msg; this.noteT = 1.8; }

  #key(code, repeat) {
    const [action, label] = ACTIONS[this.sel];

    if (this.capturing) {
      if (code === 'Escape') { this.capturing = false; this.#say('cancelled'); return; }
      this.capturing = false;
      const full = this.input.keysFor(action).length >= MAX_KEYS &&
                   !this.input.keysFor(action).includes(code);
      this.input.addKey(action, code);
      this.#say(full ? `${keyName(code)} bound — oldest key dropped` : `${keyName(code)} bound to ${label}`);
      return;
    }

    switch (code) {
      case 'ArrowUp': case 'KeyW':
        this.sel = (this.sel - 1 + ACTIONS.length) % ACTIONS.length; break;
      case 'ArrowDown': case 'KeyS':
        this.sel = (this.sel + 1) % ACTIONS.length; break;
      case 'Enter': case 'Space': case 'NumpadEnter':
        if (repeat) break;
        this.capturing = true;
        this.blink = 0;
        this.note = '';
        break;
      case 'Backspace': {
        if (repeat) break;
        const list = this.input.keysFor(action);
        if (!list.length) { this.#say(`${label} has no keys`); break; }
        const gone = list[list.length - 1];
        this.input.removeKey(action, gone);
        this.#say(`${keyName(gone)} removed`);
        break;
      }
      case 'Delete':
        if (repeat) break;
        this.input.clearKeys(action);
        this.#say(`${label} cleared`);
        break;
      case 'KeyR':
        if (repeat) break;
        this.input.resetBinds();
        this.#say('defaults restored');
        break;
      case 'Escape': case 'KeyO':
        if (!repeat) this.close();
        break;
    }
  }

  update(dt) {
    this.blink += dt;
    if (this.noteT > 0) this.noteT = Math.max(0, this.noteT - dt);
  }

  draw(ctx) {
    if (!this.open) return;

    ctx.fillStyle = 'rgba(8,6,15,0.72)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    ctx.fillStyle = 'rgba(14,10,26,0.96)';
    ctx.fillRect(X, Y, W, H);
    ctx.fillStyle = '#3b3163';
    ctx.fillRect(X, Y, W, 1);
    ctx.fillRect(X, Y + H - 1, W, 1);
    ctx.fillRect(X, Y, 1, H);
    ctx.fillRect(X + W - 1, Y, 1, H);

    drawText(ctx, 'controls', X + PAD_X, Y + 7, '#ffd678', 2);
    const gp = 'gamepad is fixed';
    drawText(ctx, gp, X + W - PAD_X - textWidth(gp, 1), Y + 9, '#4b4370', 1);
    ctx.fillStyle = '#2a2348';
    ctx.fillRect(X + 1, Y + 20, W - 2, 1);

    ACTIONS.forEach(([action, label], i) => {
      const ry = Y + 24 + i * ROW_H;
      const on = i === this.sel;
      if (on) {
        ctx.fillStyle = this.capturing ? '#2c2352' : '#241e42';
        ctx.fillRect(X + 2, ry - 1, W - 4, ROW_H - 1);
        ctx.fillStyle = this.capturing ? '#ffd678' : '#63e0b0';
        ctx.fillRect(X + 2, ry - 1, 1, ROW_H - 1);
      }
      drawText(ctx, label, X + PAD_X, ry, on ? '#ffffff' : '#b9b2d6', 1);

      if (on && this.capturing) {
        const show = Math.floor(this.blink * 3) % 2 === 0;
        drawText(ctx, show ? 'press a key   (esc cancels)' : '(esc cancels)', X + COL, ry, '#ffd678', 1);
        return;
      }
      const keys = this.input.keysFor(action);
      if (!keys.length) { drawText(ctx, 'unbound', X + COL, ry, '#6b4060', 1); return; }
      let kx = X + COL;
      keys.forEach((code, k) => {
        const name = keyName(code);
        drawText(ctx, name, kx, ry, k === 0 ? '#9cf6ff' : '#7a6fb5', 1);
        kx += textWidth(name, 1) + 5;
      });
    });

    const footY = Y + 24 + ACTIONS.length * ROW_H + 3;
    ctx.fillStyle = '#2a2348';
    ctx.fillRect(X + 1, footY - 2, W - 2, 1);
    if (this.noteT > 0) {
      drawText(ctx, this.note, X + PAD_X, footY + 1, '#7dffc4', 1);
      drawText(ctx, HELP[1], X + PAD_X, footY + 9, '#564d80', 1);
    } else {
      HELP.forEach((line, i) => drawText(ctx, line, X + PAD_X, footY + 1 + i * 8, '#564d80', 1));
    }
  }
}
