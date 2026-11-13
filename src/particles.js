// particles.js — dust, sparks, shockwave rings, screen shake and speed lines.
// Pure math: the renderer draws them.

export class Fx {
  constructor() {
    this.parts = [];
    this.shakeAmt = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.lines = [];
    this.rings = [];
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
        colour, grav: 40, glow: true,
      });
    }
  }

  /** Water thrown up off a skimmer's heels: a plume that arcs up and back. */
  spray(x, y, dir, speed) {
    const n = 2 + (Math.random() < 0.5 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const r = Math.random();
      this.#add({
        x: x + (Math.random() - 0.5) * 4, y: y - 1,
        vx: dir * (30 + Math.random() * speed * 0.35),
        vy: -(60 + Math.random() * (90 + speed * 0.35)),
        life: 0.25 + Math.random() * 0.3, max: 0.55,
        size: r < 0.35 ? 2 : 1,
        colour: r < 0.3 ? '#ffffff' : r < 0.7 ? '#bfeaff' : '#7fc8ef', grav: 620,
      });
    }
  }

  sparkle(x, y, colour = '#ffe6a8') {
    this.#add({
      x, y, vx: (Math.random() - 0.5) * 20, vy: -20 - Math.random() * 20,
      life: 0.3 + Math.random() * 0.3, max: 0.6, size: 1, colour, grav: -10, glow: true,
    });
  }

  /** A shockwave: a ring that swells to `r` and fades. `flat` squashes it to
   *  an ellipse lying on the ground, for an impact underfoot. */
  ring(x, y, r, colour = '#9cf6ff', life = 0.3, flat = false) {
    if (this.rings.length < 24) this.rings.push({ x, y, r, colour, life, max: life, flat });
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

    for (const r of this.rings) r.life -= dt;
    this.rings = this.rings.filter((r) => r.life > 0);

    for (const l of this.lines) { l.life -= dt; l.x += l.vx * dt * 0.35; }
    this.lines = this.lines.filter((l) => l.life > 0);

    this.shakeAmt *= Math.pow(0.0015, dt);
    if (this.shakeAmt < 0.05) this.shakeAmt = 0;
    this.shakeX = (Math.random() - 0.5) * 2 * this.shakeAmt;
    this.shakeY = (Math.random() - 0.5) * 2 * this.shakeAmt;
  }
}
