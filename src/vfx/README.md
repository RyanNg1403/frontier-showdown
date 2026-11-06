# Combat VFX (`src/vfx`)

Pixel-art combat effects for the fighting-game rebuild: hit sparks, dust, afterimages, supers, KO, tag and lab-themed specials. Plain ES modules, Canvas 2D, no dependencies.

## Usage

```js
import { createVfx, loadVfxAssets, bindVfxToGame, createFrameEventRouter } from "./src/vfx/index.js";

const vfx = createVfx(ctx, await loadVfxAssets("/assets/vfx/"));
const unbind = bindVfxToGame(vfx, game);          // optional: react to game.events

// each sim step
if (!vfx.isFrozen() && !vfx.isHitstopped()) stepFighters(STEP * vfx.timeScale());
vfx.update(STEP);                                 // real seconds

// each render
const cam = vfx.applyShake(camera);               // or add vfx.getShakeOffset() yourself
drawStage(ctx, cam, "back");
vfx.draw(ctx, cam, "back");                       // super-freeze darkening, afterimages, auras
drawFighters(ctx, cam);
vfx.draw(ctx, cam, "front");                      // sparks, dust, banners, flashes
drawStage(ctx, cam, "front");
```

- `spawn(type, x, y, opts)` returns a handle (`kill()`, live `x`/`y`, and `impact()` on projectiles). Common opts: `dir` (+1/-1 travel or facing), `scale`, `lab`, `colors`, `delay`, `life`, `layer`, `shake: false`, `hitstop: frames`.
- Camera: `{ x, y, zoom }` with `x/y` the world point at the view's top-left, or `{ centerX, centerY, zoom }`. World units are logical 1280x720 pixels; `y` grows downward and fighters' `y` is the feet line.
- If only `draw(ctx, cam)` is called, the super-freeze darkening falls back to the front pass (it will also cover fighters).
- Effects render into a half-resolution buffer (`pixelScale: 2`) so they share one pixel grid; afterimages draw the fighter frame at full resolution.

## Timing helpers

VFX never pauses the simulation itself; the engine reads these:

| Helper | Meaning |
| --- | --- |
| `hitstop(frames)`, `isHitstopped()`, `hitstopRemaining()` | Freeze fighters for N 60 Hz frames (sparks keep animating). |
| `shake(amp, frames)`, `getShakeOffset()`, `applyShake(cam)` | Decaying screen shake. Hits add shake by default. |
| `slowmo(scale, seconds)`, `timeScale()` | KO slow motion. Eases back to 1 over the last 30%. |
| `isFrozen()` | True during `super_freeze`. Hold fighters; super effects keep running. |
| `flash(color, frames, alpha)` | Full-screen flash. |

## Effects

- **hits:** `hit_light`, `hit_heavy`, `hit_counter`, `block`, `throw_tech`, `guard_break`, `combo_breaker`
- **dust** (x/y = ground contact, `dir` = movement direction, `tint: {light, mid, dark}`): `dust_step`, `dust_run_start`, `dust_skid`, `dust_dash`, `dust_jump`, `dust_land`, `dust_knockdown`
- **motion:** `afterimage` (`sprite: {image, sx, sy, sw, sh, anchorX, anchorY, scale, flip, x, y}`), `afterimage_trail` (`sprite: () => spriteRef`), `motion_trail` (`follow: t => {x, y} | null`), `slash_arc`, `speed_lines`
- **cinematic:** `super_freeze` (`lab`, `side`, `portrait: {image, sx, sy, sw, sh}` or `drawPortrait(ctx, rect)` for the portrait slot), `ko`, `tag_in`, `tag_out`
- **labs:** for `openai, anthropic, deepmind, xai, meta, nvidia, mistral, deepseek`: `projectile_<lab>`, `special_<lab>` (hand-sized cast flash the engine spawns when a special starts) and `signature_<lab>` (full-screen showpiece composed from the templates; x/y = feet)
- **projectiles** are sized to `opts.hitbox` (`{x, y, w, h}` relative to the projectile origin, as in character data), falling back to a 56 px square times `scale`. The orb fills the box with only a few px of glow. `projectile_hit` and `projectile_fizzle` are the matching contact and expiry effects.
- **templates** (take `lab` or `colors`): `projectile`, `lab_cast` (`size`), `lab_impact`, `lab_burst`, `lab_pillar`, `lab_beam` (`length`), `lab_slash_x`, `lab_aura` (`follow`), `lab_ground_wave`, `lab_vortex`, `lab_charge`

Character data can reference these directly, for example `special.vfx = { type: "lab_beam", dy: -120, opts: { length: 640 } }`; the bridge spawns it on the `special` event.

## Footfalls and frame events

`createFrameEventRouter(vfx)` turns atlas frame events into dust. Call `router.onFrame(fighter, animName, frameIndex, animData)` whenever a fighter's frame advances and `router.onState(fighter, prev, next, animData)` on state changes (run start, skid, dash, jump, land, knockdown fallbacks). Events can be written at animation level (`"events": [{"frame": 2, "type": "footstep", "foot": "front"}]`) or per frame (`frames[i].events`). Supported dust types are `footstep`, `run_start`, `skid`, `dash`, `jump`, `land` and `knockdown`. `inferFootfallEvents(anim, name)` adds contacts at frame 0 and the half-cycle for walk and run cycles that have none. The bridge also accepts optional `animFrame` and `animState` events.

## Assets

`assets/vfx/vfx-atlas.png` and `vfx-atlas.json` (24 sprites) are built from the generated sheets in `assets/vfx/source/` by `python3 src/vfx/tools/build_vfx_atlas.py` (Pillow, numpy). Every effect still renders procedurally if the atlas is missing.

## Preview

```
node src/vfx/preview-server.mjs      # http://127.0.0.1:4180/
```

The preview plays every effect, loops through all of them, runs a footfall demo and has toggles for shake, hitstop and atlas sprites. `server.mjs` only serves `assets/` today; once it serves `src/`, the page also works at `/src/vfx/preview.html`. `src/vfx/tools/capture.mjs` renders contact sheets and GIFs headlessly (needs `puppeteer-core` and Chrome).
