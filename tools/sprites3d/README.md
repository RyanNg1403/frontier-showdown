# sprites3d: 3D-to-pixel fighter sprites

This pipeline renders fighter locomotion from a rigged 3D body and turns the renders into pixel-art atlas cells,
the way Dead Cells did. Poses come from code, so feet plant exactly and every frame keeps the same silhouette and
scale. Each fighter's face comes from a 2D likeness head that is composited over the 3D head.

```
fighters/<id>.json ──► blender/build.py (headless Blender + MPFB) ──► beauty + part-id renders, meta.json
                                                                        │
heads/<id>.png ───────────────────────► post/process.py ◄──────────────┘
                                         │  mode downscale · likeness head · inner lines · 1px outline · palette
                                         ▼
                        atlas.png + atlas.json (strideSpeed measured from foot travel) + preview GIFs
```

## Setup and use

```bash
tools/sprites3d/setup.sh                                  # Blender 4.5 LTS, MPFB 2.0.18, numpy/pillow/scipy
tools/sprites3d/build_fighter.sh sam assets/fighters/sam/3d
python3 tools/sprites3d/post/compare.py --old assets/frontier-sam-run-atlas.png \
    --atlas assets/fighters/sam/3d --out assets/fighters/sam/3d/preview/compare.png
```

`build_fighter.sh <id> [out_dir] [anims]` writes to `tools/sprites3d/build/<id>/out` by default (gitignored). Building
all five animations takes about 25 s on CPU, and the output is deterministic.

## Stages

**Body (`blender/human.py`).** The body is the MakeHuman base mesh through MPFB: macros (gender, age, muscle, weight,
proportions, height, race) plus named MakeHuman targets from the config, such as `measure-shoulder-dist-decr` or
`stomach-pregnant-incr`. A name starting with `lr-` applies the target to both sides. The rig is MPFB's
`game_engine` skeleton. Height in pixels comes from `height_px`: the camera is scaled so that the clothed figure,
hair included, measures exactly that.

**Outfit (`blender/outfit.py`).** Garments are copies of the body's faces in a region, pushed out along the normals
and smoothed. They keep the skin weights, so they deform with the rig and need no cloth fitting. Each vertex's region
comes from its dominant bone and its position along the limb.

| kind | options |
| --- | --- |
| `top`, `outer` | `sleeve` (0 to 1, from shoulder to wrist), `collar` (`crew`, `turtle`, `open`, `vneck`, `shirt`), `hem`, `open_front` and `open_from` (jackets), `v_depth`, `v_width` |
| `bottom` | `length` (0 to 1, from hip to ankle), `waist`, `flare` |
| `shoes` | `sole`, `collar` (ankle height); leave shoes out for bare feet |
| `tie`, `belt` | `width`, `bottom`, `waist` |

Every garment also takes `color`, `thickness` (later layers must be thicker), `smooth`, `trim` (darkened rings at
cuffs, hems and collars) and `contrast` (for example, gloss on a leather jacket).

**Materials (`blender/toon.py`).** All materials are emission-only toon: a fixed light direction dotted with the world
normal gives three hue-shifted bands. Limbs on the far side are darker. With emission only, Cycles is exact at one
sample per pixel and needs no GPU or lamps.

**Animation (`blender/gait.py`, `blender/posing.py`).** Poses are authored in armature space and keyed per frame:

- `walk` has 12 frames: contact, down, passing and up for each foot, with heel strike, foot roll, toe-off,
  pelvis bob, yaw and roll, spine counter-rotation, arm counter-swing and a stabilised head.
- `run` has 10 frames: a 38% duty factor gives a flight phase. The heel kicks toward the butt, the knee drives,
  the torso leans 15° forward and the arms pump with bent elbows.
- `idle` is Sam's relaxed guard with loose fists at chest height and a visible breath. `stance` is a full orthodox
  guard with the far foot and fist leading and the chest open to the camera. `dash` is 6 frames: push off, glide
  with the lead knee up, land.
- Legs use an analytic two-bone IK. During stance the foot pivots on the heel, then lies flat, then pivots on the
  ball, and the pivot never moves relative to the ground. A cycle is in place: the planted foot moves backwards at
  exactly the speed the engine must move the fighter.
- `fit_pelvis` lowers the hips on any frame where a planted leg could not reach its target, so a straight leg never
  drags the foot.
- Per-fighter overrides go in `gait.walk` or `gait.run` (any `GaitParams` field).

**Rendering (`blender/build.py`).** An orthographic side camera renders at 4x supersampling, with the feet at
`y = 244` of a 256 px cell and the fighter turned 20° toward the viewer (`view_yaw`). Each frame is rendered twice: a
beauty pass and a part-id pass (head, hair, torso, near and far limbs, shoes). `meta.json` stores the projected heel,
ball, toe and head-bone positions of every frame, taken from the evaluated rig.

**Pixel stage (`post/process.py`).** Each step:

1. Mode downscale: each output pixel takes its block's most common part, then that part's most common toon colour.
   Nothing is blended, so edges stay hard.
2. Likeness head: the 3D head and hair are erased and `heads/<id>.png` is pasted at the head bone. The sprite is
   prepared once, at 1/`heads_tall` of the height, and tilt steps are cached. It is aligned to the 3D crown and face
   on the first frame and then follows the bone, so it bobs with the body without jittering. Near limbs and the
   collar stay in front of it.
3. Inner lines where a nearer limb overlaps a farther part, then a 1 px outer outline.
4. One shared palette (64 colours by default, `palette_colors`) across all animations.
5. `strideSpeed` = median travel of the planted heel or ball between consecutive frames × fps. The report also
   gives the worst deviation from that median, which is the foot slip (Sam: under 0.4 px).

**Atlas.** `atlas.json` follows `internal/fighter-contract.md`: 256 px cells, anchor `{128, 244}`, and `fps`, `loop`
and `strideSpeed` on `walk_fwd`, `walk_back` (the walk reversed at 80% speed) and `run`. It also has `idle`,
`stance` and `dash_fwd`.

## Likeness heads

The 3D head is a generic MakeHuman face, so each fighter needs a 2D head:

1. Generate a head-and-neck image: three-quarter view facing right, level gaze, on a flat background. Use the
   CC-licensed reference photos linked in the fighter's section 3 entry of `docs/roster-and-moves.md` as image
   references, and follow that entry's hair, glasses, facial-hair and "common mistakes" notes.
2. Run `python3 tools/sprites3d/post/prep_head.py generated.jpg tools/sprites3d/heads/<id>.png`.
3. In the config's `head` block, fill in the source image's `crown`, `chin` and `neck_cut` rows (pixel rows of the
   source image) and `source_height`.

Without a head image, `process.py` keeps the 3D head and prints a notice. Only Sam has a head so far. The other 15
configs carry a `todo` in their `head` block.

Sam's head, `heads/sam.png`, was generated with these reference photos from Wikimedia Commons:

- [Meeting with Masayoshi Son and Sam Altman (February 3, 2025)](https://commons.wikimedia.org/wiki/File:Meeting_with_Masayoshi_Son_and_Sam_Altman_(February_3,_2025)_(3x4_cropped_on_Altman).jpg),
  Office of the Prime Minister of Japan, CC BY 4.0.
- [Ilya Sutskever and Sam Altman in TAU](https://commons.wikimedia.org/wiki/File:Ilya_Sutskever_and_Sam_Altman_in_TAU.jpg),
  Eladkarmel, CC BY-SA 4.0.

The approved style frame `media/fighters/progress-12-style-test-v3-roster-likeness.png` was also a reference. The
photos themselves are not stored in the repo.

## Licences

MPFB is GPL-3.0 and is installed by `setup.sh`, not vendored. The MakeHuman base mesh, targets and rigs it ships are
CC0. Everything rendered here comes from those CC0 assets and the code in this folder.

## Known limits

- Clothing is skin-tight geometry pushed outwards: no cloth simulation, no open jacket flaps, no hoods. Long hair
  (Fei-Fei) and caps (Noam) have to come from the 2D head, which is drawn behind the torso below the neck.
- The 2D head is a single three-quarter view. It can tilt in steps but cannot turn, which is fine for side-on
  locomotion and stances but will need extra views for turnarounds.
- Only the locomotion set, idle, stance and dash are authored. Attacks and reactions still need poses in `gait.py`.
