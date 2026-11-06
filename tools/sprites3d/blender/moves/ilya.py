"""Ilya Sutskever, "The Visionary" (roster doc 3.7). Mystic zoner / teleporter: still, pianist hands,
bursts of motion.

Frame data: src/characters/ilya.js on main. Props: the glowing lavender orb (Peak Data, rising orb, super) and floating piano keys.
"""

from _group2 import props as _props
from _group2.kit import AIR, CROUCH, GUARD, air_kick, export, fps_for, low_kick, merge, sequence, strike, sweep, wave

FD = {
    "light_punch": {"startup": 6, "active": 2, "recovery": 11},      # finger flick, rings a piano note
    "heavy_punch": {"startup": 12, "active": 3, "recovery": 20},     # open palm, lavender ripple
    "light_kick": {"startup": 9, "active": 3, "recovery": 15},       # short front kick
    "heavy_kick": {"startup": 15, "active": 4, "recovery": 24},      # slow long crescent kick
    "crouch_light": {"startup": 7, "active": 2, "recovery": 12},
    "crouch_heavy": {"startup": 10, "active": 4, "recovery": 28},    # rising orb anti-air
    "air_attack": {"startup": 8, "active": 6, "recovery": 8},        # j.HP palm with a short hover
    "crouch_light_kick": {"startup": 8, "active": 2, "recovery": 14},  # c_lk Grace Note
    "crouch_heavy_kick": {"startup": 13, "active": 3, "recovery": 28},  # c_hk Long Sweep
    "air_kick": {"startup": 7, "active": 7, "recovery": 8},  # j_k Falling Kick
    "throw": {"startup": 8, "active": 3, "recovery": 22},            # Seq2Seq (swap places)
    "special_1": {"startup": 16, "active": 2, "recovery": 28},       # Peak Data
    "special_2": {"startup": 12, "active": 3, "recovery": 26},       # Straight Shot (travel 6-11)
    "special_3": {"startup": 3, "active": 20, "recovery": 28},       # What Did Ilya See? (counter window)
    "foresight_palm": {"startup": 10, "active": 4, "recovery": 22},  # the counter strike after the teleport
    "super": {"startup": 8, "active": 24, "recovery": 52},            # Feel the AGI
}

LAVENDER = "#e3d9ff"
PROPS = {
    "orb": {"parts": [("sphere", {"r": 0.085, "color": LAVENDER, "contrast": 0.35}),
                      ("sphere", {"r": 0.05, "color": "#ffffff", "contrast": 0.1})],
            "offset": (0.0, -0.35, 1.25), "vis": 0, "part": "prop_front"},
    "keys": {"parts": [("box", {"size": (0.06, 0.022, 0.012), "at": (0, -0.05 + 0.025 * i, 0), "color": "#f4f2ff",
                                "contrast": 0.3}) for i in range(5)]
             + [("box", {"size": (0.035, 0.012, 0.014), "at": (-0.012, -0.0375 + 0.025 * i, 0.008),
                         "color": "#3b1f6e"}) for i in (0, 1, 3)],
             "offset": (0.0, -0.5, 1.2), "vis": 0, "part": "prop_front"},
}

# Pianist's rest: upright and still, head slightly bowed, fingers splayed above invisible keys.
STANCE = merge(GUARD, {"drop": 0.1, "lean": 2, "l": {"f": 0.26}, "r": {"f": -0.28}, "fist": 0.0,
                       "al": (62, 55, 6), "ar": (55, 62, 14), "npitch": 8, "hpitch": 10, "cyaw": -30})


def orb_at(y, z, s=1.0):
    return {"orb": {"vis": 1, "offset": (0.0, y, z), "scale": s}}


def _moves(sk):
    g = STANCE
    out = []
    out.append(strike("light_punch", g, FD["light_punch"],
                      windup={"al": (75, 70, 6)},
                      hit={"al": (90, 4, 2), "cyaw": -22, "props": {"keys": {"vis": 1}}},
                      follow={"props": {"keys": {"vis": 1}}}, note="finger flick (piano note)"))
    out.append(strike("heavy_punch", g, FD["heavy_punch"],
                      windup={"ar": (50, 140, 10), "cyaw": -55, "lean": -2},
                      hit={"ar": (92, 4, -4), "cyaw": -5, "lean": 10, "fwd": 0.06, "l": {"f": 0.36}},
                      note="open palm, lavender ripple"))
    out.append(strike("light_kick", g, FD["light_kick"],
                      windup={"l": {"f": 0.25, "h": 0.2, "p": 20}, "kl": 0.0},
                      hit={"l": {"f": 0.6, "h": 0.42, "p": -15}, "lean": -6}, note="short front kick"))
    out.append(strike("heavy_kick", g, FD["heavy_kick"],
                      windup={"r": {"f": -0.1, "x": 0.1, "h": 0.3, "p": 20}, "pyaw": -10, "lean": 0},
                      hit={"r": {"f": 0.55, "x": 0.12, "h": 0.85, "p": 0, "yaw": 20}, "kr": -0.1, "pyaw": 15,
                           "lean": -10, "al": (45, 70, 45)},
                      follow={"r": {"f": 0.6, "x": -0.15, "h": 0.55}, "pyaw": 25},
                      note="crescent kick"))
    c = merge(g, CROUCH)
    out.append(strike("crouch_light", c, FD["crouch_light"],
                      windup={"al": (60, 70, 6)}, hit={"al": (85, 4, 2), "cyaw": -20}, note="low finger flick"))
    out.append(strike("crouch_heavy", c, FD["crouch_heavy"],
                      windup={"ar": (60, 100, 10), "al": (60, 100, 10), "drop": 0.66, "props": orb_at(-0.25, 0.6, 0.6)},
                      hit={"ar": (160, 20, 10), "al": (150, 30, 20), "drop": 0.05, "lean": -6, "hpitch": -16,
                           "props": orb_at(-0.3, 1.75, 1.0)},
                      follow={"props": orb_at(-0.3, 1.9, 0.8)}, recover={"props": {"orb": {"vis": 0}}},
                      note="rising orb anti-air"))
    a = merge(g, AIR)
    out.append(strike("air_attack", a, FD["air_attack"],
                      windup={"ar": (60, 130, 10), "lean": -4},
                      hit={"ar": (110, 4, -2), "lean": 14, "l": {"h": 0.22}, "r": {"h": 0.26}},
                      hold=2, note="j.HP palm (10 f hover)"))
    out.append(low_kick(c, FD["crouch_light_kick"], "Grace Note (opt-in: anim \"crouch_light_kick\")"))
    out.append(sweep(c, FD["crouch_heavy_kick"], "Long Sweep (opt-in: anim \"crouch_heavy_kick\")"))
    out.append(air_kick(a, FD["air_kick"], "Falling Kick (opt-in: anim \"air_kick\")"))
    out.append(strike("throw", g, FD["throw"],
                      windup={"al": (88, 30, 0), "ar": (88, 30, -6), "fwd": 0.05, "fist": 0.6},
                      hit={"al": (92, 20, 0), "ar": (92, 20, -6), "fwd": 0.08, "fist": 0.8},
                      follow={"pyaw": 150, "cyaw": 140, "al": (90, 30, 30), "ar": (90, 30, -20), "hyaw": 120},
                      recover={"pyaw": 0, "cyaw": -30}, note="Seq2Seq (swaps places)"))

    fd = FD["special_1"]
    keys = [(0, {"al": (70, 70, 20), "ar": (70, 70, 20), "props": orb_at(-0.3, 1.05, 0.4)}),
            (3, {"al": (85, 90, 30), "ar": (80, 90, 25), "lean": -2, "props": orb_at(-0.33, 1.15, 0.9)}),
            (4, {"al": (92, 20, 10), "ar": (90, 20, 6), "lean": 8, "fwd": 0.04, "props": orb_at(-0.55, 1.2, 1.2),
                 "ease": "out"}),
            (5, {"al": (92, 20, 10), "ar": (90, 20, 6), "lean": 8, "props": {"orb": {"vis": 0}}}),
            (11, {"props": {"orb": {"vis": 0}}})]
    out.append(sequence("special_1", g, keys, 12, fps_for(fd, 12), hit=4, note="Peak Data (one orb)"))

    # Straight Shot: crouch, vanish-dash pose, reappear palm. The engine hides him during travel.
    fd = FD["special_2"]
    keys = [(0, {"drop": 0.16, "ar": (40, 120, 10), "cyaw": -50}),
            (2, {"drop": 0.24, "lean": 22, "fwd": 0.1, "ar": (30, 90, 10), "al": (30, 90, 10),
                 "l": {"f": 0.42}, "r": {"f": -0.45, "p": 30}}),
            (3, {"drop": 0.18, "lean": 14, "fwd": 0.12, "ar": (95, 4, -4), "cyaw": -6, "l": {"f": 0.42},
                 "r": {"f": -0.45, "p": 20}, "ease": "out"}),
            (5, {"ar": (92, 4, -4), "cyaw": -6, "lean": 12, "fwd": 0.1, "l": {"f": 0.42}, "r": {"f": -0.45}}),
            (10, {})]
    out.append(sequence("special_2", g, keys, 11, fps_for(fd, 11), hit=3, note="Straight Shot (invuln travel 6-11)"))

    # What Did Ilya See?: eyes closed, still, hands open low; loops through the window.
    fd = FD["special_3"]
    keys = [(0, {}), (1, {"hpitch": 18, "npitch": 10, "al": (35, 40, 30), "ar": (35, 40, 30), "drop": 0.06,
                         "lean": 0, "cyaw": -45, "ease": "out"})]
    for f in range(2, 12):
        keys.append((f, {"hpitch": 18, "npitch": 10, "al": (35 + wave(f, 10, 3), 40, 30),
                         "ar": (35 - wave(f, 10, 3), 40, 30), "drop": 0.06, "lean": 0, "cyaw": -45}))
    keys.append((14, {}))
    out.append(sequence("special_3", g, keys, 15, fps_for(fd, 15), hit=1, note="What Did Ilya See? (counter window)"))
    out.append(strike("foresight_palm", g, FD["foresight_palm"],
                      windup={"ar": (60, 120, 10), "cyaw": -60, "drop": 0.18, "hpitch": 4},
                      hit={"ar": (95, 2, -4), "cyaw": -4, "lean": 12, "fwd": 0.08},
                      note="counter strike after the teleport (opt-in: parry.counter.anim \"foresight_palm\")"))

    # Feel the AGI: both arms raise slowly, chant, the storm lifts the opponent.
    fd = FD["super"]
    keys = [(0, {"al": (40, 60, 30), "ar": (40, 60, 30), "hpitch": 16}),
            (2, {"al": (120, 40, 40), "ar": (120, 40, 40), "hpitch": -4, "lean": -2}),
            (3, {"al": (175, 10, 25), "ar": (175, 10, 25), "hpitch": -20, "lean": -6, "props": orb_at(-0.15, 1.88, 1.2),
                 "ease": "out"})]
    for f in range(4, 13):
        keys.append((f, {"al": (175 + wave(f, 4, 3), 10, 25), "ar": (175 - wave(f, 4, 3), 10, 25), "hpitch": -20,
                         "lean": -6, "up": 0.02 * abs(wave(f, 4)), "props": orb_at(-0.15, 1.88, 1.2 + 0.15 * abs(wave(f, 4)))}))
    keys += [(15, {"al": (60, 60, 30), "ar": (60, 60, 30), "hpitch": 12, "props": {"orb": {"vis": 0}}})]
    out.append(sequence("super", g, keys, 16, fps_for(fd, 16), hit=3, note="Feel the AGI"))

    keys = [(0, {}), (4, {"hpitch": 4, "al": (70, 50, 10), "ar": (60, 60, 10)}),
            (8, {"hpitch": -4, "al": (80, 40, 10), "props": {"keys": {"vis": 1}}}),
            (12, {"hpitch": 14, "npitch": 12, "lean": 4, "al": (30, 30, 10), "ar": (30, 30, 10)}),
            (13, {"hpitch": 6, "npitch": 6}), (14, {"hpitch": 16, "npitch": 12}), (15, {"hpitch": 8, "npitch": 8})]
    out.append(sequence("finisher", g, keys, 16, 6.4, note="Slightly Conscious (thoughtful nod, 150 f)"))

    keys = [(0, {"drop": 0.02, "al": (10, 20, 10), "ar": (10, 20, 10), "hpitch": 18, "lean": 0})]
    keys += [(6, {"drop": 0.02, "al": (10, 20, 10), "ar": (10, 20, 10), "hpitch": 18, "lean": 0}),
             (9, {"drop": 0.04, "hpitch": 0, "al": (80, 50, 20), "ar": (75, 55, 20), "props": {"keys": {"vis": 1}}}),
             (13, {"props": {"keys": {"vis": 1}}})]
    out.append(sequence("intro", g, keys, 14, 8.0, note="\"We have the compute, we have the team...\""))

    keys = []
    for f in range(12):
        keys.append((f, {"drop": 0.02, "lean": 0, "hpitch": 12 + wave(f, 12, 2), "al": (20, 25, 10),
                         "ar": (30, 70 + wave(f, 12, 4), 30), "cyaw": -20, "ease": "linear"}))
    out.append(sequence("victory", g, keys, 12, 8.0, loop=True, note="\"I lead a very simple life.\" (still, loop)"))
    return out


def animations(fighter_id, sk, cfg, ctx=None):
    if fighter_id != "ilya":
        return {}
    _props.install(PROPS)
    return export(_moves(sk), sk, ctx)
