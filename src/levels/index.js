// index.js — the levels, in order: the level select lists them, and the
// results panel's "next level" walks through them.

import { buildTestArea } from './test-area.js';
import { buildSpire } from './spire.js';
import { buildUndercroft } from './undercroft.js';
import { buildSkyline } from './skyline.js';
import { buildOverpass } from './overpass.js';
import { buildCascade } from './cascade.js';
import { buildFurnace } from './furnace.js';

// `id` keys the saved best time, so it never changes once a level ships
// (the test area kept the key it had before there was more than one level).
// `par` is the time sim.js check 32's bot takes flat out from the start, with
// no bursts and no tricks: the medals are measured against it (see medals).
// (tools/route.js prints it: `jsc -m tools/route.js -- <level> <spawn x> <y>`.)

// On the momentum courses (no pads, and top gear the whole way) the bot's
// run is already close to the best line there is, so their medals sit much
// nearer par: beating the bot at all is bronze, and gold wants dashes chained
// down the run-ups (about an eighth faster than running) and nothing given
// away anywhere.
const TIGHT = [0.94, 0.97, 0.99];

export const LEVELS = [
  { id: 'testarea', name: 'test area', build: buildTestArea, difficulty: 1, par: 27.1,
    blurb: ['Every move, one at a time, with a sign for each.'] },
  { id: 'spire', name: 'the spire', build: buildSpire, difficulty: 2, par: 17.7,
    blurb: ['Crumbling sand, boost pads and phase blocks,', 'up a wall-jump shaft and back down again.'] },
  { id: 'undercroft', name: 'undercroft', build: buildUndercroft, difficulty: 4, par: 18.9,
    blurb: ['Pillars too small to stop on over a spiked floor,', 'and a crawlway so low only top gear gets you out.'] },
  { id: 'skyline', name: 'skyline', build: buildSkyline, difficulty: 5, par: 20.6,
    blurb: ['Islands too small to stop on, with only sky below,', 'a dash chain, and an ascent on crystals alone.'] },
  { id: 'overpass', name: 'overpass', build: buildOverpass, difficulty: 5, par: 22.1, medals: TIGHT,
    blurb: ['No boost pads: every bit of speed is yours to keep.', 'Gaps that widen past what a sprint can clear.'] },
  { id: 'cascade', name: 'cascade', build: buildCascade, difficulty: 5, par: 21.2, medals: TIGHT,
    blurb: ['Down a stair of cliffs, every landing rolled', 'or the next cliff is out of reach.'] },
  { id: 'furnace', name: 'furnace', build: buildFurnace, difficulty: 6, par: 22.6, medals: TIGHT,
    blurb: ['All of it at once: rolled falls, a roof that cuts', 'every jump short, fangs, and a vent to slide.'] },
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
  return MEDALS.map(([name, k, colour], i) =>
    ({ name, colour, time: Math.round(lv.par * (lv.medals?.[i] ?? k) * 10) / 10 }));
}

/** The best medal a time earns on a level, or null. */
export function medalFor(lv, time) {
  if (!time) return null;
  return medalTimes(lv).find((m) => time <= m.time) ?? null;
}
