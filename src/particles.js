// particles.js — dust, sparks, screen shake and speed lines. Pure math.

export class Fx {
  constructor() {
    this.parts = [];
    this.shakeAmt = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.lines = [];
  }

  #add(p) { if (this.parts.length < 700) this.parts.push(p); }

  dust(x, y, vx = 0, n = 4, colour = '#b9b2d6') {
    for (let i = 0; i < n; i++) {
      this.#add({
        x, y: y - 1,
        vx: vx * (0.4 + Math.random()) + (Math.random() - 0.5) * 40,
        vy: -Math.random() * 55 - 8,
        life: 0.22 + Math.random() * 0.3, max: 0.5,
        size: Math.random() < 0.4 ? 2 : 1,
        colour, grav: 160,
      });
    }
  }

  burst(x, y, n = 10, colour = '#9cf6ff') {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      const sp = 60 + Math.random() * 150;
      this.#add({
        x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.2 + Math.random() * 0.35, max: 0.55,
        size: Math.random() < 0.5 ? 2 : 1,
        colour, grav: 40,
      });
    }
  }

  sparkle(x, y, colour = '#ffe6a8') {
    this.#add({
      x, y, vx: (Math.random() - 0.5) * 20, vy: -20 - Math.random() * 20,
      life: 0.3 + Math.random() * 0.3, max: 0.6, size: 1, colour, grav: -10,
    });
  }

  /** A streak tearing past. `x` is the end the streak starts from — it always
   *  lies behind whatever is moving, so it never draws across it. */
  speedLine(x, y, vx) {
    const len = 6 + Math.abs(vx) / 22;
    this.lines.push({ x: vx < 0 ? x - len : x, y, vx, life: 0.14, max: 0.14, len });
  }

  shake(amount) { this.shakeAmt = Math.max(this.shakeAmt, amount); }

  update(dt) {
    for (const p of this.parts) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.grav * dt;
      p.vx *= 1 - Math.min(1, dt * 3);
    }
    this.parts = this.parts.filter((p) => p.life > 0);

    for (const l of this.lines) { l.life -= dt; l.x += l.vx * dt * 0.35; }
    this.lines = this.lines.filter((l) => l.life > 0);

    this.shakeAmt *= Math.pow(0.0015, dt);
    if (this.shakeAmt < 0.05) this.shakeAmt = 0;
    this.shakeX = (Math.random() - 0.5) * 2 * this.shakeAmt;
    this.shakeY = (Math.random() - 0.5) * 2 * this.shakeAmt;
  }
}
