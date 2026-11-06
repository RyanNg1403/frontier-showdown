"""Mark Zuckerberg, "Send Me Location" (roster doc 3.3; frame data: src/characters/mark.js).

Low, bouncing grappler stance with open hands forward, eyes on the opponent's hips; barefoot in a gi.
"""

from _kit import Kit, box, cylinder, merge, put, seq, timing
import _library as lib

META_BLUE = "#1877f2"


def make_props(k):
    k.prop("hydrofoil", box("deck", 0.5, 1.15, 0.05), META_BLUE, "Root", offset=(0.0, -0.02, 0.36),
           space="armature", part="prop_front", contrast=0.7)
    foil = merge("foil", box("mast", 0.03, 0.07, 0.34, at=(0, 0.1, -0.19)),
                 box("wing", 0.5, 0.16, 0.02, at=(0, 0.04, -0.36)))
    k.prop("foil", foil, "#30343c", "Root", offset=(0.0, -0.02, 0.36), space="armature", part="prop_back")
    k.prop("board_hand", box("board_hand", 0.42, 0.04, 0.8), META_BLUE, "hand_r", offset=(0.0, 0.08, 0.04),
           contrast=0.7)
    k.prop("sunscreen", cylinder("sunscreen", 0.022, 0.12, axis="Y"), "#f4f4f0", "hand_l",
           offset=(0.0, 0.06, 0.0), part="prop_back", contrast=0.5)
    k.prop("phone", box("phone", 0.08, 0.014, 0.16), "#d5d8de", "hand_r", offset=(0.0, 0.05, 0.035),
           rot=(10, 0, 0), contrast=0.6)


def moves(k):
    S = k.stance()
    C = lib.crouch(S)
    m = {}

    m["light_punch"] = lib.jab(S, (6, 2, 11), extra={"lfist": 1.0})
    m["heavy_punch"] = lib.straight(S, (12, 3, 21), overhand=True, extra={"rfist": 1.0})
    m["light_kick"] = lib.front_kick(S, (9, 3, 16), height=0.5, reach=0.85, teep=True)
    m["heavy_kick"] = lib.low_kick(S, (13, 3, 22))
    m["crouch_light"] = lib.crouch_jab(S, (7, 2, 12), extra={"lfist": 1.0})

    # Ankle pick (cr.LK): level change and the lead hand snatches at ankle height.
    kk, a, r = timing(8, 2, 15)
    pick = {"lh": (0.95, -1.0, 0.02), "lfist": 0.6, "spitch": 42.0, "pz": C["pz"] - 0.04,
            "lf": (0.45, 0.17, 0.0), "px": 0.04, "rh": (0.4, -0.4, -0.1)}
    m["crouch_light_kick"] = seq(C, [(kk, {"lh": (0.6, -0.7, 0.05), "spitch": 34.0}, "in"),
                                     (a, pick, "snap", "hit")] + lib.recover(r, C))
    m["crouch_light_kick"].note = "Ankle Pick (cr.LK), a hand move"

    # Double-underhook lift (cr.HP launcher): both arms scoop under and lift as he stands.
    kk, a, r = timing(10, 4, 28)
    scoop = {"lh": (0.7, -0.75, -0.05), "rh": (0.65, -0.8, -0.2), "lfist": 0.4, "rfist": 0.4, "pz": C["pz"] - 0.04,
             "spitch": 36.0}
    lift = {"lh": (0.6, 0.45, -0.1), "rh": (0.55, 0.4, -0.25),
            "pz": S["pz"] + 0.06, "spitch": -8.0, "ppitch": -2.0, "hpitch": -10.0, "rfp": 30.0, "rtp": 0.0}
    m["crouch_heavy"] = seq(C, [(kk, scoop, "in"), (a, lift, "snap", "hit"), (2, {}, "lin"),
                                (r - 2, C, "io")])
    m["crouch_heavy_kick"] = lib.sweep(S, (13, 3, 28))
    m["air_attack"] = lib.knee(S, (8, 6, 8), airborne=True)
    m["air_kick"] = lib.air_kick(S, (7, 7, 8), extra={"lfp": -40.0})

    # Throw "Back Take": spins behind and locks a seatbelt grip; "+4" flashes.
    reach = {"lh": (0.85, -0.2, 0.0), "rh": (0.8, -0.25, -0.15), "lfist": 0.5, "rfist": 0.5, "px": 0.04}
    spin = {"pyaw": 60.0, "syaw": 80.0, "rf": (0.25, 0.25, 0.0), "rfy": 70.0, "lfy": 60.0, "px": 0.1,
            "lh": (0.7, 0.0, -0.4), "rh": (0.6, -0.3, 0.1)}
    belt = {"lh": (0.35, -0.05, -0.55), "rh": (0.4, -0.35, -0.35), "lfist": 1.0, "rfist": 1.0, "spitch": 22.0,
            "pz": S["pz"] - 0.03}
    m["throw"] = seq(S, [(2, reach, "out", "hit"), (2, spin, "io"), (2, belt, "io", "vfx:bjj_scoreboard_plus4"),
                         (3, {}, "lin"), (3, S, "io")], fps=15)

    # Send Me Location: map pin, level change, penetration step, double-leg takedown, pin.
    kk, a, r = timing(6, 2, 46)
    level = {"pz": S["pz"] - 0.2, "spitch": 40.0, "lh": (0.7, -0.6, 0.15), "rh": (0.65, -0.65, -0.05),
             "lfist": 0.3, "rfist": 0.3}
    shoot = {"lf": (0.62, 0.15, 0.0), "rf": (-0.5, 0.18, 0.0), "rfp": 50.0, "rtp": 0.0, "px": 0.2,
             "pz": S["pz"] - 0.3, "spitch": 52.0, "lh": (0.85, -0.75, 0.3), "rh": (0.8, -0.8, -0.25),
             "lfist": 1.0, "rfist": 1.0}
    drive = {"px": 0.32, "pz": S["pz"] - 0.24, "spitch": 44.0, "rf": (0.0, 0.18, 0.0), "rfp": 30.0,
             "lh": (0.6, -0.55, 0.25), "rh": (0.55, -0.6, -0.2)}
    pin = {"px": 0.4, "pz": S["pz"] - 0.5, "spitch": 60.0, "lf": (0.3, 0.2, 0.0), "rf": (-0.35, 0.2, 0.0),
           "rfp": 60.0, "lh": (0.75, -0.95, 0.3), "rh": (0.7, -0.95, -0.2), "lfist": 0.2, "rfist": 0.2,
           "hpitch": -18.0}
    m["special_1"] = seq(S, [(1, put(level, lh=(0.9, 0.2, 0.0), lfist=0.0), "io", "vfx:map_pin"),
                             (kk, shoot, "snap", "hit"), (2, drive, "io"), (3, pin, "io", "vfx:scoreboard_pinned"),
                             (3, {}, "lin"), (4, S, "io")])

    # Hydrofoil Rush: hops onto the board, glides across a spray, ends in a low slide tackle.
    kk, a, r = timing(14, 20, 24)
    surf = {"lf": (0.2, 0.15, 0.36), "rf": (-0.22, 0.12, 0.36), "lfp": 0.0, "rfp": 0.0, "lfy": 70.0, "rfy": 80.0,
            "pz": S["pz"] + 0.18, "pyaw": 30.0, "syaw": 10.0, "spitch": 14.0, "lh": (0.4, -0.2, 0.75),
            "rh": (-0.3, -0.25, 0.7), "lfist": 0.0, "rfist": 0.0, "props": {"hydrofoil": True, "foil": True}}
    hop = put(surf, pz=S["pz"] + 0.3, lf=(0.2, 0.15, 0.55), rf=(-0.22, 0.12, 0.55))
    slide = {"lf": (0.85, 0.1, 0.03), "lfp": -20.0, "rf": (-0.05, 0.16, 0.0), "rfp": 60.0, "rtp": 0.0,
             "pz": S["pz"] - 0.55, "ppitch": -20.0, "spitch": -24.0, "pyaw": S["pyaw"], "syaw": S["syaw"],
             "lfy": 10.0, "rfy": 40.0, "lh": (0.1, -0.95, 0.3), "rh": (0.0, -0.9, 0.2), "props": {}}
    m["special_2"] = seq(S, [(2, put(S, pz=S["pz"] - 0.08, spitch=24.0), "in"), (2, hop, "out"),
                             (1, surf, "in", ["hit", "vfx:water_spray"]),
                             (2, put(surf, pz=surf["pz"] + 0.02, lh=(0.45, -0.1, 0.8)), "io"),
                             (2, put(surf, pz=surf["pz"] - 0.01), "io"), (2, slide, "snap", "vfx:slide_splash"),
                             (2, {}, "lin"), (4, S, "io")])

    # Move Fast and Break Things: four-punch flurry finishing with a shoulder.
    kk, a, r = timing(13, 10, 22)
    segs = [(kk, {"lh": (0.4, -0.15, 0.0), "rh": (0.35, -0.2, -0.15), "lfist": 1.0, "rfist": 1.0,
                  "spitch": 20.0, "px": 0.03}, "in")]
    for i in range(4):
        side, other = ("lh", "rh") if i % 2 == 0 else ("rh", "lh")
        segs.append((1, {side: (0.98, -0.08 - 0.06 * (i % 2), -0.1), other: (0.35, -0.2, -0.15),
                         "syaw": S["syaw"] + (-8 if side == "lh" else 34), "px": 0.05 + 0.03 * i},
                     "snap", "hit" if i == 0 else []))
    segs.append((2, {"syaw": S["syaw"] + 70, "pyaw": S["pyaw"] + 40, "spitch": 26.0, "px": 0.22,
                     "rh": (0.3, -0.2, 0.2), "lh": (0.2, -0.3, -0.3), "rfp": 40.0, "rtp": 0.0,
                     "lf": (S["lf"][0] + 0.15, S["lf"][1], 0.0)}, "snap", "vfx:guard_crush"))
    segs += lib.recover(r, S)
    m["special_3"] = seq(S, segs)

    # Metaverse Submission: shoot in, mount, armbar position, the tap, a sportsmanlike fist bump.
    mount = {"px": 0.35, "pz": S["pz"] - 0.55, "spitch": 30.0, "lf": (0.15, 0.3, 0.0), "rf": (-0.3, 0.3, 0.0),
             "rfp": 60.0, "lfp": 40.0, "lh": (0.8, -0.85, 0.2), "rh": (0.75, -0.85, -0.2), "lfist": 0.2,
             "rfist": 0.2}
    armbar = {"pz": S["pz"] - 0.62, "spitch": -26.0, "ppitch": -20.0, "lh": (0.45, -0.05, -0.05),
              "rh": (0.4, -0.1, -0.2), "lfist": 1.0, "rfist": 1.0, "lf": (0.7, 0.1, 0.12), "lfp": 10.0,
              "hpitch": 8.0}
    bump = put(S, rh=(1.0, -0.05, -0.15), rfist=1.0, syaw=S["syaw"] + 30, px=0.04, spitch=6.0, pz=S["pz"] + 0.06)
    m["super"] = seq(S, [(1, put(shoot, px=0.12), "snap", ["hit", "vfx:vr_dojo"]), (2, mount, "io"),
                         (2, {"lh": (0.8, -0.95, 0.25), "rh": (0.7, -0.95, -0.25)}, "lin"),
                         (3, armbar, "io", "vfx:opponent_taps"), (2, {}, "lin"),
                         (3, bump, "io", "vfx:gold_no_gi"), (2, {}, "lin"), (3, S, "io")])

    # Finisher "Fourth of July": hands over a hydrofoil board, a stripe of sunscreen, a wave goodbye.
    give = {"rh": (0.85, -0.1, -0.1), "rfist": 0.8, "spitch": 8.0, "props": {"board_hand": True}, "px": 0.03}
    dab = {"lh": (0.98, 0.3, -0.05), "lfist": 0.7, "props": {"sunscreen": True}, "syaw": S["syaw"] - 10}
    wave = put(S, pz=-0.05, spitch=4.0, rh=(0.35, 0.85, 0.2), rfist=0.0, props={})
    m["finisher"] = seq(S, [(3, give, "io"), (2, {}, "lin", "vfx:hydrofoil_handoff"),
                            (2, put(dab, rh=S["rh"], props={"sunscreen": True}), "io"),
                            (2, {"lh": (0.98, 0.2, 0.05)}, "io", "vfx:sunscreen_stripe"),
                            (2, wave, "io", "vfx:cartoon_wave"), (1, {"rh": (0.45, 0.8, 0.35)}, "lin"),
                            (1, {"rh": (0.35, 0.85, 0.15)}, "lin"), (1, {"rh": (0.45, 0.8, 0.35)}, "lin"),
                            (2, {}, "lin")], fps=10)

    # Intro: "Send me location." Types it on his phone, pockets it, drops into the grappler stance.
    phone = put(S, pz=-0.03, spitch=3.0, ppitch=2.0, lf=(0.12, 0.1, 0.0), rf=(-0.14, 0.12, 0.0), lfy=8.0,
                rfy=14.0, rh=(0.45, -0.15, -0.1), lh=(0.42, -0.2, -0.2), lfist=0.3, rfist=0.6,
                hpitch=14.0, npitch=8.0, props={"phone": True})
    m["intro"] = seq(phone, [(2, {"lh": (0.44, -0.16, -0.18)}, "lin"), (2, {"lh": (0.42, -0.2, -0.2)}, "lin"),
                             (2, {"hpitch": -6.0, "npitch": 0.0, "rh": (0.0, -0.7, 0.1), "props": {}}, "io"),
                             (3, S, "io"), (1, {"pz": S["pz"] + 0.03}, "io"), (1, {"pz": S["pz"]}, "io")], fps=8)
    # Victory: "Senator, we run ads." Both fists up, then a grin with hands on the hips.
    m["victory"] = seq(S, [(2, {"lh": (0.25, 0.95, 0.25), "rh": (0.2, 0.95, 0.35), "lfist": 1.0, "rfist": 1.0,
                                "pz": -0.02, "spitch": -4.0, "lf": (0.18, 0.12, 0.0), "rf": (-0.2, 0.14, 0.0),
                                "hpitch": -10.0}, "out", "vfx:gold_no_gi"),
                           (2, {}, "lin"),
                           (3, {"lh": (-0.05, -0.6, 0.35), "rh": (-0.05, -0.6, 0.35), "spitch": 2.0, "hpitch": 0.0}, "io"),
                           (4, {}, "lin")], fps=8)
    return m



def animations(fighter_id, sk, cfg, ctx=None):
    if fighter_id != "mark":
        return {}
    k = Kit(sk, cfg, ctx)
    make_props(k)
    return {name: k.anim(m) for name, m in moves(k).items()}
