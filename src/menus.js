// menus.js — the screens around a run: title, level select, pause and the
// results panel. They are drawn straight onto the game canvas in the bitmap
// font, over the live world (the title and level select pan slowly across a
// level with nobody in it).

import { drawText, textWidth } from './font.js';
import { VIEW_W, VIEW_H, THEMES } from './render.js';
import { LEVELS, medalFor, medalTimes } from './levels/index.js';
import { T } from './level.js';
import { fmtTime } from './hud.js';
import { keyName } from './input.js';
import { makeCanvas } from './art.js';
import { sfx } from './audio.js';

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
        col = ty > 0 && level.get(tx, ty - 1) === T.EMPTY ? top : rock;
      else if (t === T.ONEWAY) col = '#a294e0';
      else if (t === T.SPIKE_UP || t === T.SPIKE_DOWN) col = '#ff6b7a';
      else if (t === T.CRUMBLE) col = '#c99c6e';
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
    this.screen = null;           // 'title' | 'select' | 'pause' | 'results' | null
    this.sel = 0;
    this.t = 0;
    this.thumbs = null;           // built the first time the level list is shown
  }

  get open() { return this.screen !== null; }

  show(screen) {
    this.screen = screen;
    this.t = 0;
    if (screen === 'select') {
      this.sel = this.game.levelIndex;
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
      case 'title': return [['play', () => this.show('select')], ['controls', () => g.menu?.show()]];
      case 'select': return LEVELS.map((lv, i) => [lv.name, () => g.start(i)]);
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
        if (g.levelIndex + 1 < LEVELS.length) rows.push(['next level', () => g.nextLevel()]);
        rows.push(['run it again', () => { this.close(); g.restart(); }]);
        rows.push(['level select', () => this.show('select')]);
        return rows;
      }
      default: return [];
    }
  }

  update(realDt) {
    const inp = this.input;
    this.t += realDt;
    const rows = this.#rows();
    // ArrowUp and W are jump keys as well as `up`: in a menu they only move.
    const up = inp.hit('up'), down = inp.hit('down');
    const pick = inp.hit('confirm') || (inp.hit('jump') && !up);
    const back = inp.hit('pause') || inp.hit('dash');

    if (up || down) {
      this.sel = (this.sel + (down ? 1 : -1) + rows.length) % rows.length;
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
      if (inp.hit('next') && this.game.levelIndex + 1 < LEVELS.length) this.game.nextLevel();
      else if (inp.hit('restart')) { this.close(); this.game.restart(); }
    }
  }

  draw(ctx) {
    if (!this.screen) return;
    if (this.screen === 'title') this.#title(ctx);
    else if (this.screen === 'select') this.#select(ctx);
    else if (this.screen === 'pause') this.#list(ctx, 'paused', null);
    else if (this.screen === 'results') this.#results(ctx);
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
    const help = `${keys('jump')} jump   ${keys('dash')} dash   ${keys('vault')} ledges   ${keys('burst')} burst`;
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
      const best = Number(this.#best(lv)) || 0;
      drawText(ctx, `${i + 1}`, x + 8, ry + 4, on ? HOT : DIM, 1);
      drawText(ctx, lv.name, x + 20, ry + 4, on ? '#ffffff' : INK, 1);
      const stars = '*'.repeat(lv.difficulty ?? 1);
      drawText(ctx, stars, x + 150, ry + 4, '#ff9ecd', 1);
      const bt = best ? fmtTime(best) : '--:--.--';
      drawText(ctx, bt, x + w - 12 - textWidth(bt, 1), ry + 4, best ? GOOD : '#443a6e', 1);
      const medal = medalFor(lv, best);
      if (best) drawText(ctx, medal ? medal.name : 'clear', x + w - 60 - textWidth(bt, 1), ry + 4, medal ? medal.colour : '#3f9a78', 1);
    });

    // the chosen level: its blurb and a map of it
    const lv = LEVELS[this.sel];
    const by = y + LEVELS.length * rowH + 16;
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

  #best(lv) {
    try { return localStorage.getItem(`momentum.best.${lv.id}`); } catch { return null; }
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
    ]);
  }
}
