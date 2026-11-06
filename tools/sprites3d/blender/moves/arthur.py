"""Arthur Mensch, "Le Mistral" (roster doc 3.8). Speed rushdown: light, bouncing, forward-leaning.

Frame data: src/characters/arthur.js on main. Props: the blue-white-red scarf that always streams in the wind (an animation cue
only), a horseshoe magnet on a glowing link and his running watch. Le Chonk balloons his silhouette with an
inflated "1T" belly prop for the dive.
"""

from _group2 import props as _props
from _group2.kit import AIR, CROUCH, GUARD, export, fps_for, merge, sequence, strike, sweep, wave

FD = {
    "light_punch": {"startup": 5, "active": 2, "recovery": 10},      # whip-fast jab
    "heavy_punch": {"startup": 11, "active": 3, "recovery": 19},     # spinning back fist with a gust
    "light_kick": {"startup": 8, "active": 2, "recovery": 14},       # quick shin flick
    "heavy_kick": {"startup": 13, "active": 6, "recovery": 20},      # Pedal Kick (2 hits)
    "crouch_light": {"startup": 6, "active": 2, "recovery": 11},     # c_lp Low Jab
    "crouch_light_kick": {"startup": 7, "active": 2, "recovery": 14},  # c_lk Slide Poke (opt-in anim)
    "crouch_heavy": {"startup": 9, "active": 3, "recovery": 28},     # wind uppercut
    "air_attack": {"startup": 7, "active": 6, "recovery": 8},        # j_p Diving Palm
    "air_kick": {"startup": 6, "active": 7, "recovery": 8},          # j_k Cross-up Knee (opt-in anim)
    "crouch_heavy_kick": {"startup": 12, "active": 3, "recovery": 27},  # c_hk Peloton Sweep
    "throw": {"startup": 8, "active": 3, "recovery": 22},            # Breakaway
    "breakaway_kick": {"startup": 14, "active": 5, "recovery": 20},  # f_hk Breakaway Kick (opt-in anim)
    "special_1": {"startup": 15, "active": 2, "recovery": 24},      # Mistral Gust
    "special_2": {"startup": 16, "active": 6, "recovery": 28},       # Magnet Link
    "special_3": {"startup": 10, "active": 40, "recovery": 22},      # Le Chonk Drop (active until landing)
    "super": {"startup": 6, "active": 42, "recovery": 50},            # Chinchilla Optimal
}

PROPS = {
    "scarf": {"always": 1, "ribbon": {"bone": "neck_01", "anchor": (0.0, 0.03, 0.06), "length": 0.95, "width": 0.07,
                         "segments": 16, "colors": ["#1f4fa3", "#f2f2f2", "#d23a3a"], "dir": (0.0, 1.0, -0.15),
                         "wind": 0.07},
              "part": "torso"},
    "collar": {"always": 1, "parts": [("torus", {"R": 0.07, "r": 0.022, "color": "#1f4fa3"})],
               "attach": "neck_01", "offset": (0.0, 0.03, 0.0), "rot": (90, 0, 0), "part": "torso"},
    "watch": {"always": 1, "parts": [("box", {"size": (0.05, 0.04, 0.05), "color": "#141416"}),
                        ("box", {"size": (0.03, 0.03, 0.054), "color": "#9be7ff", "contrast": 0.3})],
              "attach": "lowerarm_l", "offset": (0.0, 0.24, 0.0), "part": "outer_arm_far"},
    "magnet": {"parts": [("torus", {"R": 0.07, "r": 0.02, "arc": 200, "color": "#d23a3a", "rot": (0, 0, 90)}),
                         ("box", {"size": (0.045, 0.04, 0.04), "at": (0.07, 0.0, 0.0), "color": "#d7dbe2"}),
                         ("box", {"size": (0.045, 0.04, 0.04), "at": (-0.07, 0.0, 0.0), "color": "#d7dbe2"})],
               "attach": "hand_r", "offset": (0.0, 0.12, 0.0), "vis": 0, "part": "prop_front"},
    "chonk": {"parts": [("sphere", {"r": 0.2, "color": "#1c2541"}),
                        ("box", {"size": (0.02, 0.07, 0.09), "at": (-0.19, -0.04, 0.02), "color": "#ff7000",
                                 "contrast": 0.3})],
              "attach": "spine_02", "offset": (0.0, 0.02, -0.04), "vis": 0, "part": "torso"},
    "link": {"parts": [("cyl", {"r": 0.012, "l": 0.6, "at": (0, -0.3, 0), "color": "#9be7ff", "contrast": 0.2})],
             "offset": (-0.1, -0.35, 1.25), "vis": 0, "part": "prop_front"},
}

# Runner's guard: forward lean, weight on the toes, loose fists.
STANCE = merge(GUARD, {"lean": 12, "drop": 0.13, "l": {"f": 0.27, "p": 6}, "r": {"f": -0.32, "p": 22},
                       "al": (60, 100, 8), "ar": (30, 120, 18), "fist": 0.7, "hpitch": -6})


def scarf(i, n, wind=0.07, dirz=-0.15, back=1.0):
    return {"scarf": {"phase": i / max(n, 1) * 2.0, "wind": wind, "dir": (0.0, back, dirz)}}


def with_scarf(move, wind=0.07, dirz=-0.15):
    """Streams the scarf on every frame of a move (keys may override per frame)."""
    n = len(move.frames)
    for i, d in enumerate(move.frames):
        s = scarf(i, n, wind, dirz)["scarf"]
        d["props"]["scarf"] = {**s, **{k: v for k, v in d["props"].get("scarf", {}).items() if k != "phase"}}
    return move


def _moves(sk):
    g = STANCE
    out = []
    out.append(strike("light_punch", g, FD["light_punch"],
                      windup={"al": (66, 95, 6)},
                      hit={"al": (92, 2, 2), "cyaw": -16, "lean": 14, "fwd": 0.04}, note="whip-fast jab"))
    out.append(strike("heavy_punch", g, FD["heavy_punch"],
                      windup={"pyaw": 10, "cyaw": 40, "al": (60, 130, -40), "ar": (40, 110, 10)},
                      hit={"pyaw": -55, "cyaw": -95, "al": (92, 4, 84), "ar": (40, 120, 20), "lean": 8,
                           "hyaw": -30, "nyaw": -40, "r": {"f": -0.26}},
                      follow={"pyaw": -60, "cyaw": -100, "al": (80, 20, 70)},
                      note="spinning back fist with a gust"))
    out.append(strike("light_kick", g, FD["light_kick"],
                      windup={"l": {"f": 0.22, "h": 0.1, "p": 15}},
                      hit={"l": {"f": 0.5, "h": 0.2, "p": 0}, "lean": 6}, note="quick shin flick"))
    # Pedal Kick: two cycling kicks, left then right.
    fd = FD["heavy_kick"]
    keys = [(0, {"l": {"f": 0.2, "h": 0.2, "p": 20}, "lean": 4}),
            (3, {"l": {"f": 0.15, "h": 0.42, "p": 30}, "lean": -2, "drop": 0.1}),
            (4, {"l": {"f": 0.72, "h": 0.5, "p": 0}, "lean": -8, "r": {"p": 30}, "ease": "out"}),
            (6, {"l": {"f": 0.25, "h": 0.4, "p": 20}, "r": {"f": 0.1, "h": 0.5, "p": 30}, "up": 0.1, "lean": -8}),
            (7, {"l": {"f": 0.0, "h": 0.25}, "r": {"f": 0.72, "x": 0.0, "h": 0.55, "p": 0}, "up": 0.12, "lean": -10,
                 "ease": "out"}),
            (9, {"r": {"f": 0.2, "h": 0.15}, "up": 0.0}),
            (10, {})]
    out.append(sequence("heavy_kick", g, keys, 11, fps_for(fd, 11), hit=4, note="Pedal Kick (2 hits)"))
    c = merge(g, CROUCH)
    out.append(strike("crouch_light", c, FD["crouch_light"],
                      windup={"al": (60, 100, 6)}, hit={"al": (86, 4, 2), "cyaw": -18, "fwd": 0.03}, note="Low Jab"))
    out.append(strike("crouch_light_kick", c, FD["crouch_light_kick"],
                      windup={"l": {"f": 0.3, "h": 0.05}, "drop": 0.66},
                      hit={"l": {"f": 0.72, "h": 0.02, "p": -10}, "drop": 0.7, "lean": 6, "fwd": 0.06,
                           "r": {"p": 35}}, note="Slide Poke (opt-in: anim \"crouch_light_kick\")"))
    out.append(strike("crouch_heavy", c, FD["crouch_heavy"],
                      windup={"ar": (30, 120, 10), "drop": 0.66, "cyaw": -55},
                      hit={"ar": (150, 70, 4), "drop": 0.03, "lean": -2, "cyaw": -4, "r": {"f": -0.2, "p": 45},
                           "hpitch": -6}, follow={"ar": (140, 80, 6), "drop": 0.06}, note="wind uppercut"))
    a = merge(g, AIR)
    out.append(strike("air_attack", a, FD["air_attack"],
                      windup={"ar": (60, 130, 10), "lean": 2},
                      hit={"ar": (75, 4, -4), "lean": 22, "l": {"f": 0.25, "h": 0.2}}, hold=2, note="Diving Palm"))
    out.append(strike("air_kick", a, FD["air_kick"],
                      windup={"l": {"f": 0.05, "h": 0.4, "p": 30}, "lean": 4},
                      hit={"l": {"f": 0.3, "h": 0.55, "p": 40}, "r": {"f": -0.25, "h": 0.15}, "kl": -0.2, "lean": -6,
                           "al": (40, 100, 30)}, hold=2, note="Cross-up Knee (opt-in: anim \"air_kick\")"))
    out.append(strike("breakaway_kick", g, FD["breakaway_kick"],
                      windup={"l": {"f": 0.1, "h": 0.35, "p": 30}, "lean": 2, "drop": 0.1},
                      hit={"l": {"f": 0.85, "h": 0.55, "p": 10, "yaw": 0}, "r": {"p": 35}, "lean": -14, "fwd": 0.12,
                           "kl": -0.1, "al": (40, 90, 30), "ar": (60, 100, 20)},
                      note="F+HK Breakaway Kick, flying side kick (opt-in: anim \"breakaway_kick\")"))
    out.append(sweep(c, FD["crouch_heavy_kick"], "Peloton Sweep (opt-in: anim \"crouch_heavy_kick\")"))
    out.append(strike("throw", g, FD["throw"],
                      windup={"al": (88, 30, 0), "ar": (88, 40, -8), "fwd": 0.06},
                      hit={"al": (95, 20, 0), "ar": (95, 25, -8), "fwd": 0.1},
                      follow={"pyaw": 120, "cyaw": 140, "lean": 18, "al": (100, 30, 50), "ar": (60, 60, 40),
                              "l": {"f": 0.5}, "r": {"f": -0.1, "p": 30}},
                      recover={"pyaw": 0}, note="Breakaway (sprint past, draft spin)"))
    # Mistral Gust: wind up both arms and push the gust out, holding while it rolls.
    fd = FD["special_1"]
    keys = [(0, {"al": (60, 110, 20), "ar": (60, 110, 20)}),
            (3, {"al": (40, 140, 40), "ar": (40, 140, 40), "cyaw": -60, "lean": 4, "drop": 0.18}),
            (4, {"al": (92, 4, 10), "ar": (92, 4, -6), "cyaw": -15, "lean": 16, "fwd": 0.06, "ease": "out"}),
            (7, {"al": (92, 4, 10), "ar": (92, 4, -6), "cyaw": -15, "lean": 16, "fwd": 0.06}),
            (10, {})]
    out.append(sequence("special_1", g, keys, 11, fps_for(fd, 11), hit=4, note="Mistral Gust"))
    # Magnet Link: wind up and hurl the horseshoe, the glowing link trails out.
    fd = FD["special_2"]
    keys = [(0, {"props": {"magnet": {"vis": 1}}, "ar": (40, 110, 20)}),
            (4, {"props": {"magnet": {"vis": 1}}, "ar": (160, 110, 20), "cyaw": -70, "lean": 2}),
            (5, {"props": {"link": {"vis": 1}}, "ar": (100, 4, 0), "cyaw": -10, "lean": 16, "fwd": 0.05, "ease": "out"}),
            (8, {"props": {"link": {"vis": 1}}, "ar": (100, 4, 0), "cyaw": -10, "lean": 16}),
            (10, {"ar": (70, 40, 0), "props": {"link": {"vis": 1, "scale": 0.6}}}),
            (13, {})]
    out.append(sequence("special_2", g, keys, 14, fps_for(fd, 14), hit=5, note="Magnet Link"))
    # Le Chonk Drop: in the air, balloons to "1T parameters" and slams down; ground bounce.
    fd = FD["special_3"]
    keys = [(0, {**AIR, "lean": 10}),
            (2, {**AIR, "props": {"chonk": {"vis": 1, "scale": 1.0}}, "lean": 20, "al": (150, 60, 40), "ar": (150, 60, 40), "ease": "out"}),
            (3, {**AIR, "props": {"chonk": {"vis": 1, "scale": 1.08}}, "lean": 26, "al": (120, 40, 40), "ar": (120, 40, 40),
                 "l": {"f": 0.25, "h": 0.12}, "r": {"f": -0.15, "h": 0.18}}),
            (6, {"props": {"chonk": {"vis": 1, "scale": 1.08}}, "drop": 0.3, "lean": 28, "al": (80, 20, 50), "ar": (80, 20, 50)}),
            (7, {"props": {"chonk": {"vis": 1, "scale": 0.6}}, "drop": 0.2, "up": 0.1, "lean": 14}),
            (8, {"props": {"chonk": {"vis": 0}}, "drop": 0.16}),
            (10, {})]
    out.append(sequence("special_3", g, keys, 11, fps_for(fd, 11), hit=3, note="Le Chonk Drop (balloon belly, 1-hit armor)"))
    # Chinchilla Optimal: a blur of 20 strikes (alternating fists and kicks), one balanced finishing kick.
    fd = FD["super"]
    keys = [(0, {"al": (70, 110, 10), "ar": (30, 120, 18), "lean": 16}), (1, {"lean": 18, "drop": 0.17})]
    for f in range(2, 13):
        side = f % 2
        jab = {"al": (92, 2, 2) if side else (70, 100, 6), "ar": (92, 4, -10) if not side else (40, 120, 18),
               "cyaw": -14 if side else -50, "lean": 16, "fwd": 0.05, "ease": "out"}
        if f in (5, 9):
            jab = {"l": {"f": 0.68, "h": 0.5, "p": 0}, "lean": -6, "ease": "out"}
        keys.append((f, jab))
    keys += [(14, {"r": {"f": -0.1, "h": 0.4, "p": 30}, "lean": 0, "pyaw": -10}),
             (15, {"r": {"f": 0.75, "x": 0.0, "h": 0.8, "p": 0}, "pyaw": 20, "lean": -10, "al": (70, 40, 40),
                   "ease": "out"}),
             (17, {"r": {"f": 0.75, "x": 0.0, "h": 0.8, "p": 0}, "pyaw": 20, "lean": -10, "al": (70, 40, 40)}),
             (19, {})]
    out.append(sequence("super", g, keys, 20, fps_for(fd, 20), hit=2, note="Chinchilla Optimal (20 strikes + kick)"))
    # Paris Marathon: jogging in place around the vortex, then hands the medal over with a nod.
    keys = []
    for f in range(10):
        ph = f / 5.0
        keys.append((f, {"l": {"f": 0.15 + 0.1 * wave(f, 5), "h": max(0, 0.18 * wave(f, 5)), "p": 10},
                         "r": {"f": -0.15 - 0.1 * wave(f, 5), "h": max(0, -0.18 * wave(f, 5)), "p": 20},
                         "al": (40 + 30 * wave(f, 5), 90, 10), "ar": (40 - 30 * wave(f, 5), 90, 10), "lean": 10,
                         "drop": 0.06, "pyaw": -24 + 10 * ph, "ease": "linear"}))
    keys += [(12, {"ar": (95, 30, -10), "lean": 4, "hpitch": 6}), (15, {"ar": (90, 30, -10), "hpitch": 10})]
    out.append(with_scarf(sequence("finisher", g, keys, 16, 6.4, note="Paris Marathon (150 f)"), wind=0.12))
    keys = [(0, {"lean": 4, "drop": 0.04, "al": (20, 40, 10), "ar": (20, 40, 10), "hpitch": 4}),
            (6, {"lean": 4, "drop": 0.04, "al": (20, 40, 10), "ar": (70, 100, -20), "hyaw": 10}),
            (10, {"lean": 8, "al": (55, 100, 10), "ar": (40, 110, 18)}), (13, {})]
    out.append(sequence("intro", g, keys, 14, 8.0, note="\"The narrative that Europe cannot compete...\""))
    keys = []
    for f in range(12):
        tap = 1 if f % 4 in (1, 2) else 0
        keys.append((f, {"drop": 0.03, "lean": 2, "al": (15, 85, -30), "ar": (22, 76 - 10 * tap, -24),
                         "hpitch": 24, "nyaw": 10, "ease": "linear"}))
    out.append(sequence("victory", g, keys, 12, 8.0, loop=True, note="checks the running watch: \"Sub-3:30.\""))

    for m in out:
        if m.name != "finisher":
            with_scarf(m, wind=0.06 if m.name in ("intro", "victory") else 0.09)
    return out


def animations(fighter_id, sk, cfg, ctx=None):
    if fighter_id != "arthur":
        return {}
    _props.install(PROPS)
    return export(_moves(sk), sk, ctx)
