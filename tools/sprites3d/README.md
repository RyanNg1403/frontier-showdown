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

The heads come from PR #12: `tools/sprites3d/heads/<id>_{tq,profile,hurt,shout}.png`, with `heads/heads.json`
recording each file's crown, chin and neck-cut rows (in `source_height` units). `heads/make_heads.py` regenerates
them from the source sheets.

Each fighter config's `head` block points at `heads/<id>_tq.png` and lists every view with its rows, copied from
`heads.json`. Without a `views` block, the renderer discovers `heads/<id>.png`, `<id>-<view>.png` and
`<id>_<view>.png` itself and measures the rows from the alpha (`post/headmeta.py`). Sidecar `<id>_<view>.json`
files override them. Without any head image, the generic 3D head stays.

**View per animation** (`process.HEAD_RULES`; an animation's explicit non-default `head`, or the config's
`head.by_anim`, wins):

| View | Animations |
| --- | --- |
| profile | `walk_back`, `dash_fwd`, `dash_back` |
| hurt | `hit_high`, `hit_low`, `knockdown`, `ko`, `dazed`, `thrown` |
| shout | `special*`, `super*`, `victory*`, `intro*`, `finisher*` |
| three-quarter | everything else; also the fallback when a view is missing |

**Placement.** Each view is scaled to 1/`heads_tall` of the fighter's height. It is aligned to the 3D crown and
face on the idle pose, then rotated about that pivot with the head bone, so it stays attached when the fighter
tilts, falls, lies down or flips. The 3D skin takes its tone from lit skin pixels on the three-quarter head's lower
face and neck. In a narrow band above the neck cut, the 3D neck and collar draw over the 2D head, so the joint shows
no seam. Fei-Fei's neck cut deliberately sits at the bottom of her hair, so the hair falls over her shoulders.

## Props

Props are simple meshes parented to bones, such as a flamethrower, hydrofoil, hex shield, EWI or scarf
(`blender/props.py`). Create one per build with `props.add(name, mesh, color, bone, offset, rot, part="prop_front",
space="bone")`, or call `props.register(name, obj)` for an object you placed yourself. A prop starts hidden. A pose
shows it through `pose.props`, which a `shared.pose_from` key can also carry as `props`:

```python
{"hex_shield": True}                                           # visible at its attachment
{"ewi": {"offset": (0, 0.02, 0), "rot": (0, 0, 15)}}           # visible and moved for this frame
{"scarf": {"visible": True, "scale": (1, 1.4, 1), "space": "armature"}}
```

`posing.apply_pose` keys every registered prop on every frame: its visibility, and its transform (reset to the
attachment when the pose gives none). A prop therefore never leaks into frames or animations that don't list it,
the shared states included. The `prop_front` part draws in front of everything, including the 2D head;
`prop_back` draws behind the body.

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
- Heads cover four views (three-quarter, profile, hurt, shout). A new expression needs a new file and a rule.
