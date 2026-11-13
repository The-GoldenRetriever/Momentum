// game.js — ties the level, the player and the world objects together.

import { LEVELS } from './levels/index.js';
import { TILE, clamp } from './level.js';
import { updateMechanics, resetMechanics } from './mechanics.js';
import { Player, P } from './player.js';
import { Fx } from './particles.js';
import { Camera } from './camera.js';
import { Renderer, VIEW_W, VIEW_H } from './render.js';
import { drawHud } from './hud.js';
import { BindMenu } from './binds.js';
import { Menus } from './menus.js';
import { sfx } from './audio.js';
import { WALK_SPEED, WALK_MAX, OFF_EDGE, FADE_TIME, LOAD_TIME, drawLetterbox, drawFade, drawLoading } from './cutscene.js';

import { store, LAST_KEY, AUTO_KEY, migrateSave, seedBoards, bestTime, setBest, lastUnlocked, unlocked } from './save.js';

const RESULTS_DELAY = 0.8;        // let the goal burst play before the panel covers it

// what the player is fed while a panel is up: nothing held, nothing pressed
const IDLE = { held: () => false, hit: () => false, let_go: () => false, moveX: 0, moveY: 0 };
// ... and through the walk-off: right held, and nothing else
const WALK = { held: (a) => a === 'right', hit: () => false, let_go: () => false, moveX: 1, moveY: 0 };

export class Game {
  // `input` is optional: the headless frame grabber drives the game with its
  // own key stub and has no binding screen. `menus` puts the title screen in
  // front of everything; without it the game drops straight into a level.
  constructor(ctx, input = null, { menus = false } = {}) {
    this.ctx = ctx;
    this.menu = input ? new BindMenu(input) : null;
    this.ui = new Menus(this, input);
    this.cutscene = null;            // the walk-off and loading screen, between levels
    this.fx = new Fx();
    this.debug = false;
    this.muted = false;
    this.fps = 60;
    this.timeScale = 1;
    this.fade = 0;
    this.playing = !menus;       // a level is underway (paused or not)

    // ?level=<n> (1-based) picks the level; ?at=<tile x>[&ay=<tile y>] then
    // drops you straight into a section of it — handy for testing
    // (an old save has its times wiped, once: see save.js)
    migrateSave();
    seedBoards();
    // V's switch outlives the player it is flipped on: every level builds a
    // fresh one, which is handed this (see load), and it is saved as it changes
    this.autoBurst = store.get(AUTO_KEY) !== 'off';
    const q = new URLSearchParams(location.search);
    // The menus open on the last level you started, if it is still open to
    // you. ?level= is for testing, and goes anywhere.
    const last = Math.min(Number(store.get(LAST_KEY)) || 0, lastUnlocked());
    const n = clamp(Math.floor(Number(q.get('level') ?? (menus ? last + 1 : 1))) - 1 || 0, 0, LEVELS.length - 1);
    this.load(n);
    if (q.has('at')) {
      this.level.spawn = { x: Number(q.get('at')) * TILE, y: (Number(q.get('ay') ?? 26)) * TILE };
      this.spawnPoint = { ...this.level.spawn };
      resetMechanics(this.level, this.spawnPoint.x);
      this.player.reset(this.level.spawn.x, this.level.spawn.y);
      this.cam.snapTo(this.player.cx, this.player.cy);
    }
    if (menus) this.toTitle();
    else this.banner = 'MOMENTUM';  // the title card, the first time round only
  }

  /** True while a level is underway, paused or not. */
  get inRun() { return this.playing; }

  /** Start level `n` from the top, from a menu. */
  start(n) {
    // through the loading card, the same as arriving from the level before
    // (the level is built behind it: see #cutsceneStep)
    this.ui.close();
    this.cutscene = { phase: 'load', t: 0, loaded: false, next: n };
  }

  /** From the results panel: walk off, load behind a black screen, go. */
  nextLevel() {
    // (a level shut behind medals is not offered: see Menus' results rows)
    if (this.levelIndex + 1 >= LEVELS.length || !unlocked(this.levelIndex + 1)) return;
    this.ui.close();
    this.player.standDown();           // no slow motion through the walk-off
    this.level.exitOpen = true;        // through the end wall and off screen
    // `out` counts up from the moment they are past the edge: the fade
    this.cutscene = { phase: 'walk', t: 0, out: null, next: this.levelIndex + 1 };
  }

  #cutsceneStep(dt, realDt) {
    const cs = this.cutscene;
    cs.t += realDt;
    if (cs.phase === 'walk') {
      const p = this.player;
      p.update(dt, WALK, realDt);
      // held right accelerates into a run; the walk-off is a walk
      if (Math.abs(p.vx) > WALK_SPEED) p.vx = Math.sign(p.vx) * WALK_SPEED;
      this.fx.update(dt);
      this.cam.follow(p, dt);
      this.renderer.updateScarf(p, dt);
      if (cs.out === null && (p.dead || p.x > this.level.w * TILE + OFF_EDGE)) cs.out = 0;
      else if (cs.out !== null) cs.out += realDt;
      if (cs.out >= FADE_TIME || cs.t >= WALK_MAX) { cs.phase = 'load'; cs.t = 0; cs.loaded = false; }
    } else {
      // Build the next level once the black screen has been drawn at least
      // once, so the moment it takes to bake is spent behind it.
      if (!cs.loaded && cs.t > 0.05) {
        this.load(cs.next);
        this.playing = true;
        store.set(LAST_KEY, String(cs.next));
        cs.loaded = true;
      }
      if (cs.loaded && cs.t >= LOAD_TIME) { this.cutscene = null; this.fade = 1; }
    }
  }

  toTitle() {
    this.playing = false;
    // a burst left running would keep the title zoomed in and in slow motion
    this.player.standDown();
    this.ui.show('title');
    this.#attractCam(true);
  }

  /** Called when the window loses focus: a run in progress pauses itself. */
  autoPause() {
    if (!this.ui.open && this.playing && !this.finished && !this.menu?.open) this.ui.show('pause');
  }

  /** Build level `n` from scratch. The renderer bakes its tiles once, so a new
   *  level means a new renderer, not a repaint. */
  load(n) {
    this.levelIndex = n;
    this.levelInfo = LEVELS[n];
    this.level = this.levelInfo.build();
    this.fx.parts.length = 0;
    this.fx.lines.length = 0;
    this.player = new Player(this.level, this.fx);
    this.player.autoBurst = this.autoBurst;
    this.cam = new Camera(VIEW_W, VIEW_H, this.level);
    this.renderer = new Renderer(this.ctx, this.level);
    this.cam.snapTo(this.player.cx, this.player.cy);
    this.spawnPoint = { ...this.level.spawn };
    this.time = 0;
    this.running = false;
    this.finished = false;
    this.activeSign = null;
    this.resultsIn = 0;
    this.newBest = false;
    this.lastRank = null;            // this run's place on the board, once it has one (-1: not on it)
    this.best = bestTime(this.levelInfo);
    this.#say(`LEVEL ${n + 1}`, `${this.levelInfo.name} \u2014 move to start`, 3.2);
  }

  /** The title and level select pan slowly along the level, nobody in it. */
  #attractCam(snap = false, dt = 0) {
    const L = this.level, cam = this.cam;
    const span = Math.max(1, L.w * TILE - VIEW_W);
    if (snap) cam.x = 0;
    cam.x += 26 * dt;
    if (cam.x > span) cam.x = 0;
    cam.y = clamp(L.spawn.y - VIEW_H * 0.62, -40, L.h * TILE - VIEW_H + 40);
  }

  // ------------------------------------------------------------------ loop
  update(dt, input, realDt = dt) {
    const p = this.player;
    this.#remember();
    this.fade = Math.max(0, this.fade - realDt * 2.5);

    // M mutes from anywhere, menus included.
    if (input.hit('mute')) this.muted = sfx.toggleMute();

    // The binding screen freezes everything outright — the run clock included.
    // It reads the keyboard raw, so the gamepad's start or B (which still
    // arrive as actions) is the pad's way back out, or a pad player who
    // opened it would be shut in.
    if (this.menu?.open) {
      if (input.hit('pause') || input.hit('dash')) { this.menu.close(); sfx.menuMove(); return; }
      this.menu.update(realDt);
      return;
    }
    if (this.cutscene) { this.#cutsceneStep(dt, realDt); return; }

    // Title and level select: the world is scenery, panning past.
    const ui = this.ui.screen;
    if (ui === 'title' || ((ui === 'select' || ui === 'board') && !this.playing)) {
      this.ui.update(realDt);
      this.#attractCam(false, realDt);
      return;
    }
    // Pause, and level select reached from it: the run is frozen.
    if (ui === 'pause' || ui === 'select') { this.ui.update(realDt); return; }

    // After the goal: signing the leaderboard, the results, and the board
    // (only ever reached from the results, mid-level, since a run is over)
    const after = (s) => s === 'results' || s === 'initials' || s === 'board';
    if (!after(ui)) {
      if (input.hit('pause') && this.ui.input) { this.ui.show('pause'); sfx.menuMove(); return; }
      if (this.menu && input.hit('keys')) { this.menu.show(); return; }
      if (input.hit('debug')) this.debug = !this.debug;
      if (input.hit('restart')) this.restart();
      if (input.hit('respawn') && !p.dead) p.kill();
    } else {
      this.ui.update(realDt);
      if (!after(this.ui.screen)) return;          // it started something else
    }

    // Once the run is over the player coasts to a stop under the panel.
    p.update(dt, after(ui) ? IDLE : input, realDt);
    if (this.finished) p.standDown();            // (see Player.standDown)
    updateMechanics(this.level, p, dt);
    if (p.autoBurst !== this.autoBurst) {        // V, this step
      this.autoBurst = p.autoBurst;
      store.set(AUTO_KEY, p.autoBurst ? 'on' : 'off');
      this.#say(p.autoBurst ? 'BURST ON' : 'BURST OFF', '', 1.1);
    }

    if (p.dead && p.deadTimer <= 0) this.respawn();

    if (!p.dead && !p.sinking) {
      this.#pickups();
      this.#signs();
      this.#speedFx(dt);
    }

    if (this.running && !this.finished) this.time += dt;
    // The clock waits for you to move. It used to start on "not grounded" as
    // well, and every spawn drops a few pixels onto the floor, so each run and
    // each restart was charged for a fall nobody asked for. A jump on the spot
    // (rising) or a dash still counts as moving.
    if (!this.running && !p.dead && (Math.abs(p.vx) > 8 || p.vy < -1 || p.dashing)) {
      this.running = true;
      this.bannerT = Math.min(this.bannerT, 0.6);
    }
    if (this.finished && this.resultsIn > 0 && this.ui.input) {
      this.resultsIn -= realDt;
      if (this.resultsIn <= 0) this.ui.finishRun();   // (signing the board first, if it made it)
    }

    this.fx.update(dt);
    this.cam.follow(p, dt);
    this.renderer.updateScarf(p, dt);
    this.bannerT -= dt;
  }

  /** Where the player and camera stood before the step now being run. */
  #prev = { player: null, x: 0, y: 0, cam: null, camX: 0, camY: 0 };
  #remember() {
    const s = this.#prev, p = this.player, cam = this.cam;
    s.player = p; s.x = p.x; s.y = p.y;
    s.cam = cam; s.camX = cam.x; s.camY = cam.y;
  }

  /** `alpha` is how far the frame falls between the last physics step and the
   *  next one. Physics ticks at 120Hz, which no display divides evenly (a
   *  144Hz screen gets a step on five frames in six, and a 60Hz one gets 1 or
   *  3 now and then from timer jitter), so drawing whole steps stuttered at
   *  speed. The player and camera are drawn between their last two positions
   *  instead, a step behind at most. A jump too big for one step is a
   *  teleport (respawn, a new level, the title pan wrapping round), and that
   *  is drawn where it landed. */
  draw(dt, realDt = dt, alpha = 1) {
    const s = this.#prev, p = this.player, cam = this.cam;
    const x = p.x, y = p.y, camX = cam.x, camY = cam.y;
    const near = (a, b) => Math.abs(a - b) < 32;
    if (alpha < 1 && s.player === p && near(s.x, x) && near(s.y, y)) {
      p.x = s.x + (x - s.x) * alpha;
      p.y = s.y + (y - s.y) * alpha;
    }
    if (alpha < 1 && s.cam === cam && near(s.camX, camX) && near(s.camY, camY)) {
      cam.x = s.camX + (camX - s.camX) * alpha;
      cam.y = s.camY + (camY - s.camY) * alpha;
    }
    // the scarf is simulated on whole steps, so it rides along with the body
    this.renderer.shiftX = p.x - x;
    this.renderer.shiftY = p.y - y;
    try {
      this.#drawFrame(dt, realDt);
    } finally {
      p.x = x; p.y = y; cam.x = camX; cam.y = camY;
    }
  }

  #drawFrame(dt, realDt) {
    const cs = this.cutscene;
    if (cs && cs.phase === 'load') { drawLoading(this.ctx, cs.t, cs.next, LEVELS[cs.next]); return; }
    if (cs) {                     // the walk-off: the world, bars, and a fade out
      this.renderer.hideActors = false;
      this.renderer.draw(this, dt, realDt);
      drawLetterbox(this.ctx, Math.min(1, cs.t / 0.4));
      drawFade(this.ctx, (cs.out ?? 0) / FADE_TIME);
      return;
    }
    const scenery = this.ui.screen === 'title' || ((this.ui.screen === 'select' || this.ui.screen === 'board') && !this.playing);
    this.renderer.hideActors = scenery;
    this.renderer.draw(this, dt, realDt);
    if (!scenery) drawHud(this.ctx, this);
    this.ui.draw(this.ctx);
    this.menu?.draw(this.ctx);
    if (this.fade > 0) {
      this.ctx.fillStyle = `rgba(8,6,15,${this.fade.toFixed(3)})`;
      this.ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }

  // -------------------------------------------------------------- entities
  #pickups() {
    const p = this.player;
    const L = this.level;

    // (crystals and springs are level furniture: mechanics.js runs them)
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
      this.newBest = !this.best || this.time < this.best;
      if (this.newBest) {
        this.best = this.time;
        setBest(this.levelInfo, this.time);
      }
      this.resultsIn = RESULTS_DELAY;
      // (without menus, as in the frame grabber, the banner is all there is)
      const sub = this.levelIndex + 1 < LEVELS.length
        ? 'T to run it again, N for the next level' : 'press T to run it again';
      this.#say(this.newBest ? 'NEW BEST' : 'FINISH', this.ui.input ? null : sub, this.ui.input ? 1 : 5);
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
    resetMechanics(this.level, this.spawnPoint.x);
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
    L.phaseT = 0;                 // every run meets the phase blocks in the same rhythm
    this.spawnPoint = { ...L.spawn };
    this.time = 0;
    this.running = false;
    this.finished = false;
    this.resultsIn = 0;
    this.newBest = false;
    this.lastRank = null;
    this.respawn();
    this.player.deaths = 0;
    this.#say('RUN RESET', 'timer starts when you move', 1.6);
  }
}
