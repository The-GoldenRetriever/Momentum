// mechanics.js — the level furniture that acts on you while you play:
// crumbling blocks, phase blocks, boost pads, springs and crystals. Pure state + rules, no DOM, so the
// headless harnesses can tick it alongside the player.

import { TILE, T } from './level.js';
import { sfx } from './audio.js';

export const M = {
  CRUMBLE_DELAY: 0.32,       // touch to gone: long enough to cross one at a run,
                             // never long enough to stand and think on it
  CRUMBLE_BACK: 2.4,         // ... and how long the hole stays open

  PHASE_HALF: 1.4,           // each set is solid this long, then the other is
  PHASE_WARN: 0.4,           // the solid set flickers this long before it goes

  CRYSTAL_RESPAWN: 2.2,      // a spent crystal grows back this long after
  CRYSTAL_REACH: 14,         // px past the player's box that still counts as a touch:
                             // generous, because a chain lives or dies on it

  BOOST_SPEED: 520,          // well past a sprint: overspeed drag bleeds it off
                             // on the ground, so a pad wants a jump soon after
  BOOST_FLOW: 0.12,

  STILL_START: 0.5,          // the Stillness sets off at this share of its pace
  STILL_GATHER: 6,           // ... and is at all of it this many seconds later
};

const overlaps = (p, tx, ty, pad = 0) =>
  p.x - pad < (tx + 1) * TILE && p.x + p.w + pad > tx * TILE &&
  p.y - pad < (ty + 1) * TILE && p.y + p.h + pad > ty * TILE;

/** Seconds until the phase blocks next swap over, and which set is solid now. */
export function phaseState(L) {
  const n = Math.floor(L.phaseT / M.PHASE_HALF);
  return { active: n % 2, left: (n + 1) * M.PHASE_HALF - L.phaseT };
}

export function updateMechanics(L, p, dt) {
  const alive = !p.dead;

  // ---- the Stillness: it waits for you to move, then comes on and does not
  // stop. Never more than `reach` behind, so a second given away is a second
  // closer. It halts at the goal: once you are there it has lost.
  // It gathers itself first, from about half its pace to all of it over a few
  // seconds, so getting going from a standstill (the start, every flag) is a
  // race you can win.
  const ch = L.chase;
  if (ch && alive && !(L.goal && L.goal.hit)) {
    if (!ch.on && Math.abs(p.vx) > 8) ch.on = true;
    if (ch.on) {
      ch.t += dt;
      const pace = ch.speed * Math.min(1, M.STILL_START + ch.t / M.STILL_GATHER);
      ch.x = Math.max(ch.x + pace * dt, p.x - ch.reach * TILE);
    }
    if (p.x < ch.x) p.kill('still');
  }

  // ---- crumbling blocks. Feet, either side or the top of your head all count:
  // a crumble is a hold for a moment, never a wall or a floor you can keep.
  let cracked = false;
  for (const c of L.crumbles) {
    if (c.state === 'idle') {
      if (alive && overlaps(p, c.tx, c.ty, 1.5)) { c.state = 'shaking'; c.t = M.CRUMBLE_DELAY; cracked = true; }
    } else if (c.state === 'shaking') {
      c.t -= dt;
      if (c.t <= 0) { c.state = 'gone'; c.t = M.CRUMBLE_BACK; L.set(c.tx, c.ty, T.EMPTY); }
    } else if ((c.t -= dt) <= 0) {
      // never grow back into the player: that would bury them in rock
      if (!(alive && overlaps(p, c.tx, c.ty))) { c.state = 'idle'; L.set(c.tx, c.ty, T.CRUMBLE); }
    }
  }

  if (cracked) sfx.crumble();      // once, however many blocks you landed across

  // ---- phase blocks. A block that should appear while you stand inside it
  // waits until you are clear, for the same reason.
  L.phaseT += dt;
  if (L.phases.length) {
    const { active } = phaseState(L);
    for (const b of L.phases) {
      const want = b.group === active;
      if (want && !b.on) {
        if (alive && overlaps(p, b.tx, b.ty)) continue;
        b.on = true; L.set(b.tx, b.ty, T.PHASE);
      } else if (!want && b.on) {
        b.on = false; L.set(b.tx, b.ty, T.EMPTY);
      }
    }
  }

  // ---- crystals hand back your dash, and are not wasted on a full one
  for (const c of L.crystals) {
    if (c.t > 0) { c.t = Math.max(0, c.t - dt); continue; }
    if (!alive) continue;
    if (Math.abs(c.x - p.cx) < M.CRYSTAL_REACH + p.w / 2 && Math.abs(c.y - p.cy) < M.CRYSTAL_REACH + p.h / 2) {
      if (p.dashes >= p.maxDashes && p.grounded) continue;
      c.t = M.CRYSTAL_RESPAWN;
      p.refillDash();
    }
  }

  // ---- springs fire you upwards, but only on the way down onto them
  for (const s of L.springs) {
    if (s.t > 0) s.t = Math.max(0, s.t - dt);
    if (!alive) continue;
    const hit = p.x + p.w > s.x + 1 && p.x < s.x + TILE - 1 && p.footY > s.y + 6 && p.y < s.y + TILE;
    if (hit && p.vy >= -10) {
      p.y = s.y + 6 - p.h;
      p.bounce();
      s.t = 0.25;
    }
  }

  // ---- boost pads: only with your feet on them, and never inside a burst or
  // a vault, which own your speed outright.
  for (const b of L.boosts) {
    if (b.t > 0) b.t = Math.max(0, b.t - dt);
    if (!alive || !p.grounded) continue;
    if (p.x + p.w <= b.x || p.x >= b.x + b.w || Math.abs(p.footY - b.y) > 2) continue;
    const fresh = b.t <= 0;
    b.t = 0.3;
    // A pad always fires you at the same speed, so a pad that also restarts
    // the phase clock makes a phase crossing beyond it deterministic: the same
    // jumps land at the same moments every time, whenever you got there. The
    // clock restarts even inside a burst, which is only a little faster.
    if (fresh && b.sync !== null) L.phaseT = b.sync;
    if (p.bursting || p.vault) continue;
    p.boost(b.dir, M.BOOST_SPEED, M.BOOST_FLOW, fresh);
  }
}

/** Put every block back the way the level was built: on respawn and restart,
 *  so a death never leaves the way forward missing. `fromX` is where you are
 *  coming back in, and the Stillness waits a little way behind it. */
export function resetMechanics(L, fromX = null) {
  if (L.chase && fromX !== null) { L.chase.x = fromX - L.chase.lead * TILE; L.chase.on = false; L.chase.t = 0; }
  for (const c of L.crumbles) { c.state = 'idle'; c.t = 0; L.set(c.tx, c.ty, T.CRUMBLE); }
  for (const b of L.boosts) b.t = 0;
  for (const s of L.springs) s.t = 0;
}
