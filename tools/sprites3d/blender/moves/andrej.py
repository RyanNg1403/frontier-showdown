"""Andrej Karpathy, "The Vibe Coder" (roster doc 3.9). Frame data: src/characters/andrej.js
(branch cursor/group-c-fighters-c657). Props: whiteboard marker in the lead hand, a Rubik's cube in the
rear hand, the super's whiteboard and the finisher's tiny monitor."""

from _group2 import props as _props
from _group2.kit import AIR, CROUCH, GUARD, air_kick, export, fps_for, low_kick, merge, sequence, strike, sweep, wave

FD = {
    "light_punch": {"startup": 7, "active": 2, "recovery": 11},      # lp Marker Jab (f_lp micrograd reuses it)
    "heavy_punch": {"startup": 12, "active": 4, "recovery": 20},     # hp Whiteboard Swipe
    "light_kick": {"startup": 9, "active": 3, "recovery": 15},       # lk Sneaker Flick
    "heavy_kick": {"startup": 14, "active": 4, "recovery": 22},      # hk Token Scatter
    "crouch_light": {"startup": 7, "active": 2, "recovery": 12},     # c_lp Pointer Tap / c_lk Shin Ping
    "crouch_heavy": {"startup": 10, "active": 3, "recovery": 28},    # c_hp Backprop / c_hk Gradient Descent
    "air_attack": {"startup": 8, "active": 6, "recovery": 8},        # j_p Cube Smash / j_k Diagonal Flick
    "crouch_light_kick": {"startup": 8, "active": 2, "recovery": 14},  # c_lk Shin Ping
    "crouch_heavy_kick": {"startup": 13, "active": 3, "recovery": 28},  # c_hk Gradient Descent
    "air_kick": {"startup": 7, "active": 7, "recovery": 8},  # j_k Diagonal Flick
    "throw": {"startup": 8, "active": 3, "recovery": 22},            # Let's Build It (shared throw timing)
    "special_1": {"startup": 16, "active": 2, "recovery": 30},       # Tokenizer
    "special_2": {"startup": 12, "active": 1, "recovery": 14},       # Vibe Coding
    "special_3": {"startup": 6, "active": 10, "recovery": 34},       # Rubik's Rotation
    "super": {"startup": 8, "active": 2, "recovery": 50},            # microgpt
}

CUBE = [("box", {"size": (0.055, 0.055, 0.055), "color": "#141416"}),
        ("box", {"size": (0.05, 0.05, 0.004), "at": (0, 0, 0.028), "color": "#2fbf4a"}),
        ("box", {"size": (0.05, 0.05, 0.004), "at": (0, 0, -0.028), "color": "#2457d6"}),
        ("box", {"size": (0.004, 0.05, 0.05), "at": (0.028, 0, 0), "color": "#e0352b"}),
        ("box", {"size": (0.004, 0.05, 0.05), "at": (-0.028, 0, 0), "color": "#ff8a1e"}),
        ("box", {"size": (0.05, 0.004, 0.05), "at": (0, 0.028, 0), "color": "#f4f4f0"}),
        ("box", {"size": (0.05, 0.004, 0.05), "at": (0, -0.028, 0), "color": "#f5d90a"})]

PROPS = {
    "marker": {"always": 1, "parts": [("cyl", {"r": 0.011, "l": 0.15, "color": "#f2f2f2"}),
                         ("cyl", {"r": 0.012, "l": 0.04, "at": (0, 0.07, 0), "color": "#ff5fd2"})],
               "attach": "hand_l", "offset": (0.0, 0.07, 0.02), "rot": (0, 0, -90), "part": "outer_arm_far"},
    "cube": {"always": 1, "parts": CUBE, "attach": "hand_r", "offset": (0.0, 0.08, 0.035), "rot": (0, 0, 0), "part": "prop_front"},
    "whiteboard": {"parts": [("box", {"size": (0.03, 0.95, 0.62), "at": (0, 0, 0), "color": "#f4f6f8", "contrast": 0.5}),
                             ("box", {"size": (0.035, 0.97, 0.03), "at": (0, 0, 0.32), "color": "#9aa0aa"}),
                             ("box", {"size": (0.035, 0.97, 0.03), "at": (0, 0, -0.32), "color": "#9aa0aa"}),
                             ("box", {"size": (0.012, 0.6, 0.012), "at": (-0.02, 0, 0.12), "color": "#ff5fd2"}),
                             ("box", {"size": (0.012, 0.45, 0.012), "at": (-0.02, 0.05, 0.02), "color": "#ff5fd2"}),
                             ("box", {"size": (0.012, 0.52, 0.012), "at": (-0.02, -0.02, -0.08), "color": "#57ff9a"}),
                             ("cyl", {"r": 0.015, "l": 0.9, "at": (0, 0.4, -0.75), "rot": (90, 0, 0), "color": "#6b707a"}),
                             ("cyl", {"r": 0.015, "l": 0.9, "at": (0, -0.4, -0.75), "rot": (90, 0, 0), "color": "#6b707a"})],
                   "offset": (0.6, -0.4, 1.2), "vis": 0, "part": "torso"},
    "monitor": {"parts": [("box", {"size": (0.16, 0.03, 0.12), "color": "#2a2d33"}),
                          ("box", {"size": (0.13, 0.035, 0.09), "at": (0, -0.002, 0.005), "color": "#57ff9a", "contrast": 0.3})],
                "attach": "hand_r", "offset": (0.0, 0.1, 0.07), "rot": (0, 0, 90), "vis": 0, "part": "prop_front"},
}

# Lecturer's guard: marker forward like a pointer, cube turning at chest height in the rear hand.
STANCE = merge(GUARD, {"drop": 0.11, "lean": 4, "al": (78, 62, 6), "ar": (38, 112, 16), "fist": 0.8,
                       "hpitch": -3, "props": {"cube": {"rot": (0, 0, 0)}}})


def spin(i, deg):
    return {"cube": {"rot": (deg * i, deg * 0.6 * i, 0)}}


def _moves(sk):
    g = STANCE
    out = []
    out.append(strike("light_punch", g, FD["light_punch"],
                      windup={"al": (70, 95, 6), "cyaw": -44},
                      hit={"al": (92, 4, 2), "cyaw": -14, "lean": 8, "fwd": 0.04, "l": {"f": 0.36}},
                      note="Marker Jab (also F+LP micrograd)"))
    out.append(strike("heavy_punch", g, FD["heavy_punch"],
                      windup={"al": (155, 70, 30), "cyaw": -78, "pyaw": -40, "lean": 0, "r": {"p": 10}},
                      hit={"al": (96, 8, 0), "cyaw": -4, "pyaw": -10, "lean": 12, "fwd": 0.08, "r": {"p": 25}},
                      follow={"al": (45, 20, -30), "cyaw": 10, "lean": 14},
                      note="Whiteboard Swipe"))
    out.append(strike("light_kick", g, FD["light_kick"],
                      windup={"l": {"f": 0.24, "h": 0.12, "p": 10}, "lean": 0},
                      hit={"l": {"f": 0.62, "h": 0.36, "p": -10}, "lean": -6, "ar": (50, 110, 20), "kl": 0.05},
                      note="Sneaker Flick"))
    out.append(strike("heavy_kick", g, FD["heavy_kick"],
                      windup={"pyaw": -60, "cyaw": -80, "r": {"f": -0.25, "h": 0.1, "p": 30}, "al": (60, 60, 30)},
                      hit={"pyaw": 20, "cyaw": -20, "lean": -6, "r": {"f": 0.7, "x": 0.02, "h": 0.74, "p": 10, "yaw": 70},
                           "l": {"yaw": 60}, "kr": 0.9, "al": (40, 30, 50), "ar": (60, 80, 40)},
                      follow={"pyaw": 40, "cyaw": 10, "r": {"f": 0.25, "h": 0.25}},
                      note="Token Scatter spinning kick"))
    c = merge(g, CROUCH)
    out.append(strike("crouch_light", c, FD["crouch_light"],
                      windup={"al": (60, 90, 6)},
                      hit={"al": (88, 6, 2), "cyaw": -16, "fwd": 0.03}, note="Pointer Tap / Shin Ping"))
    out.append(strike("crouch_heavy", c, FD["crouch_heavy"],
                      windup={"ar": (40, 120, 10), "drop": 0.66, "cyaw": -55},
                      hit={"ar": (150, 75, 6), "drop": 0.04, "lean": -4, "cyaw": -2, "pyaw": -10,
                           "r": {"f": -0.2, "p": 40}, "npitch": 6, "hpitch": 8, "props": {"cube": {"rot": (90, 0, 0)}}},
                      follow={"ar": (140, 80, 10), "drop": 0.08},
                      note="Backprop uppercut (launcher)"))
    a = merge(g, AIR)
    out.append(strike("air_attack", a, FD["air_attack"],
                      windup={"al": (175, 60, 10), "ar": (175, 60, 10), "lean": -8, "cyaw": -20},
                      hit={"al": (110, 20, 4), "ar": (110, 20, 4), "lean": 22, "cyaw": -10,
                           "l": {"f": 0.3, "h": 0.2}, "r": {"f": -0.1, "h": 0.28}},
                      hold=2, note="Cube Smash (two-handed)"))
    out.append(low_kick(c, FD["crouch_light_kick"], "Shin Ping (opt-in: anim \"crouch_light_kick\")"))
    out.append(sweep(c, FD["crouch_heavy_kick"], "Gradient Descent (opt-in: anim \"crouch_heavy_kick\")"))
    out.append(air_kick(a, FD["air_kick"], "Diagonal Flick (opt-in: anim \"air_kick\")"))
    out.append(strike("throw", g, FD["throw"],
                      windup={"al": (85, 30, 0), "ar": (85, 40, -10), "fwd": 0.06, "cyaw": -10},
                      hit={"al": (95, 20, 0), "ar": (95, 25, -10), "fwd": 0.1, "cyaw": 0, "lean": 10},
                      follow={"cyaw": 70, "pyaw": 40, "al": (100, 30, 60), "ar": (20, 60, 40), "lean": -4},
                      recover={"cyaw": -30}, note="Let's Build It (back throw)"))
    out.append(strike("special_1", g, FD["special_1"],
                      windup={"al": (150, 120, 20), "cyaw": -70, "lean": -4, "r": {"p": 15}},
                      hit={"al": (100, 0, 0), "cyaw": -8, "lean": 12, "fwd": 0.06, "r": {"p": 30}},
                      note="Tokenizer: flicks a magenta word off the marker"))
    out.append(strike("special_2", g, FD["special_2"],
                      windup={"al": (20, 30, 10), "ar": (20, 30, 10), "lean": 0, "props": {"marker": {"vis": 0}}},
                      hit={"al": (-12, 25, 6), "ar": (-12, 25, 6), "lean": -12, "hyaw": 45, "hpitch": -10,
                           "nyaw": 22, "drop": 0.05, "fist": 0.6, "l": {"f": 0.2}, "r": {"f": -0.2},
                           "props": {"marker": {"vis": 0}, "cube": {"vis": 0}}},
                      recover={"al": (-10, 25, 6), "ar": (-10, 25, 6), "lean": -10, "hyaw": 40, "hpitch": -8,
                               "nyaw": 20, "drop": 0.05, "l": {"f": 0.2}, "r": {"f": -0.2},
                               "props": {"marker": {"vis": 0}, "cube": {"vis": 0}}},
                      note="Vibe Coding: hands in pockets, leans back, stops looking"))
    # Rubik's Rotation: a rising 360 spin with the cube held high, 3 face-turn hits.
    k, n = 2, 13
    keys = [(0, {"drop": 0.2, "cyaw": -50, "ar": (60, 120, 10)}),
            (1, {"drop": 0.26, "cyaw": -60, "ar": (100, 90, 10), "lean": 10})]
    for j, f in enumerate(range(k, 8)):
        t = j / 5
        keys.append((f, {"up": 0.28 * (1 - (1 - t) ** 2), "drop": 0.0, "pyaw": -24 + 360 * t, "cyaw": -36 + 360 * t,
                         "ar": (172, 18, 8), "al": (60, 60, 30), "lean": -4,
                         "l": {"f": 0.18, "h": 0.42, "p": 20}, "r": {"f": -0.1, "h": 0.18, "p": 35},
                         "props": {"cube": {"rot": (90 * j, 45 * j, 0), "scale": 1.6}}, "ease": "linear"}))
    keys += [(10, {"up": 0.1, "pyaw": 336, "cyaw": 324, "ar": (120, 40, 8), "l": {"h": 0.15}, "r": {"h": 0.1},
                   "props": {"cube": {"scale": 1.2}}}),
             (12, {"pyaw": 336, "cyaw": 324, "props": {"cube": {"scale": 1.0}}})]
    out.append(sequence("special_3", g, keys, n, fps_for(FD["special_3"], n), hit=k, note="Rubik's Rotation (invuln 1-6, 3 hits)"))

    # microgpt: flash pose, whiteboard drops in, scribble, turn and point as the block slams down.
    n = 16
    keys = [(0, {"al": (175, 40, 10), "lean": -6, "hpitch": -12}),
            (1, {"al": (178, 30, 10), "lean": -8, "hpitch": -14}),
            (2, {"props": {"whiteboard": {"vis": 1}}, "pyaw": 20, "cyaw": 50, "al": (100, 40, 40), "lean": 2}),
            ]
    for f in range(3, 12):
        keys.append((f, {"props": {"whiteboard": {"vis": 1}}, "pyaw": 24, "cyaw": 58, "hyaw": 40,
                         "al": (105 + wave(f, 3, 12), 45 + wave(f, 2, 15), 40 + wave(f, 3, 10, phase=0.25)),
                         "ease": "linear"}))
    keys += [(13, {"props": {"whiteboard": {"vis": 1}}, "pyaw": -20, "cyaw": -30, "al": (96, 6, 2), "lean": 8}),
             (15, {"props": {"whiteboard": {"vis": 1}}, "al": (110, 8, 2), "lean": 6})]
    out.append(sequence("super", g, keys, n, fps_for(FD["super"], n), hit=2, note="microgpt: writes a GPT in 200 lines"))

    # Software 2.0: two marker taps to "compile", then shows the tiny monitor.
    n = 16
    keys = [(0, {}), (3, {"al": (120, 40, 4), "lean": -2}),
            (5, {"al": (98, 6, 2), "lean": 6, "ease": "out"}), (6, {"al": (110, 30, 2)}),
            (7, {"al": (98, 6, 2), "lean": 6, "ease": "out"}), (9, {"al": (70, 70, 6)}),
            (11, {"ar": (40, 75, -10), "props": {"cube": {"vis": 0}, "monitor": {"vis": 1}}, "hyaw": 10}),
            (15, {"ar": (50, 70, -10), "props": {"cube": {"vis": 0}, "monitor": {"vis": 1}}, "hyaw": 25, "lean": -4})]
    out.append(sequence("finisher", g, keys, n, 6.4, note="Software 2.0 (150 f)"))

    # Intro: strolls in turning the cube, raises the marker on "English", settles into the guard.
    n = 14
    keys = [(0, {"l": {"f": 0.05}, "r": {"f": -0.1, "p": 20}, "drop": 0.04, "lean": 0, "al": (20, 30, 8),
                 "ar": (60, 100, 10), "props": spin(0, 0)})]
    for f in range(1, 8):
        keys.append((f, {"l": {"f": 0.05 + 0.03 * f}, "drop": 0.04, "lean": 0, "al": (20 + 20 * f, 30, 8),
                         "ar": (60, 100, 10), "props": spin(f, 30), "hyaw": 10}))
    keys += [(10, {"al": (170, 20, 6), "props": spin(10, 30), "hpitch": -10, "drop": 0.04}),
             (13, {"props": spin(13, 30)})]
    out.append(sequence("intro", g, keys, n, 8.0, note="\"The hottest new programming language is English.\""))

    # Victory loop: relaxed, solving the cube with both hands while grinning.
    n = 12
    keys = []
    for f in range(n):
        keys.append((f, {
            "drop": 0.03, "lean": -4 + wave(f, n, 1.5), "l": {"f": 0.12}, "r": {"f": -0.14},
            "al": (22, 82 + wave(f, n, 6), -28), "ar": (24, 80 + wave(f, n, 6, phase=0.5), 26),
            "props": {"cube": {"rot": (90 * (f // 3), 0, 90 * ((f + 1) // 3))},
                      "marker": {"vis": 0}}, "hpitch": 8, "ease": "linear"}))
    out.append(sequence("victory", g, keys, n, 8.0, loop=True, note="solving the cube, loop"))
    return out


def animations(fighter_id, sk, cfg, ctx=None):
    if fighter_id != "andrej":
        return {}
    _props.install(PROPS)
    return export(_moves(sk), sk, ctx)
