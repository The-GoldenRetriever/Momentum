# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

MOMENTUM is a pixel-art speed platformer written in plain browser JavaScript (ES modules, Canvas 2D, WebAudio). There's no build step, no package.json and no dependencies.

## Running

ES modules don't load over `file://`, so serve the repo root:

```sh
python3 -m http.server 8000      # then open http://localhost:8000/
```

The game opens on a title screen, then a level select. `?level=<n>` (1-based) skips the menus and starts that level, and `?at=<tileX>&ay=<tileY>` drops the player straight into a section of it (both handled in `Game`'s constructor; `main.js` turns the menus off when either is present).

## Tests and headless tools

This machine has no node, so use the system JavaScriptCore shell. The harness scripts are DOM-free and use jsc's `print` and `arguments`, not `console.log` or `process.argv`.

```sh
JSC=/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc
$JSC --module-file=tools/sim.js       # scripted physics checks; ends with "ALL PASS" or "N FAILURE(S)"
$JSC --module-file=tools/fuzz.js      # 90 seeded random-input runs per level; each must report "no embedded frames"
$JSC -m tools/dump-level.js -- 0 60 2 # ASCII dump of tile columns 0..60 of level 2 (args go after --; level defaults to 1)
$JSC -m tools/dbg.js -- 656           # trace a run to the right from pixel x=656
```

- `tools/sim.js` has no test filter. Each check is a numbered `{ ... }` block that calls `check(name, ok, detail)`. To run one alone, comment out the others or copy the block into a scratch module (importing `sim.js` runs every check). `makeSim({x, y}, customLevel?)` (exported) builds a level + player at a tile position, and `run(steps, heldKeys | (i) => keys, onStep)` advances it at the fixed 1/120 step, ticking `updateMechanics` too.
- Pixel checks use headless Chrome against the local server:
  ```sh
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
    --window-size=960,540 --virtual-time-budget=3000 --screenshot=out.png \
    "http://localhost:8000/tools/shot.html?at=150&ay=26&keys=right&steps=240"
  ```
  `tools/shot.html` is a deterministic frame grabber. Its params include `level`, `keys`, `steps`, `vx`, `flow`, `flip`, `duck`, `auto=vault|burst`, `screen=title|select|pause|results` (with `sel=<row>`), `next=<steps>` (finish, pick "next level", play that many steps of the cutscene) and `menu=open|capture` (the binding screen). The page title becomes `ready` when the frame is drawn (or `error: ...`). A tiny blank PNG with the title still `frame grab` means the modules hadn't loaded within the virtual-time budget. That's flaky, not a hang, so just retry. `tools/sheet.html?s=<zoom>&only=<anim,...>` renders the sprite sheet.

## Architecture

**Loop (`src/main.js`).** Physics runs on a fixed 1/120 s step with an accumulator, and rendering happens once per animation frame. A burst eases a global time scale down to `P.BURST_SCALE`, and the simulated step shrinks with it. So `Game.update(dt, input, realDt)` and `Player.update(dt, input, realDt)` take two clocks: `dt` is world time and `realDt` is wall-clock time. Almost everything uses `dt`. The burst wind-up and the binding menu use `realDt`.

**Input contract.** Gameplay never reads keys directly. It reads named actions through `held(a)`, `hit(a)` (press edge), `let_go(a)` (release edge), `moveX` and `moveY`. `src/input.js` maps keyboard and gamepad onto actions and stores rebinds in `localStorage` (`momentum.binds`). `keys` and `confirm` are fixed (not rebindable) so no binding can lock you out of the menus. An edge is consumed by exactly one physics step, and it waits for that step: `main.js` must not clear edges in a frame that ran no step (at 120Hz physics that is many frames on a fast display, and every frame of a burst's slow motion). Menus treat `up` as navigation even though ArrowUp/W are also `jump`. `tools/sim.js`, `tools/shot.html` and the `dbg` scripts each define a small `Keys` stub with the same interface. If you add an action or change the interface, update the stubs too.

**Module roles.**
- `game.js` (`Game`) owns the level, player, camera, renderer, particles, the menus and the binding screen. `load(n)` builds level `n` from `levels/index.js`, with a fresh player, camera and renderer; `start(n)` is the menu's way in. It handles checkpoints, signs, the goal and results, the run timer, respawn and restart, auto-pause on blur, and a best time per level (`localStorage` key `momentum.best.<level id>`; `momentum.last` remembers the last level started).
- `cutscene.js` draws what plays when you pick "next level": a letterboxed walk-off (`Game.nextLevel` feeds the player a held-right input capped at walking speed), a fade, then a black loading screen with the character's run cycle as a white silhouette in the bottom-left; the next level is built behind it. Each level keeps a 14-tile run-out past its goal to walk on.
- `menus.js` (`Menus`) draws and drives the title, level select (with one-pixel-per-tile map thumbnails), pause menu and results panel. The title and level select show the loaded level as scenery (`renderer.hideActors`, a panning camera); pause and level-select-from-pause freeze the run; under the results panel the player coasts on an idle input.
- `player.js` holds all movement feel. Momentum is the core: the flow bar's overfill past one bar is a top gear (`RUN_OVER`), jumps lift more the faster you run (`JUMP_SPEED_LIFT`), friction and flow drain punish slowing down, and a jump that comes down more than `LAND_FREE` from its peak costs speed and flow unless you roll (C held or pressed on landing; a late press refunds it). A dash only comes back on the ground or from a crystal or spring, never from a wall, and hands off at `DASH_END` or the speed you went in with, whichever is higher. Boost pads also charge the bar to at least one. It covers run, flow meter, jump, wall jump, dash, slide, vault and roll on ledge cues, burst, and skid. Tuning constants live in the exported `P` table. The header comment states the design rules (speed is earned slowly and lost reluctantly, and nothing that costs speed happens unless the player asks). Collision is integrated per axis in `#moveX` and `#moveY`, with step-ups, slope lift, one-way platforms and corner correction.
- `level.js` (`Level`) is pure data and math: the tile grid (`T` enum, with `SPAN` for partial-height solids such as `LOWCEIL`), authoring helpers (`rect`, `platform`, `spikes`, `stairs`, `ramp`, `crystal`, `spring`, `checkpoint`, `sign`, `crumble`, `phase`, `boost`) and every collision query (`boxHitsWall`, `floorUnder`, `ceilingAbove`, `slopeUnder`, `boxHitsSpikes`, ...).
- `mechanics.js` runs the level furniture that acts on the player: crumbling blocks (`T.CRUMBLE`), the two alternating sets of phase blocks (`T.PHASE`), boost pads, springs and crystals. Because it is headless-safe, `makeSim`, the fuzzer and the game all run the same rules. A block that is "away" is just set to `T.EMPTY`, so collision queries need no special cases. Blocks never reappear inside the player. A boost pad built with `{ sync }` restarts the phase clock when stepped on, which makes a phase crossing beyond it deterministic (the spire's phase pit relies on this). `resetMechanics` restores crumbles on respawn. Tuning lives in its `M` table.
- `levels/index.js` lists the levels in order (`id` keys the saved best time, so don't change it). `levels/test-area.js` is level 1, a 330×42-tile playground split into lettered sections. Each section isolates one mechanic and can be entered at full speed from the one before it. `levels/spire.js` (level 2), `levels/undercroft.js` (3, a cave) and `levels/skyline.js` (4, floating islands over a void) are courses built to be run flat out, getting harder in that order; `sim.js` check 32 proves each one with a scripted bot from the start and every flag. Where a level demands more than running and jumping (hops under fangs, dashes across gaps), the route lists it as a zone, and the check also proves each zone is needed. If you move geometry in these levels, update those zones. Undercroft and Skyline are built from "stations" (a flag with a boost pad right after it) followed by platforms too small to stop on, placed where a full-speed jump from the pad lands; tune them by probing where the bot's jumps come down. Each level's `par` in `levels/index.js` is the bot's flat-out time from the start, and the medals (`medalTimes`) are fractions of it; re-measure par if a level changes. A level sets `L.theme` (`night`, `cave`, `dusk`) to pick its look. Sim checks address sections by tile coordinates, so moving geometry can break `tools/sim.js`.
- `render.js` (`Renderer`) bakes the whole tile map and the sky into offscreen canvases **once, in its constructor**. Changing tiles at runtime won't show up unless the bake is redone. The bake only sees permanent rock (its `rock()` helper). Colours for sky, ridges, rock and growth come from the level's entry in `THEMES`, read only while baking. Crumble and phase blocks and boost pads are drawn live in `#furniture`. The view is fixed at 480×270 (`VIEW_W`/`VIEW_H`). Burst zoom is a nearest-neighbour blow-up of a finished frame, not a transform, so edges stay crisp.
- `art.js` stores sprites as string grids (one character per pixel, indexed into `PAL`, 16×18 frames, foot-anchored). `buildArt()` turns them into canvases at startup, and `FRAMES`/`FRAME_COUNT` define the animations. `font.js` is a 3×5 bitmap font. `hud.js`, `binds.js`, `camera.js`, `particles.js` and `audio.js` (a pure oscillator synth) are self-contained.

**Headless-safe modules.** `level.js`, `player.js`, `particles.js`, `mechanics.js` and `levels/*` are loaded by jsc with no DOM present. Keep DOM, `window` and `localStorage` access out of them and out of anything they import at module load time (`art.js` and `audio.js` are imported by `player.js`; their DOM work happens only in `buildArt()` and lazily in `Sfx`).

## Conventions

Comments explain *why* in full sentences (feel decisions, edge cases, past bugs) rather than restating the code. Match that density when editing. Before claiming a physics change works, run both `sim.js` and `fuzz.js`. For a visual change, take a screenshot and look at it.
