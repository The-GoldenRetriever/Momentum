// save.js — what the game keeps between visits: a best time per level (which
// is also what unlocks the next one), each level's leaderboard, and the last
// level started.
// Browser-only (localStorage), so the headless modules never import it.

import { LEVELS, medalsShort, needsText } from './levels/index.js';

// Bumped when a change to the game makes old saves meaningless. A save from
// an earlier version has its times wiped once, on the first load after: the
// levels were rebuilt, and a time on the old ones would unlock and medal
// levels that no longer exist as they were. (Key bindings are kept.)
const SAVE_VERSION = '3';
const VERSION_KEY = 'momentum.save';
export const LAST_KEY = 'momentum.last';
// V's auto-burst switch, kept between visits ('off', or anything else for on)
export const AUTO_KEY = 'momentum.autoburst';

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
    if (k && (k.startsWith('momentum.best.') || k.startsWith('momentum.board.') || k === LAST_KEY)) store.remove(k);
  }
  store.set(VERSION_KEY, SAVE_VERSION);
  return true;
}

const bestKey = (lv) => `momentum.best.${lv.id}`;

/** A level's best time in seconds, or 0 if it has never been finished. */
export function bestTime(lv) { return Number(store.get(bestKey(lv))) || 0; }
export function setBest(lv, t) { store.set(bestKey(lv), String(t)); }

/** You have to beat a level to open the next, and some levels ask for medals
 *  as well (their `needs`, see levels/index.js): the first is always open. */
export function unlocked(i) {
  return i <= 0 || (bestTime(LEVELS[i - 1]) > 0 && medalsShort(LEVELS[i], bestTime).length === 0);
}

/** Why level `i` is shut, as lines for the level select (empty if it is open). */
export function lockReason(i) {
  if (unlocked(i)) return [];
  const lines = [];
  if (!(bestTime(LEVELS[i - 1]) > 0)) lines.push(`beat ${LEVELS[i - 1].name} to open this one`);
  const short = medalsShort(LEVELS[i], bestTime);
  if (short.length) {
    lines.push(`${lines.length ? 'and earn' : 'earn'} ${needsText(short)} medals or better`);
    lines.push(`(you have ${short.map((n) => `${n.have} ${n.name}`).join(', ')}: any level counts)`);
  }
  return lines;
}

/** Medals still missing for level `i` (see medalsShort), for the results panel. */
export function medalsMissing(i) { return i < LEVELS.length ? medalsShort(LEVELS[i], bestTime) : []; }

/** The furthest level you can play right now. */
export function lastUnlocked() {
  let i = 0;
  while (i + 1 < LEVELS.length && unlocked(i + 1)) i++;
  return i;
}

// ------------------------------------------------------------- leaderboards
//
// Each level keeps its ten best runs on this machine, with the three letters
// whoever ran them signed it with (the last ones used are offered again, so
// a player alone signs with one press). There is no server: the board is
// this browser's.

export const BOARD_SIZE = 10;
const INITIALS_KEY = 'momentum.initials';
const boardKey = (lv) => `momentum.board.${lv.id}`;

/** A level's board, fastest first: [{ t, name, deaths, at }]. */
export function board(lv) {
  let rows = null;
  try { rows = JSON.parse(store.get(boardKey(lv)) || 'null'); } catch { rows = null; }
  if (!Array.isArray(rows)) rows = [];
  return rows.filter((r) => r && r.t > 0).sort((a, b) => a.t - b.t).slice(0, BOARD_SIZE);
}

/** A best time from before there were boards goes on its level's board,
 *  unsigned, once, at startup. (Seeding it whenever a board was read found the
 *  run just finished already there: the best is saved at the goal, before
 *  the board is asked, so a first run signed itself in twice.) */
export function seedBoards() {
  for (const lv of LEVELS) {
    if (store.get(boardKey(lv)) !== null || !bestTime(lv)) continue;
    store.set(boardKey(lv), JSON.stringify([{ t: bestTime(lv), name: '---', deaths: null, at: null }]));
  }
}

/** Where a time would go on a level's board (0 is the top), or -1 if it would
 *  not make it. */
export function boardRank(lv, t) {
  const rows = board(lv);
  const i = rows.findIndex((r) => t < r.t);
  const at = i < 0 ? rows.length : i;
  return at < BOARD_SIZE ? at : -1;
}

/** Sign a run onto the board; returns its place (0 is the top), or -1. */
export function addToBoard(lv, t, name, deaths) {
  const rank = boardRank(lv, t);
  if (rank < 0) return -1;
  const rows = board(lv);
  rows.splice(rank, 0, { t, name, deaths, at: Date.now() });
  store.set(boardKey(lv), JSON.stringify(rows.slice(0, BOARD_SIZE)));
  store.set(INITIALS_KEY, name);
  return rank;
}

/** The initials last signed with, to offer again. */
export function lastInitials() {
  const s = store.get(INITIALS_KEY);
  return s && /^[A-Z]{3}$/.test(s) ? s : 'AAA';
}
