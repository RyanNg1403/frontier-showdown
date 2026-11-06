# Group 2 move animations: Jensen, Ilya, Arthur, Andrej, Yann

`moves/<id>.py` holds one fighter: its props and every move, and it returns `{}` for every other fighter.
`build.py` discovers these modules and merges them over the shared states.

```bash
JOBS=5 tools/sprites3d/build_all.sh jensen ilya arthur andrej yann    # assets/fighters/<id>/atlas.{png,json}
python3 tools/sprites3d/blender/moves/_group2/sheet.py <id> <out.png>  # moves-only contact sheet
```

| File | Contents |
| --- | --- |
| `kit.py` | Key-pose dicts over `shared.GUARD`, eased timelines, `strike` and `sequence` builders, crouch and air kick templates, frame-data timing, and the conversion to `shared.pose_from` |
| `props.py` | Multi-colour prop meshes and the scarf ribbon, registered with the renderer's props hook. `pose_props` turns per-frame channels (offset, rot, scale, `upright`) into `pose.props` |
| `sheet.py` | Contact sheet of the move-file animations, cut from the merged atlas |

**Timing.** Timing comes from `src/characters/<id>.js` on main. Each attack has `{"frame": k, "type": "hit"}` on
its first active frame. The k frames before it play over the startup, and fps is set so the clip lasts as long
as the move.

**Head views.** `special_1` to `special_3`, `super`, `intro` and `victory` use the shout head.

**Props.**

| Fighter | Props |
| --- | --- |
| Jensen | superchip, diner tray, oven mitt and GPU board, DGX box, AI Factory rack, tower of coffee cups, marker, collectible figure box |
| Ilya | lavender orb, floating piano keys |
| Arthur | tricolour scarf (four flutter phases, shown on every frame of his moves), collar ring, running watch, horseshoe magnet and link, the "1T" belly balloon for Le Chonk |
| Andrej | marker and Rubik's cube (on every frame of his moves), whiteboard, tiny monitor |
| Yann | EWI (on every frame of his moves), RC plane, three-layer cake, coffee cup |

The props hook only shows a prop in frames that list it, so the always-on props do not appear in the shared
states.

**Extra animations.** The character data on main already plays these:

| Animation | Move |
| --- | --- |
| `dennys_booth` | Jensen `f_hp` |
| `breakaway_kick` | Arthur `f_hk` |
| `optimal_brain_damage` | Yann `b_hp` |
| `foresight_palm` | Ilya's `parry.counter` |

`crouch_light_kick`, `crouch_heavy_kick` and `air_kick` are rendered for all five, but the engine's
`KNOWN_ANIMS` check (`REQUIRED_ANIMS` plus `ANIM_FALLBACKS` in `src/combat/constants.js`) rejects unknown names
on the standard normals. They take effect once the engine registers them, for example as fallbacks to
`crouch_light`, `crouch_heavy` and `air_attack`, and `c_lk`, `c_hk` and `j_k` name them with `anim:`.
