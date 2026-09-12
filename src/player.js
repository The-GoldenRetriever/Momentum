// player.js — the whole movement feel lives here.
//
// Design rules:
//   * speed is earned slowly and lost reluctantly (the "flow" meter)
//   * nothing that costs speed happens without the player asking for it
//   * tiny bumps never interrupt a run; anything taller is a vault you call

import { TILE, T, clamp } from './level.js';
import { FRAME_COUNT } from './art.js';
import { sfx } from './audio.js';

export const P = {
  W: 10, H: 14, SLIDE_H: 8,

  GRAVITY: 1500,
  GRAVITY_APEX: 1050,        // floatier near the top of a jump
  FALL_MAX: 640,
  FAST_FALL: 900,

  RUN_BASE: 190,             // top speed with no flow built up
  RUN_FLOW: 140,             // extra top speed at one full bar of flow
  FLOW_MAX: 1.6,             // the bar holds more than it spends on running:
                             // the first bar buys speed, the rest is burst fuel
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
  DASH_GAP: 0.22,            // quiet time after a dash ends before the next one:
                             // standing on the floor does not exempt you from it
  DASH_BUFFER: 0.10,         // ... but a press that lands early still fires

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
  STEP_MIN: 3,
  STEP_MAX: 7,               // only scuffs; a real ledge is a vault
  STEP_SPEED_FULL: 160,
  SNAP_BASE: 4,              // the glue is for slope jitter only: a real ledge
  SNAP_SPEED: 0.012,         // has to be dropped off, with air under your feet
  SNAP_MAX: 8,

  // --- vaulting ---------------------------------------------------------
  VAULT_MIN: 7,              // shorter than this and you just step up
  VAULT_MAX: 34,             // a little over two tiles
  VAULT_REACH: 24,           // how far ahead the prompt starts watching
  VAULT_GRACE: 0.30,         // the window stays open this long after the cue
  VAULT_RISE_RATE: 120,      // px of climb per second — a tall lip takes longer
  VAULT_MIN_TIME: 0.10,      // ... but never long enough to break a stride
  VAULT_MAX_TIME: 0.26,
  VAULT_EXIT: 165,           // you always come out of a vault moving
  VAULT_BUFFER: 0.16,        // an early press on the vault key still counts
  MANTLE_HOLD: 0.35,         // lean into a ledge this long and you climb it anyway
  RECENT_FADE: 420,          // px/s per second: how fast "the speed you had" fades

  DROP_MIN: 11,              // ledges shorter than this you simply run off
  DROP_MAX: 52,
  ROLL_TIME: 0.26,
  ROLL_REFUND: 0.20,         // roll this soon after a scuffed drop and it is undone
  ROLL_FREE: 0.60,           // a called roll rides out the whole drop untaxed

  LEDGE_MIN_DROP: 9,         // anything shallower costs nothing
  LEDGE_LOSS: 0.30,          // fraction of your speed an uncalled drop eats
  LEDGE_FULL_DROP: 44,       // ... reaching that fraction at this height
  LEDGE_AIR_FREE: 0.14,      // airtime you can stumble through for nothing
  LEDGE_AIR_FULL: 0.60,      // ... and where the airtime tax tops out
  LEDGE_AIR_LOSS: 0.34,      // extra fraction a long drop on your feet eats
  LEDGE_LOSS_MAX: 0.60,      // no single fumbled landing takes more than this

  // --- burst: spend a full flow bar on bullet time -----------------------
  BURST_SPEED: 980,          // genuinely silly, which is the point
  BURST_FLOW_MIN: 0.9,       // only off a full bar
  BURST_SPEED_MIN: 280,      // ... and only at a real sprint
  BURST_DRAIN: 0.3,          // bar per second while it runs (~3.3s of burst)
  BURST_SCALE: 0.15,         // the world (and the clock) runs this slowly
  BURST_GRACE: 0.35,         // stays cashable this long after you drop off it
  BURST_WIND: 0.09,          // real seconds the world drops away *before* you go:
                             // the press slows time first, then fires you

  // --- animation ----------------------------------------------------------
  SPRINT_ANIM: 170,          // above this the run is thrown properly forward
  STRIDE_SLOW: 0.095,        // seconds per frame at a jog ...
  STRIDE_FAST: 0.046,        // ... and flat out: quick, but the poses still read
  TRAIL_SPEED: 210,          // afterimages start smearing off you here

  // --- turning ------------------------------------------------------------
  SKID_MIN: 165,             // reversing above this reads as a skid, not a turn
  SKID_TAIL: 0.10,           // the brace holds this long after you stop fighting it

  SPRING_V: 700,
};

const smooth = (a) => a * a * (3 - 2 * a);

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
      coyote: 0, buffer: 0, dash: 0, dashCool: 0, dashBuf: 0, refill: 0, super: 0,
      wallCoyote: 0, wallLock: 0, noSnap: 0, stepFx: 0, land: 0, drop: 0,
      mantle: 0, bump: 0, cue: 0, vaultFx: 0, vaultBuf: 0, refund: 0, rollFree: 0,
      burstReady: 0, skid: 0, skidFx: 0, ghost: 0,
    };
    this.dashDir = { x: 1, y: 0 };
    this.trail = [];
    this.bumpDir = 0;
    this.scarf = null;
    this.vault = null;         // the vault currently being played out
    this.cue = null;           // the vault the player could call for right now
    this.vaults = 0;
    this.rolling = 0;          // cosmetic roll (the recovery one keeps you moving)
    this.bursting = false;     // full-flow sprint: very fast, world in slow motion
    this.burstWind = 0;        // armed: counting down the beat before it fires
    this.burstDir = 1;
    this.bursts = 0;
    this.skidDir = 1;          // the way a skid is turning towards
    this.recentSpeed = 0;      // the speed you had a moment ago, for vault payouts
    this.recentFlow = 0;
    this.fallFrom = null;      // foot height when we walked off an edge
    this.lostSpeed = 0;        // banked by a scuffed drop, refunded by a late roll
    this.lostFlow = 0;
    this.airTime = 0;          // how long you have been off the ground
    this.footfall = false;     // a stride just planted a boot — one frame only
  }

  /** Cashable? True while you are at a full-bar sprint, and for a moment after
   *  you drop off it — getting clipped on the way in should not eat the burst. */
  get canBurst() {
    return !this.bursting && this.burstWind <= 0 && !this.dead && !this.vault &&
           this.t.burstReady > 0;
  }

  /** True whenever the world should be running slowly — through the wind-up
   *  beat as well as the burst itself, since the point of the beat is that you
   *  watch the world drop away before you are thrown down it. */
  get timeWarped() { return this.bursting || this.burstWind > 0; }

  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  get footY() { return this.y + this.h; }
  get dashing() { return this.t.dash > 0; }
  get vaulting() { return this.vault !== null; }
  get skidding() { return this.t.skid > 0; }
  // Running tops out at one bar. Flow past that is headroom for the burst, not
  // more sprint — the overfill is fuel you are carrying, not speed you have.
  get topSpeed() { return P.RUN_BASE + P.RUN_FLOW * Math.min(1, this.flow); }
  get speed() { return Math.abs(this.vx); }
  get sprinting() { return this.speed > P.RUN_BASE * 0.92; }

  kill() {
    if (this.dead) return;
    this.dead = true;
    this.deadTimer = 0.45;
    this.deaths++;
    this.flow = 0;
    this.vault = null;
    this.cue = null;
    this.bursting = false;
    this.burstWind = 0;
    this.fx.burst(this.cx, this.cy, 26, '#ef5a5a');
    this.fx.shake(6);
    sfx.death();
  }

  // ------------------------------------------------------------------ update
  //
  // `realDt` is wall-clock time where `dt` is world time — the two differ only
  // while a burst has the world in slow motion. Almost nothing cares; the
  // burst wind-up does, because it is a beat the player watches, not a beat
  // the world takes.
  update(dt, input, realDt = dt) {
    if (this.dead) { this.deadTimer -= dt; return; }

    const L = this.level;
    const t = this.t;
    for (const k of ['coyote', 'buffer', 'dashCool', 'dashBuf', 'refill', 'super', 'wallCoyote',
                     'wallLock', 'noSnap', 'stepFx', 'land', 'drop', 'bump', 'cue',
                     'vaultFx', 'vaultBuf', 'refund', 'rollFree', 'burstReady',
                     'skid', 'skidFx', 'ghost'])
      t[k] = Math.max(0, t[k] - dt);
    this.rolling = Math.max(0, this.rolling - dt);
    // measured from the frame you left the ground, so a landing knows how long
    // it had to think about it
    this.airTime = this.grounded ? 0 : this.airTime + dt;
    this.#remember(dt);

    let ix = input.moveX;
    const iy = input.moveY;
    if (t.wallLock > 0 && Math.sign(ix) === -Math.sign(this.vx) && this.wallDir === 0) ix = 0;

    if (input.hit('jump')) t.buffer = P.JUMP_BUFFER;
    if (input.hit('vault')) t.vaultBuf = P.VAULT_BUFFER;
    if (input.hit('dash')) t.dashBuf = P.DASH_BUFFER;
    if (input.hit('burst') && this.canBurst) this.#armBurst();
    if (this.burstWind > 0) {
      // a stumble into a vault (or into the spikes) during the beat quietly
      // stands the burst down — the readiness window re-opens by itself if you
      // are still running fast enough to deserve it
      if (this.vault) this.burstWind = 0;
      else {
        this.burstWind -= realDt;
        if (this.burstWind <= 0) { this.burstWind = 0; this.#startBurst(); }
      }
    }
    if (this.bursting) this.#burstStep(dt, ix);

    // --- ledge calls -------------------------------------------------------
    // A press takes the ledge in front of you; holding the key takes every
    // descent you meet, so a staircase can be run straight down.
    const holding = input.held('vault');
    if (!this.vault && !this.dashing) {
      if ((t.vaultBuf > 0 || (holding && this.cue?.kind === 'down')) && this.cue) this.#startVault();
      else if ((t.vaultBuf > 0 || holding) && t.refund > 0) this.#recoveryRoll();
    }
    if (this.vault) {
      this.#vaultStep(dt);
      this.#animate(dt, ix);
      this.#runFx(dt);
      if (L.boxHitsSpikes(this.x, this.y, this.w, this.h) || this.y > L.killY) this.kill();
      return;
    }

    // --- dash start -------------------------------------------------------
    // The gap between dashes is not negotiable, on the ground or off it; the
    // buffer means you never have to guess when it is up, only press again.
    if (t.dashBuf > 0 && this.dashes > 0 && t.dashCool <= 0 && !this.dashing) this.#startDash(ix, iy);

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
    this.#unstick();

    // --- ground state, flow, feedback -------------------------------------
    if (this.grounded) {
      t.coyote = P.COYOTE;
      if (t.refill <= 0) this.dashes = this.maxDashes;
      if (!this.wasGrounded) this.#onLand();
    }
    this.#walls();
    this.#vaultScan(dt, ix, iy);
    this.#skidState(dt, ix);
    this.#flow(dt, ix);
    if (!this.bursting && this.flow >= P.BURST_FLOW_MIN && Math.abs(this.vx) >= P.BURST_SPEED_MIN)
      t.burstReady = P.BURST_GRACE;
    this.#animate(dt, ix);
    this.#runFx(dt);

    if (this.t.skid > 0) this.facing = this.skidDir;   // already looking the new way
    else if (this.vx !== 0 && !this.sliding) this.facing = Math.sign(this.vx);
    else if (ix !== 0 && !this.sliding) this.facing = ix;

    // --- hazards ----------------------------------------------------------
    if (L.boxHitsSpikes(this.x, this.y, this.w, this.h)) this.kill();
    if (this.y > L.killY) this.kill();
  }

  // --------------------------------------------------------------- movement
  #horizontal(dt, ix) {
    if (this.bursting) { this.vx = this.burstDir * P.BURST_SPEED; return; }
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
    // Under a low ceiling there is nowhere to stand up into: hold the buffered
    // jump until the roof clears instead of forcing the hitbox into the rock.
    if (!this.#tryStand()) return;
    this.vy = -P.JUMP_V;
    // super / hyper: cash a fresh dash in for horizontal speed
    if (t.super > 0) {
      if (this.dashDir.y > 0) { this.vx = this.facing * P.HYPER_X; this.vy = -P.JUMP_V * 0.82; }
      else this.vx = this.facing * Math.max(Math.abs(this.vx), P.SUPER_X);
      this.flow = Math.min(P.FLOW_MAX, this.flow + 0.2);
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
    this.fallFrom = null;
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
    this.fallFrom = null;
    this.flow = Math.min(P.FLOW_MAX, this.flow + 0.08);
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
    this.t.dashBuf = 0;
    // nothing hands the dash back while it is still going — a dash along the
    // floor touches the ground on every frame of itself
    this.t.refill = P.DASH_TIME + P.DASH_GAP;
    // Only stand up if there is room: dashing out of a tunnel keeps the low
    // profile rather than shoving the hitbox up into the rock.
    if (this.#tryStand()) this.sliding = false;
    this.fallFrom = null;
    this.flow = Math.min(P.FLOW_MAX, this.flow + 0.15);
    this.fx.burst(this.cx, this.cy, 14, '#9cf6ff');
    this.fx.shake(3.5);
    sfx.dash();
  }

  #endDash() {
    this.t.dash = 0;
    this.t.super = P.SUPER_WINDOW;
    // The gap is measured from here, and the pip comes back at the same moment
    // the dash does, so the HUD never offers one you cannot spend.
    this.t.dashCool = P.DASH_GAP;
    this.t.refill = P.DASH_GAP;
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
      // A burst survives a slide: the burst owns your speed either way, so
      // ducking inside one is a change of posture, not a change of pace — and
      // it is the only way to take the low rock at 980 px/s.
      this.#setHeight(P.SLIDE_H);
      this.fx.dust(this.cx, this.footY, -Math.sign(this.vx) * 60, 8);
      sfx.slide();
    } else if (this.sliding) {
      const tooSlow = Math.abs(this.vx) < P.SLIDE_EXIT;
      if (!wantsDown && this.#canStand()) { this.sliding = false; this.#setHeight(P.H); }
      else if (tooSlow) this.sliding = false;   // decays into a crouch, roof or not
      if (this.sliding && this.grounded && Math.random() < dt * 30)
        this.fx.dust(this.cx - Math.sign(this.vx) * 4, this.footY, -Math.sign(this.vx) * 40, 1);
    }
    // Ducking is ducking whether you chose it or a low roof chose it for you —
    // but only while the roof is actually there, or you could never stand again.
    const roofed = this.h < P.H && !this.#canStand();
    this.crouching = !this.sliding && this.grounded && (wantsDown || roofed);
    if (this.crouching && this.h === P.H) this.#setHeight(P.SLIDE_H);
    else if (!this.crouching && !this.sliding) this.#tryStand();
  }

  /** Carry "the speed and flow you had a moment ago" forward, so a vault called
   *  a frame after brushing the ledge still pays out what you ran in with. */
  #remember(dt) {
    const sp = Math.abs(this.vx);
    this.recentSpeed = Math.max(sp, this.recentSpeed - P.RECENT_FADE * dt);
    this.recentFlow = Math.max(this.flow, this.recentFlow - dt * 1.6);
  }

  /** Is there room for the full-height box, with the feet where they are? */
  #canStand() {
    if (this.h === P.H) return true;
    return !this.level.boxHitsWall(this.x, this.y + this.h - P.H, this.w, P.H);
  }

  /** Stand up if the ceiling allows it. Returns whether the box is full height. */
  #tryStand() {
    if (this.h === P.H) return true;
    if (!this.#canStand()) return false;
    this.#setHeight(P.H);
    return true;
  }

  #setHeight(h) {
    const foot = this.footY;
    this.h = h;
    this.y = foot - h;
  }

  /** Last-resort safety net: never leave the hitbox buried inside the rock. */
  #unstick() {
    const L = this.level;
    if (!L.boxHitsWall(this.x, this.y, this.w, this.h)) return;
    if (this.h === P.H && !L.boxHitsWall(this.x, this.y + P.H - P.SLIDE_H, this.w, P.SLIDE_H)) {
      this.#setHeight(P.SLIDE_H);       // a low roof caught us: duck back under it
      this.sliding = Math.abs(this.vx) > P.SLIDE_EXIT;
      return;
    }
    for (let d = 1; d <= TILE * 2; d++) {
      for (const sign of [1, -1]) {
        const ny = this.y + sign * d;
        if (L.boxHitsWall(this.x, ny, this.w, this.h)) continue;
        this.y = ny;
        if (sign > 0) this.vy = Math.max(this.vy, 0);   // pushed down: stop rising into it
        return;
      }
    }
  }

  // ----------------------------------------------------------- integration
  #moveX(dx) {
    if (this.t.bump <= 0) this.bumpDir = 0;
    if (dx === 0) return;
    const L = this.level;
    const nx = this.x + dx;
    if (!L.boxHitsWall(nx, this.y, this.w, this.h)) { this.x = nx; return; }

    // Blocked. `flush` is where we would stop; try to scuff up from there rather
    // than from the overlapping position — this keeps a sprint unbroken.
    const dir = Math.sign(dx);
    const flush = dir > 0
      ? Math.floor((nx + this.w) / TILE) * TILE - this.w - 0.001
      : (Math.floor(nx / TILE) + 1) * TILE + 0.001;
    if (this.#tryStep(flush, nx)) return;

    // Hard wall: stop flush against it and shed some flow. A burst is the one
    // thing a wall cannot take from you — it is bought and paid for with a full
    // bar, so it costs you the ground and nothing else, and it is still burning
    // the moment you get a way past.
    const first = this.t.bump <= 0;          // repeat contact is the same bump
    this.bumpDir = dir;
    this.t.bump = 0.12;
    this.x = flush;
    if (first && Math.abs(this.vx) > 240) {
      this.fx.dust(this.x + (dir > 0 ? this.w : 0), this.cy, -dir * 40, 4);
      if (!this.bursting) this.flow *= 0.55;
    }
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

    // Smooth out slope jitter. Anything deeper than a scuff is a ledge, and a
    // ledge you did not call is meant to put you in the air.
    if (!this.grounded && this.wasGrounded && this.vy >= 0 && this.t.noSnap <= 0 && !this.dashing) {
      const snap = Math.min(P.SNAP_MAX, P.SNAP_BASE + Math.abs(this.vx) * P.SNAP_SPEED);
      const before = this.footY;
      const surf = L.floorUnder(this.x + 1, this.x + this.w - 1, this.footY - 1, this.footY + snap,
        { oneway: this.t.drop <= 0 });
      if (surf !== null) {
        this.y = surf - this.h;
        this.vy = 0;
        this.grounded = true;
        this.#ledgeCost(surf - before);       // stumbling down a step is not free
        if (this.speed > 200 && this.t.stepFx <= 0) {
          this.fx.dust(this.cx, this.footY, -Math.sign(this.vx) * 30, 2);
          this.t.stepFx = 0.07;
        }
      }
    }

    // Walked clean off an edge: remember where from, so the landing can be priced.
    // (#onLand consumes it; jumping or dashing off a ledge clears it instead.)
    if (!this.grounded && this.wasGrounded && this.vy >= 0 && !this.dashing && !this.vault)
      this.fallFrom = prevFoot;

    // Uphill slopes push you up instead of stopping you.
    if (this.grounded || this.wasGrounded) this.#slopeLift();

    // Wavedash: a down-diagonal dash that meets the floor becomes raw speed.
    if (this.grounded && this.dashing && this.dashDir.y > 0 && this.dashDir.x !== 0) {
      this.#endDash();
      this.vx = Math.sign(this.dashDir.x) * P.WAVEDASH_X;
      this.vy = 0;
      this.t.super = P.SUPER_WINDOW;
      this.flow = Math.min(P.FLOW_MAX, this.flow + 0.25);
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
    this.t.land = 0.14;
    if (impact > 0.25) { this.fx.shake(impact * 5); sfx.land(); }
    if (this.t.rollFree > 0) {
      this.rolling = Math.max(this.rolling, 0.14);   // roll out of the landing
      this.t.rollFree = 0;
    } else if (this.fallFrom !== null) {
      this.#ledgeCost(this.footY - this.fallFrom);
    }
    this.fallFrom = null;
  }

  /** Dropping off a ledge on your feet is clumsy: it costs speed, and the more
   *  of a ledge it was the more it costs. Airtime is charged on top of the
   *  height — the longer you spent falling, the more of the run you have to
   *  reassemble on landing — so the one thing you must never do off a real
   *  drop is nothing. Rolling (the vault key) avoids the whole bill, and
   *  rolling just afterwards still buys it back. */
  #ledgeCost(drop) {
    if (this.vault || this.dashing || this.t.rollFree > 0) return;
    const f = clamp((drop - P.LEDGE_MIN_DROP) / (P.LEDGE_FULL_DROP - P.LEDGE_MIN_DROP), 0, 1);
    const air = clamp((this.airTime - P.LEDGE_AIR_FREE) / (P.LEDGE_AIR_FULL - P.LEDGE_AIR_FREE), 0, 1);
    if (f <= 0 && air <= 0) return;
    const bite = Math.min(P.LEDGE_LOSS_MAX, P.LEDGE_LOSS * f + P.LEDGE_AIR_LOSS * air);
    const loss = Math.abs(this.vx) * bite;
    if (loss < 8) return;
    this.lostSpeed = loss;
    this.lostFlow = this.flow * 0.3 * Math.min(1, f + air);
    this.vx -= Math.sign(this.vx) * loss;
    this.flow -= this.lostFlow;
    this.t.refund = P.ROLL_REFUND;
    // a bigger stumble throws more up off the boots
    this.fx.dust(this.cx, this.footY, -Math.sign(this.vx) * 20, 4 + Math.round(air * 5), '#8f86c9');
    if (air > 0.35) this.fx.shake(1 + air * 2);
  }

  /** Too late for a clean roll off the lip, but not too late to roll out of the
   *  landing: hand back everything the scuff took. */
  #recoveryRoll() {
    this.vx += Math.sign(this.vx || this.facing) * this.lostSpeed;
    this.flow = Math.min(P.FLOW_MAX, this.flow + this.lostFlow);
    this.recentSpeed = Math.max(this.recentSpeed, Math.abs(this.vx));
    this.lostSpeed = 0;
    this.lostFlow = 0;
    this.t.refund = 0;
    this.t.vaultBuf = 0;
    this.rolling = P.ROLL_TIME;
    this.vaults++;
    this.fx.burst(this.cx, this.footY - 3, 10, '#ffe6a8');
    this.fx.dust(this.cx, this.footY, -Math.sign(this.vx) * 40, 5, '#ffe6a8');
    sfx.vault();
  }

  // ------------------------------------------------------------- vaulting
  //
  // Ledges are not climbed for you. Run at one and a prompt appears; call the
  // vault with JUMP any time while it is up (a generous window, and the jump
  // buffer means an early press counts too) and the character takes the ledge
  // in one scripted movement that keeps every bit of speed.

  #vaultScan(dt, ix, iy) {
    const t = this.t;
    const blocked = this.dead || this.dashing || this.vault || this.sliding ||
                    this.h !== P.H || !(this.grounded || t.coyote > 0);
    if (!blocked) {
      const dir = Math.abs(this.vx) > 20 ? Math.sign(this.vx) : ix;
      if (dir !== 0) {
        const found = this.#lipAhead(dir) || (iy >= 0 ? this.#edgeAhead(dir) : null);
        if (found) {
          if (!this.cue || this.cue.kind !== found.kind) sfx.cue();
          this.cue = found;
          t.cue = P.VAULT_GRACE;
        }
      }
    }
    if (t.cue <= 0) this.cue = null;
    // a held cue that we have already arrived at is just noise
    if (this.cue) {
      const c = this.cue;
      const done = c.kind === 'up' ? this.footY <= c.y + this.h + 2 : this.footY >= c.y + this.h - 2;
      if (done) { this.cue = null; t.cue = 0; }
    }

    // Leaning into a ledge you were too slow to reach calls the vault for you.
    if (this.cue && this.cue.kind === 'up' && ix === this.cue.dir && Math.abs(this.vx) < 70) {
      t.mantle += dt;
      if (t.mantle >= P.MANTLE_HOLD) this.#startVault();
    } else {
      t.mantle = 0;
    }
  }

  /** A lip in front of us that we could pull up onto. */
  #lipAhead(dir) {
    const L = this.level;
    // the faster you travel the further ahead the prompt has to reach, or there
    // is no window left to press in
    const reach = clamp(P.VAULT_REACH + Math.abs(this.vx) * 0.06, P.VAULT_REACH, 78);
    let d = null;
    for (let i = 2; i <= reach; i += 2) {
      if (L.boxHitsWall(this.x + dir * i, this.y, this.w, this.h)) { d = i; break; }
    }
    if (d === null) return null;
    const landX = this.x + dir * (d + this.w + 2);
    for (let rise = P.VAULT_MIN; rise <= P.VAULT_MAX; rise++) {
      const probeY = this.y - rise;
      if (L.boxHitsWall(this.x, probeY, this.w, this.h)) return null;   // no headroom over us
      if (L.boxHitsWall(landX, probeY, this.w, this.h)) continue;       // still inside the rock
      const surf = L.floorUnder(landX, landX + this.w, probeY + this.h, probeY + this.h + 4);
      if (surf === null) continue;
      const landY = surf - this.h;
      if (L.boxHitsWall(landX, landY, this.w, this.h)) continue;
      if (L.boxHitsSpikes(landX, landY, this.w, this.h)) continue;     // never aim at spikes
      if (L.boxHitsWall(this.x, landY, this.w, this.h)) return null;   // we could not rise that far
      return { kind: 'up', dir, x: landX, y: landY, rise: this.footY - surf, dist: d };
    }
    return null;
  }

  /** An edge just ahead with a floor a short way below it. The faster you are
   *  travelling the further out the prompt appears, so the window stays fair. */
  #edgeAhead(dir) {
    const L = this.level;
    const foot = this.footY;
    const look = clamp(4 + Math.abs(this.vx) * 0.07, 4, 74);
    let gap = null;
    for (let d = 1; d <= look; d += 2) {
      const px = dir > 0 ? this.x + this.w + d : this.x - d - 6;
      if (L.floorUnder(px, px + 6, foot - 1, foot + 5) === null) { gap = d; break; }
    }
    if (gap === null) return null;
    const landX = this.x + dir * (this.w + gap + 3);
    if (L.boxHitsWall(landX, this.y, this.w, this.h)) return null;            // that is a wall, not an edge
    const surf = L.floorUnder(landX, landX + this.w, foot + P.DROP_MIN, foot + P.DROP_MAX);
    if (surf === null) return null;
    const landY = surf - this.h;
    if (L.boxHitsWall(landX, landY, this.w, this.h)) return null;
    if (L.boxHitsSpikes(landX, landY, this.w, this.h)) return null;   // never aim at spikes
    return { kind: 'down', dir, x: landX, y: landY, rise: surf - foot, dist: gap };
  }

  #startVault() {
    const c = this.cue;
    const L = this.level;
    if (!c || L.boxHitsWall(c.x, c.y, this.w, this.h)) { this.cue = null; return; }
    // Already tucked? Holding the key down a long descent should keep the one
    // roll going, not restart it (and its sound) on every ledge it passes.
    if (c.kind === 'down' && this.rolling > 0) {
      this.t.rollFree = P.ROLL_FREE;
      this.cue = null;
      this.t.cue = 0;
      return;
    }
    this.#claimCue(c);
    if (c.kind === 'down') { this.#roll(c); return; }

    // Called on time, a ledge costs you nothing at all: pay out the best speed
    // and flow of the last moment, not whatever the lip left you with. The rise
    // is scripted; the legs are not, so you take it at a run.
    const speed = Math.max(Math.abs(this.vx), this.recentSpeed, P.VAULT_EXIT);
    const dur = clamp(c.rise / P.VAULT_RISE_RATE, P.VAULT_MIN_TIME, P.VAULT_MAX_TIME);
    this.vx = c.dir * speed;
    this.vault = {
      kind: 'up', dir: c.dir, t: 0, dur,
      y0: this.y, y1: c.y,
      cross: Math.abs(c.x - this.x) / dur,     // floor pace: always clears the lip
    };
    this.sliding = false;
    this.crouching = false;
    this.grounded = false;
    this.vy = 0;
    this.anim = { name: 'vault', t: 0, frame: 0 };
    this.fx.dust(this.cx + c.dir * 4, this.footY, -c.dir * 30, 5, '#ffe6a8');
    sfx.ledge();
  }

  /** Book-keeping shared by both ledge calls. */
  #claimCue(c) {
    this.vaults++;
    this.cue = null;
    this.t.cue = 0;
    this.t.mantle = 0;
    this.t.super = 0;
    this.t.vaultBuf = 0;
    this.t.refund = 0;
    this.lostSpeed = 0;
    this.fallFrom = null;
    this.facing = c.dir;
    this.flow = Math.max(this.flow, this.recentFlow);
  }

  /** Rolling off a ledge is not a scripted hop: you keep your own momentum and
   *  simply leave the edge already tucked, so the drop costs nothing. */
  #roll(c) {
    const speed = Math.max(Math.abs(this.vx), this.recentSpeed, P.VAULT_EXIT);
    this.vx = c.dir * speed;
    this.rolling = P.ROLL_TIME;
    this.t.rollFree = P.ROLL_FREE;
    this.t.noSnap = 0.2;                       // let the drop actually happen
    this.sliding = false;
    this.crouching = false;
    this.#tryStand();
    this.fx.dust(this.cx, this.footY, -c.dir * 45, 6, '#ffe6a8');
    sfx.vault();
  }

  #vaultStep(dt) {
    const v = this.vault;
    const L = this.level;
    v.t += dt;
    const a = clamp(v.t / v.dur, 0, 1);

    // The climb is on rails; the horizontal is whatever you were already doing,
    // so a sprinting vault covers as much ground as sprinting would have. The
    // move is tested at the height we are climbing TO and taken in small bites:
    // the lip itself never blocks us, anything standing above it does, and no
    // amount of speed can carry the box through solid rock.
    let togo = Math.max(Math.abs(this.vx), v.cross) * dt;
    while (togo > 0.001) {
      const bite = Math.min(3, togo);
      const nx = this.x + v.dir * bite;
      if (L.boxHitsWall(nx, v.y1, this.w, this.h)) { v.blocked = true; break; }
      this.x = nx;
      togo -= bite;
    }
    this.y = v.y0 + (v.y1 - v.y0) * smooth(Math.min(1, a * 1.25));
    this.vy = 0;

    if (this.t.vaultFx <= 0) {
      this.fx.sparkle(this.cx + (Math.random() - 0.5) * 8, this.footY - Math.random() * 6, '#ffe6a8');
      this.t.vaultFx = 0.04;
    }
    if (a < 1) return;

    this.y = v.y1;
    this.h = P.H;
    this.vault = null;
    this.vy = 0;
    this.flow = Math.min(P.FLOW_MAX, this.flow + 0.12);
    this.t.land = 0.1;

    // Belt and braces: back out of anything we are still touching.
    for (let guard = 0; guard < TILE * 2; guard++) {
      if (!L.boxHitsWall(this.x, this.y, this.w, this.h)) break;
      this.x -= v.dir;
    }
    if (v.blocked) {                           // vaulted straight into a wall
      this.vx = 0;
      this.fx.dust(this.x + (v.dir > 0 ? this.w : 0), this.cy, -v.dir * 40, 4);
      // The climb is on rails, so a wall met halfway up it was never really
      // yours to avoid — and a burst rides it out with its fuel intact either
      // way (see #moveX).
      if (!this.bursting) this.flow *= 0.7;
    }

    // Land on whatever the stride actually carried us onto.
    const surf = L.floorUnder(this.x + 1, this.x + this.w - 1, this.footY - 2, this.footY + 8);
    if (surf !== null) {
      this.y = surf - this.h;
      this.grounded = true;
      this.wasGrounded = true;
      this.t.coyote = P.COYOTE;
    } else {
      this.grounded = false;                   // ran straight off the far side
      this.t.coyote = P.COYOTE;
    }
    this.t.noSnap = 0.05;
    this.fallFrom = null;
    this.#unstick();
    this.fx.dust(this.cx, this.footY, -v.dir * 40, 6, '#ffe6a8');
    this.fx.shake(1.6);
    sfx.vault();
  }

  // -------------------------------------------------------------- bursting
  //
  // A full flow bar is worth one burst: you go roughly three times a sprint,
  // and the world (the clock included) drops to BURST_SCALE so there is still
  // time to read a ledge and call it. The bar is the fuel gauge.

  /** The press does not launch you: it drops the world into slow motion and
   *  starts the countdown. You get a beat to see it happen, then you go. */
  #armBurst() {
    this.burstWind = P.BURST_WIND;
    this.t.burstReady = 0;     // spent: only a fresh full bar opens it again
    this.fx.burst(this.cx, this.cy, 10, '#dff3ff');
    this.fx.shake(1.5);
    sfx.burstWind();
  }

  #startBurst() {
    this.bursting = true;
    this.burstWind = 0;
    this.burstDir = Math.sign(this.vx) || this.facing;
    this.facing = this.burstDir;
    this.bursts++;
    this.vx = this.burstDir * P.BURST_SPEED;
    // Posture is the player's business. Cash a burst out of a slide and you
    // stay in it; the slide rules let go of you the moment you let go of down.
    this.fx.burst(this.cx, this.cy, 26, '#9cf6ff');
    this.fx.shake(6);
    sfx.burst();
  }

  #burstStep(dt, ix) {
    if (ix === -this.burstDir) { this.#endBurst(); return; }   // turning back drops it
    this.flow -= P.BURST_DRAIN * dt;
    if (this.flow <= 0) { this.flow = 0; this.#endBurst(); return; }
    if (Math.random() < dt * 40) {
      this.fx.speedLine(this.cx - this.burstDir * 14, this.y + Math.random() * this.h,
        -this.burstDir * 260);
    }
  }

  #endBurst() {
    if (!this.bursting) return;
    this.bursting = false;
    this.recentSpeed = Math.max(this.recentSpeed, Math.abs(this.vx));
    this.fx.burst(this.cx, this.cy, 14, '#dff3ff');
  }

  /** Hauling a sprint around: the feet go out, the weight goes back, and the
   *  ground takes the difference. Purely how it looks and sounds — the turn
   *  itself is the same hard deceleration it always was. */
  #skidState(dt, ix) {
    const t = this.t;
    const fighting = ix !== 0 && this.vx !== 0 && Math.sign(ix) === -Math.sign(this.vx);
    if (!(fighting && this.grounded && Math.abs(this.vx) > P.SKID_MIN &&
          !this.sliding && !this.crouching && !this.dashing && !this.vault)) return;

    t.skid = P.SKID_TAIL;
    this.skidDir = ix;
    if (t.skidFx <= 0) {
      const heel = this.cx - ix * 5;
      this.fx.dust(heel, this.footY, -ix * 70, 3, '#cfc6ef');
      t.skidFx = 0.05;
      sfx.skid();
    }
  }

  #flow(dt, ix) {
    if (this.bursting) return;       // the burst owns the meter while it runs
    const sp = Math.abs(this.vx);
    const moving = ix !== 0 && Math.sign(ix) === Math.sign(this.vx);
    if (sp > 150 && (moving || this.sliding || !this.grounded)) this.flow += dt * 0.42;
    else if (sp < 70) this.flow -= dt * 1.1;
    else this.flow -= dt * 0.2;
    this.flow = clamp(this.flow, 0, P.FLOW_MAX);
  }

  #runFx(dt) {
    const back = -Math.sign(this.vx || this.facing);

    // The feet kick up the dust, not a timer: every contact frame of the
    // stride plants a boot, so the footfalls land on the poses that look like
    // footfalls and the cadence you hear is the cadence you see.
    if (this.footfall && this.grounded && !this.vault && this.speed > 90) {
      const hard = this.speed > P.SPRINT_ANIM;
      this.fx.dust(this.cx + back * 4, this.footY, back * (25 + this.speed * 0.2), hard ? 3 : 1);
      sfx.step();
    }
    this.footfall = false;

    // Afterimages. A dash or a burst lays one down every frame, which smears
    // into a solid streak; a sprint leaves a handful of separate ghosts, so you
    // can still see the stride inside the blur.
    const hot = this.dashing || this.bursting;
    const smear = this.speed > P.TRAIL_SPEED && !this.vault && this.t.ghost <= 0;
    if (hot || smear) {
      const life = hot ? 0.22 : 0.15;
      if (!hot) this.t.ghost = 0.075;
      this.trail.push({ x: this.x, y: this.y, h: this.h, facing: this.facing,
                        name: this.anim.name, frame: this.anim.frame,
                        life, max: life, alpha: hot ? 0.45 : 0.24 });
    }
    for (const g of this.trail) g.life -= dt;
    this.trail = this.trail.filter((g) => g.life > 0);
  }

  #animate(dt, ix) {
    const a = this.anim;

    if (this.vault) {
      const v = this.vault;
      const name = v.kind === 'up' ? 'vault' : 'roll';
      const n = FRAME_COUNT[name];
      a.name = name;
      a.t += dt;
      a.frame = clamp(Math.floor((v.t / v.dur) * n), 0, n - 1);
      return;
    }

    let name = 'idle';
    if (this.dashing) name = 'dash';
    else if (this.rolling > 0) name = 'roll';
    else if (this.sliding) name = 'slide';
    else if (this.crouching || this.h < P.H)
      name = this.speed > P.SLIDE_EXIT ? 'slide' : 'crouch';
    else if (this.wallDir !== 0 && !this.grounded) name = 'wall';
    else if (!this.grounded) name = this.vy < 0 ? 'jump' : 'fall';
    else if (this.t.skid > 0) name = 'skid';
    else if (this.speed > P.SPRINT_ANIM) name = 'sprint';
    else if (this.speed > 12) name = 'run';
    else if (this.t.land > 0.02) name = 'land';

    // run and sprint are the same cycle at different leans: crossing between
    // them should change the pose, not restart the stride
    const strides = name === 'run' || name === 'sprint';
    if (name !== a.name) {
      const kept = strides && (a.name === 'run' || a.name === 'sprint');
      a.name = name;
      if (!kept) { a.t = 0; a.frame = 0; }
    }
    a.t += dt;
    const n = FRAME_COUNT[name] ?? 1;
    if (name === 'roll') {
      a.frame = clamp(Math.floor((1 - this.rolling / P.ROLL_TIME) * n), 0, n - 1);
    } else if (name === 'skid') {
      a.frame = Math.abs(this.vx) > P.SKID_MIN * 1.3 ? 0 : 1;   // brace, then pivot
    } else if (strides) {
      // One cycle is two strides. The cadence climbs with speed all the way to
      // the top of the flow meter instead of pinning flat the moment you get
      // going, but it never gets so quick that the contact and drive poses
      // stop reading — a blur reads as panic, a long stride reads as speed.
      const q = smooth(clamp((this.speed - 60) / (P.RUN_BASE + P.RUN_FLOW - 60), 0, 1));
      const rate = P.STRIDE_SLOW + (P.STRIDE_FAST - P.STRIDE_SLOW) * q;
      while (a.t > rate) {
        a.t -= rate;
        a.frame = (a.frame + 1) % n;
        // frames 0 and 3 are the two contacts of the cycle
        if (a.frame % 3 === 0) this.footfall = true;
      }
    } else if (name === 'idle') {
      while (a.t > 0.5) { a.t -= 0.5; a.frame = (a.frame + 1) % n; }
    } else a.frame = 0;
  }

  // --------------------------------------------------------------- pickups
  bounce(power = P.SPRING_V) {
    this.vy = -power;
    this.grounded = false;
    if (this.#tryStand()) this.sliding = false;
    this.dashes = this.maxDashes;
    this.t.dashCool = 0;       // a spring hands it straight back, like a crystal
    this.t.refill = 0;
    this.t.noSnap = 0.16;
    this.flow = Math.min(P.FLOW_MAX, this.flow + 0.12);
    this.fx.burst(this.cx, this.footY, 14, '#ffe6a8');
    this.fx.shake(3);
    sfx.spring();
  }

  refillDash() {
    this.dashes = this.maxDashes;
    this.t.refill = 0;
    this.t.dashCool = 0;       // a crystal is the one thing that skips the queue
    this.fx.burst(this.cx, this.cy, 12, '#9cf6ff');
    sfx.crystal();
  }
}
