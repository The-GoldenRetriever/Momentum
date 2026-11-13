// index.js — the levels, in order: the level select lists them, and the
// results panel's "next level" walks through them.

import { buildTutorial } from './tutorial.js';
import { buildTestArea } from './test-area.js';
import { buildSpire } from './spire.js';
import { buildUndercroft } from './undercroft.js';
import { buildSkyline } from './skyline.js';
import { buildOverpass } from './overpass.js';
import { buildUpdraft } from './updraft.js';
import { buildFurnace } from './furnace.js';
import { buildTidewater } from './tidewater.js';
import { buildStillness } from './stillness.js';
import { buildGlacier } from './glacier.js';

// `id` keys the saved best time, so it never changes once a level ships
// (the test area kept the key it had before there was more than one level).
// `needs` is what a level asks for on top of beating the one before it:
// medals, by kind and count, earned anywhere in the game (see medalsShort).
// `par` is the time sim.js check 32's bot takes flat out from the start, with
// no bursts and no tricks: the medals are measured against it (see medals).
// (tools/route.js prints it: `jsc -m tools/route.js -- <level> <spawn x> <y>`.)

// On the momentum courses (no pads, and top gear the whole way) the bot's
// run is already close to the best line there is, so their medals sit much
// nearer par: beating the bot at all is bronze, and gold wants dashes chained
// down the run-ups (about an eighth faster than running) and nothing given
// away anywhere.
const TIGHT = [0.90, 0.97, 0.99];

export const LEVELS = [
  // (the expert dashes a long way down the burst's run-up, about a ninth
  // faster than the bot, so gold sits under it as everywhere else)
  { id: 'tutorial', name: 'first steps', build: buildTutorial, difficulty: 1, par: 23.7, medals: [0.845, 0.9, 0.99],
    blurb: ['Every move, one at a time: each gate can only', 'be passed with the move it teaches.'] },
  // (the test area kept its id when it became a regular level, and its file
  // name: the sim checks still build it as their playground)
  { id: 'testarea', name: 'proving ground', build: buildTestArea, difficulty: 1, par: 27.1,
    blurb: ['Every move again, back to back, at a run:', 'ledges, slopes, a shaft, springs and a gate.'] },
  { id: 'spire', name: 'the spire', build: buildSpire, difficulty: 2, par: 17.1,
    blurb: ['Crumbling sand, boost pads and phase blocks,', 'up a wall-jump shaft and back down again.'] },
  { id: 'undercroft', name: 'undercroft', build: buildUndercroft, difficulty: 3, par: 18.9, needs: { bronze: 2 },
    blurb: ['Pillars too small to stop on over a spiked floor,', 'and a crawlway so low only top gear gets you out.'] },
  { id: 'skyline', name: 'skyline', build: buildSkyline, difficulty: 4, par: 20.6,
    blurb: ['Islands too small to stop on, with only sky below,', 'a dash chain, and an ascent on crystals alone.'] },
  { id: 'tidewater', name: 'tidewater', build: buildTidewater, difficulty: 5, par: 29.6, medals: TIGHT, needs: { bronze: 4 },
    blurb: ['Water you can run on, if you are fast: too slow,', 'sliding or ducked, and you sink. Reefs and arches.'] },
  { id: 'stillness', name: 'stillness', build: buildStillness, difficulty: 6, par: 29.7, medals: TIGHT,
    blurb: ['A wall of stillness chases you the whole way', 'and never stops. Neither can you.'] },
  // (overpass's expert runs nearer par than most, so its gold sits a little
  // lower, to ask the same of you as the others)
  { id: 'overpass', name: 'overpass', build: buildOverpass, difficulty: 7, par: 29.6, medals: [0.915, 0.97, 0.99], needs: { silver: 3 },
    blurb: ['Parkour on girders at every height, with water', 'below them and a stretch to run across it.'] },
  { id: 'updraft', name: 'updraft', build: buildUpdraft, difficulty: 8, par: 29.4, medals: TIGHT,
    blurb: ['Springs keep your speed and throw it upward:', 'top gear or you come down short. Hop the traps.'] },
  { id: 'furnace', name: 'furnace', build: buildFurnace, difficulty: 9, par: 30.6, medals: TIGHT, needs: { silver: 5, gold: 1 },
    blurb: ['Under a low roof that keeps changing, with the', 'stillness chasing you the whole way.'] },
  { id: 'glacier', name: 'glacier', build: buildGlacier, difficulty: 10, par: 30.9, medals: TIGHT, needs: { gold: 2 },
    blurb: ['All of it ice: it will not let you stop. A lake', 'that holds a full bar, and an icefall to dash.'] },
];

// Medal times, from a level's par: bronze is a bit better than the bot, silver
// is a good run, and gold asks for something near perfect (top gear held the
// whole way, every straight dashed, dashes spent in the air too): about 5%
// faster than tools/route.js's expert, which already chains dashes down every
// straight, on every level. (Gold used to be 0.80 of par here, which on the
// early courses was a fifth faster than the expert: nothing reaches that,
// bursts included, which on these courses cost more top gear than they gain.)
// On these early courses the expert is barely faster than the bot (there is
// little room to dash), so silver is about matching the expert, and bronze
// just beating the bot.
export const MEDALS = [
  ['gold', 0.93, '#ffd34d'],
  ['silver', 0.98, '#d6dde8'],
  ['bronze', 0.995, '#d08a52'],
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

/** How many levels have earned each kind of medal, given each level's best
 *  time (`best(lv)`, 0 for never finished). A better medal counts as the
 *  lesser ones too: a gold is a silver and a bronze as well, so "three silver"
 *  is any three levels at silver or better. */
export function medalTally(best) {
  const tally = Object.fromEntries(MEDALS.map(([name]) => [name, 0]));
  for (const lv of LEVELS) {
    const m = medalFor(lv, best(lv));
    if (!m) continue;
    for (let r = MEDALS.findIndex(([name]) => name === m.name); r < MEDALS.length; r++) tally[MEDALS[r][0]]++;
  }
  return tally;
}

/** What a level's `needs` still asks for: one entry per kind you are short
 *  of, best kind first, as { name, colour, need, have }. Empty once it is met. */
export function medalsShort(lv, best) {
  if (!lv.needs) return [];
  const tally = medalTally(best);
  return MEDALS.filter(([name]) => (lv.needs[name] ?? 0) > tally[name])
    .map(([name, , colour]) => ({ name, colour, need: lv.needs[name], have: tally[name] }));
}

/** "3 silver, 1 gold" — a level's needs, or what is still missing of them. */
export function needsText(list) {
  return list.map((n) => `${n.need} ${n.name}`).join(', ');
}
