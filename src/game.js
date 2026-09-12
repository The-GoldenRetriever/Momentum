// game.js — ties the level, the player and the world objects together.

import { buildTestArea } from './levels/test-area.js';
import { TILE, clamp } from './level.js';
import { Player, P } from './player.js';
import { Fx } from './particles.js';
import { Camera } from './camera.js';
import { Renderer, VIEW_W, VIEW_H } from './render.js';
import { drawHud } from './hud.js';
import { BindMenu } from './binds.js';
import { sfx } from './audio.js';

const CRYSTAL_RESPAWN = 2.2;
const BEST_KEY = 'momentum.best.testarea';

export class Game {
  // `input` is optional: the headless frame grabber drives the game with its
  // own key stub and has no binding screen.
  constructor(ctx, input = null) {
    this.ctx = ctx;
    this.menu = input ? new BindMenu(input) : null;
    this.level = buildTestArea();
    this.fx = new Fx();
    this.player = new Player(this.level, this.fx);
    this.cam = new Camera(VIEW_W, VIEW_H, this.level);
    this.renderer = new Renderer(ctx, this.level);
    this.cam.snapTo(this.player.cx, this.player.cy);

    // ?at=<tile x>[&ay=<tile y>] drops you straight into a section — handy for testing
    const q = new URLSearchParams(location.search);
    if (q.has('at')) {
      this.level.spawn = { x: Number(q.get('at')) * TILE, y: (Number(q.get('ay') ?? 26)) * TILE };
      this.player.reset(this.level.spawn.x, this.level.spawn.y);
      this.cam.snapTo(this.player.cx, this.player.cy);
    }
    this.spawnPoint = { ...this.level.spawn };
    this.time = 0;
    this.running = false;
    this.finished = false;
    this.debug = false;
    this.muted = false;
    this.fps = 60;
    this.timeScale = 1;
    this.activeSign = null;
    this.banner = 'MOMENTUM';
    this.bannerSub = 'test area — move to start';
    this.bannerT = 3.2;
    this.best = Number(localStorage.getItem(BEST_KEY)) || 0;
  }

  // ------------------------------------------------------------------ loop
  update(dt, input, realDt = dt) {
    const p = this.player;

    // The binding screen freezes the run outright — the clock included.
    if (this.menu?.open) { this.menu.update(realDt); return; }
    if (this.menu && input.hit('keys')) { this.menu.show(); return; }

    if (input.hit('debug')) this.debug = !this.debug;
    if (input.hit('mute')) this.muted = sfx.toggleMute();
    if (input.hit('restart')) this.restart();
    if (input.hit('respawn') && !p.dead) p.kill();

    p.update(dt, input, realDt);

    if (p.dead && p.deadTimer <= 0) this.respawn();

    if (!p.dead) {
      this.#pickups();
      this.#signs();
      this.#speedFx(dt);
    }

    if (this.running && !this.finished) this.time += dt;
    if (!this.running && (Math.abs(p.vx) > 8 || !p.grounded)) { this.running = true; this.bannerT = Math.min(this.bannerT, 0.6); }

    for (const c of this.level.crystals) if (c.t > 0) c.t = Math.max(0, c.t - dt);
    for (const s of this.level.springs) if (s.t > 0) s.t = Math.max(0, s.t - dt);

    this.fx.update(dt);
    this.cam.follow(p, dt);
    this.renderer.updateScarf(p, dt);
    this.bannerT -= dt;
  }

  draw(dt, realDt = dt) {
    this.renderer.draw(this, dt, realDt);
    drawHud(this.ctx, this);
    this.menu?.draw(this.ctx);
  }

  // -------------------------------------------------------------- entities
  #pickups() {
    const p = this.player;
    const L = this.level;

    for (const c of L.crystals) {
      if (c.t > 0) continue;
      if (Math.abs(c.x - p.cx) < 10 + p.w / 2 && Math.abs(c.y - p.cy) < 10 + p.h / 2) {
        if (p.dashes >= p.maxDashes && p.grounded) continue;   // don't waste it
        c.t = CRYSTAL_RESPAWN;
        p.refillDash();
      }
    }

    for (const s of L.springs) {
      const hit = p.x + p.w > s.x + 1 && p.x < s.x + TILE - 1 &&
                  p.footY > s.y + 6 && p.y < s.y + TILE;
      if (hit && p.vy >= -10) {
        p.y = s.y + 6 - p.h;
        p.bounce();
        s.t = 0.25;
      }
    }

    for (const c of L.checkpoints) {
      if (c.on) continue;
      if (Math.abs(c.x - p.cx) < 16 && Math.abs(c.y - 8 - p.cy) < 26) {
        c.on = true;
        this.spawnPoint = { x: c.x - p.w / 2, y: c.y - p.h - 2 };
        this.fx.burst(c.x, c.y - 12, 14, '#7dffc4');
        sfx.checkpoint();
        this.#say('CHECKPOINT', null, 1.1);
      }
    }

    const g = L.goal;
    if (g && !g.hit && p.x + p.w > g.x && p.x < g.x + g.w && p.footY > g.y && p.y < g.y + g.h) {
      g.hit = true;
      this.finished = true;
      this.fx.burst(g.x + g.w / 2, g.y + g.h / 2, 40, '#7dffc4');
      this.fx.shake(6);
      sfx.goal();
      if (!this.best || this.time < this.best) {
        this.best = this.time;
        localStorage.setItem(BEST_KEY, String(this.time));
        this.#say('NEW BEST', 'press T to run it again', 4);
      } else {
        this.#say('FINISH', 'press T to run it again', 4);
      }
    }
  }

  #signs() {
    const p = this.player;
    let nearest = null, bestD = 44;
    for (const s of this.level.signs) {
      const d = Math.hypot(s.x + 8 - p.cx, s.y + 8 - p.cy);
      if (d < bestD) { bestD = d; nearest = s; }
    }
    this.activeSign = nearest;
  }

  /** Air tearing past: the streaks start where a sprint does and thicken with
   *  speed, so the screen itself tells you how fast you are going. */
  #speedFx(dt) {
    const p = this.player;
    const sp = Math.abs(p.vx);
    if (sp < P.TRAIL_SPEED) return;
    const rate = 12 + (sp - P.TRAIL_SPEED) * 0.12;
    if (Math.random() < dt * rate) {
      this.fx.speedLine(p.cx - Math.sign(p.vx) * 11, p.y + 1 + Math.random() * p.h, -p.vx * 0.3);
    }
  }

  #say(text, sub, dur) {
    this.banner = text;
    this.bannerSub = sub;
    this.bannerT = dur;
  }

  // ------------------------------------------------------------- lifecycle
  respawn() {
    const p = this.player;
    p.reset(this.spawnPoint.x, this.spawnPoint.y);
    this.renderer.scarf = null;
    this.cam.snapTo(p.cx, p.cy);
    this.fx.burst(p.cx, p.cy, 12, '#9cf6ff');
  }

  restart() {
    const L = this.level;
    for (const c of L.checkpoints) c.on = false;
    for (const c of L.crystals) c.t = 0;
    if (L.goal) L.goal.hit = false;
    this.spawnPoint = { ...L.spawn };
    this.time = 0;
    this.running = false;
    this.finished = false;
    this.respawn();
    this.player.deaths = 0;
    this.#say('RUN RESET', 'timer starts when you move', 1.6);
  }
}
