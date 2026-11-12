// camera.js — follows with a soft deadzone plus velocity look-ahead.

import { clamp } from './level.js';

export class Camera {
  constructor(vw, vh, level) {
    this.vw = vw; this.vh = vh;
    this.level = level;
    this.x = 0; this.y = 0;
    this.lookX = 0; this.lookY = 0;
    this.vel = 0;
  }

  snapTo(px, py) {
    this.lookX = 0; this.lookY = 0; this.vel = 0;
    this.x = px - this.vw / 2;
    this.y = py - this.vh / 2 + 14;        // (framed as follow frames it)
    this.#clamp();
  }

  follow(p, dt) {
    // A jump at top gear carries about nineteen tiles, so that is how far
    // ahead you need to see before you take it: the look-ahead grows with
    // speed until it does, and on past top gear (a boost pad throws a jump
    // further still). At burst speed, further again.
    const reach = p.bursting ? 160 : 145;
    const targetLookX = clamp(p.vx * 0.27, -reach, reach);
    // Falling, look down harder than you look up rising: an eased follow
    // trails a fall badly, and a landing below you has to stay on screen all
    // the way down onto it.
    // (Rising, barely look up at all: in a runner what matters is where you
    // come down, and a view that drifted up on the way up left it short.)
    const targetLookY = clamp(p.vy * (p.vy > 0 ? 0.16 : 0.04), -16, 84);
    // Gaining speed the way you are already looking, the view runs ahead
    // quickly: a boost pad two tiles from an edge throws you into a jump the
    // slow ease had not yet made room for. Turning or slowing, it stays slow.
    const gaining = Math.sign(targetLookX) === Math.sign(this.lookX) && Math.abs(targetLookX) > Math.abs(this.lookX);
    this.lookX += (targetLookX - this.lookX) * Math.min(1, dt * (gaining ? 9 : p.bursting ? 5 : 3.2));
    this.lookY += (targetLookY - this.lookY) * Math.min(1, dt * (targetLookY > this.lookY ? 4 : 2.4));

    // An eased follow trails a moving target by speed / ease: at top gear that
    // was 55px of the view ahead lost, and every full-speed jump landed off
    // the edge of the screen. Leading by the lag puts the camera where it
    // means to be. The speed is smoothed first, so a wall kick's reversal
    // does not swing the view across and back.
    this.vel += (p.vx - this.vel) * Math.min(1, dt * 6);
    const tx = p.cx + this.lookX + this.vel / 7.5 - this.vw / 2;
    // the player rides a little above the middle: what is coming is mostly
    // below you (drops, landings, spikes), very rarely far overhead
    const ty = p.cy + this.lookY - this.vh / 2 + 14;
    const easeX = Math.min(1, dt * 7.5);
    const easeY = Math.min(1, dt * (p.grounded ? 6 : 4.2));
    this.x += (tx - this.x) * easeX;
    this.y += (ty - this.y) * easeY;
    this.#clamp();
  }

  #clamp() {
    const W = this.level.w * 16, H = this.level.h * 16;
    this.x = clamp(this.x, 0, Math.max(0, W - this.vw));
    this.y = clamp(this.y, -40, Math.max(0, H - this.vh + 40));
  }
}
