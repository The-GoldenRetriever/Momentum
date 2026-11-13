// menus.js — the screens around a run: title, level select, pause, the
// results panel, and the leaderboards (signing one, and reading them). They are drawn straight onto the game canvas in the bitmap
// font, over the live world (the title and level select pan slowly across a
// level with nobody in it).

import { drawText, textWidth } from './font.js';
import { VIEW_W, VIEW_H, THEMES } from './render.js';
import { LEVELS, MEDALS, medalFor, medalTimes, needsText } from './levels/index.js';
import { T } from './level.js';
import { fmtTime } from './hud.js';
import { keyName } from './input.js';
import { makeCanvas } from './art.js';
import { sfx } from './audio.js';
import { unlocked, lastUnlocked, bestTime, lockReason, medalsMissing, board, boardRank, addToBoard, lastInitials, BOARD_SIZE } from './save.js';

const INK = '#cbc4e6', DIM = '#6f649c', HOT = '#ffd678', COOL = '#9cf6ff', GOOD = '#7dffc4';

function panel(ctx, x, y, w, h, alpha = 0.9) {
  ctx.fillStyle = `rgba(14,10,26,${alpha})`;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#3b3163';
  ctx.fillRect(x, y, w, 1);
  ctx.fillRect(x, y + h - 1, w, 1);
  ctx.fillRect(x, y, 1, h);
  ctx.fillRect(x + w - 1, y, 1, h);
}

// 1st, 2nd, 3rd ... (the font has no '#')
const nth = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;

const centred = (ctx, str, y, col, scale = 1, shadow = null) =>
  drawText(ctx, str, Math.round((VIEW_W - textWidth(str, scale) + scale) / 2), y, col, scale, shadow);

/** One pixel per tile: enough to read a level's shape at a glance. */
function thumbnail(level, theme) {
  const c = makeCanvas(level.w, level.h);
  const g = c.getContext('2d');
  const rock = theme.bands[1].mid, top = theme.moss;
  for (let ty = 0; ty < level.h; ty++) {
    for (let tx = 0; tx < level.w; tx++) {
      const t = level.get(tx, ty);
      let col = null;
      if (t === T.SOLID || t === T.SLOPE_L || t === T.SLOPE_R || t === T.LOWCEIL)
        col = level.isIce(tx, ty) ? '#d8f2ff' : ty > 0 && level.get(tx, ty - 1) === T.EMPTY ? top : rock;
      else if (t === T.ONEWAY) col = '#a294e0';
      else if (t === T.SPIKE_UP || t === T.SPIKE_DOWN) col = '#ff6b7a';
      else if (t === T.CRUMBLE) col = '#c99c6e';
      else if (t === T.WATER) col = level.waterTop(tx, ty) ? '#9fe0ff' : '#245f8f';
      if (col) { g.fillStyle = col; g.fillRect(tx, ty, 1, 1); }
    }
  }
  for (const b of level.phases) { g.fillStyle = b.group ? '#8fa8ff' : '#ff7ab8'; g.fillRect(b.tx, b.ty, 1, 1); }
  for (const b of level.boosts) { g.fillStyle = '#7dffc4'; g.fillRect(b.x / 16, b.y / 16 - 1, b.w / 16, 1); }
  for (const s of level.springs) { g.fillStyle = '#ffcb57'; g.fillRect(s.x / 16, s.y / 16, 1, 1); }
  for (const k of level.checkpoints) { g.fillStyle = '#ff8ab0'; g.fillRect(Math.floor(k.x / 16), k.y / 16 - 2, 1, 2); }
  if (level.goal) { g.fillStyle = HOT; g.fillRect(level.goal.x / 16, level.goal.y / 16, 2, 4); }
  return c;
}

export class Menus {
  constructor(game, input) {
    this.game = game;
    this.input = input;
    this.screen = null;           // 'title' | 'select' | 'pause' | 'results' | 'initials' | 'board' | null
    this.sel = 0;
    this.t = 0;
    this.thumbs = null;           // built the first time the level list is shown
  }

  get open() { return this.screen !== null; }

  show(screen) {
    // the board goes back where it was opened from, on the level it opened on
    if (screen === 'board') { this.boardBack = this.screen ?? 'title'; this.boardAt = this.game.levelIndex; }
    this.screen = screen;
    this.t = 0;
    this.note = false;            // a locked level was just picked: its reason turns pink
    if (screen === 'select') {
      // on the level you were on, or the furthest one you can reach
      this.sel = Math.min(this.game.levelIndex, lastUnlocked());
      this.thumbs ??= LEVELS.map((lv) => {
        const level = lv.build();
        return thumbnail(level, THEMES[level.theme] ?? THEMES.night);
      });
    } else {
      this.sel = 0;
    }
  }

  close() { this.screen = null; }

  // the rows each screen offers, as [label, action]
  #rows() {
    const g = this.game;
    switch (this.screen) {
      case 'title': return [['play', () => this.show('select')], ['leaderboard', () => this.show('board')],
                            ['controls', () => g.menu?.show()]];
      case 'select': return LEVELS.map((lv, i) => [lv.name, () => {
        if (unlocked(i)) { g.start(i); return; }
        this.note = true;
        sfx.locked();
      }]);
      case 'pause': return [
        ['resume', () => this.close()],
        ['restart run', () => { this.close(); g.restart(); }],
        ['back to last flag', () => { this.close(); g.player.kill(); }],
        ['level select', () => this.show('select')],
        ['controls', () => g.menu?.show()],
        ['quit to title', () => g.toTitle()],
      ];
      case 'results': {
        const rows = [];
        if (g.levelIndex + 1 < LEVELS.length && unlocked(g.levelIndex + 1)) rows.push(['next level', () => g.nextLevel()]);
        rows.push(['run it again', () => { this.close(); g.restart(); }]);
        rows.push(['leaderboard', () => this.show('board')]);
        rows.push(['level select', () => this.show('select')]);
        return rows;
      }
      default: return [];
    }
  }

  update(realDt) {
    const inp = this.input;
    this.t += realDt;
    if (this.screen === 'initials') { this.#initialsStep(inp); return; }
    if (this.screen === 'board') { this.#boardStep(inp); return; }
    const rows = this.#rows();
    // ArrowUp and W are jump keys as well as `up`: in a menu they only move.
    const up = inp.hit('up'), down = inp.hit('down');
    const pick = inp.hit('confirm') || (inp.hit('jump') && !up);
    const back = inp.hit('pause') || inp.hit('dash');

    if (up || down) {
      this.sel = (this.sel + (down ? 1 : -1) + rows.length) % rows.length;
      this.note = false;
      sfx.menuMove();
    }
    if (pick && rows[this.sel]) { sfx.menuPick(); rows[this.sel][1](); return; }
    if (back) {
      if (this.screen === 'pause') { sfx.menuMove(); this.close(); }
      else if (this.screen === 'select') {
        sfx.menuMove();
        const g = this.game;
        this.show(!g.inRun ? 'title' : g.finished ? 'results' : 'pause');
      }
    }
    // shortcuts that already mean something during a run keep meaning it here
    if (this.screen === 'results') {
      if (inp.hit('next') && this.game.levelIndex + 1 < LEVELS.length && unlocked(this.game.levelIndex + 1)) this.game.nextLevel();
      else if (inp.hit('restart')) { this.close(); this.game.restart(); }
    }
  }

  draw(ctx) {
    if (!this.screen) return;
    if (this.screen === 'title') this.#title(ctx);
    else if (this.screen === 'select') this.#select(ctx);
    else if (this.screen === 'pause') this.#list(ctx, 'paused', null);
    else if (this.screen === 'results') this.#results(ctx);
    else if (this.screen === 'initials') this.#initials(ctx);
    else if (this.screen === 'board') this.#board(ctx);
  }

  /** The run is over and the panel is due: a time that makes the level's
   *  board signs it first (see #initials), then the results. */
  finishRun() {
    const g = this.game;
    g.lastRank = null;
    const rank = boardRank(g.levelInfo, g.time);
    if (rank < 0) { g.lastRank = -1; this.show('results'); return; }
    this.pending = { rank };
    this.letters = lastInitials().split('');
    this.slot = 0;
    this.show('initials');
  }

  // ------------------------------------------------------------------ title
  #title(ctx) {
    ctx.fillStyle = 'rgba(8,6,15,0.45)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    // the title itself, with a sweep of light running across it
    const word = 'MOMENTUM', s = 6;
    const w = textWidth(word, s) - s;
    const x0 = Math.round((VIEW_W - w) / 2), y0 = 52;
    drawText(ctx, word, x0, y0 + 3, '#150f26', s);
    drawText(ctx, word, x0, y0, '#ffffff', s);
    const sweep = ((this.t * 140) % (w + 160)) - 80;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0 + sweep, y0, 26, 5 * s);
    ctx.clip();
    drawText(ctx, word, x0, y0, COOL, s);
    ctx.restore();
    centred(ctx, 'a speed platformer', y0 + 5 * s + 10, DIM, 1);

    this.#rowsAt(ctx, VIEW_H / 2 + 22, 2);

    // the pan puts the ground right behind the help lines, which drowned them
    ctx.fillStyle = 'rgba(8,6,15,0.72)';
    ctx.fillRect(0, VIEW_H - 34, VIEW_W, 34);
    const keys = (a, n = 1) => this.input.keysFor(a).slice(0, n).map(keyName).join('/') || '-';
    const help = `${keys('jump')} jump   ${keys('dash')} dash   ${keys('vault')} ledges   ${keys('autoburst')} burst on/off`;
    centred(ctx, help, VIEW_H - 28, '#8a7fc0', 1);
    centred(ctx, 'up/down choose   jump or enter to pick   f fullscreen', VIEW_H - 18, '#5f5590', 1);
  }

  /** The current screen's rows, centred, the chosen one marked. */
  #rowsAt(ctx, y, scale = 1) {
    this.#rows().forEach(([label], i) => {
      const on = i === this.sel;
      const str = on ? `> ${label} <` : label;
      centred(ctx, str, y + i * (6 * scale + 6), on ? HOT : INK, scale, '#150f26');
    });
  }

  // ----------------------------------------------------------- level select
  #select(ctx) {
    ctx.fillStyle = 'rgba(8,6,15,0.62)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    centred(ctx, 'select level', 14, HOT, 2, '#150f26');

    // rows tighten up as the list grows, so the map below still has room
    const x = 28, y = 40, w = VIEW_W - 56, rowH = LEVELS.length > 5 ? 12 : 14;
    panel(ctx, x, y, w, LEVELS.length * rowH + 8);
    LEVELS.forEach((lv, i) => {
      const ry = y + 4 + i * rowH;
      const on = i === this.sel;
      if (on) { ctx.fillStyle = '#241e42'; ctx.fillRect(x + 2, ry, w - 4, rowH - 1); ctx.fillStyle = HOT; ctx.fillRect(x + 2, ry, 1, rowH - 1); }
      const best = bestTime(lv);
      const open = unlocked(i);
      drawText(ctx, `${i + 1}`, x + 8, ry + 4, on ? HOT : DIM, 1);
      if (!open) {                               // a level you have not earned yet
        drawText(ctx, lv.name, x + 20, ry + 4, on ? '#8a80b0' : '#4a4270', 1);
        drawText(ctx, 'locked', x + w - 12 - textWidth('locked', 1), ry + 4, '#4a4270', 1);
        // and the medals it asks for, in the colour of the best kind asked
        if (lv.needs) {
          const asks = MEDALS.filter(([name]) => lv.needs[name]).map(([name, , colour]) => ({ name, colour, need: lv.needs[name] }));
          const txt = `needs ${needsText(asks)}`;
          drawText(ctx, txt, x + w - 52 - textWidth(txt, 1), ry + 4, on ? asks[0].colour : '#6a5f8e', 1);
        }
        return;
      }
      drawText(ctx, lv.name, x + 20, ry + 4, on ? '#ffffff' : INK, 1);
      const stars = '*'.repeat(lv.difficulty ?? 1);
      drawText(ctx, stars, x + 150, ry + 4, '#ff9ecd', 1);
      const bt = best ? fmtTime(best) : '--:--.--';
      drawText(ctx, bt, x + w - 12 - textWidth(bt, 1), ry + 4, best ? GOOD : '#443a6e', 1);
      const medal = medalFor(lv, best);
      if (best) drawText(ctx, medal ? medal.name : 'clear', x + w - 60 - textWidth(bt, 1), ry + 4, medal ? medal.colour : '#3f9a78', 1);
    });

    // the chosen level: its blurb and a map of it (or, locked, what opens it)
    const lv = LEVELS[this.sel];
    const by = y + LEVELS.length * rowH + 16;
    if (!unlocked(this.sel)) {
      lockReason(this.sel).forEach((line, i) => centred(ctx, line, by + 4 + i * 9, this.note ? '#ff9ecd' : '#7a6fb5', 1));
      centred(ctx, 'jump or enter: play   esc: back', VIEW_H - 12, '#564d80', 1);
      return;
    }
    (lv.blurb ?? []).forEach((line, i) => centred(ctx, line, by + i * 8, '#b9b2d6', 1));
    const targets = medalTimes(lv).map((m) => `${m.name} ${fmtTime(m.time)}`).join('   ');
    centred(ctx, targets, by + (lv.blurb?.length ?? 0) * 8 + 2, '#7a6fb5', 1);
    // The map fits the space left under the text, by width and by height: a
    // tall level (the cascade drops seventy rows) used to spill up over it.
    const th = this.thumbs[this.sel];
    const ty = by + (lv.blurb?.length ?? 0) * 8 + 16;
    const scale = Math.min(1, (VIEW_W - 40) / th.width, (VIEW_H - 22 - ty) / th.height);
    const tw = Math.round(th.width * scale), thh = Math.round(th.height * scale);
    const tx = Math.round((VIEW_W - tw) / 2);
    panel(ctx, tx - 3, ty - 3, tw + 6, thh + 6, 0.85);
    ctx.drawImage(th, tx, ty, tw, thh);

    centred(ctx, 'jump or enter: play   esc: back', VIEW_H - 12, '#564d80', 1);
  }

  // ------------------------------------------------------------ pause & co.
  #list(ctx, title, lines) {
    ctx.fillStyle = 'rgba(8,6,15,0.55)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const rows = this.#rows();
    const h = 40 + (lines ? lines.length * 9 + 8 : 0) + rows.length * 12;
    const w = 200, x = Math.round((VIEW_W - w) / 2), y = Math.round((VIEW_H - h) / 2);
    panel(ctx, x, y, w, h);
    centred(ctx, title, y + 8, HOT, 2);
    let cy = y + 30;
    if (lines) {
      for (const [label, value, col] of lines) {
        drawText(ctx, label, x + 24, cy, DIM, 1);
        drawText(ctx, value, x + w - 24 - textWidth(value, 1), cy, col ?? INK, 1);
        cy += 9;
      }
      cy += 8;
    }
    rows.forEach(([label], i) => {
      const on = i === this.sel;
      centred(ctx, on ? `> ${label} <` : label, cy + i * 12, on ? HOT : INK, 1);
    });
  }

  #results(ctx) {
    const g = this.game;
    const fresh = g.newBest;
    const medal = medalFor(g.levelInfo, g.time);
    // the next medal up, so there is always something to run for
    const next = medalTimes(g.levelInfo).filter((m) => !medal || m.time < medal.time).pop();
    this.#list(ctx, fresh ? 'new best' : 'level clear', [
      ['level', g.levelInfo.name],
      ['time', fmtTime(g.time), fresh ? GOOD : '#ffffff'],
      ['medal', medal ? medal.name : 'none', medal ? medal.colour : '#6f649c'],
      ['best', fmtTime(g.best), GOOD],
      ['deaths', String(g.player.deaths)],
      ...(next ? [[`${next.name} at`, fmtTime(next.time), next.colour]] : []),
      // the next level shut behind medals: what it still wants
      ...(g.levelIndex + 1 < LEVELS.length && medalsMissing(g.levelIndex + 1).length
        ? [['next needs', needsText(medalsMissing(g.levelIndex + 1)), medalsMissing(g.levelIndex + 1)[0].colour]] : []),
      ...(g.lastRank != null ? [['leaderboard', g.lastRank >= 0 ? `${nth(g.lastRank + 1)} of ${BOARD_SIZE}` : 'not in the top ten',
                                 g.lastRank >= 0 ? COOL : DIM]] : []),
    ]);
  }

  // ------------------------------------------------------------ leaderboard
  // Up and down turn a letter (ArrowUp and W are jump keys too: here they
  // only turn), left and right pick one, jump or enter signs. Backing out
  // signs as well: a run that made the board is never thrown away.
  #initialsStep(inp) {
    const up = inp.hit('up'), down = inp.hit('down');
    if (up || down) {
      const c = this.letters[this.slot].charCodeAt(0) - 65;
      this.letters[this.slot] = String.fromCharCode(65 + (c + (up ? 1 : 25)) % 26);
      sfx.menuMove();
    }
    if (inp.hit('left') || inp.hit('right')) { this.slot = (this.slot + (inp.hit('right') ? 1 : 2)) % 3; sfx.menuMove(); }
    if (inp.hit('confirm') || (inp.hit('jump') && !up) || inp.hit('pause') || inp.hit('dash')) {
      const g = this.game;
      g.lastRank = addToBoard(g.levelInfo, g.time, this.letters.join(''), g.player.deaths);
      sfx.menuPick();
      this.show('results');
    }
  }

  #initials(ctx) {
    const g = this.game;
    ctx.fillStyle = 'rgba(8,6,15,0.55)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const w = 260, h = 120, x = Math.round((VIEW_W - w) / 2), y = Math.round((VIEW_H - h) / 2);
    panel(ctx, x, y, w, h);
    centred(ctx, 'new record', y + 8, HOT, 2);
    centred(ctx, `${g.levelInfo.name}   ${fmtTime(g.time)}   ${nth(this.pending.rank + 1)} on the board`, y + 30, INK, 1);
    // three letters, the one being turned in colour with a caret under it
    const s = 4, cw = 6 * s, lx = Math.round(VIEW_W / 2 - cw * 1.5 + s / 2);
    this.letters.forEach((ch, i) => {
      const on = i === this.slot;
      drawText(ctx, ch, lx + i * cw, y + 48, on ? COOL : '#ffffff', s, '#150f26');
      if (on && Math.floor(this.t * 3) % 2 === 0) { ctx.fillStyle = COOL; ctx.fillRect(lx + i * cw, y + 48 + 5 * s + 3, 3 * s, 2); }
    });
    centred(ctx, 'up/down letter   left/right move', y + h - 26, DIM, 1);
    centred(ctx, 'jump or enter: sign the board', y + h - 16, DIM, 1);
  }

  #boardStep(inp) {
    const left = inp.hit('left'), right = inp.hit('right');
    if (left || right) { this.boardAt = (this.boardAt + (right ? 1 : LEVELS.length - 1)) % LEVELS.length; sfx.menuMove(); }
    if (inp.hit('confirm') || inp.hit('jump') || inp.hit('pause') || inp.hit('dash')) { sfx.menuMove(); this.show(this.boardBack); }
  }

  #board(ctx) {
    const g = this.game;
    ctx.fillStyle = 'rgba(8,6,15,0.66)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    centred(ctx, 'leaderboard', 14, HOT, 2, '#150f26');
    const lv = LEVELS[this.boardAt];
    centred(ctx, `<  ${this.boardAt + 1} ${lv.name}  >`, 36, '#ffffff', 1);
    const targets = medalTimes(lv).map((m) => `${m.name} ${fmtTime(m.time)}`).join('   ');
    centred(ctx, targets, 47, '#7a6fb5', 1);

    const rows = board(lv);
    const x = 70, y = 60, w = VIEW_W - 140, rowH = 13;
    panel(ctx, x, y, w, BOARD_SIZE * rowH + 20);
    const cols = [[x + 10, ''], [x + 42, 'name'], [x + 92, 'time'], [x + 158, 'medal'], [x + 214, 'deaths'], [x + 272, 'date']];
    for (const [cx, label] of cols) drawText(ctx, label, cx, y + 6, DIM, 1);
    // this run's place, if it is this level's board you came to from the results
    const mine = this.boardBack === 'results' && this.boardAt === g.levelIndex ? g.lastRank : -1;
    for (let i = 0; i < BOARD_SIZE; i++) {
      const ry = y + 18 + i * rowH, r = rows[i];
      if (i === mine) { ctx.fillStyle = '#241e42'; ctx.fillRect(x + 2, ry - 3, w - 4, rowH - 1); }
      drawText(ctx, nth(i + 1), cols[0][0], ry, i === mine ? HOT : DIM, 1);
      if (!r) { drawText(ctx, '---', cols[1][0], ry, '#3f3866', 1); continue; }
      const medal = medalFor(lv, r.t);
      const date = r.at ? (() => { const d = new Date(r.at); return `${d.getMonth() + 1}/${d.getDate()}`; })() : '-';
      drawText(ctx, r.name, cols[1][0], ry, i === mine ? HOT : '#ffffff', 1);
      drawText(ctx, fmtTime(r.t), cols[2][0], ry, GOOD, 1);
      drawText(ctx, medal ? medal.name : '-', cols[3][0], ry, medal ? medal.colour : DIM, 1);
      drawText(ctx, r.deaths == null ? '-' : String(r.deaths), cols[4][0], ry, INK, 1);
      drawText(ctx, date, cols[5][0], ry, INK, 1);
    }
    if (!rows.length) centred(ctx, 'no runs yet', y + 18 + 4.5 * rowH, DIM, 1);
    centred(ctx, 'left/right: level   jump, enter or esc: back', VIEW_H - 12, '#564d80', 1);
  }
}
