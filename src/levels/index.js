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
import { buildRicochet } from './ricochet.js';
import { buildMire } from './mire.js';
import { buildGale } from './gale.js';

// `id` keys the saved best time, so it never changes once a level ships
// (the test area kept the key it had before there was more than one level).
// `needs` is what a level asks for on top of beating the one before it:
// medals, by kind and count, earned anywhere in the game (see medalsShort).
// `par` is the time sim.js check 32's bot takes flat out from the start, with
// no bursts and no tricks: the medals are measured against it (see MEDALS).
// (tools/route.js prints it: `jsc -m tools/route.js -- <level> <spawn x> <y>`.)

export const LEVELS = [
  { id: 'tutorial', name: 'first steps', build: buildTutorial, difficulty: 1, par: 39.6,
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
  { id: 'tidewater', name: 'tidewater', build: buildTidewater, difficulty: 5, par: 29.6, needs: { bronze: 4 },
    blurb: ['Water you can run on, if you are fast: too slow,', 'sliding or ducked, and you sink. Reefs and arches.'] },
  { id: 'stillness', name: 'stillness', build: buildStillness, difficulty: 6, par: 29.7,
    blurb: ['A wall of stillness chases you the whole way', 'and never stops. Neither can you.'] },
  { id: 'overpass', name: 'overpass', build: buildOverpass, difficulty: 7, par: 29.6, needs: { silver: 3 },
    blurb: ['Parkour on girders at every height, with water', 'below them and a stretch to run across it.'] },
  { id: 'updraft', name: 'updraft', build: buildUpdraft, difficulty: 8, par: 29.4,
    blurb: ['Springs keep your speed and throw it upward:', 'top gear or you come down short. Hop the traps.'] },
  { id: 'furnace', name: 'furnace', build: buildFurnace, difficulty: 9, par: 30.6, needs: { silver: 5, gold: 1 },
    blurb: ['Under a low roof that keeps changing, with the', 'stillness chasing you the whole way.'] },
  { id: 'glacier', name: 'glacier', build: buildGlacier, difficulty: 10, par: 30.9, needs: { gold: 2 },
    blurb: ['All of it ice: it will not let you stop. A lake', 'that holds you at a full bar\'s speed, and an icefall.'] },
  { id: 'ricochet', name: 'ricochet', build: buildRicochet, difficulty: 11, par: 17.8, needs: { gold: 3 },
    blurb: ['Pads that fire you across gaps no jump crosses,', 'red ones that throw you back, a pinball run.'] },
  { id: 'mire', name: 'the mire', build: buildMire, difficulty: 12, par: 23.5, needs: { gold: 4 },
    blurb: ['Goo that holds you: one touch and you crawl.', 'Jump every strip of it. Dash it under the roof.'] },
  { id: 'gale', name: 'gale', build: buildGale, difficulty: 13, par: 23.1, needs: { gold: 5 },
    blurb: ['Wind that carries you, wind that holds you back,', 'updrafts up the cliffs, downdrafts in the pits.'] },
];

// Medal times, from a level's par and its difficulty (1 to 10): a share of
// par that starts generous and tightens as the levels get harder, so a hard
// level still asks more of you than an easy one. Bronze is a clean finish
// with some slack; silver is about the bot's flat-out run; gold is the bot's
// run on the first levels and a little under it on the last, where it sits
// at about tools/route.js's expert (dashes chained down every straight): an
// expert run always earns it. (They used to be far tighter, every one under
// par, gold under even the expert's time; they were asked to come down.)
//   [name, share of par at difficulty 1, colour, less per level of difficulty]
export const MEDALS = [
  ['gold', 1.00, '#ffd34d', 0.002],
  ['silver', 1.12, '#d6dde8', 0.010],
  ['bronze', 1.30, '#d08a52', 0.02],
];

export function medalTimes(lv) {
  const d = (lv.difficulty ?? 1) - 1;
  return MEDALS.map(([name, k, colour, step]) =>
    ({ name, colour, time: Math.round(lv.par * (k - step * d) * 10) / 10 }));
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
