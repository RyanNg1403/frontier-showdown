# Fighter art direction

Frontier Showdown fighters are **semi-realistic, high-detail pixel sprites in the spirit of Mortal
Kombat's digitized actors**: they should read as real people photographed in costume and reduced to
pixels, not as cartoons. The likeness and costume spec for every fighter is section 3 of the roster
doc (`docs/roster-and-moves.md` in the project store). That doc is the source of truth, including
its "common mistakes" list.

The old chibi sprites (`assets/frontier-*-pixel.png`, `frontier-*-run-atlas.png`) set the costumes,
the lab colours and the outline weight. Everything else changes.

## Proportions and scale

- Realistic adult anatomy, about **7.5 heads tall**. No oversized heads, big eyes or chunky hands.
- Standing height **about 198-200 px** in the 256x256 cell (the roster gives per-fighter heights).
  One scale per fighter for every animation: frames never resize to fit the cell.
- Feet anchor at bottom-centre, `(128, 244)`. Fighters face right.
- Fighting stance stands about 4 % lower than neutral (bent knees).

## Rendering

- **Photographic shading:** smooth skin ramps, real cloth folds and creases, soft studio key light
  from the **top left** with a cool, faint rim on the right edge. Deep, realistic shadows. No flat
  cel bands, no hard comic ink lines.
- **Outline:** a 1 px darkened edge, taken from each pixel's own colour, so the silhouette stays
  crisp against busy stages. No uniform black outline.
- **Palette:** one locked palette per fighter (about 48 colours), extracted from the model sheet
  plus shaded variants and the lab accent ramp. Every frame is snapped to it, so colours never
  drift between animations.
- **Far-side limbs** are about 35 % darker and slightly cooler than near-side limbs. This gives
  depth in a three-quarter view.
- **No anti-aliasing to the background.** Alpha is binary, and edges are clean on any stage.

## Likeness

- Build each fighter from reference photos (linked in the roster doc). The face, hairline, hair
  length, glasses and build must match the photo, and the roster's common mistakes must not appear
  (for example: Sam's hair is short and textured, falling forward, never a swept-back pompadour.
  Dario's curls are medium length, never an afro, and his glasses are thick rounded-rectangle
  acetate frames, never wire).
- Respectful parody: confident, flattering poses. Hit, KO and finisher frames show dazed or
  embarrassed, never injured. No blood or gore.

## Lab colours and effects

- Lab accent colours come from the roster doc (OpenAI mint teal `#79e4cf`, Anthropic terracotta
  `#f29a68`, cream and soft gold). They are included in each fighter's palette.
- Sprites carry only **contact glow** (hands, a fist, the edge of a shield). Projectiles, walls,
  rings, trails and particles belong to the VFX module (`src/vfx/`), which spawns them from the
  atlas `events` (`hit`, `projectile`, `footstep`, ...).
- No brand logos on clothing unless the roster asks for one. Use abstract lab emblems in VFX.

## Motion

- **Locomotion (walk, run):** every frame is one coherent drawing (no paper-doll cut-outs), posed
  from the kinematic rig in `tools/sprites/rig.py`. Each cycle has 8-12 frames with contact, down,
  passing and up poses, counter-swinging arms, a visible centre-of-mass bob (walk about 5 px,
  run about 8 px), and a forward lean in the run (about 12-14°). The atlas records the measured
  `strideSpeed` (px/s), so feet never slide.
- **Attacks** read in three beats: anticipation, a held, fully extended active frame (the `hit`
  event), and recovery back to the stance. Attacks start and end on the fighter's stance so they
  chain cleanly from idle.
- **Idle** is the stance with a subtle breathing loop (an upper-body shift of 1-2 px). No
  per-frame redraws, so nothing boils.
- No jitter: frames are registered on the planted foot, or on the torso when airborne, and snapped
  to whole pixels.

## Pipeline

`tools/sprites/README.md` explains how sources are generated, normalised and packed. Raw
generations live in `assets/fighters/<id>/source/`. Reference photos are linked from the roster
doc and are not committed.
