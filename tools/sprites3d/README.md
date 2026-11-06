# sprites3d: 3D-to-pixel fighter sprites

This pipeline produces every fighter's atlas, the way Dead Cells made its sprites. A parametric, rigged 3D body is
posed in code and rendered with toon shading, then reduced to pixel art. A 2D likeness head is composited at the
head bone. Poses come from code, so feet plant exactly, and every frame keeps the same silhouette and scale.

```
fighters/<id>.json ─► blender/build.py ─► shared states (blender/shared.py) + move modules (blender/moves/**)
                       (headless Blender + MPFB)            │ beauty + part-id renders, meta.json, build.json
heads/<id>[-<view>].png ─► post/process.py ◄────────────────┘
                            mode downscale · head view per animation · inner lines · outline · palette
                            ▼
              assets/fighters/<id>/atlas.png + atlas.json  (+ contact sheet and GIFs in build/<id>/preview)
```

## Setup and use

```bash
tools/sprites3d/setup.sh                                # Blender 4.5 LTS, MPFB 2.0.18, numpy/pillow/scipy
tools/sprites3d/build_fighter.sh sam assets/fighters/sam  # one fighter: render, post-process, atlas
JOBS=4 tools/sprites3d/build_all.sh                      # all 16 fighters (about 6 min on 8 CPU cores)
python3 tools/sprites3d/post/compare.py --old assets/frontier-sam-run-atlas.png \
    --atlas assets/fighters/sam --out compare.png        # old vs new side by side
```

`build_fighter.sh <id> [out_dir] [anims]` renders every shared state plus every move module that covers the
fighter. The output is deterministic. Scratch renders, previews and contact sheets go to `tools/sprites3d/build/<id>/`,
which is gitignored.

## Atlas

`assets/fighters/<id>/atlas.json` follows `internal/fighter-contract.md`: 256 px cells, anchor `{128, 244}`, and
frames packed into a 12-column grid with one rect per frame.

| Entry | Contents |
| --- | --- |
| `fps`, `loop` | On every animation; one-shot states have `"loop": false` |
| `strideSpeed` | On `walk_fwd`, `walk_back` and `run`: the planted heel or ball's median travel between frames × fps, measured from the evaluated rig. Foot slip is under 0.4 px. |
| `events` | `{"frame", "type": "footstep", "foot"}` on every landing frame of `walk_fwd`, `walk_back` and `run`, plus any events a move module declares (`hit` and so on) |

The shared states, the same for every fighter, are: `idle` (breathing orthodox guard), `walk_fwd`, `walk_back` (the
walk reversed at 80% speed), `run`, `dash_fwd`, `dash_back`, `jump_start`, `jump_air`, `jump_land`, `crouch`,
`block`, `crouch_block`, `hit_high`, `hit_low`, `knockdown`, `getup`, `ko`, `dazed`, `thrown`, `tag_in` and `tag_out`.
Move modules add the rest of the contract's states for each fighter.

## Authoring animation

**Shared states (`blender/shared.py`).** Each state is a list of keyframes. A key is a dict merged over `GUARD`, the
orthodox guard; `pose_from` turns a key into a pose and `keyed` turns a list of keys into poses. Lead means the
rig's left (the far side), rear means the rig's right (the camera side). Lengths are in leg lengths and angles in
degrees.

| Parameters | Meaning |
| --- | --- |
| `lead_f`, `rear_f`, `lead_x`, `rear_x` | Foot placement forward and sideways |
| `*_lift`, `*_pitch`, `*_toe` | Foot lift, pitch, toe-out |
| `crouch` or `pelvis_h` | Pelvis drop, or absolute pelvis height |
| `fwd` | Pelvis forward offset |
| `yaw`, `lean`, `chest_yaw`, `chest_lean` | Hip and chest twist and lean |
| `neck`, `head`, `head_roll` | Neck and head pitch, head roll |
| `lead_arm`, `rear_arm` | `(swing, elbow, splay)` relative to the chest |
| `fist`, `fist_lead`, `fist_rear`, `twist` | Fist amount and wrist twist (40 gives a guard fist with knuckles forward) |
| `body` | Whole-body pitch: −90 is lying on the back, 180 is inverted |
| `roll` | Whole-body roll |
| `lead_fk`, `rear_fk` | `(hip, knee, foot)` FK legs in the pelvis frame, for sitting, kneeling and lying |

Legs default to an analytic two-bone IK on the foot targets. A foot planted with a positive pitch pivots on its
ball.

**Locomotion (`blender/gait.py`).** The walk and run are cycles generated from `GaitParams`: duty factor, step,
keyed swing path, heel strike, foot roll, toe-off, pelvis bob, yaw and roll, spine counter-rotation and arm swing.
The run leans 19° forward. During stance the foot pivots on the heel, then lies flat, then pivots on the ball, and
the pivot never moves relative to the ground. `fit_pelvis` lowers the hips wherever a planted leg could not reach
its target. Per-fighter overrides go in `gait.walk` and `gait.run` in the config.

**Move modules (`blender/moves/**/*.py`).** Discovery is recursive; files and folders starting with `_` are skipped.
A module defines one of:

```python
from shared import Anim, GUARD, keyed

def animations(fighter_id, sk, cfg, ctx=None):          # ctx: rest, posing, ppm, skeleton
    if fighter_id != "sam":
        return {}
    return {"light_punch": Anim(keyed(sk, [GUARD, dict(lead_arm=(90, 10, 4)), GUARD]), fps=20, loop=False,
                                events=[{"frame": 1, "type": "hit"}])}

ANIMATIONS = {"sam": {"light_punch": lambda sk, cfg: Anim(...)}}   # the table form also works
```

`Anim` fields:

- `poses`, `fps`, `loop`
- `events`
- `head`: the head view, `threequarter`, `profile`, `hurt` or a custom name
- `locomotion`: True adds `strideSpeed` and footstep events
- `derived`: extra atlas entries, such as a reversed copy

A move with the same name as a shared state overrides it, and the log says so. A module that raises is skipped
with a warning, and the shared build still completes.

## Likeness heads

The post stage composites `tools/sprites3d/heads/<id>.png` (the three-quarter view) and `<id>-<view>.png`, for
example `-profile`, `-hurt` or `-victory`. Each animation picks a view: run uses `profile`; `hit_high`, `hit_low`,
`knockdown`, `ko`, `dazed` and `thrown` use `hurt`. A missing view falls back to the three-quarter head, and without
any head image the generic 3D head stays.

- **Image format:** head and neck, facing right, on a transparent background.
- **Measurements:** `post/headmeta.py` finds the crown (top of the alpha), the chin (where the face edge recedes
  fastest into the neck) and the neck cut. Override any of them with a sidecar `<id>-<view>.json` such as
  `{"crown": 51, "chin": 360, "neck_cut": 390, "flip": false}` in image rows, or under `head.views.<view>` in the
  fighter config.
- **Size and placement:** the head is scaled to 1/`heads_tall` of the fighter's height (default 7.2). It is aligned
  to the 3D crown and face on the idle pose, then rotated about that pivot with the head bone, so it stays attached
  when the fighter tilts, falls, lies down or flips.
- **Neck seam:** the 3D skin takes the head's neck tone (`skin_from_head`, on by default). In a narrow band above
  the neck cut, the 3D neck and collar draw over the 2D head.
- **Generated heads:** `post/prep_head.py` keys a generated head off a flat background.

Sam's current head, `heads/sam.png`, was generated from these reference photos from Wikimedia Commons:

- [Meeting with Masayoshi Son and Sam Altman (February 3, 2025)](https://commons.wikimedia.org/wiki/File:Meeting_with_Masayoshi_Son_and_Sam_Altman_(February_3,_2025)_(3x4_cropped_on_Altman).jpg),
  Office of the Prime Minister of Japan, CC BY 4.0.
- [Ilya Sutskever and Sam Altman in TAU](https://commons.wikimedia.org/wiki/File:Ilya_Sutskever_and_Sam_Altman_in_TAU.jpg),
  Eladkarmel, CC BY-SA 4.0.

## Bodies, outfits, rendering

**Body (`blender/human.py`).** The body is the MakeHuman base mesh through MPFB. It takes macros plus named targets
from the config; `lr-` applies a target to both sides. Every fighter gets `lr-foot-scale-decr` 0.35 unless the
config overrides it. The rig is MPFB's `game_engine` skeleton, and `height_px` sets the clothed height in pixels.

**Outfit (`blender/outfit.py`).** Garments are body regions pushed out along the normals, so they keep the skin
weights.

| Kind | Options |
| --- | --- |
| `top`, `outer` | `sleeve`, `collar` (`crew`, `turtle`, `open`, `vneck`, `shirt`), `hem`, `open_front`, `v_depth`, `v_width` |
| `bottom` | `length`, `waist`, `flare` |
| `shoes` | Smoothed shell with a flat `sole` and a darker sole band; leave shoes out for bare feet |
| `tie`, `belt` | Strips |

Every garment also takes `color`, `thickness` (later layers must be thicker), `smooth`, `trim` and `contrast`.

**Hands (`blender/posing.py`).** A fist curls 85/100/70° per finger joint, with the thumb wrapped (`FIST`). Guard
and run poses add a 35–40° wrist twist so the knuckles read.

**Materials and rendering.** All materials are emission-only toon in three hue-shifted bands, with darker far-side
limbs, trims and sole bands. Each frame is rendered in Cycles at one sample per pixel and 4x supersampling, through
an orthographic camera with the fighter turned 20° toward the viewer. A part-id pass is rendered alongside the
beauty pass.

**Pixel stage (`post/process.py`).** Each step:

1. Mode downscale, with no blending.
2. Head composite.
3. Inner lines where a nearer limb overlaps a farther part.
4. A 1 px outline.
5. One 64-colour palette per fighter.

## Licences

MPFB is GPL-3.0 and is installed by `setup.sh`, not vendored. The MakeHuman base mesh, targets and rigs it ships are
CC0.

## Known limits

- Clothing is pushed-out body geometry: no cloth simulation, jacket flaps or hoods.
- Long hair and caps must come from the 2D head, which is drawn behind the torso near the neck.
- The 2D head turns only between the views supplied. Within a view it rotates in the image plane.
- Only Sam has a likeness head so far. The other fighters show the generic 3D head until their heads land in
  `heads/`; then rebuild them with `build_all.sh`.
