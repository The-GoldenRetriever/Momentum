// player.js — the whole movement feel lives here.
//
// Design rules:
//   * speed is earned slowly and lost reluctantly (the "flow" meter)
//   * nothing that costs speed happens without the player asking for it
//   * tiny bumps never interrupt a run; anything taller is a vault you call
//   * coming down is free: a fall, a drop or a hard landing never costs you
//     anything
//   * a slope is the one place to go faster than you can run: roll down it

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
  RUN_OVER: 80,              // ... and more again as the overfill tops up: hold
                             // top speed and you keep getting faster
  FLOW_MAX: 1.6,             // the bar holds more than one bar: the overfill
                             // is top gear and burst fuel at once
  FLOW_GAIN: 0.5,            // bar per second while you keep up a real run:
                             // slow enough that a bar lost is a bar missed
  FLOW_DRAIN: 0.5,           // ... per second lost coasting or holding back
  FLOW_STALL: 1.8,           // ... and per second lost crawling (under 70 px/s)
  ACCEL: 1500,
  ACCEL_AIR: 1150,
  TURN_BOOST: 2.1,           // how much faster you accelerate when reversing
  FRICTION: 2300,            // let go and you lose it: momentum is kept, not given
  FRICTION_AIR: 220,
  OVERSPEED_DRAG: 260,       // gentle bleed when moving faster than your top speed

  JUMP_V: 420,
  JUMP_SPEED_LIFT: 0.35,     // extra lift per px/s of run above RUN_BASE ...
  JUMP_LIFT_MAX: 70,         // ... up to this: faster jumps go higher and further
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
  WAVEDASH_BLEED: 90,        // px/s per second more drag on a wavedash's speed
                             // while it runs over top speed: sliding on with it,
                             // it used to outlast a plain dash's by seconds
                             // (30 was asked to bleed it faster)

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
  VAULT_SNAP: 0.03,          // the quickest a fast vault can get the climb done
  VAULT_EXIT: 165,           // you always come out of a vault moving
  VAULT_BUFFER: 0.16,        // an early press on the vault key still counts
  MANTLE_HOLD: 0.35,         // lean into a ledge this long and you climb it anyway
  RECENT_FADE: 420,          // px/s per second: how fast "the speed you had" fades

  DROP_MIN: 11,              // ledges shorter than this you simply run off
  DROP_MAX: 52,
  ROLL_TIME: 0.26,
  ROLL_FREE: 0.60,           // a called roll tucks you through the whole drop
  ROLL_DOWNHILL: 380,        // px/s per second a roll down a slope adds, on top
                             // of what running down it does: no drag, no brakes
  ROLL_MAX: 500,             // ... up to this: past top gear, but not so far
                             // past it that a slope outruns everything else
                             // (620, then 530, both asked to come down; running
                             // a long slope makes ~463, so this keeps an edge)
  ROLL_OFF: 0.15,            // off the slope this long and the roll is over

  // --- burst: a bar topped right up fires one by itself ------------------
  BURST_SPEED: 560,          // SPEED x SCALE is what you see on screen
                             // (~118 px/s real): change one, rebalance both
  BURST_DASH: 1000,          // a dash inside a burst: the one thing that outruns
                             // it, or a dash would be a brake mid-burst
  BURST_ARM: 1.45,           // with burst on, the bar from here to the top is the
                             // top-off: it creeps in at TOPOFF_GAIN, and any
                             // speed lost on the way knocks it back to here
  TOPOFF_GAIN: 0.03,         // bar per second through the top-off (~5s of it;
                             // 0.06, then 0.04, were asked to go slower still)
  BURST_SPEED_MIN: 280,      // ... at a real sprint, and only with auto-burst on
  BURST_DRAIN: 0.8,          // bar per world second: one bar is ~1.25s of burst
                             // (~6 real seconds at BURST_SCALE), a full tank ~2s
  BURST_SCALE: 0.21,         // the world (and the clock) runs this slowly
  BURST_GRACE: 0.35,         // the wind-up waits this long for a dropped sprint
  BURST_WIND: 1.5,           // real seconds of slow motion, with the bar full,
                             // before it fires: the warning, and a last chance to
                             // switch it off (V)
  WIND_SCALE: 0.4,           // how slowly the world runs through the wind-up
  BURST_TAIL: 1.0,           // ... and for this many real seconds after a burst
                             // ends, before it comes back up to speed

  // --- animation ----------------------------------------------------------
  SPRINT_ANIM: 170,          // above this the run is thrown properly forward
  STRIDE_SLOW: 0.095,        // seconds per frame at a jog ...
  STRIDE_FAST: 0.046,        // ... and flat out: quick, but the poses still read
  TRAIL_SPEED: 210,          // afterimages start smearing off you here

  // --- turning ------------------------------------------------------------
  SKID_MIN: 165,             // reversing above this reads as a skid, not a turn
  SKID_TAIL: 0.10,           // the brace holds this long after you stop fighting it

  SPRING_V: 700,

  // --- water --------------------------------------------------------------
  WATER_SKIM: 328,           // run on water at this, upright: under it, or
                             // sliding, or ducked, and you go through it. It is
                             // the speed a full bar runs at (RUN_BASE + RUN_FLOW,
                             // a hair under so a full bar at its top speed
                             // counts), not the bar itself: anything that fast
                             // holds, a burst, a dash or a roll included
  WATER_HIGH: 160,           // px fallen (from the top of the arc, or from the
                             // end of a dash) past which water is no floor: a
                             // dash just before the surface breaks the fall.
                             // Ten tiles: a top-gear leap off a ledge four rows
                             // up (overpass) still lands, a real drop does not
  SINK_SPEED: 14,            // px/s: how fast you settle while you wade
  WADE_MAX: 110,             // a run in the water: momentum past this drains off
  WADE_DRAG: 3,              // ... at this rate (per second, of the excess)
  PULL_DEPTH: 12,            // feet no deeper than this below the bank's top
                             // and C pulls you out (see #lipAhead)
  DROWN_DEPTH: 15,           // feet this deep and your head is under: it is over
  STRUGGLE_TIME: 0.75,       // ... after this long fighting at the surface
  STRUGGLE_UNDER: 0.2,       // the last of which is going under for good

  // --- ice ------------------------------------------------------------------
  ICE_FRICTION: 70,          // let go on ice and you glide on (FRICTION is 2300)
  ICE_GRIP: 0.55,            // the feet spin: building speed takes longer
  ICE_TURN: 0.3,             // ... and turning round takes far longer
  ICE_SLIDE: 0.35,           // a slide on ice runs much further
};

const smooth = (a) => a * a * (3 - 2 * a);
/** The stride at a running speed: which cycle (run, or the long-legged
 *  sprint), and how long each of its frames holds. Shared with the loading
 *  screen's runner, so it runs the way the game would at its pace. */
export function stride(speed) {
  // One cycle is two strides. The cadence climbs with speed all the way to
  // the top of the flow meter instead of pinning flat the moment you get
  // going, but it never gets so quick that the contact and drive poses stop
  // reading: a blur reads as panic, a long stride reads as speed.
  const q = smooth(clamp((speed - 60) / (P.RUN_BASE + P.RUN_FLOW - 60), 0, 1));
  return { name: speed > P.SPRINT_ANIM ? 'sprint' : 'run', rate: P.STRIDE_SLOW + (P.STRIDE_FAST - P.STRIDE_SLOW) * q };
}

// how long each idle frame holds: breathe in, out, in, out, a beat, a blink
const IDLE_TIMES = [0.5, 0.5, 0.5, 0.5, 0.7, 0.12];

export class Player {
  constructor(level, fx) {
    this.level = level;
    this.fx = fx;
    this.reset(level.spawn.x, level.spawn.y);
    this.deaths = 0;
    // A setting more than a state, so a respawn keeps it: V flips it, and the
    // game carries it over to each new level's player (and saves it).
    this.autoBurst = true;
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
    this.sinking = false;      // through the water's surface, wading down (see #sink)
    this.struggle = 0;         // ... and how long is left fighting it at the surface
    this.sinkSurface = 0;
    this.airTop = y + P.H;     // the highest the feet have been since solid footing
    this.onIce = false;        // standing on ice (Level.iceUnder), as of the last step
    this.gliding = false;      // on ice with the stick let go: carried along
    this.dashes = 1;
    this.maxDashes = 1;
    this.flow = 0;
    this.anim = { name: 'idle', t: 0, frame: 0 };
    this.edgeDir = 0;          // teetering over a drop on that side (see #edge)
    this.t = {
      coyote: 0, buffer: 0, dash: 0, dashCool: 0, dashBuf: 0, refill: 0, super: 0,
      wallCoyote: 0, wallLock: 0, noSnap: 0, stepFx: 0, land: 0, drop: 0,
      mantle: 0, bump: 0, cue: 0, vaultFx: 0, vaultBuf: 0, rollFree: 0,
      burstReady: 0, skid: 0, skidFx: 0, ghost: 0, rollOff: 0,
    };
    this.dashDir = { x: 1, y: 0 };
    this.dashSpeed = P.DASH_SPEED;
    this.trail = [];
    this.bumpDir = 0;
    this.scarf = null;
    this.vault = null;         // the vault currently being played out
    this.cue = null;           // the vault the player could call for right now
    this.vaults = 0;
    this.rolling = 0;          // the roll animation's clock
    this.slopeRoll = false;    // tucked and rolling down a slope (see #slopeRollStep)
    this.waveRun = false;      // running on a wavedash's speed (see WAVEDASH_BLEED)
    this.bursting = false;     // full-flow sprint: very fast, world in slow motion
    this.burstWind = 0;        // winding up: real seconds left before it fires
    this.burstSlow = false;    // coming down off a burst's speed: the bar waits
    this.burstTail = 0;        // real seconds of slow motion left after a burst
    this.lastSpeed = 0;        // the speed at the last step's flow update (the top-off watches it)
    this.burstDir = 1;
    this.bursts = 0;
    this.skidDir = 1;          // the way a skid is turning towards
    this.recentSpeed = 0;      // the speed you had a moment ago, for vault payouts
    this.recentDir = 1;        // ... and which way it was going: it pays out only that way
    this.recentFlow = 0;
    this.fallFrom = null;      // foot height when we walked off an edge
    this.airTime = 0;          // how long you have been off the ground
    this.footfall = false;     // a stride just planted a boot — one frame only
  }

  /** Could a wind-up start? True on a full bar at a sprint (and for a moment
   *  after you drop off the sprint, though losing speed under your top speed
   *  empties the top-off anyway). Whether it does start is autoBurst. */
  get canBurst() {
    return !this.bursting && this.burstWind <= 0 && !this.dead && !this.sinking && !this.vault &&
           this.t.burstReady > 0 && this.flow >= P.FLOW_MAX - 1e-6 && this.cx >= this.level.burstFrom;
  }

  /** True whenever the world should be running slowly — through the wind-up
   *  as well as the burst itself, since the point of the wind-up is that you
   *  watch the world drop away before you are thrown down it. */
  get timeWarped() { return this.bursting || this.burstWind > 0 || this.burstTail > 0; }

  /** A move paying a little bar back (a dash, a wall kick, a vault ...). With
   *  burst on it pays only up to the top-off and never into it: a dash used
   *  to jump the bar from the bottom of the top-off to full in one go. */
  #refund(amount) {
    const cap = this.autoBurst && this.cx >= this.level.burstFrom ? Math.max(this.flow, P.BURST_ARM) : P.FLOW_MAX;
    this.flow = Math.min(cap, this.flow + amount);
  }

  /** Creeping through the top-off: burst on, the bar past BURST_ARM, not full
   *  yet. Lose any speed now and it is back to the start of it. */
  get toppingOff() {
    return this.autoBurst && !this.bursting && this.burstWind <= 0 && this.flow > P.BURST_ARM &&
           this.flow < P.FLOW_MAX && this.cx >= this.level.burstFrom;
  }

  /** How fast the world should be running: main.js eases its clock toward it. */
  get warp() {
    return this.bursting ? P.BURST_SCALE : this.burstWind > 0 || this.burstTail > 0 ? P.WIND_SCALE : 1;
  }

  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  get footY() { return this.y + this.h; }
  get dashing() { return this.t.dash > 0; }
  /** Not handed the dash yet (Level.dashFrom: the tutorial, before its dash section). */
  get dashLocked() { return this.cx < this.level.dashFrom; }
  get vaulting() { return this.vault !== null; }
  get skidding() { return this.t.skid > 0; }
  // The first bar buys sprint speed; the overfill past it (which only fills
  // while you are already holding top speed) buys a top gear on top of that,
  // and doubles as burst fuel. Speed you keep is speed you get more of.
  get topSpeed() {
    const over = clamp((this.flow - 1) / (P.FLOW_MAX - 1), 0, 1);
    return P.RUN_BASE + P.RUN_FLOW * Math.min(1, this.flow) + P.RUN_OVER * over;
  }
  get speed() { return Math.abs(this.vx); }
  /** Which way to draw the character: away from the wall on a wall slide
   *  (back to it, looking for the next one), towards the drop when teetering
   *  on a lip, and otherwise the way you face. Only the picture: `facing`,
   *  which a neutral dash and the rest go by, is untouched. */
  get look() {
    if (this.anim.name === 'wall' && this.wallDir !== 0) return -this.wallDir;
    if (this.anim.name === 'teeter' && this.edgeDir) return this.edgeDir;
    return this.facing;
  }
  /** Stood still with the toes over a drop (a few pixels of the box past the
   *  lip, on one side only): which side, or 0. */
  #edge() {
    if (!this.grounded || Math.abs(this.vx) > 12) return 0;
    const L = this.level, f = this.footY;
    const under = (x0, x1) => L.floorUnder(x0, x1, f - 1, f + 4) !== null;
    const left = under(this.x, this.x + 2), right = under(this.x + this.w - 3, this.x + this.w - 1);
    return left && !right ? 1 : right && !left ? -1 : 0;
  }
  get sprinting() { return this.speed > P.RUN_BASE * 0.92; }

  /** The slope underfoot runs downhill the way you are going (+1/-1), or 0. */
  #downhill() {
    if (!this.grounded) return 0;
    const slope = this.level.slopeUnder(this.cx, this.footY);
    if (!slope) return 0;
    const down = slope === T.SLOPE_L ? 1 : -1;        // "\" descends towards +x
    const dir = Math.sign(this.vx) || this.facing;
    return dir === down ? down : 0;
  }

  /** On a downhill and not rolling yet: the prompt for a slope roll. */
  get rollHere() { return !this.slopeRoll && !this.vault && this.#downhill() !== 0; }

  /** The slope roll: C on a downhill (pressed or held, or called at the top of
   *  one) tucks you into a roll that runs away down it, much faster than your
   *  legs could, and you keep that speed off the bottom (it bleeds away the
   *  way any overspeed does). It lasts until the slope does, a moment after
   *  you leave it, or until you jump, dash, slide or vault out of it. */
  #slopeRollStep(dt, holding) {
    const t = this.t;
    if (!this.slopeRoll && !this.vault && !this.dashing && !this.sliding && this.#downhill() &&
        (t.vaultBuf > 0 || holding)) {
      this.slopeRoll = true;
      t.vaultBuf = 0;
      t.rollOff = P.ROLL_OFF;
      this.fx.dust(this.cx, this.footY, -Math.sign(this.vx || this.facing) * 45, 6, '#ffe6a8');
      sfx.vault();
    }
    if (!this.slopeRoll) return;
    if (this.vault || this.dashing || this.sliding || this.dead) { this.slopeRoll = false; return; }
    // on a slope (or just over a bump in it) the roll keeps going
    if (this.#downhill() || (!this.grounded && t.rollOff > 0)) t.rollOff = P.ROLL_OFF;
    else if ((t.rollOff -= dt) <= 0) { this.slopeRoll = false; return; }
    if (this.rolling <= 0.02) this.rolling = P.ROLL_TIME;      // the tumble loops
  }

  /** Running at a full bar's speed or better, upright, to run on water (see
   *  Level.skim). Speed is all it asks: a burst runs across, and so does a
   *  dash, while they last. Run out of a burst onto the water with the bar it
   *  burned, though, and you slow towards an empty bar's pace and go through.
   *  Coming down on it from a great height you go straight through, unless a
   *  dash broke the fall just before. */
  #skimming() {
    return !this.sliding && !this.crouching && Math.abs(this.vx) >= P.WATER_SKIM && !this.#plunging();
  }

  /** Falling from higher than water will hold you? A dash resets the height
   *  (see #endDash), and holds you up while it lasts. */
  #plunging() {
    return !this.grounded && !this.dashing && this.footY - this.airTop > P.WATER_HIGH;
  }

  /** Through the surface. You keep running, or sliding, while you sink; reach
   *  a bank while you are still shallow and C pulls you out (#sinkStep), and
   *  if your head goes under you struggle at the surface and drown. The
   *  splash is here, where you go in. */
  #sink() {
    if (this.dead || this.sinking) return;
    this.sinking = true;
    this.struggle = 0;
    this.sinkSurface = this.#waterSurface();
    this.flow = 0;
    this.vault = null;
    this.cue = null;
    this.t.dash = 0;
    this.t.vaultBuf = 0;
    this.slopeRoll = false;
    this.bursting = false;
    this.burstWind = 0;
    this.burstTail = 0;
    this.crouching = false;
    this.grounded = false;
    this.gliding = false;
    this.onIce = false;
    this.wallDir = 0;
    // A plunge from height goes deeper at once; the water takes most of it,
    // and most of a run too (a dash that hit the water carried on at its own
    // pace, wading at 700).
    this.vy = clamp(this.vy * 0.12, P.SINK_SPEED, 170);
    this.vx = Math.sign(this.vx) * Math.min(Math.abs(this.vx) * 0.7, 300);
    this.fx.burst(this.cx, this.sinkSurface, 22, '#9fdcff');
    this.fx.dust(this.cx, this.sinkSurface, 0, 12, '#dff4ff');
    this.fx.shake(3);
    sfx.splash();
  }

  /** Any water at all in the box (or just under the feet)? */
  #touchingWater() {
    const L = this.level;
    const x0 = Math.floor((this.x + 1) / TILE), x1 = Math.floor((this.x + this.w - 2) / TILE);
    const y0 = Math.floor(this.y / TILE), y1 = Math.floor(this.footY / TILE);
    for (let ty = y0; ty <= y1; ty++)
      for (let tx = x0; tx <= x1; tx++) if (L.get(tx, ty) === T.WATER) return true;
    return false;
  }

  /** The pixel height of the top of the water you are in. */
  #waterSurface() {
    const L = this.level;
    const ty0 = Math.floor(this.y / TILE), ty1 = Math.floor((this.footY - 1) / TILE);
    for (const px of [this.cx, this.x + 2, this.x + this.w - 3]) {
      const tx = Math.floor(px / TILE);
      for (let ty = ty0; ty <= ty1; ty++) {
        if (L.get(tx, ty) !== T.WATER) continue;
        while (L.get(tx, ty - 1) === T.WATER) ty--;
        return ty * TILE;
      }
    }
    return this.footY;
  }

  #sinkStep(dt, input) {
    const L = this.level;
    const t = this.t;
    const ix = this.struggle > 0 ? 0 : input.moveX;
    if (input.hit('vault')) t.vaultBuf = P.VAULT_BUFFER;
    t.vaultBuf = Math.max(0, t.vaultBuf - dt);
    t.cue = Math.max(0, t.cue - dt);

    if (this.struggle > 0) {
      // Fighting it at the surface: the head bobs up and goes under again,
      // and then it goes under for good.
      this.struggle -= dt;
      this.vx -= this.vx * Math.min(1, 8 * dt);
      const under = this.struggle < P.STRUGGLE_UNDER;
      const bob = Math.sin(this.struggle * 22) * 1.5;
      const target = this.sinkSurface + P.DROWN_DEPTH - 3 + bob - this.h;
      this.vy = under ? 60 : (target - this.y) * 12;
      // the water fought: a slap on every third beat of the thrash throws up
      // spray both ways and sends a ring out over the surface; bubbles all
      // the while, and more once it is going under
      const beat = Math.floor((P.STRUGGLE_TIME - this.struggle) / 0.09);
      if (!under && beat !== this.slapBeat && beat % 4 === 2) {
        this.fx.spray(this.cx - 4, this.sinkSurface, -1, 120);
        this.fx.spray(this.cx + 4, this.sinkSurface, 1, 120);
        this.fx.ring(this.cx, this.sinkSurface, 12, '#dff4ff', 0.35, true);
      }
      this.slapBeat = beat;
      if (Math.random() < dt * (under ? 30 : 10)) this.fx.bubble(this.cx, this.cy, this.sinkSurface);
      if (Math.random() < dt * 14)
        this.fx.dust(this.cx + (Math.random() - 0.5) * 12, this.sinkSurface, (Math.random() - 0.5) * 60, 2, '#dff4ff');
    } else {
      if (this.sliding) {
        // a slide goes on into the water, losing itself, and you come up out
        // of it into a wade once it is spent
        this.vx -= Math.sign(this.vx) * P.SLIDE_FRICTION * dt;
        if (Math.abs(this.vx) < P.SLIDE_EXIT && this.#tryStand()) this.sliding = false;
      } else if (ix !== 0) {
        const reversing = Math.sign(ix) !== Math.sign(this.vx) && this.vx !== 0;
        if (reversing || Math.abs(this.vx) < P.WADE_MAX) this.vx += ix * P.ACCEL * 0.5 * dt;
      } else {
        this.vx -= Math.sign(this.vx) * Math.min(P.FRICTION * 0.3 * dt, Math.abs(this.vx));
      }
      const over = Math.abs(this.vx) - P.WADE_MAX;
      if (over > 0) this.vx -= Math.sign(this.vx) * over * Math.min(1, P.WADE_DRAG * dt);
      this.vy += (P.SINK_SPEED - this.vy) * Math.min(1, 8 * dt);
      if (ix !== 0 && !this.sliding) this.facing = ix;
    }

    if (!L.boxHitsWall(this.x + this.vx * dt, this.y, this.w, this.h)) this.x += this.vx * dt;
    else this.vx = 0;
    if (!L.boxHitsWall(this.x, this.y + this.vy * dt, this.w, this.h)) this.y += this.vy * dt;
    else this.vy = 0;
    for (const g of this.trail) g.life -= dt;
    this.trail = this.trail.filter((g) => g.life > 0);

    // Wading is no shelter: a reef's spikes still kill. And wading clear of
    // the water altogether (over a sand bar that has crumbled away, say) ends
    // it: there is nothing left to sink in.
    if (L.boxHitsSpikes(this.x, this.y, this.w, this.h)) { this.kill(); return; }
    if (!this.#touchingWater()) { this.sinking = false; this.struggle = 0; this.#animate(dt, ix); return; }

    const depth = this.footY - this.sinkSurface;
    if (this.struggle > 0) {
      if (this.struggle <= dt * 0.5) { this.kill('water'); return; }
    } else if (depth >= P.DROWN_DEPTH) {
      this.struggle = P.STRUGGLE_TIME;
      this.cue = null;
      sfx.splash();
    } else {
      // A bank in reach and you still shallow: C pulls you up onto it.
      const dir = ix || this.facing;
      const lip = !this.sliding && depth <= P.PULL_DEPTH ? this.#lipAhead(dir, 1) : null;
      if (lip) {
        if (!this.cue) sfx.cue();
        this.cue = lip;
        t.cue = P.VAULT_GRACE;
      } else if (t.cue <= 0) this.cue = null;
      if (this.cue && t.vaultBuf > 0) {
        this.sinking = false;
        this.recentSpeed = 0;       // out at a walk: the run you fell in with is gone
        this.#startVault();
        if (this.vault) { this.vault.pull = true; return; }
        this.sinking = true;
      }
    }
    this.#animate(dt, ix);
    if (this.footfall) {                       // wading strides throw water, not dust
      this.fx.dust(this.cx - this.facing * 3, this.sinkSurface, -this.facing * 30, 2, '#bfeaff');
      this.footfall = false;
    }
  }

  /** True while the ground underfoot is water. */
  get onWater() {
    return this.grounded && this.level.get(Math.floor(this.cx / TILE), Math.floor(this.footY / TILE)) === T.WATER;
  }

  kill(cause = null) {
    if (this.dead) return;
    this.deathCause = cause;
    this.dead = true;
    this.sinking = false;
    this.struggle = 0;
    this.deadTimer = 0.45;
    this.deaths++;
    this.flow = 0;
    this.vault = null;
    this.cue = null;
    this.bursting = false;
    this.burstWind = 0;
    this.burstTail = 0;
    if (cause === 'water') {                // gone under: the splash was on the way in
      for (let i = 0; i < 6; i++) this.fx.sparkle(this.cx + (Math.random() - 0.5) * 10, this.sinkSurface + 2, '#dff4ff');
      for (let i = 0; i < 12; i++) this.fx.bubble(this.cx, this.cy + Math.random() * 8, this.sinkSurface);
      this.fx.ring(this.cx, this.sinkSurface, 18, '#dff4ff', 0.6, true);
      this.fx.ring(this.cx, this.sinkSurface, 9, '#ffffff', 0.4, true);
    } else if (cause === 'still') {         // caught: frozen where you stood
      this.fx.burst(this.cx, this.cy, 26, '#e8eef8');
      this.fx.shake(4);
      sfx.frozen();
    } else {
      this.fx.burst(this.cx, this.cy, 26, '#ef5a5a');
      this.fx.ring(this.cx, this.cy, 22, '#ef5a5a', 0.35);
      this.fx.shake(6);
      sfx.death();
    }
  }

  // ------------------------------------------------------------------ update
  //
  // `realDt` is wall-clock time where `dt` is world time — the two differ only
  // while a burst (or its wind-up) has the world in slow motion. Almost
  // nothing cares; the wind-up does, because it is seconds the player
  // watches, not seconds the world takes.
  update(dt, input, realDt = dt) {
    // (a setting, so it answers even while you are dead or wading: read
    //  below those, a press there was simply lost)
    if (input.hit('autoburst')) this.#toggleAutoBurst();
    if (this.dead) { this.deadTimer -= dt; return; }
    if (this.sinking) { this.#sinkStep(dt, input); return; }
    // A glide is whatever this step's ground handling says it is: a dash, a
    // burst or a vault skips that, and must not inherit the last one.
    this.gliding = false;

    const L = this.level;
    const t = this.t;
    for (const k of ['coyote', 'buffer', 'dashCool', 'dashBuf', 'refill', 'super', 'wallCoyote',
                     'wallLock', 'noSnap', 'stepFx', 'land', 'drop', 'bump', 'cue',
                     'vaultFx', 'vaultBuf', 'rollFree', 'burstReady',
                     'skid', 'skidFx', 'ghost'])
      t[k] = Math.max(0, t[k] - dt);
    this.rolling = Math.max(0, this.rolling - dt);
    this.airTime = this.grounded ? 0 : this.airTime + dt;
    this.#remember(dt);

    let ix = input.moveX;
    const iy = input.moveY;
    if (t.wallLock > 0 && Math.sign(ix) === -Math.sign(this.vx) && this.wallDir === 0) ix = 0;

    if (input.hit('jump')) t.buffer = P.JUMP_BUFFER;
    if (input.hit('vault')) t.vaultBuf = P.VAULT_BUFFER;
    if (input.hit('dash')) t.dashBuf = P.DASH_BUFFER;
    if (this.burstTail > 0) this.burstTail = Math.max(0, this.burstTail - realDt);
    if (this.burstWind > 0) {
      // Dropping off the sprint for longer than the grace (or off the top of
      // the bar) stands the wind-up down; it starts again by itself once you
      // are back up there. A vault does not: the burst just waits for it.
      if (t.burstReady <= 0) this.burstWind = 0;
      else {
        this.burstWind -= realDt;
        if (this.burstWind <= 0) {
          if (this.vault) this.burstWind = 1e-6;     // fires as you come out of it
          else this.startBurst();
        }
      }
    } else if (this.autoBurst && this.canBurst) this.#armBurst();
    if (this.bursting) this.#burstStep(dt, ix);

    // --- ledge calls -------------------------------------------------------
    // A press takes the ledge in front of you; holding the key takes every
    // descent you meet, so a staircase can be run straight down.
    const holding = input.held('vault');
    this.holdingVault = holding;       // a hard landing reads it, to tuck into a roll
    this.#slopeRollStep(dt, holding);
    if (!this.vault && !this.dashing) {
      if ((t.vaultBuf > 0 || (holding && this.cue?.kind === 'down')) && this.cue) this.#startVault();
    }
    if (this.vault) {
      const pulling = this.vault.pull;      // climbing out of water starts in it
      this.#vaultStep(dt);
      this.#animate(dt, ix);
      this.#runFx(dt);
      if (L.boxHitsSpikes(this.x, this.y, this.w, this.h) || this.y > L.killY) this.kill();
      if (!pulling && L.boxInWater(this.x, this.y, this.w, this.h)) this.#sink();
      if (!this.vault) this.airTop = this.footY;
      return;
    }

    // --- dash start -------------------------------------------------------
    // The gap between dashes is not negotiable, on the ground or off it; the
    // buffer means you never have to guess when it is up, only press again.
    if (t.dashBuf > 0 && this.dashes > 0 && t.dashCool <= 0 && !this.dashing && !this.dashLocked) this.#startDash(ix, iy);

    // --- dash motion ------------------------------------------------------
    if (this.dashing) {
      t.dash -= dt;
      this.vx = this.dashDir.x * this.dashSpeed;
      this.vy = this.dashDir.y * this.dashSpeed;
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
    // Water holds you up only while you are fast and upright: the level asks
    // this, not the player, so every floor query sees water the same way.
    if (this.grounded || this.wallDir !== 0 || this.dashing) this.airTop = this.footY;
    else this.airTop = Math.min(this.airTop, this.footY);
    L.skim = this.#skimming();
    this.wasGrounded = this.grounded;
    if (this.grounded) this.#slopeLift();
    this.#moveX(this.vx * dt);
    if (this.grounded) this.#slopeLift();
    this.#moveY(this.vy * dt, dt);
    this.#unstick();
    this.onIce = this.grounded && L.iceUnder(this.x, this.x + this.w, this.footY);

    // --- ground state, flow, feedback -------------------------------------
    if (this.grounded) {
      t.coyote = P.COYOTE;
      if (t.refill <= 0) this.dashes = this.maxDashes;
      if (!this.wasGrounded) this.#onLand();
    }
    this.#walls();
    this.#vaultScan(dt, ix, iy);
    this.#skidState(dt, ix);
    this.#flow(dt, ix, realDt);
    if (!this.bursting && this.flow >= P.FLOW_MAX - 1e-6 && Math.abs(this.vx) >= P.BURST_SPEED_MIN)
      t.burstReady = P.BURST_GRACE;
    this.#animate(dt, ix);
    this.#runFx(dt);

    if (this.t.skid > 0) this.facing = this.skidDir;   // already looking the new way
    else if (this.vx !== 0 && !this.sliding) this.facing = Math.sign(this.vx);
    else if (ix !== 0 && !this.sliding) this.facing = ix;

    // --- hazards ----------------------------------------------------------
    if (L.boxHitsSpikes(this.x, this.y, this.w, this.h)) this.kill();
    if (L.boxInWater(this.x, this.y, this.w, this.h)) this.#sink();
    if (this.y > L.killY) this.kill();
  }

  // --------------------------------------------------------------- movement
  #horizontal(dt, ix) {
    if (this.bursting) { this.vx = this.burstDir * P.BURST_SPEED; return; }
    const top = this.crouching ? P.CROUCH_MAX : this.topSpeed;
    const onGround = this.grounded;
    // Ice: let go and you glide on, the feet spin when you push, and turning
    // round takes an age. It never takes speed away; it just will not let you
    // stop, or get going, in a hurry.
    const icy = onGround && this.onIce;
    this.gliding = icy && ix === 0 && !this.sliding && !this.slopeRoll && Math.abs(this.vx) > 12;

    if (this.sliding) {
      const fr = P.SLIDE_FRICTION * (ix !== 0 && Math.sign(ix) === Math.sign(this.vx) ? 0.4 : 1) * (icy ? P.ICE_SLIDE : 1);
      this.vx -= Math.sign(this.vx) * fr * dt;
      if (Math.abs(this.vx) < 6) this.vx = 0;
    } else if (ix !== 0) {
      const reversing = Math.sign(ix) !== Math.sign(this.vx) && this.vx !== 0;
      let accel = (onGround ? P.ACCEL : P.ACCEL_AIR) * (reversing ? P.TURN_BOOST : 1) * (this.crouching ? 0.7 : 1) *
                  (icy ? (reversing ? P.ICE_TURN : P.ICE_GRIP) : 1);
      if (Math.abs(this.vx) > top && !reversing) accel = 0;   // never fight your own momentum
      this.vx += ix * accel * dt;
      if (Math.abs(this.vx) > top && !this.slopeRoll) {
        // over top speed: bleed slowly instead of clamping, so boosts survive
        const drag = P.OVERSPEED_DRAG * (onGround ? 1 : 0.45) * dt;
        this.vx -= Math.sign(this.vx) * Math.min(drag, Math.abs(this.vx) - top);
      }
    } else if (!this.slopeRoll) {             // (a roll needs no stick held to keep going)
      const fr = (onGround ? (icy ? P.ICE_FRICTION : P.FRICTION) : P.FRICTION_AIR) * dt;
      this.vx -= Math.sign(this.vx) * Math.min(fr, Math.abs(this.vx));
    }

    // A wavedash (a slide-dash) hands you more than a dash does; on the
    // ground it bleeds off a little faster than other overspeed, so it is a
    // burst of pace, not a gear. But only down to what a plain dash would have
    // handed you (dashCarry: the run you were making, plus what running would
    // have added through the dash), never below it: it used to bleed all the
    // way to top speed, and a slide-dash came out slower than a dash did.
    if (this.waveRun) {
      const floor = Math.max(this.topSpeed, this.waveFloor ?? 0);
      if (this.dashing || Math.abs(this.vx) <= floor) this.waveRun = false;
      else if (onGround) this.vx -= Math.sign(this.vx) * Math.min(P.WAVEDASH_BLEED * dt, Math.abs(this.vx) - floor);
    }

    // slopes: downhill is free speed, uphill costs a little
    if (onGround) {
      const slope = this.level.slopeUnder(this.cx, this.footY);
      if (slope) {
        const downhill = (slope === T.SLOPE_L ? 1 : -1);   // "\" descends towards +x
        const mult = this.sliding ? P.SLOPE_SLIDE_MULT : 1;
        if (Math.sign(this.vx) === downhill || this.vx === 0) {
          // (never past a roll's top speed, though: a slide down a long slope
          //  used to run away with you without limit, wavedashed into it at 500)
          if (Math.abs(this.vx) < P.ROLL_MAX)
            this.vx = downhill * Math.min(P.ROLL_MAX, Math.abs(this.vx) + P.SLOPE_DOWNHILL * mult * dt);
          // tucked into a roll, a slope is a launch ramp: it runs away with you
          if (this.slopeRoll) {
            this.vx += downhill * P.ROLL_DOWNHILL * dt;
            if (Math.abs(this.vx) > P.ROLL_MAX) this.vx = downhill * P.ROLL_MAX;
          }
        }
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
    // the faster you are running, the more the jump lifts you: speed carries
    // into height, and height into distance
    const lift = clamp((Math.abs(this.vx) - P.RUN_BASE) * P.JUMP_SPEED_LIFT, 0, P.JUMP_LIFT_MAX);
    this.vy = -(P.JUMP_V + lift);
    // super / hyper: cash a fresh dash in for horizontal speed
    if (t.super > 0) {
      if (this.dashDir.y > 0) { this.vx = this.facing * P.HYPER_X; this.vy = -P.JUMP_V * 0.82; }
      else this.vx = this.facing * Math.max(Math.abs(this.vx), P.SUPER_X);
      // (no bar: it is a dash cashed in, and dashes pay none; it paid 0.2)
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
    this.slopeRoll = false;
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
    this.#refund(0.08);
    this.fx.burst(this.x + (dir > 0 ? this.w : 0), this.cy, 8, '#cbb9ff');
    this.fx.ring(this.x + (dir > 0 ? this.w : 0), this.cy, 9, '#cbb9ff', 0.2);
    sfx.wallJump();
    // A wall jump turns you around, and turning back has always dropped a
    // burst. It has to here in particular: the burst pins vx into the wall
    // every step, so if it survived you were straight back on the wall for
    // another jump — an endless climb, refuelled by each kick's flow.
    this.#endBurst();
  }

  #startDash(ix, iy) {
    let dx = ix, dy = iy;
    if (dx === 0 && dy === 0) { dx = this.facing; dy = 0; }
    const len = Math.hypot(dx, dy);
    this.dashDir = { x: dx / len, y: dy / len };
    this.facing = dx !== 0 ? Math.sign(dx) : this.facing;
    this.dashes--;
    // (a dash is speed of your own making: whatever it hands off afterwards is
    //  not a burst's coming down any more, and the bar fills as usual)
    this.burstSlow = false;
    // fixed for the whole dash, so a burst running out mid-dash cannot cut it short
    this.dashSpeed = this.bursting ? P.BURST_DASH : P.DASH_SPEED;
    // the run you were already making in the dash's direction, for the hand-off
    this.dashEntry = Math.sign(this.vx) === Math.sign(this.dashDir.x) ? Math.abs(this.vx) : 0;
    // ... and what it would have become had you kept running instead: the dash
    // pays that back at the end (both kinds), so it never costs the speed the
    // run would have built in the meantime
    const top = this.topSpeed;
    this.dashCarry = this.dashEntry >= top ? this.dashEntry : Math.min(top, this.dashEntry + P.ACCEL * P.DASH_TIME);
    this.t.dash = P.DASH_TIME;
    this.t.dashBuf = 0;
    // nothing hands the dash back while it is still going — a dash along the
    // floor touches the ground on every frame of itself
    this.t.refill = P.DASH_TIME + P.DASH_GAP;
    // Only stand up if there is room: dashing out of a tunnel keeps the low
    // profile rather than shoving the hitbox up into the rock.
    if (this.#tryStand()) this.sliding = false;
    this.fallFrom = null;
    // (no bar for a dash, of either kind: it used to pay back 0.15 of one)
    this.fx.burst(this.cx, this.cy, 14, '#9cf6ff');
    this.fx.ring(this.cx, this.cy, 16, '#9cf6ff', 0.25);
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
    // A dash hands off into a run faster than you can run, and never slower
    // than you were already going its way: dashing off a boost pad used to
    // drop you from 520 to 330, a dash that cost the speed it was meant to add.
    this.vx = d.x !== 0 ? Math.sign(d.x) * Math.max(P.DASH_END, this.dashCarry ?? this.dashEntry ?? 0) : this.vx * 0.4;
    this.vy = d.y < 0 ? -170 : 0;
    if (this.grounded) this.vy = 0;
    this.airTop = this.footY;      // a dash breaks a fall: water counts from here
  }

  #slideState(dt, iy, ix) {
    const wantsDown = iy > 0;
    if (!this.sliding && this.grounded && wantsDown && Math.abs(this.vx) >= P.SLIDE_ENTER && !this.dashing) {
      this.sliding = true;
      this.crouching = false;
      // A burst survives a slide: the burst owns your speed either way, so
      // ducking inside one is a change of posture, not a change of pace — and
      // it is the only way to take the low rock at burst speed.
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
    // A dash remembers what it will hand off (see #endDash), not its own pace:
    // a vault or roll called just after one used to pay the dash's 560 (or a
    // burst dash's 1000) back out as a run.
    const sp = this.dashing ? Math.min(Math.abs(this.vx), Math.max(P.DASH_END, this.dashEntry ?? 0))
                            : Math.abs(this.vx);
    this.recentSpeed -= P.RECENT_FADE * dt;
    if (sp >= this.recentSpeed) { this.recentSpeed = sp; this.recentDir = Math.sign(this.vx) || this.recentDir; }
    this.recentFlow = Math.max(this.flow, this.recentFlow - dt * 1.6);
  }

  /** The speed you had a moment ago, if it was going `dir`. A vault or roll
   *  pays it back so clipping a lip costs nothing, but never the other way:
   *  a stale cue behind you, or a skid round into a ledge, used to turn a run
   *  round on the spot at full speed. */
  #recentToward(dir) { return this.recentDir === dir ? this.recentSpeed : 0; }

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
      this.waveRun = true;
      this.waveFloor = Math.max(P.DASH_END, this.dashCarry ?? 0);   // where its bleed stops, as a dash's hand-off
      // (no bar of its own either: it used to add a quarter of one)
      this.fx.burst(this.cx, this.footY, 16, '#ffe6a8');
      this.fx.ring(this.cx, this.footY, 18, '#ffe6a8', 0.3, true);
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
      // No dash back from a wall: only the ground (and a crystal or a spring,
      // which exist to hand one back) refills it. A wall that refilled made
      // every shaft a free dash per kick, and every crystal chain optional.
      if (this.vy > 40 && Math.random() < 0.3)
        this.fx.dust(this.x + (this.wallDir > 0 ? this.w : 0), this.cy + 4, -this.wallDir * 20, 1, '#8f86c9');
    }
  }

  #onLand() {
    const impact = clamp(this.vy / P.FALL_MAX, 0, 1);
    this.fx.dust(this.cx, this.footY, 0, 4 + impact * 8);
    if (impact > 0.35) this.fx.ring(this.cx, this.footY, 8 + impact * 14, '#e8e2ff', 0.25, true);
    this.t.land = 0.14;
    if (impact > 0.25) { this.fx.shake(impact * 5); sfx.land(); }
    // A landing never costs anything, however far it came down (it used to
    // tax the run unless you rolled, and that was one thing too many to ask
    // of a player already reading the next gap). C held as you touch still
    // tucks you into a roll, for the look of it.
    if (this.t.rollFree > 0 || (this.holdingVault && impact > 0.5)) {
      this.rolling = Math.max(this.rolling, this.t.rollFree > 0 ? 0.14 : P.ROLL_TIME);
      this.t.rollFree = 0;
    }
    this.fallFrom = null;
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
    // a cue left behind you (you have turned round since) is not yours to call
    if (this.cue && Math.abs(this.vx) > 20 && Math.sign(this.vx) !== this.cue.dir) { this.cue = null; t.cue = 0; }
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
  #lipAhead(dir, minRise = P.VAULT_MIN) {
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
    for (let rise = minRise; rise <= P.VAULT_MAX; rise++) {
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
    const speed = Math.max(Math.abs(this.vx), this.#recentToward(c.dir), P.VAULT_EXIT);
    // The climb has to be over by the time the stride reaches the face (the
    // rise is done at 80% of the vault, see #vaultStep). At a sprint it always
    // was; at burst speed a climb of the usual length was still going when you
    // got there, so you slid up through the corner of the rock and then met
    // the next step while still mid-vault, which stopped you dead. A fast
    // vault is simply a quick one.
    const reachFace = this.#gapAhead(c.dir) / speed;
    const dur = Math.min(clamp(c.rise / P.VAULT_RISE_RATE, P.VAULT_MIN_TIME, P.VAULT_MAX_TIME),
                         Math.max(reachFace / 0.8, P.VAULT_SNAP));
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

  /** Does the ground ahead carry on as a ramp, rather than ending in a drop?
   *  Probed from the leading edge to a little past where the edge scanner saw
   *  the ground fall away (`gap`, which grows with speed), never deeper than a 45-degree
   *  slope could fall over that distance, so a slope at the foot of a real
   *  ledge does not count. The feet ride the highest point of a slope under
   *  the box, which on the way down is its trailing edge, so the slope at the
   *  leading edge already sits up to a box-width lower: that is allowed for. */
  #rampAhead(dir, gap = 0) {
    const edge = dir > 0 ? this.x + this.w : this.x;
    for (let d = 0; d <= gap + 24; d += 3) {
      const px = edge + dir * d;
      const deepest = this.footY + this.w + d + 4;
      if (this.level.floorUnder(px - 1, px + 1, this.footY - 1, deepest, { slopesOnly: true }) !== null)
        return true;
    }
    return false;
  }

  /** How far the box can move along `dir` at its current height before it
   *  touches rock, up to a limit well past any vault's reach. */
  #gapAhead(dir) {
    let d = 0;
    while (d < 120 && !this.level.boxHitsWall(this.x + dir * (d + 1), this.y, this.w, this.h)) d++;
    return d;
  }

  /** Book-keeping shared by both ledge calls. */
  #claimCue(c) {
    this.vaults++;
    this.cue = null;
    this.t.cue = 0;
    this.t.mantle = 0;
    this.t.super = 0;
    this.t.vaultBuf = 0;
    this.fallFrom = null;
    this.facing = c.dir;
    this.flow = Math.max(this.flow, this.recentFlow);
  }

  /** Rolling off a ledge is not a scripted hop: you keep your own momentum and
   *  simply leave the edge already tucked, so the drop costs nothing. */
  #roll(c) {
    const speed = Math.max(Math.abs(this.vx), this.#recentToward(c.dir), P.VAULT_EXIT);
    this.vx = c.dir * speed;
    this.rolling = P.ROLL_TIME;
    this.t.rollFree = P.ROLL_FREE;
    // Off a real edge the snap has to let go, or the drop never happens. Down
    // a ramp it must not: the slope falls away as fast as the edge scanner can
    // see, so it offers a roll there too, and switching the snap off launched
    // you clean off the ramp in a long hop instead of tumbling down it.
    const ramp = this.#rampAhead(c.dir, c.dist);
    this.t.noSnap = ramp ? 0 : 0.2;
    if (ramp) { this.slopeRoll = true; this.t.rollOff = P.ROLL_OFF; }
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
    // The box is also tested where it actually is: until the climb has lifted
    // it clear, the face of the lip holds it back instead of letting it slide
    // through the corner. (A vault sized to its speed never waits there long.)
    let togo = Math.max(Math.abs(this.vx), v.cross) * dt;
    while (togo > 0.001) {
      const bite = Math.min(3, togo);
      const nx = this.x + v.dir * bite;
      if (L.boxHitsWall(nx, v.y1, this.w, this.h)) { v.blocked = true; break; }
      if (L.boxHitsWall(nx, this.y, this.w, this.h)) break;
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
    this.#refund(0.12);
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
  // There is no burst button. Sprint the bar up to BURST_ARM with burst on and
  // the last of it creeps in (the top-off: lose any speed and it starts over);
  // full, the world drops into slow motion for a second and a half (the
  // wind-up), then
  // the burst fires by itself: you go well past a sprint, and
  // the world (the clock included) drops to BURST_SCALE so there is still
  // time to read a ledge and call it. The bar is the fuel gauge, and a burst
  // burns all of it, so where a stretch wants the bar kept (water, top-gear
  // gaps) V switches auto-burst off, and on again.

  /** Into the wind-up: slow motion, and BURST_WIND real seconds to watch it. */
  #armBurst() {
    this.burstWind = P.BURST_WIND;
    this.fx.burst(this.cx, this.cy, 10, '#dff3ff');
    this.fx.shake(1.5);
    sfx.burstWind();
  }

  /** V. Switched off mid-wind-up, the world snaps straight back and you run on
   *  with the bar you had; a burst already going is spent, and runs out. */
  #toggleAutoBurst() {
    this.autoBurst = !this.autoBurst;
    if (!this.autoBurst) this.burstWind = 0;
    sfx.cue();
  }

  /** The burst itself. Public because the sim checks start one directly,
   *  skipping the wind-up, to test what a burst does wherever they need it. */
  startBurst() {
    this.bursting = true;
    this.burstWind = 0;
    this.burstTail = 0;
    this.burstDir = Math.sign(this.vx) || this.facing;
    this.facing = this.burstDir;
    this.bursts++;
    this.vx = this.burstDir * P.BURST_SPEED;
    // Posture is the player's business. Cash a burst out of a slide and you
    // stay in it; the slide rules let go of you the moment you let go of down.
    this.fx.burst(this.cx, this.cy, 26, '#9cf6ff');
    this.fx.ring(this.cx, this.cy, 48, '#bff4ff', 0.45);
    this.fx.ring(this.cx, this.cy, 26, '#ffffff', 0.3);
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

  /** No burst and no wind-up, now: the run is over (the goal, the walk-off,
   *  the title). A burst kept going under the results panel, which feeds you
   *  no input, ran on into the level's end wall in slow motion for seconds,
   *  and a coast at top gear there wound a fresh one up. */
  standDown() {
    this.burstWind = 0;
    this.t.burstReady = 0;
    this.#endBurst();
    this.burstTail = 0;
  }

  #endBurst() {
    if (!this.bursting) return;
    this.bursting = false;
    this.burstSlow = true;
    // A second more of slow motion on the way out, so coming out of it is
    // something you watch happen rather than a snap back to full speed.
    this.burstTail = P.BURST_TAIL;
    // (at burst speed, not a burst dash's: that is the dash's own pace)
    if (P.BURST_SPEED >= this.recentSpeed) { this.recentSpeed = P.BURST_SPEED; this.recentDir = this.burstDir; }
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

  #flow(dt, ix, realDt) {
    if (this.bursting) return;       // the burst owns the meter while it runs
    const sp = Math.abs(this.vx);
    const moving = ix !== 0 && Math.sign(ix) === Math.sign(this.vx);
    // Coming down off a burst's speed is not running fast: until you are back
    // at your own top speed the bar does not fill (it used to refill all the
    // way down from 560, on speed the burst paid for).
    if (this.burstSlow && sp <= this.topSpeed) this.burstSlow = false;
    // The top-off (burst on, past BURST_ARM): the last of the bar creeps in,
    // and it has to be earned in one go. Any speed lost since the last step,
    // through the top-off or the wind-up after it, and the bar drops back to
    // where the top-off starts. Only speed lost below your top speed counts:
    // over it, bleeding back down is just the run settling (every stride at
    // top speed overshoots a little and drag takes it back, and a slope's or
    // a vault's extra pace runs off the same way). A hair of slack for rounding.
    const topping = this.autoBurst && this.flow > P.BURST_ARM && this.cx >= this.level.burstFrom;
    if (topping && sp < Math.min(this.lastSpeed, this.topSpeed) - 0.5) {
      this.flow = P.BURST_ARM;
      this.burstWind = 0;
      this.t.burstReady = 0;      // (or a wind-up started again, on a bar that is not full)
    }
    this.lastSpeed = sp;
    if (sp > 150 && (moving || this.sliding || this.slopeRoll || !this.grounded)) {
      // Nor does a dash fill it while it is going, of either kind. After it,
      // either kind, the run fills it as running always does (a slide-dash's
      // coast used to fill nothing, and left you a slower runner than a dash).
      if (!this.burstSlow && !this.dashing) {
        const creep = this.autoBurst && this.flow >= P.BURST_ARM && this.cx >= this.level.burstFrom;
        this.flow += dt * (creep ? P.TOPOFF_GAIN : P.FLOW_GAIN);
      }
    }
    else if (sp > 150 && this.gliding) { /* carried along on ice: the bar holds */ }
    else if (sp < 70) this.flow -= dt * P.FLOW_STALL;
    else this.flow -= dt * P.FLOW_DRAIN;
    this.flow = clamp(this.flow, 0, P.FLOW_MAX);
  }

  #runFx(dt) {
    const back = -Math.sign(this.vx || this.facing);

    // The feet kick up the dust, not a timer: every contact frame of the
    // stride plants a boot, so the footfalls land on the poses that look like
    // footfalls and the cadence you hear is the cadence you see.
    if (this.footfall && this.grounded && !this.vault && this.speed > 90) {
      const hard = this.speed > P.SPRINT_ANIM;
      if (this.onWater) {                     // spray, not dust: every stride a splash
        this.fx.dust(this.cx + back * 3, this.footY, back * (40 + this.speed * 0.3), 5, '#bfeaff');
        sfx.skim();
      } else {
        this.fx.dust(this.cx + back * 4, this.footY, back * (25 + this.speed * 0.2), hard ? 3 : 1);
        sfx.step();
      }
    }
    this.footfall = false;

    // Running on water throws a plume up behind you, every step, not just on
    // the footfalls: it is how you see that the water is holding you up.
    if (this.onWater && this.speed > 200 && Math.random() < 0.85)
      this.fx.spray(this.cx + back * 4, this.footY, back, this.speed);
    if (this.gliding && this.speed > 60 && Math.random() < 0.25)
      this.fx.sparkle(this.cx + back * 4, this.footY - 1, '#e8f6ff');

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
    if (this.struggle > 0) name = this.struggle < P.STRUGGLE_UNDER ? 'drown' : 'struggle';
    else if (this.dashing) name = 'dash';
    else if (this.rolling > 0) name = 'roll';
    else if (this.sliding) name = 'slide';
    else if (this.crouching || this.h < P.H)
      name = this.speed > P.SLIDE_EXIT ? 'slide' : this.speed > 12 ? 'crouchwalk' : 'crouch';
    else if (this.wallDir !== 0 && !this.grounded) name = 'wall';
    else if (!this.grounded && !this.sinking) name = this.vy < 80 ? 'jump' : 'fall';
    else if (this.t.skid > 0) name = 'skid';
    else if (this.gliding) name = 'glide';
    else if (this.speed > P.SPRINT_ANIM) name = 'sprint';
    else if (this.speed > 12) name = 'run';
    else if (this.t.land > 0.02) name = 'land';
    this.edgeDir = name === 'idle' ? this.#edge() : 0;
    if (this.edgeDir) name = 'teeter';

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
      const { rate } = stride(this.speed);
      while (a.t > rate) {
        a.t -= rate;
        a.frame = (a.frame + 1) % n;
        // frames 0 and 3 are the two contacts of the cycle
        if (a.frame % 3 === 0) this.footfall = true;
      }
    } else if (name === 'idle') {
      while (a.t > IDLE_TIMES[a.frame % IDLE_TIMES.length]) { a.t -= IDLE_TIMES[a.frame % IDLE_TIMES.length]; a.frame = (a.frame + 1) % n; }
    } else if (name === 'jump') {
      a.frame = this.vy < -300 ? 0 : this.vy < -90 ? 1 : 2;          // takeoff, rising, apex
    } else if (name === 'fall') {
      a.frame = Math.floor(a.t / 0.11) % n;                          // flailing
    } else if (name === 'land') {
      a.frame = this.t.land > 0.07 ? 0 : 1;                          // the hit, then up out of it
    } else if (name === 'dash') {
      const d = this.dashDir;                                        // the way it is going
      a.frame = Math.abs(d.x) > 0.35 ? 0 : d.y < 0 ? 1 : 2;
    } else if (name === 'teeter') {
      a.frame = Math.floor(a.t / 0.13) % n;                          // arms windmilling
    } else if (name === 'crouch') {
      a.frame = Math.floor(a.t / 0.6) % n;                           // breathing, ducked
    } else if (name === 'crouchwalk') {
      a.frame = Math.floor(a.t / 0.11) % n;                          // the shuffle
    } else if (name === 'struggle') {
      while (a.t > 0.09) { a.t -= 0.09; a.frame = (a.frame + 1) % n; }
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
    this.#refund(0.12);
    this.fx.burst(this.cx, this.footY, 14, '#ffe6a8');
    this.fx.shake(3);
    sfx.spring();
  }

  /** A boost pad underfoot: raises you to `speed` in its direction and never
   *  trims a run already going its way faster. Meet it backwards and it turns
   *  you round, as a pad pointing somewhere should. `fresh` is the first frame
   *  on it, for the fanfare. */
  boost(dir, speed, flow, fresh) {
    if (Math.sign(this.vx) !== dir || Math.abs(this.vx) < speed) this.vx = dir * speed;
    // A pad charges the bar to at least a full one as well: with an empty bar
    // (just respawned, say) the pad's speed would bleed straight back down to
    // a jog, and whatever comes after a pad is built for the speed it gives.
    this.flow = Math.max(this.flow, 1);
    if (!fresh) return;
    this.#refund(flow);
    this.fx.burst(this.cx, this.footY, 10, '#7dffc4');
    this.fx.shake(2);
    sfx.boost();
  }

  refillDash() {
    this.dashes = this.maxDashes;
    this.t.refill = 0;
    this.t.dashCool = 0;       // a crystal is the one thing that skips the queue
    this.fx.burst(this.cx, this.cy, 12, '#9cf6ff');
    sfx.crystal();
  }
}
