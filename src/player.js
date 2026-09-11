// player.js — the whole movement feel lives here.
//
// Design rules:
//   * speed is earned slowly and lost reluctantly (the "flow" meter)
//   * nothing that costs speed happens without the player asking for it
//   * small ledges never interrupt a run: step up over them, glue down onto them

import { TILE, T, clamp } from './level.js';
import { sfx } from './audio.js';

export const P = {
  W: 10, H: 14, SLIDE_H: 8,

  GRAVITY: 1500,
  GRAVITY_APEX: 1050,        // floatier near the top of a jump
  FALL_MAX: 640,
  FAST_FALL: 900,

  RUN_BASE: 190,             // top speed with no flow built up
  RUN_FLOW: 140,             // extra top speed at full flow
  ACCEL: 1500,
  ACCEL_AIR: 1150,
  TURN_BOOST: 2.1,           // how much faster you accelerate when reversing
  FRICTION: 1700,
  FRICTION_AIR: 220,
  OVERSPEED_DRAG: 260,       // gentle bleed when moving faster than your top speed

  JUMP_V: 420,
  JUMP_CUT: 0.42,
  COYOTE: 0.10,
  JUMP_BUFFER: 0.12,

  DASH_SPEED: 560,
  DASH_TIME: 0.14,
  DASH_END: 330,             // dashes hand off into a run faster than you can run
  DASH_COOL: 0.14,
  DASH_REFILL_DELAY: 0.08,

  SUPER_WINDOW: 0.16,        // jump this soon after a dash for a super / hyper
  SUPER_X: 450,
  HYPER_X: 500,
  WAVEDASH_X: 500,

  WALL_SLIDE: 130,
  WALL_SLIDE_FAST: 320,
  WALL_JUMP_X: 340,
  WALL_JUMP_Y: 400,
  WALL_COYOTE: 0.10,
  WALL_LOCK: 0.11,           // input towards the wall is ignored this long

  CROUCH_MAX: 95,            // you can still shuffle along while ducked
  SLIDE_ENTER: 150,
  SLIDE_EXIT: 105,
  SLIDE_FRICTION: 150,
  SLIDE_JUMP_Y: 380,
  SLIDE_BOOST: 40,

  SLOPE_DOWNHILL: 340,       // free acceleration running downhill
  SLOPE_UPHILL: 210,
  SLOPE_SLIDE_MULT: 1.9,

  STEP_MIN_SPEED: 55,
  STEP_MIN: 5,
  STEP_MAX: 19,              // enough to clear a full tile at sprint speed
  STEP_SPEED_FULL: 200,       // a sustained run clears a full tile
  MANTLE_HOLD: 0.18,          // hold into a ledge this long and you climb it
  SNAP_BASE: 7,
  SNAP_SPEED: 0.055,
  SNAP_MAX: 22,

  SPRING_V: 700,
};

export class Player {
  constructor(level, fx) {
    this.level = level;
    this.fx = fx;
    this.reset(level.spawn.x, level.spawn.y);
    this.deaths = 0;
  }

  reset(x, y) {
    this.x = x; this.y = y;
    this.w = P.W; this.h = P.H;
    this.vx = 0; this.vy = 0;
    this.facing = 1;
    this.grounded = false;
    this.wasGrounded = false;
    this.wallDir = 0;
    this.sliding = false;
    this.crouching = false;
    this.dead = false;
    this.deadTimer = 0;
    this.dashes = 1;
    this.maxDashes = 1;
    this.flow = 0;
    this.anim = { name: 'idle', t: 0, frame: 0 };
    this.t = {
      coyote: 0, buffer: 0, dash: 0, dashCool: 0, refill: 0, super: 0,
      wallCoyote: 0, wallLock: 0, noSnap: 0, stepFx: 0, runFx: 0, land: 0, drop: 0, mantle: 0, bump: 0,
    };
    this.dashDir = { x: 1, y: 0 };
    this.trail = [];
    this.bumpDir = 0;
    this.scarf = null;
  }

  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  get footY() { return this.y + this.h; }
  get dashing() { return this.t.dash > 0; }
  get topSpeed() { return P.RUN_BASE + P.RUN_FLOW * this.flow; }
  get speed() { return Math.abs(this.vx); }
  get sprinting() { return this.speed > P.RUN_BASE * 0.92; }

  kill() {
    if (this.dead) return;
    this.dead = true;
    this.deadTimer = 0.45;
    this.deaths++;
    this.flow = 0;
    this.fx.burst(this.cx, this.cy, 26, '#ef5a5a');
    this.fx.shake(6);
    sfx.death();
  }

  // ------------------------------------------------------------------ update
  update(dt, input) {
    if (this.dead) { this.deadTimer -= dt; return; }

    const L = this.level;
    const t = this.t;
    for (const k of ['coyote', 'buffer', 'dashCool', 'refill', 'super', 'wallCoyote', 'wallLock', 'noSnap', 'stepFx', 'land', 'drop', 'bump'])
      t[k] = Math.max(0, t[k] - dt);

    let ix = input.moveX;
    const iy = input.moveY;
    if (t.wallLock > 0 && Math.sign(ix) === -Math.sign(this.vx) && this.wallDir === 0) ix = 0;

    if (input.hit('jump')) t.buffer = P.JUMP_BUFFER;

    // --- dash start -------------------------------------------------------
    if (input.hit('dash') && this.dashes > 0 && t.dashCool <= 0 && !this.dashing) this.#startDash(ix, iy);

    // --- dash motion ------------------------------------------------------
    if (this.dashing) {
      t.dash -= dt;
      this.vx = this.dashDir.x * P.DASH_SPEED;
      this.vy = this.dashDir.y * P.DASH_SPEED;
      if (t.dash <= 0) this.#endDash();
    } else {
      this.#horizontal(dt, ix);
      this.#vertical(dt, iy);
    }

    // --- jumps ------------------------------------------------------------
    if (t.buffer > 0) {
      if (iy > 0 && this.grounded && this.#onOneWay()) this.#dropThrough();
      else if (this.wallDir !== 0 || t.wallCoyote > 0) this.#wallJump();
      else if (this.grounded || t.coyote > 0) this.#jump(ix);
    }
    if (input.let_go('jump') && this.vy < -60 && !this.dashing) this.vy *= P.JUMP_CUT;

    // --- slide / crouch ---------------------------------------------------
    this.#slideState(dt, iy, ix);

    // --- integrate --------------------------------------------------------
    this.wasGrounded = this.grounded;
    if (this.grounded) this.#slopeLift();
    this.#moveX(this.vx * dt);
    if (this.grounded) this.#slopeLift();
    this.#moveY(this.vy * dt, dt);
    this.#mantle(dt, ix);

    // --- ground state, flow, feedback -------------------------------------
    if (this.grounded) {
      t.coyote = P.COYOTE;
      if (t.refill <= 0) this.dashes = this.maxDashes;
      if (!this.wasGrounded) this.#onLand();
    }
    this.#walls();
    this.#flow(dt, ix);
    this.#animate(dt, ix);
    this.#runFx(dt);

    if (this.vx !== 0 && !this.sliding) this.facing = Math.sign(this.vx);
    else if (ix !== 0 && !this.sliding) this.facing = ix;

    // --- hazards ----------------------------------------------------------
    if (L.boxHitsSpikes(this.x, this.y, this.w, this.h)) this.kill();
    if (this.y > L.killY) this.kill();
  }

  // --------------------------------------------------------------- movement
  #horizontal(dt, ix) {
    const top = this.crouching ? P.CROUCH_MAX : this.topSpeed;
    const onGround = this.grounded;

    if (this.sliding) {
      const fr = P.SLIDE_FRICTION * (ix !== 0 && Math.sign(ix) === Math.sign(this.vx) ? 0.4 : 1);
      this.vx -= Math.sign(this.vx) * fr * dt;
      if (Math.abs(this.vx) < 6) this.vx = 0;
    } else if (ix !== 0) {
      const reversing = Math.sign(ix) !== Math.sign(this.vx) && this.vx !== 0;
      let accel = (onGround ? P.ACCEL : P.ACCEL_AIR) * (reversing ? P.TURN_BOOST : 1) * (this.crouching ? 0.7 : 1);
      if (Math.abs(this.vx) > top && !reversing) accel = 0;   // never fight your own momentum
      this.vx += ix * accel * dt;
      if (Math.abs(this.vx) > top) {
        // over top speed: bleed slowly instead of clamping, so boosts survive
        const drag = P.OVERSPEED_DRAG * (onGround ? 1 : 0.45) * dt;
        this.vx -= Math.sign(this.vx) * Math.min(drag, Math.abs(this.vx) - top);
      }
    } else {
      const fr = (onGround ? P.FRICTION : P.FRICTION_AIR) * dt;
      this.vx -= Math.sign(this.vx) * Math.min(fr, Math.abs(this.vx));
    }

    // slopes: downhill is free speed, uphill costs a little
    if (onGround) {
      const slope = this.level.slopeUnder(this.cx, this.footY);
      if (slope) {
        const downhill = (slope === T.SLOPE_L ? 1 : -1);   // "\" descends towards +x
        const mult = this.sliding ? P.SLOPE_SLIDE_MULT : 1;
        if (Math.sign(this.vx) === downhill || this.vx === 0)
          this.vx += downhill * P.SLOPE_DOWNHILL * mult * dt;
        else if (this.vx !== 0)
          this.vx -= Math.sign(this.vx) * P.SLOPE_UPHILL * dt;
      }
    }
  }

  #vertical(dt, iy) {
    if (this.grounded) return;
    if (this.wallDir !== 0 && this.vy > 0) {
      const fast = iy > 0;
      const cap = fast ? P.WALL_SLIDE_FAST : P.WALL_SLIDE;
      this.vy = Math.min(this.vy + P.GRAVITY * 0.35 * dt, cap);
      return;
    }
    const g = Math.abs(this.vy) < 60 ? P.GRAVITY_APEX : P.GRAVITY;
    this.vy += g * dt * (iy > 0 && this.vy > 0 ? 1.45 : 1);
    const cap = iy > 0 ? P.FAST_FALL : P.FALL_MAX;
    if (this.vy > cap) this.vy = cap;
  }

  #jump(ix) {
    const t = this.t;
    this.vy = -P.JUMP_V;
    // super / hyper: cash a fresh dash in for horizontal speed
    if (t.super > 0) {
      if (this.dashDir.y > 0) { this.vx = this.facing * P.HYPER_X; this.vy = -P.JUMP_V * 0.82; }
      else this.vx = this.facing * Math.max(Math.abs(this.vx), P.SUPER_X);
      this.flow = Math.min(1, this.flow + 0.2);
      this.fx.burst(this.cx, this.footY, 12, '#9cf6ff');
      this.fx.shake(3);
      t.super = 0;
    } else if (this.sliding) {
      this.vx += Math.sign(this.vx || this.facing) * P.SLIDE_BOOST;
      this.vy = -P.SLIDE_JUMP_Y;
    } else if (ix !== 0 && Math.sign(ix) === Math.sign(this.vx)) {
      this.vx += ix * 22;                        // small kick for jumping in your run direction
    }
    this.grounded = false;
    this.sliding = false;
    this.h = P.H;
    t.buffer = 0; t.coyote = 0; t.noSnap = 0.09;
    this.fx.dust(this.cx, this.footY, -Math.sign(this.vx) * 30, 6);
    sfx.jump();
  }

  #wallJump() {
    const dir = this.wallDir !== 0 ? this.wallDir : this.lastWallDir;
    this.vx = -dir * P.WALL_JUMP_X;
    this.vy = -P.WALL_JUMP_Y;
    this.facing = -dir;
    this.t.buffer = 0; this.t.wallCoyote = 0; this.t.wallLock = P.WALL_LOCK; this.t.noSnap = 0.1;
    this.grounded = false;
    this.flow = Math.min(1, this.flow + 0.08);
    this.fx.burst(this.x + (dir > 0 ? this.w : 0), this.cy, 8, '#cbb9ff');
    sfx.wallJump();
  }

  #startDash(ix, iy) {
    let dx = ix, dy = iy;
    if (dx === 0 && dy === 0) { dx = this.facing; dy = 0; }
    const len = Math.hypot(dx, dy);
    this.dashDir = { x: dx / len, y: dy / len };
    this.facing = dx !== 0 ? Math.sign(dx) : this.facing;
    this.dashes--;
    this.t.dash = P.DASH_TIME;
    this.t.dashCool = P.DASH_COOL;
    this.t.refill = P.DASH_REFILL_DELAY;
    this.sliding = false;
    this.h = P.H;
    this.flow = Math.min(1, this.flow + 0.15);
    this.fx.burst(this.cx, this.cy, 14, '#9cf6ff');
    this.fx.shake(3.5);
    sfx.dash();
  }

  #endDash() {
    this.t.dash = 0;
    this.t.super = P.SUPER_WINDOW;
    const d = this.dashDir;
    this.vx = d.x !== 0 ? Math.sign(d.x) * P.DASH_END : this.vx * 0.4;
    this.vy = d.y < 0 ? -170 : 0;
    if (this.grounded) this.vy = 0;
  }

  #slideState(dt, iy, ix) {
    const wantsDown = iy > 0;
    if (!this.sliding && this.grounded && wantsDown && Math.abs(this.vx) >= P.SLIDE_ENTER && !this.dashing) {
      this.sliding = true;
      this.crouching = false;
      this.#setHeight(P.SLIDE_H);
      this.fx.dust(this.cx, this.footY, -Math.sign(this.vx) * 60, 8);
      sfx.slide();
    } else if (this.sliding) {
      const tooSlow = Math.abs(this.vx) < P.SLIDE_EXIT;
      if (!wantsDown && this.#canStand()) { this.sliding = false; this.#setHeight(P.H); }
      else if (tooSlow && wantsDown) this.sliding = false;   // decays into a crouch
      if (this.sliding && this.grounded && Math.random() < dt * 30)
        this.fx.dust(this.cx - Math.sign(this.vx) * 4, this.footY, -Math.sign(this.vx) * 40, 1);
    }
    this.crouching = !this.sliding && this.grounded && wantsDown;
    if (this.crouching && this.h === P.H) this.#setHeight(P.SLIDE_H);
    else if (!this.crouching && !this.sliding && this.h !== P.H && this.#canStand()) this.#setHeight(P.H);
  }

  #canStand() {
    if (this.h === P.H) return true;
    return !this.level.boxHitsWall(this.x, this.y + this.h - P.H, this.w, P.H);
  }

  #setHeight(h) {
    const foot = this.footY;
    this.h = h;
    this.y = foot - h;
  }

  // ----------------------------------------------------------- integration
  #moveX(dx) {
    if (this.t.bump <= 0) this.bumpDir = 0;
    if (dx === 0) return;
    const L = this.level;
    const nx = this.x + dx;
    if (!L.boxHitsWall(nx, this.y, this.w, this.h)) { this.x = nx; return; }

    // Blocked. `flush` is where we would stop; try to step up from there rather
    // than from the overlapping position — this keeps a sprint unbroken.
    const dir = Math.sign(dx);
    const flush = dir > 0
      ? Math.floor((nx + this.w) / TILE) * TILE - this.w - 0.001
      : (Math.floor(nx / TILE) + 1) * TILE + 0.001;
    if (this.#tryStep(flush, nx)) return;

    // Hard wall: stop flush against it and shed some flow.
    this.bumpDir = dir;
    this.t.bump = 0.12;
    this.x = flush;
    if (Math.abs(this.vx) > 240) { this.fx.dust(this.x + (dir > 0 ? this.w : 0), this.cy, -dir * 40, 4); this.flow *= 0.55; }
    this.vx = 0;
  }

  #tryStep(baseX, nx) {
    if (this.dashing) return false;
    if (!(this.grounded || this.t.coyote > 0)) return false;
    const sp = Math.abs(this.vx);
    if (sp < P.STEP_MIN_SPEED) return false;
    const reach = P.STEP_MIN + (P.STEP_MAX - P.STEP_MIN) *
      clamp((sp - P.STEP_MIN_SPEED) / (P.STEP_SPEED_FULL - P.STEP_MIN_SPEED), 0, 1);
    const L = this.level;
    for (let h = 1; h <= reach; h++) {
      const ny = this.y - h;
      if (L.boxHitsWall(baseX, ny, this.w, this.h)) break;        // no room to rise in place
      if (L.boxHitsWall(nx, ny, this.w, this.h)) continue;        // still inside the ledge
      if (!L.boxHasGroundUnder(nx, ny, this.w, this.h)) continue; // nothing to land on
      this.x = nx; this.y = ny;
      this.grounded = true;
      this.t.coyote = P.COYOTE;
      this.t.noSnap = 0;
      if (this.t.stepFx <= 0) {
        this.fx.dust(this.cx, this.footY, -Math.sign(this.vx) * 20, 3, '#ffe6a8');
        this.t.stepFx = 0.08;
        if (h > 6) sfx.ledge();
      }
      return true;
    }
    return false;
  }

  #moveY(dy, dt) {
    const L = this.level;
    const prevFoot = this.footY;
    this.y += dy;
    this.grounded = false;

    if (dy >= 0) {
      const surf = L.floorUnder(this.x + 1, this.x + this.w - 1, prevFoot - 1, this.footY,
        { oneway: this.t.drop <= 0 });
      if (surf !== null) { this.y = surf - this.h; this.vy = 0; this.grounded = true; }
    } else {
      const ceil = L.ceilingAbove(this.x + 1, this.x + this.w - 1, prevFoot - this.h, this.y);
      if (ceil !== null) {
        // corner correction: nudge sideways past a ceiling you only just clipped
        const nudged = this.#cornerCorrect(ceil);
        if (!nudged) { this.y = ceil; this.vy = Math.max(0, this.vy); }
      }
    }

    // Stay glued to the ground across small drops and along slopes.
    if (!this.grounded && this.wasGrounded && this.vy >= 0 && this.t.noSnap <= 0 && !this.dashing) {
      const snap = Math.min(P.SNAP_MAX, P.SNAP_BASE + Math.abs(this.vx) * P.SNAP_SPEED);
      const surf = L.floorUnder(this.x + 1, this.x + this.w - 1, this.footY - 1, this.footY + snap,
        { oneway: this.t.drop <= 0 });
      if (surf !== null) {
        this.y = surf - this.h;
        this.vy = 0;
        this.grounded = true;
        if (this.speed > 200 && this.t.stepFx <= 0) {
          this.fx.dust(this.cx, this.footY, -Math.sign(this.vx) * 30, 2);
          this.t.stepFx = 0.07;
        }
      }
    }

    // Uphill slopes push you up instead of stopping you.
    if (this.grounded || this.wasGrounded) this.#slopeLift();

    // Wavedash: a down-diagonal dash that meets the floor becomes raw speed.
    if (this.grounded && this.dashing && this.dashDir.y > 0 && this.dashDir.x !== 0) {
      this.#endDash();
      this.vx = Math.sign(this.dashDir.x) * P.WAVEDASH_X;
      this.vy = 0;
      this.t.super = P.SUPER_WINDOW;
      this.flow = Math.min(1, this.flow + 0.25);
      this.fx.burst(this.cx, this.footY, 16, '#ffe6a8');
      this.fx.shake(4);
    }
  }

  #onOneWay() {
    const L = this.level;
    const soft = L.floorUnder(this.x + 1, this.x + this.w - 1, this.footY - 1, this.footY + 2);
    const hard = L.floorUnder(this.x + 1, this.x + this.w - 1, this.footY - 1, this.footY + 2, { oneway: false });
    return soft !== null && hard === null;
  }

  /** Ride the surface of a ramp instead of walking into the rock beside it. */
  #slopeLift() {
    const up = this.level.floorUnder(this.x + 1, this.x + this.w - 1,
      this.footY - TILE - 4, this.footY - 0.5, { slopesOnly: true });
    if (up === null) return false;
    this.y = up - this.h;
    if (this.vy > 0) this.vy = 0;
    this.grounded = true;
    return true;
  }

  /** Walked into a ledge too slowly to vault it? Leaning on it climbs up. */
  #mantle(dt, ix) {
    const t = this.t;
    if (!this.grounded || this.sliding || ix === 0 || Math.abs(this.vx) > 70 ||
        this.t.bump <= 0 || this.bumpDir !== ix) {
      t.mantle = 0;
      return;
    }
    t.mantle += dt;
    if (t.mantle < P.MANTLE_HOLD) return;
    const L = this.level;
    const nx = this.x + ix * 3;
    for (let h = 1; h <= P.STEP_MAX + 3; h++) {
      const ny = this.y - h;
      if (L.boxHitsWall(this.x, ny, this.w, this.h)) break;
      if (L.boxHitsWall(nx, ny, this.w, this.h)) continue;
      if (!L.boxHasGroundUnder(nx, ny, this.w, this.h)) continue;
      this.x = nx; this.y = ny;
      this.vx = ix * 95;
      this.grounded = true;
      t.mantle = 0;
      this.fx.dust(this.cx, this.footY, 0, 4, '#ffe6a8');
      sfx.ledge();
      return;
    }
    t.mantle = 0;
  }

  #dropThrough() {
    this.t.drop = 0.18;
    this.t.buffer = 0;
    this.t.noSnap = 0.18;
    this.grounded = false;
    this.y += 2;
    this.vy = Math.max(this.vy, 60);
  }

  #cornerCorrect(ceil) {
    const L = this.level;
    for (const dx of [1, 2, 3, -1, -2, -3]) {
      if (!L.boxHitsWall(this.x + dx, this.y, this.w, this.h)) {
        this.x += dx;
        this.fx.dust(this.cx, this.y, 0, 2);
        return true;
      }
    }
    return false;
  }

  #walls() {
    const L = this.level;
    const l = L.boxHitsWall(this.x - 1.5, this.y + 1, this.w, this.h - 2);
    const r = L.boxHitsWall(this.x + 1.5, this.y + 1, this.w, this.h - 2);
    this.wallDir = this.grounded ? 0 : (r ? 1 : l ? -1 : 0);
    if (this.wallDir !== 0) {
      this.lastWallDir = this.wallDir;
      this.t.wallCoyote = P.WALL_COYOTE;
      if (this.t.refill <= 0) this.dashes = this.maxDashes;
      if (this.vy > 40 && Math.random() < 0.3)
        this.fx.dust(this.x + (this.wallDir > 0 ? this.w : 0), this.cy + 4, -this.wallDir * 20, 1, '#8f86c9');
    }
  }

  #onLand() {
    const impact = clamp(this.vy / P.FALL_MAX, 0, 1);
    this.fx.dust(this.cx, this.footY, 0, 4 + impact * 8);
    this.t.land = 0.12;
    if (impact > 0.25) { this.fx.shake(impact * 5); sfx.land(); }
  }

  #flow(dt, ix) {
    const sp = Math.abs(this.vx);
    const moving = ix !== 0 && Math.sign(ix) === Math.sign(this.vx);
    if (sp > 150 && (moving || this.sliding || !this.grounded)) this.flow += dt * 0.42;
    else if (sp < 70) this.flow -= dt * 1.1;
    else this.flow -= dt * 0.2;
    this.flow = clamp(this.flow, 0, 1);
  }

  #runFx(dt) {
    this.t.runFx -= dt;
    if (this.grounded && this.speed > 120 && this.t.runFx <= 0) {
      this.fx.dust(this.cx - Math.sign(this.vx) * 4, this.footY, -Math.sign(this.vx) * 25, 1);
      this.t.runFx = 0.12 - Math.min(0.07, this.speed / 6000);
      sfx.step();
    }
    // dash / high-speed afterimages
    if (this.dashing || this.speed > this.topSpeed * 0.98) {
      this.trail.push({ x: this.x, y: this.y, h: this.h, facing: this.facing, name: this.anim.name, frame: this.anim.frame, life: 0.22 });
    }
    for (const g of this.trail) g.life -= dt;
    this.trail = this.trail.filter((g) => g.life > 0);
  }

  #animate(dt, ix) {
    const a = this.anim;
    let name = 'idle';
    if (this.dashing) name = 'dash';
    else if (this.sliding) name = 'slide';
    else if (this.crouching || this.h < P.H) name = 'crouch';
    else if (this.wallDir !== 0 && !this.grounded) name = 'wall';
    else if (!this.grounded) name = this.vy < 0 ? 'jump' : 'fall';
    else if (Math.abs(this.vx) > 12) name = 'run';

    if (name !== a.name) { a.name = name; a.t = 0; a.frame = 0; }
    a.t += dt;
    if (name === 'run') {
      const rate = clamp(0.16 - Math.abs(this.vx) / 4200, 0.055, 0.16);
      while (a.t > rate) { a.t -= rate; a.frame = (a.frame + 1) % 4; }
    } else if (name === 'idle') {
      while (a.t > 0.5) { a.t -= 0.5; a.frame = (a.frame + 1) % 2; }
    } else a.frame = 0;
  }

  // --------------------------------------------------------------- pickups
  bounce(power = P.SPRING_V) {
    this.vy = -power;
    this.grounded = false;
    this.sliding = false;
    this.h = P.H;
    this.dashes = this.maxDashes;
    this.t.noSnap = 0.16;
    this.flow = Math.min(1, this.flow + 0.12);
    this.fx.burst(this.cx, this.footY, 14, '#ffe6a8');
    this.fx.shake(3);
    sfx.spring();
  }

  refillDash() {
    this.dashes = this.maxDashes;
    this.t.refill = 0;
    this.fx.burst(this.cx, this.cy, 12, '#9cf6ff');
    sfx.crystal();
  }
}
