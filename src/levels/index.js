// index.js — the levels, in order: the level select lists them, and the
// results panel's "next level" walks through them.

import { buildTestArea } from './test-area.js';
import { buildSpire } from './spire.js';
import { buildUndercroft } from './undercroft.js';
import { buildSkyline } from './skyline.js';

// `id` keys the saved best time, so it never changes once a level ships
// (the test area kept the key it had before there was more than one level).
// `par` is the time sim.js check 32's bot takes flat out from the start, with
// no bursts and no tricks: the medals are measured against it (see medals).
export const LEVELS = [
  { id: 'testarea', name: 'test area', build: buildTestArea, difficulty: 1, par: 27.1,
    blurb: ['Every move, one at a time, with a sign for each.'] },
  { id: 'spire', name: 'the spire', build: buildSpire, difficulty: 2, par: 17.5,
    blurb: ['Crumbling sand, boost pads and phase blocks,', 'up a wall-jump shaft and back down again.'] },
  { id: 'undercroft', name: 'undercroft', build: buildUndercroft, difficulty: 4, par: 18.8,
    blurb: ['Pillars too small to stop on over a spiked floor,', 'and a crawlway so low only top gear gets you out.'] },
  { id: 'skyline', name: 'skyline', build: buildSkyline, difficulty: 5, par: 20.6,
    blurb: ['Islands too small to stop on, with only sky below,', 'a dash chain, and an ascent on crystals alone.'] },
];

// Medal times, from a level's par: bronze is a bit better than the bot, silver
// is a good run, and gold asks for something near perfect (top gear held the
// whole way, the rolls called, the bursts spent well).
export const MEDALS = [
  ['gold', 0.84, '#ffd34d'],
  ['silver', 0.90, '#d6dde8'],
  ['bronze', 0.97, '#d08a52'],
];

export function medalTimes(lv) {
  return MEDALS.map(([name, k, colour]) => ({ name, colour, time: Math.round(lv.par * k * 10) / 10 }));
}

/** The best medal a time earns on a level, or null. */
export function medalFor(lv, time) {
  if (!time) return null;
  return medalTimes(lv).find((m) => time <= m.time) ?? null;
}
