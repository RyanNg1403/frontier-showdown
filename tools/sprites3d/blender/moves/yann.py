"""Yann LeCun, "The Contrarian" (roster doc 3.10). Frame data: src/characters/yann.js (branch
cursor/group-c-fighters-c657). Zoner and anti-air: the EWI (a black electronic wind instrument carried
like a short staff) is in his rear hand in every pose; the RC plane, the three-layer cake and the
finisher's coffee cup appear in their moves."""

from _group2 import props as _props
from _group2.kit import AIR, CROUCH, GUARD, air_kick, export, fps_for, low_kick, merge, sequence, strike, sweep, wave

FD = {
    "light_punch": {"startup": 7, "active": 2, "recovery": 12},      # lp EWI Poke
    "heavy_punch": {"startup": 13, "active": 4, "recovery": 21},     # hp Jazz Swing
    "light_kick": {"startup": 9, "active": 3, "recovery": 15},       # lk Short Kick
    "heavy_kick": {"startup": 15, "active": 4, "recovery": 23},      # hk Long Sweeping Kick
    "crouch_light": {"startup": 7, "active": 2, "recovery": 12},     # c_lp Low Reed / c_lk Toe Tap
    "crouch_heavy": {"startup": 9, "active": 4, "recovery": 28},     # c_hp Max Pool / c_hk Gradient Sweep
    "air_attack": {"startup": 8, "active": 6, "recovery": 8},        # j_p Downward EWI / j_k Brown-Shoe Stomp
    "crouch_light_kick": {"startup": 8, "active": 2, "recovery": 15},  # c_lk Toe Tap
    "crouch_heavy_kick": {"startup": 13, "active": 3, "recovery": 29},  # c_hk Gradient Sweep
    "air_kick": {"startup": 8, "active": 7, "recovery": 8},  # j_k Brown-Shoe Stomp
    "throw": {"startup": 8, "active": 3, "recovery": 22},            # Check Reader
    "optimal_brain_damage": {"startup": 18, "active": 5, "recovery": 20},   # B+HP Optimal Brain Damage
    "special_1": {"startup": 16, "active": 2, "recovery": 28},       # Convolution
    "special_2": {"startup": 18, "active": 2, "recovery": 26},       # RC Air Strike
    "special_3": {"startup": 20, "active": 1, "recovery": 18},       # The Cake
    "super": {"startup": 9, "active": 3, "recovery": 48},            # JEPA
}

ROSE = "#e0457b"
PROPS = {
    "ewi": {"always": 1, "parts": [("cyl", {"r": 0.017, "l": 0.6, "at": (0, 0.16, 0), "color": "#151518"}),
                      ("cyl", {"r": 0.019, "l": 0.05, "at": (0, 0.44, 0), "color": "#c9ccd2"}),
                      ("cyl", {"r": 0.012, "r2": 0.006, "l": 0.05, "at": (0, 0.49, 0), "color": "#151518"}),
                      ("box", {"size": (0.012, 0.2, 0.012), "at": (0.016, 0.2, 0), "color": "#8d9099"})],
            "attach": "hand_r", "offset": (0.0, 0.07, 0.02), "rot": (0, 0, 0), "part": "prop_front"},
    "plane": {"parts": [("box", {"size": (0.05, 0.36, 0.05), "color": "#f2efe8"}),
                        ("box", {"size": (0.5, 0.09, 0.012), "at": (0, -0.03, 0.02), "color": "#f2efe8"}),
                        ("box", {"size": (0.18, 0.05, 0.01), "at": (0, 0.16, 0.02), "color": ROSE}),
                        ("box", {"size": (0.01, 0.06, 0.08), "at": (0, 0.16, 0.05), "color": ROSE})],
              "attach": "hand_l", "offset": (0.0, 0.1, 0.0), "upright": (-20, 0, 0), "vis": 0, "part": "outer_arm_far"},
    "cake": {"parts": [("cyl", {"r": 0.17, "l": 0.12, "at": (0, 0, 0.06), "rot": (90, 0, 0), "color": "#c99a6b", "seg": 16}),
                       ("cyl", {"r": 0.13, "l": 0.1, "at": (0, 0, 0.17), "rot": (90, 0, 0), "color": "#f6efe4", "seg": 16}),
                       ("cyl", {"r": 0.09, "l": 0.08, "at": (0, 0, 0.26), "rot": (90, 0, 0), "color": "#f2c4d4", "seg": 16}),
                       ("sphere", {"r": 0.03, "at": (0, 0, 0.32), "color": "#d0202e"})],
             "offset": (0.0, -0.62, 0.0), "vis": 0, "part": "torso"},
    "cup": {"parts": [("cyl", {"r": 0.035, "r2": 0.042, "l": 0.09, "color": "#f2efe8", "contrast": 0.6}),
                      ("cyl", {"r": 0.032, "l": 0.01, "at": (0, 0.046, 0), "color": "#4a2c1a"})],
            "attach": "hand_l", "offset": (0.0, 0.08, 0.05), "rot": (0, 0, 0), "vis": 0, "part": "outer_arm_far"},
}

# Amused confidence: EWI held diagonally like a sax in the rear hand, lead hand on its upper keys.
STANCE = merge(GUARD, {"drop": 0.11, "lean": 4, "ar": (40, 95, 4), "al": (70, 110, -12), "fist": 0.9,
                       "cyaw": -32, "hpitch": 2})


def _moves(sk):
    g = STANCE
    out = []
    out.append(strike("light_punch", g, FD["light_punch"],
                      windup={"ar": (60, 110, 4), "al": (50, 120, -4)},
                      hit={"ar": (92, 4, -4), "al": (60, 100, 4), "cyaw": -10, "lean": 8, "fwd": 0.04},
                      note="EWI Poke"))
    out.append(strike("heavy_punch", g, FD["heavy_punch"],
                      windup={"ar": (170, 50, 20), "cyaw": -70, "lean": -4},
                      hit={"ar": (105, 6, -10), "cyaw": -4, "lean": 10, "fwd": 0.06},
                      follow={"ar": (55, 20, -30), "cyaw": 15, "lean": 14},
                      note="Jazz Swing (rose note trail)"))
    out.append(strike("light_kick", g, FD["light_kick"],
                      windup={"l": {"f": 0.22, "h": 0.16, "p": 15}},
                      hit={"l": {"f": 0.58, "h": 0.32, "p": -10}, "lean": -4}, note="Short Kick"))
    out.append(strike("heavy_kick", g, FD["heavy_kick"],
                      windup={"r": {"f": -0.3, "h": 0.15, "p": 30}, "pyaw": -45, "cyaw": -55},
                      hit={"r": {"f": 0.78, "x": 0.0, "h": 0.55, "p": 0, "yaw": 50}, "pyaw": 15, "cyaw": -25, "lean": -8,
                           "kr": 0.6},
                      follow={"r": {"f": 0.4, "h": 0.2}, "pyaw": 25},
                      note="Long Sweeping Kick"))
    c = merge(g, CROUCH)
    out.append(strike("crouch_light", c, FD["crouch_light"],
                      windup={"ar": (55, 110, 4)},
                      hit={"ar": (85, 4, -4), "cyaw": -12}, note="Low Reed / Toe Tap"))
    out.append(strike("crouch_heavy", c, FD["crouch_heavy"],
                      windup={"ar": (40, 110, 4), "al": (50, 110, -6), "drop": 0.66},
                      hit={"ar": (165, 10, 0), "al": (150, 30, -6), "drop": 0.04, "lean": -6, "hpitch": -14},
                      follow={"ar": (160, 15, 0), "drop": 0.07}, note="Max Pool (upward EWI thrust)"))
    a = merge(g, AIR)
    out.append(strike("air_attack", a, FD["air_attack"],
                      windup={"ar": (170, 60, 4), "lean": -6},
                      hit={"ar": (70, 4, -4), "lean": 22, "l": {"f": 0.25, "h": 0.18}},
                      hold=2, note="Downward EWI / Brown-Shoe Stomp"))
    out.append(low_kick(c, FD["crouch_light_kick"], "Toe Tap (opt-in: anim \"crouch_light_kick\")"))
    out.append(sweep(c, FD["crouch_heavy_kick"], "Gradient Sweep (opt-in: anim \"crouch_heavy_kick\")"))
    out.append(air_kick(a, FD["air_kick"], "Brown-Shoe Stomp (opt-in: anim \"air_kick\")"))
    out.append(strike("throw", g, FD["throw"],
                      windup={"al": (88, 30, 0), "fwd": 0.05},
                      hit={"al": (95, 20, 0), "fwd": 0.08, "lean": 8},
                      follow={"al": (100, 40, -20), "ar": (110, 20, -10), "cyaw": 0, "hpitch": 10},
                      recover={"al": (80, 60, 0)}, note="Check Reader (scan and stamp)"))
    out.append(strike("optimal_brain_damage", g, FD["optimal_brain_damage"],
                      windup={"ar": (150, 80, 30), "cyaw": -75, "lean": -6, "l": {"f": 0.2}},
                      hit={"ar": (88, 30, -20), "cyaw": -5, "lean": 6},
                      follow={"ar": (60, 40, -35), "cyaw": 10},
                      note="B+HP Optimal Brain Damage (opt-in: anim \"optimal_brain_damage\")"))

    fd = FD["special_1"]
    keys = [(0, {"ar": (60, 100, 4)}), (3, {"ar": (140, 60, 10), "cyaw": -55, "lean": 0}),
            (5, {"ar": (55, 6, -4), "al": (40, 90, 10), "cyaw": -6, "lean": 20, "drop": 0.22, "fwd": 0.05,
                 "ease": "out"}),
            (7, {"ar": (55, 6, -4), "cyaw": -6, "lean": 20, "drop": 0.22}), (12, {})]
    out.append(sequence("special_1", g, keys, 13, fps_for(fd, 13), hit=5, note="Convolution (EWI taps the floor)"))
    fd = FD["special_2"]
    keys = [(0, {"props": {"plane": {"vis": 1}}, "al": (60, 90, 10)}),
            (4, {"props": {"plane": {"vis": 1}}, "al": (150, 80, 20), "cyaw": -60, "lean": -6}),
            (6, {"al": (130, 10, 4), "cyaw": -10, "lean": 8, "hpitch": -14, "ease": "out"}),
            (8, {"al": (125, 20, 4), "hpitch": -16}), (12, {})]
    out.append(sequence("special_2", g, keys, 13, fps_for(fd, 13), hit=6, note="RC Air Strike (plane launch)"))
    fd = FD["special_3"]
    keys = [(0, {"al": (60, 90, 10)}),
            (4, {"drop": 0.3, "lean": 30, "al": (40, 40, 10), "props": {"cake": {"vis": 1, "offset": (0.0, -0.5, 0.25)}}}),
            (7, {"drop": 0.32, "lean": 32, "al": (30, 30, 10), "props": {"cake": {"vis": 1}}, "ease": "out"}),
            (9, {"props": {"cake": {"vis": 1}}, "al": (60, 90, 10), "hpitch": 8}),
            (10, {"props": {"cake": {"vis": 1}}})]
    out.append(sequence("special_3", g, keys, 11, fps_for(fd, 11), hit=7,
                        note="The Cake (shown while placed; the engine draws the trap)"))
    # JEPA: freeze gesture, then a fast jazz solo on the EWI, one accent per struck pose.
    fd = FD["super"]
    keys = [(0, {"al": (100, 10, 20), "lean": -2}), (2, {"al": (105, 4, 10), "hpitch": -4, "ease": "out"}),
            (3, {"ar": (25, 80, 0), "al": (60, 95, -20), "hpitch": -18, "lean": -10, "drop": 0.12})]
    for f in range(4, 14):
        keys.append((f, {"ar": (25 + 12 * abs(wave(f, 4)), 80, 0), "al": (60, 95 + 10 * wave(f, 2), -20),
                         "hpitch": -18 - 4 * abs(wave(f, 4)), "lean": -10 + 3 * wave(f, 4), "drop": 0.12,
                         "l": {"p": -22 * max(0, wave(f, 2))}, "ease": "linear"}))
    keys.append((15, {}))
    out.append(sequence("super", g, keys, 16, fps_for(fd, 16), hit=2, note="JEPA (jazz solo)"))
    # Smarter Than a House Cat: holds his coffee, the cup is knocked away, he shrugs.
    keys = [(0, {"props": {"cup": {"vis": 1}}, "al": (60, 110, 10)}),
            (6, {"props": {"cup": {"vis": 1}}, "al": (75, 120, 10), "hpitch": 10}),
            (8, {"al": (40, 60, 20), "lean": -4, "props": {"cup": {"vis": 0}}}),
            (11, {"al": (60, 120, 50), "ar": (60, 100, 40), "lean": -4, "hpitch": 6, "nyaw": 10}),
            (13, {"al": (68, 125, 55), "ar": (66, 105, 45), "lean": -5, "hpitch": 4}),
            (15, {"al": (60, 120, 50), "ar": (60, 100, 40), "lean": -4, "hpitch": 8})]
    out.append(sequence("finisher", g, keys, 16, 6.4, note="Smarter Than a House Cat: \"Common sense.\" (150 f)"))
    keys = [(0, {"drop": 0.03, "lean": -2, "ar": (25, 80, 0), "al": (60, 95, -20), "hpitch": -12})]
    for f in range(1, 9):
        keys.append((f, {"drop": 0.03, "lean": -2, "ar": (25, 80, 0), "al": (60, 95 + 8 * wave(f, 2), -20),
                         "hpitch": -12, "l": {"p": -20 * max(0, wave(f, 4))}, "ease": "linear"}))
    keys += [(13, {})]
    out.append(sequence("intro", g, keys, 14, 8.0, note="a short riff, then the house-cat line"))
    keys = []
    for f in range(12):
        keys.append((f, {"drop": 0.03, "lean": -3, "ar": (25, 80, 0), "al": (60, 95 + 8 * wave(f, 3), -20),
                         "hpitch": -10, "l": {"p": -22 * max(0, wave(f, 4))}, "ease": "linear"}))
    out.append(sequence("victory", g, keys, 12, 8.0, loop=True, note="plays a riff, toe tapping (loop)"))
    return out


def animations(fighter_id, sk, cfg, ctx=None):
    if fighter_id != "yann":
        return {}
    _props.install(PROPS)
    return export(_moves(sk), sk, ctx)
