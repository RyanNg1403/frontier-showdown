# Character move animations: Group 1 (Sam, Dario, Mark, Elon, Demis)

These move modules plug into the shared renderer through the move-file interface. `build.py` discovers every
`moves/**/*.py` whose name does not start with `_`. It calls `animations(fighter_id, sk, cfg, ctx)` and merges the
result over the shared states. Shared states (walk, run, jump, crouch, block, hit, knockdown, getup, ko, dash, tag,
idle) are not authored here.

```bash
JOBS=5 tools/sprites3d/build_all.sh sam dario mark elon demis   # writes assets/fighters/<id>/atlas.{png,json}
python3 tools/sprites3d/blender/moves/_sheet.py <id>            # moves contact sheet -> tools/sprites3d/build/<id>/preview
```

| file | contents |
| --- | --- |
| `sam.py`, `dario.py`, `mark.py`, `elon.py`, `demis.py` | one fighter each: props plus every move, returning `{}` for other fighters |
| `_kit.py` | pose specs, `seq` keyframing with easing and hit/VFX marks, `timing`, spec to `gait.Pose`, prop meshes |
| `_library.py` | templates: jab, straight and overhand, uppercut, front kick, roundhouse, axe kick, low kick, crouch moves, sweep, air moves, knee, cast, grab |
| `_props.py` | prop visibility per frame (see "Props" below) |
| `_sheet.py` | moves contact sheet read from the merged atlas |

## Poses

A move is authored as eased keyframes over the shared guard. `Kit.stance()` is `shared.GUARD` in spec form, so
every move starts and ends on the shared idle.

- Feet, pelvis, chest, neck and head go straight onto `gait.Pose`, so the legs use the shared analytic IK.
- Hands are authored as targets (forward, up, out) relative to the shoulder. `Kit.arm_fk` solves them into the
  shared FK arm tuples `(swing, elbow, splay)` relative to the chest.
- Fists set `fist_side`, and guard fists get the shared wrist twist.

## Events and head views

Every attack has `{"frame": k, "type": "hit"}` on its first active frame, and k is always between 1 and the frame
count minus one. VFX hooks are `{"frame": k, "type": "vfx", "name": ...}`: flame stream, map pin, singularity ring,
geniuses, Go stone, and so on. `super` asks for the `shout` head and `victory` for the `victory` head. Missing views
fall back to the three-quarter head.

## Animation names

The engine names (`src/characters/schema.js`) are `light_punch`, `heavy_punch`, `light_kick`, `heavy_kick`,
`crouch_light`, `crouch_heavy`, `air_attack`, `throw`, `special_1` to `special_3`, `super`, `finisher`, `intro`
and `victory`, plus `air_dive` for Elon's Walrus.

| extra animation | fighter | move | engine today |
| --- | --- | --- | --- |
| `crouch_light_kick`, `crouch_heavy_kick`, `air_kick` | all | `c_lk`, `c_hk`, `j_k` | `crouch_light`, `crouch_heavy`, `air_attack` |
| `ship_it` | Sam | `f_hp` Ship It | `heavy_punch` |
| `safeguard_palm` | Dario | ASL Safeguard counter | `heavy_punch` (`parry.counter.anim`) |
| `cybertruck_charge` | Elon | `f_hk` | `heavy_punch` (the data sets `anim: "heavy_punch"`) |
| `knights_move` | Demis | `f_hk` Knight's Move | `heavy_kick` |

The extras take effect once the character data names them with `anim:`.

## Timing

All five character files are on main; `src/characters/*.js` there is the source of truth for timing.
`timing(startup, active, recovery)` converts the 60 Hz frame data into frame counts.

On main, Elon's Walrus is the special `the_walrus` (D+HP, air only) with `anim: "air_attack"`, so the engine
plays the jumping punch for it. Set `anim: "air_dive"` there to use the belly-flop authored here.

## Props

| fighter | props (simple meshes) |
| --- | --- |
| Sam | phone, visitor badge on a lanyard, deploy button on a plinth |
| Dario | hexagon shield (two sizes), constitution scroll, mini datacenter rack |
| Mark | electric hydrofoil (blue deck, dark mast and foil), handed-over board, sunscreen, phone |
| Elon | Not-a-Flamethrower torch with an orange nozzle, steel ball, phone |
| Demis | white Go stone, stone bowl, gold medal |

Each prop is parented to a rig bone (`Kit.prop`). A frame's spec lists the props it shows, and `_kit` copies that
onto `pose.props`. The shared renderer has no prop hook yet, so `_props.register` wraps `posing.apply_pose` at run
time. The wrapper calls the original unchanged, then keys each registered prop's `hide_render` for that frame. It
installs only when a fighter registers props, and shared-state poses have no `props`, so they show none.

This should become an official hook in the shared renderer, for example `pose.props` honoured by `apply_pose`, or
a per-frame callback in `ctx`. When that lands, `_props.py` goes away.
