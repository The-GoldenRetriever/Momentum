// save.js — what the game keeps between visits: a best time per level (which
// is also what unlocks the next one) and the last level started.
// Browser-only (localStorage), so the headless modules never import it.

import { LEVELS } from './levels/index.js';

// Bumped when a change to the game makes old saves meaningless. A save from
// an earlier version has its times wiped once, on the first load after: the
// levels were rebuilt, and a time on the old ones would unlock and medal
// levels that no longer exist as they were. (Key bindings are kept.)
const SAVE_VERSION = '3';
const VERSION_KEY = 'momentum.save';
export const LAST_KEY = 'momentum.last';

export const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  remove(k) { try { localStorage.removeItem(k); } catch { /* private mode */ } },
  keys() {
    try { return Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)); } catch { return []; }
  },
};

/** Wipe every time and the progress that hangs off them, once per version. */
export function migrateSave() {
  if (store.get(VERSION_KEY) === SAVE_VERSION) return false;
  for (const k of store.keys()) {
    if (k && (k.startsWith('momentum.best.') || k === LAST_KEY)) store.remove(k);
  }
  store.set(VERSION_KEY, SAVE_VERSION);
  return true;
}

const bestKey = (lv) => `momentum.best.${lv.id}`;

/** A level's best time in seconds, or 0 if it has never been finished. */
export function bestTime(lv) { return Number(store.get(bestKey(lv))) || 0; }
export function setBest(lv, t) { store.set(bestKey(lv), String(t)); }

/** You have to beat a level to open the next: the first is always open. */
export function unlocked(i) { return i <= 0 || bestTime(LEVELS[i - 1]) > 0; }

/** The furthest level you can play right now. */
export function lastUnlocked() {
  let i = 0;
  while (i + 1 < LEVELS.length && unlocked(i + 1)) i++;
  return i;
}
