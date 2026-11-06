"""Jensen Huang, "The Leather Jacket" (roster doc 3.6). Heavy-body juggernaut.

Frame data: src/characters/jensen.js on main. Props: the superchip, a diner tray, oven mitt and GPU board, the DGX
box, the AI Factory rack, a tower of diner coffee cups, a marker and the finisher's collectible box.
"""

from _group2 import props as _props
from _group2.kit import AIR, CROUCH, GUARD, air_kick, export, fps_for, low_kick, merge, sequence, strike, sweep, wave

FD = {
    "light_punch": {"startup": 7, "active": 2, "recovery": 12},      # keynote-clicker jab
    "heavy_punch": {"startup": 14, "active": 4, "recovery": 24},     # superchip slam (big, slow)
    "light_kick": {"startup": 9, "active": 3, "recovery": 16},      # short stomp
    "heavy_kick": {"startup": 15, "active": 4, "recovery": 24},      # Jacket Spin back fist
    "crouch_light": {"startup": 8, "active": 2, "recovery": 13},
    "crouch_heavy": {"startup": 11, "active": 4, "recovery": 30},    # Tray Lift launcher
    "air_attack": {"startup": 9, "active": 6, "recovery": 8},
    "crouch_light_kick": {"startup": 9, "active": 2, "recovery": 16},  # c_lk Hand-Truck Kick
    "crouch_heavy_kick": {"startup": 14, "active": 3, "recovery": 30},  # c_hk Server Sweep
    "air_kick": {"startup": 8, "active": 7, "recovery": 8},  # j_k Boot Drop
    "throw": {"startup": 8, "active": 3, "recovery": 22},            # Who Makes the Best?
    "dennys_booth": {"startup": 22, "active": 3, "recovery": 22},   # F+HP Denny's Booth overhead
    "special_1": {"startup": 22, "active": 2, "recovery": 34},       # This Has Been Cooking
    "special_2": {"startup": 8, "active": 2, "recovery": 48},        # Hand-Delivered DGX (command grab)
    "special_3": {"startup": 24, "active": 2, "recovery": 20},       # AI Factory
    "super": {"startup": 10, "active": 3, "recovery": 60},           # Vera Rubin Keynote
}

GREEN = "#76b900"
PROPS = {
    "chip": {"parts": [("box", {"size": (0.03, 0.26, 0.26), "color": "#1b1d20"}),
                       ("box", {"size": (0.034, 0.2, 0.2), "color": GREEN, "contrast": 0.4}),
                       ("box", {"size": (0.036, 0.09, 0.09), "color": "#c9ccd2", "contrast": 0.5})],
             "attach": "hand_r", "offset": (0.0, 0.12, 0.05), "rot": (0, 0, 0), "vis": 0, "part": "prop_front"},
    "tray": {"parts": [("cyl", {"r": 0.2, "l": 0.018, "color": "#b9bec7", "contrast": 0.6, "seg": 16}),
                       ("cyl", {"r": 0.16, "l": 0.02, "color": "#d7dbe2", "contrast": 0.4, "seg": 16})],
             "attach": "hand_r", "offset": (0.0, 0.08, 0.06), "upright": (90, 0, 0), "vis": 0,
             "part": "prop_front"},
    "mitt": {"parts": [("box", {"size": (0.12, 0.17, 0.08), "color": "#d9d4c7"}),
                       ("box", {"size": (0.13, 0.04, 0.09), "at": (0, -0.08, 0), "color": GREEN})],
             "attach": "hand_r", "offset": (0.0, 0.06, 0.0), "vis": 0, "part": "prop_front"},
    "board": {"parts": [("box", {"size": (0.02, 0.34, 0.13), "color": "#1f6b2a"}),
                        ("box", {"size": (0.024, 0.1, 0.08), "at": (0, 0.05, 0), "color": "#2a2d33"}),
                        ("box", {"size": (0.024, 0.3, 0.012), "at": (0, 0, -0.06), "color": "#d4af37"})],
              "attach": "hand_r", "offset": (0.0, 0.16, 0.04), "rot": (0, 0, 90), "vis": 0, "part": "prop_front"},
    "dgx": {"parts": [("box", {"size": (0.5, 0.5, 0.82), "at": (0, 0, 0.47), "color": "#d4af37", "contrast": 0.8}),
                      ("box", {"size": (0.51, 0.3, 0.2), "at": (0, 0, 0.6), "color": "#1b1d20"}),
                      ("box", {"size": (0.52, 0.16, 0.05), "at": (0, 0, 0.62), "color": GREEN, "contrast": 0.4}),
                      ("box", {"size": (0.4, 0.06, 0.06), "at": (0, 0.28, 0.04), "color": "#3a3d44"}),
                      ("cyl", {"r": 0.05, "l": 0.05, "at": (0.18, 0.3, 0.05), "rot": (0, 0, 90), "color": "#151515"}),
                      ("cyl", {"r": 0.05, "l": 0.05, "at": (-0.18, 0.3, 0.05), "rot": (0, 0, 90), "color": "#151515"})],
            "offset": (0.0, -0.72, 0.0), "vis": 0, "part": "torso"},
    "rack": {"parts": [("box", {"size": (0.42, 0.42, 1.0), "at": (0, 0, 0.5), "color": "#202226"}),
                       ("box", {"size": (0.44, 0.3, 0.02), "at": (0, -0.02, 0.85), "color": GREEN, "contrast": 0.3}),
                       ("box", {"size": (0.44, 0.3, 0.02), "at": (0, -0.02, 0.62), "color": GREEN, "contrast": 0.3}),
                       ("box", {"size": (0.44, 0.3, 0.02), "at": (0, -0.02, 0.39), "color": GREEN, "contrast": 0.3})],
             "offset": (0.0, -0.62, 0.0), "vis": 0, "part": "torso"},
    "cups": {"parts": [("cyl", {"r": 0.04, "r2": 0.05, "l": 0.09, "at": (0, 0, 0.045 + 0.08 * i), "rot": (90, 0, 0),
                                "color": "#f2efe8", "contrast": 0.6}) for i in range(7)]
             + [("cyl", {"r": 0.052, "l": 0.012, "at": (0, 0, 0.08 * i), "rot": (90, 0, 0), "color": "#b9b2a4"}) for i in range(7)],
             "attach": "hand_r", "offset": (0.0, 0.05, 0.05), "upright": (0, 0, 0), "vis": 0,
             "part": "prop_front"},
    "marker": {"parts": [("cyl", {"r": 0.011, "l": 0.15, "color": "#141416"})],
               "attach": "hand_r", "offset": (0.0, 0.07, 0.03), "rot": (0, 0, -90), "vis": 0, "part": "prop_front"},
    "figure_box": {"parts": [("box", {"size": (0.24, 0.32, 0.5), "at": (0, 0, 0.25), "color": "#202226"}),
                             ("box", {"size": (0.25, 0.24, 0.34), "at": (0, 0, 0.27), "color": "#cfe6f2", "contrast": 0.3}),
                             ("box", {"size": (0.26, 0.33, 0.06), "at": (0, 0, 0.47), "color": GREEN, "contrast": 0.4})],
                   "offset": (0.0, -0.6, 0.0), "vis": 0, "part": "torso"},
}

# Keynote presenter: feet planted wide, heavy and upright, hands up and open.
STANCE = merge(GUARD, {"l": {"f": 0.32, "x": 0.16}, "r": {"f": -0.32, "x": -0.18}, "drop": 0.12, "lean": 3,
                       "cyaw": -30, "al": (55, 95, 14), "ar": (35, 115, 22), "fist": 0.7})


def _moves(sk):
    g = STANCE
    out = []
    out.append(strike("light_punch", g, FD["light_punch"],
                      windup={"al": (60, 100, 10), "cyaw": -38},
                      hit={"al": (90, 6, 2), "cyaw": -18, "lean": 6, "fist": 0.9}, note="keynote-clicker jab"))
    out.append(strike("heavy_punch", g, FD["heavy_punch"],
                      windup={"ar": (178, 40, 10), "cyaw": -55, "lean": -6, "drop": 0.1,
                              "props": {"chip": {"vis": 1}}},
                      hit={"ar": (72, 6, -6), "cyaw": -5, "lean": 24, "drop": 0.24, "fwd": 0.08,
                           "props": {"chip": {"vis": 1}}},
                      follow={"ar": (55, 12, -6), "lean": 26, "drop": 0.26, "props": {"chip": {"vis": 1}}},
                      recover={"props": {"chip": {"vis": 0}}}, note="superchip slam"))
    out.append(strike("light_kick", g, FD["light_kick"],
                      windup={"l": {"f": 0.3, "h": 0.22, "p": -6}, "lean": -2, "kl": 0.3},
                      hit={"l": {"f": 0.46, "h": 0.0, "p": 0}, "drop": 0.17, "lean": 8},
                      note="short stomp"))
    out.append(strike("heavy_kick", g, FD["heavy_kick"],
                      windup={"pyaw": 10, "cyaw": 40, "al": (60, 130, -40), "ar": (40, 110, 10), "lean": 2},
                      hit={"pyaw": -55, "cyaw": -95, "al": (92, 4, 84), "ar": (45, 120, 20), "lean": 4,
                           "r": {"f": -0.24, "p": 20}, "hyaw": -30, "nyaw": -40},
                      follow={"pyaw": -60, "cyaw": -100, "al": (80, 20, 70)},
                      note="jacket-spin back fist"))
    c = merge(g, CROUCH)
    out.append(strike("crouch_light", c, FD["crouch_light"],
                      windup={"al": (55, 100, 8)}, hit={"al": (82, 8, 4), "cyaw": -18}, note="low jab"))
    out.append(strike("crouch_heavy", c, FD["crouch_heavy"],
                      windup={"ar": (20, 70, 20), "drop": 0.66, "props": {"tray": {"vis": 1}}},
                      hit={"ar": (160, 20, 10), "drop": 0.06, "lean": -2, "cyaw": -15,
                           "props": {"tray": {"vis": 1}}},
                      follow={"ar": (150, 30, 10), "drop": 0.08, "props": {"tray": {"vis": 1}}},
                      recover={"props": {"tray": {"vis": 0}}}, note="Tray Lift launcher"))
    a = merge(g, AIR)
    out.append(strike("air_attack", a, FD["air_attack"],
                      windup={"al": (170, 60, 20), "ar": (170, 60, 10), "lean": -6},
                      hit={"al": (115, 30, 10), "ar": (115, 30, 4), "lean": 20, "l": {"f": 0.25, "h": 0.2}},
                      hold=2, note="double-axe hammer"))
    out.append(low_kick(c, FD["crouch_light_kick"], "Hand-Truck Kick (opt-in: anim \"crouch_light_kick\")"))
    out.append(sweep(c, FD["crouch_heavy_kick"], "Server Sweep (opt-in: anim \"crouch_heavy_kick\")"))
    out.append(air_kick(a, FD["air_kick"], "Boot Drop (opt-in: anim \"air_kick\")"))
    out.append(strike("throw", g, FD["throw"],
                      windup={"al": (88, 40, 4), "ar": (88, 40, -6), "fwd": 0.06},
                      hit={"al": (95, 30, 4), "ar": (95, 30, -6), "fwd": 0.08, "lean": 8},
                      follow={"al": (172, 20, 10), "ar": (172, 20, 0), "lean": -8, "drop": 0.06, "hpitch": -14},
                      recover={"al": (165, 25, 10), "ar": (165, 25, 0), "lean": -6},
                      note="Who Makes the Best? (lifts overhead)"))
    out.append(strike("dennys_booth", g, FD["dennys_booth"],
                      windup={"ar": (185, 50, 6), "al": (185, 50, 6), "lean": -10, "props": {"tray": {"vis": 1}}},
                      hit={"ar": (118, 8, 0), "al": (118, 8, 4), "lean": 18, "drop": 0.16, "fwd": 0.08,
                           "props": {"tray": {"vis": 1, "upright": (60, 0, 0)}}},
                      recover={"props": {"tray": {"vis": 0}}},
                      note="F+HP Denny's Booth overhead tray smash (opt-in: anim \"dennys_booth\")"))

    # This Has Been Cooking: mitt on, pull the glowing board from the (off-screen) oven, hurl it.
    fd = FD["special_1"]
    keys = [(0, {"props": {"mitt": {"vis": 1}}, "ar": (40, 120, 30), "cyaw": -10}),
            (3, {"props": {"mitt": {"vis": 1}, "board": {"vis": 1}}, "ar": (20, 80, 50), "pyaw": 10, "cyaw": 30,
                 "lean": 12, "drop": 0.2, "hyaw": 30}),
            (6, {"props": {"mitt": {"vis": 1}, "board": {"vis": 1}}, "ar": (150, 90, 20), "cyaw": -70, "lean": -4}),
            (7, {"props": {"mitt": {"vis": 1}}, "ar": (100, 10, 0), "cyaw": -10, "lean": 14, "fwd": 0.06, "ease": "out"}),
            (9, {"props": {"mitt": {"vis": 1}}, "ar": (80, 20, 0), "lean": 12}),
            (14, {"props": {"mitt": {"vis": 0}}})]
    out.append(sequence("special_1", g, keys, 15, fps_for(fd, 15), hit=7, note="This Has Been Cooking"))

    # Hand-Delivered DGX: grab, box them in, sign the lid, kick it over.
    fd = FD["special_2"]
    keys = [(0, {"al": (80, 60, 4), "ar": (80, 60, -6), "fwd": 0.04}),
            (2, {"al": (95, 20, 4), "ar": (95, 20, -6), "fwd": 0.1, "lean": 10, "ease": "out"}),
            (4, {"props": {"dgx": {"vis": 1}}, "al": (90, 30, 4), "ar": (90, 30, -6), "lean": 8}),
            (6, {"props": {"dgx": {"vis": 1}, "marker": {"vis": 1}}, "ar": (110, 50, -10), "al": (40, 90, 10)}),
            (8, {"props": {"dgx": {"vis": 1}, "marker": {"vis": 1}}, "ar": (118, 40, 10), "al": (40, 90, 10)}),
            (10, {"props": {"dgx": {"vis": 1}, "marker": {"vis": 1}}, "ar": (108, 45, -14), "al": (40, 90, 10)}),
            (12, {"props": {"dgx": {"vis": 1}}, "l": {"f": 0.55, "h": 0.32, "p": -10}, "lean": -8, "ar": (60, 90, 20)}),
            (13, {"props": {"dgx": {"vis": 1, "rot": (40, 0, 0)}}, "l": {"f": 0.4, "h": 0.05}}),
            (15, {"props": {"dgx": {"vis": 0}}})]
    out.append(sequence("special_2", g, keys, 16, fps_for(fd, 16), hit=2, note="Hand-Delivered DGX (grab on frame 2)"))

    # AI Factory: roll the rack in front, slap it on, step back.
    fd = FD["special_3"]
    keys = [(0, {"ar": (70, 60, 0), "al": (70, 60, 6)}),
            (4, {"props": {"rack": {"vis": 1, "offset": (0.0, -0.45, 0.0)}}, "al": (85, 30, 4), "ar": (85, 30, -4),
                 "lean": 14, "fwd": 0.05}),
            (7, {"props": {"rack": {"vis": 1, "offset": (0.0, -0.62, 0.0)}}, "al": (95, 10, 4), "ar": (95, 10, -4),
                 "lean": 16, "fwd": 0.08, "ease": "out"}),
            (9, {"props": {"rack": {"vis": 1, "offset": (0.0, -0.62, 0.0)}}, "ar": (150, 60, 10), "al": (60, 90, 10),
                 "lean": 0}),
            (11, {"props": {"rack": {"vis": 1, "offset": (0.0, -0.62, 0.0)}}})]
    out.append(sequence("special_3", g, keys, 12, fps_for(fd, 12), hit=7,
                        note="AI Factory (rack shown while placing; the engine draws the turret)"))

    # Vera Rubin Keynote: arms wide to the spotlights, point up at the rack drop, jacket-glint pose.
    fd = FD["super"]
    keys = [(0, {"al": (90, 20, 60), "ar": (90, 20, 60), "lean": -4, "hpitch": -10}),
            (2, {"al": (100, 10, 70), "ar": (100, 10, 70), "lean": -6, "hpitch": -14}),
            (3, {"ar": (175, 10, 10), "al": (60, 60, 30), "hpitch": -20, "ease": "out"}),
            (7, {"ar": (178, 10, 10), "al": (60, 60, 30), "hpitch": -22}),
            (9, {"ar": (95, 10, 0), "al": (40, 100, 20), "cyaw": -10, "lean": 8, "ease": "out"}),
            (12, {"ar": (40, 110, 10), "al": (40, 110, -10), "cyaw": -60, "lean": -2, "hyaw": 10}),
            (15, {"ar": (60, 120, -20), "al": (35, 110, 10), "cyaw": -55, "lean": -3, "hyaw": 15})]
    out.append(sequence("super", g, keys, 16, fps_for(fd, 16), hit=3, note="Vera Rubin Keynote"))

    # Signed Limited Edition: shrink-wrap gesture, sign the box with a flourish, set it down.
    keys = [(0, {}), (3, {"al": (85, 40, 30), "ar": (85, 40, -30), "lean": 6}),
            (5, {"al": (85, 70, -10), "ar": (85, 70, 10), "props": {"figure_box": {"vis": 1}}}),
            (7, {"props": {"figure_box": {"vis": 1}, "marker": {"vis": 1}}, "ar": (100, 40, -10), "al": (40, 100, 10)}),
            (9, {"props": {"figure_box": {"vis": 1}, "marker": {"vis": 1}}, "ar": (120, 30, 10), "al": (40, 100, 10)}),
            (10, {"props": {"figure_box": {"vis": 1}, "marker": {"vis": 1}}, "ar": (150, 20, 20), "al": (40, 100, 10),
                  "ease": "out"}),
            (13, {"props": {"figure_box": {"vis": 1}}, "ar": (60, 100, 20), "lean": -4, "hpitch": -6}),
            (15, {"props": {"figure_box": {"vis": 1}}, "ar": (40, 110, 20), "lean": -4})]
    out.append(sequence("finisher", g, keys, 16, 6.4, note="Signed Limited Edition (150 f)"))

    # Intro: walks in balancing a tower of coffee cups, then sets them aside and squares up.
    keys = []
    for f in range(9):
        keys.append((f, {"props": {"cups": {"vis": 1}}, "ar": (48, 38 + wave(f, 4, 3), -6), "al": (40, 60, 30),
                         "l": {"f": 0.1 + 0.025 * f}, "r": {"f": -0.15}, "drop": 0.04 + 0.01 * abs(wave(f, 4, 1)),
                         "lean": -3, "hpitch": -12, "ease": "linear"}))
    keys += [(11, {"props": {"cups": {"vis": 1}}, "ar": (40, 50, 30), "lean": 6}), (13, {})]
    out.append(sequence("intro", g, keys, 14, 8.0, note="\"No one can carry more coffee cups than I can.\""))

    # Victory: the superchip held aloft like a trophy, three pumps ("three times").
    keys = []
    for f in range(12):
        pump = abs(wave(f, 12, 1.0, cycles=1.5))
        keys.append((f, {"props": {"chip": {"vis": 1}}, "ar": (165 + 10 * pump, 15, 8), "al": (70, 90, 30),
                         "lean": -4, "hpitch": -8 - 4 * pump, "drop": 0.08, "cyaw": -25, "ease": "linear"}))
    out.append(sequence("victory", g, keys, 12, 8.0, loop=True, note="superchip aloft, three pumps"))
    return out


def animations(fighter_id, sk, cfg, ctx=None):
    if fighter_id != "jensen":
        return {}
    _props.install(PROPS)
    return export(_moves(sk), sk, ctx)
