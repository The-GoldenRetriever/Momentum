// camera.js — follows with a soft deadzone plus velocity look-ahead.

import { clamp } from './level.js';

export class Camera {
  constructor(vw, vh, level) {
    this.vw = vw; this.vh = vh;
    this.level = level;
    this.x = 0; this.y = 0;
    this.lookX = 0; this.lookY = 0;
  }

  snapTo(px, py) {
    this.lookX = 0; this.lookY = 0;
    this.x = px - this.vw / 2;
    this.y = py - this.vh / 2;
    this.#clamp();
  }

  follow(p, dt) {
    // at burst speed you need to see a lot further down the track
    const reach = p.bursting ? 150 : 70;
    const targetLookX = clamp(p.vx * 0.22, -reach, reach);
    const targetLookY = clamp(p.vy * 0.10, -34, 52);
    this.lookX += (targetLookX - this.lookX) * Math.min(1, dt * (p.bursting ? 5 : 3.2));
    this.lookY += (targetLookY - this.lookY) * Math.min(1, dt * 2.4);

    const tx = p.cx + this.lookX - this.vw / 2;
    const ty = p.cy + this.lookY - this.vh / 2 - 8;
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
