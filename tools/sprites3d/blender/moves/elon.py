"""Elon Musk, "The Technoking" (roster doc 3.4; frame data: src/characters/elon.js).

Wide, slightly awkward bounce with rolling shoulders; laughs at his own hits. The tallest fighter.
"""

from _kit import Kit, box, cylinder, merge, put, seq, sphere, timing
import _library as lib


def make_props(k):
    torch = merge("flamethrower", cylinder("body", 0.035, 0.42, axis="Y", at=(0, 0.14, 0)),
                  cylinder("nozzle", 0.022, 0.12, axis="Y", at=(0, 0.4, 0)),
                  box("grip", 0.03, 0.05, 0.11, at=(0, 0.0, -0.06)),
                  box("tank", 0.06, 0.16, 0.06, at=(0, 0.08, 0.06)))
    k.prop("flamethrower", torch, "#5a5f6a", "hand_r", offset=(0.0, 0.05, 0.02), rot=(-20, 0, 0))
    k.prop("nozzle_glow", cylinder("glow", 0.026, 0.04, axis="Y", at=(0, 0.47, 0)), "#ff8a1f", "hand_r",
           offset=(0.0, 0.05, 0.02), rot=(-20, 0, 0), contrast=0.4)
    k.prop("steel_ball", sphere("steel_ball", 0.055), "#9aa1ad", "hand_r", offset=(0.0, 0.07, 0.03))
    k.prop("phone", box("phone", 0.08, 0.014, 0.16), "#d5d8de", "hand_r", offset=(0.0, 0.05, 0.035),
           rot=(10, 0, 0), contrast=0.6)


def moves(k):
    S = k.stance()
    C = lib.crouch(S)
    m = {}

    m["light_punch"] = lib.jab(S, (7, 2, 12))
    # Exhaust Haymaker: a wide looping right with an exhaust puff.
    kk, a, r = timing(13, 3, 21)
    wind = {"rh": (-0.25, -0.05, 0.6), "syaw": S["syaw"] - 20, "pyaw": S["pyaw"] - 8,
            "spitch": S["spitch"] - 4}
    hook = {"rh": (0.82, 0.0, 0.15), "syaw": S["syaw"] + 60, "pyaw": S["pyaw"] + 32,
            "spitch": S["spitch"] + 12, "rfp": 30.0, "rtp": 0.0, "px": 0.06, "lh": (0.3, -0.2, -0.1)}
    m["heavy_punch"] = seq(S, [(kk, wind, "in"), (a, hook, "snap", ["hit", "vfx:exhaust_puff"])] + lib.recover(r, S))
    m["light_kick"] = lib.front_kick(S, (9, 3, 16), height=0.36, reach=0.85, toe=5.0)
    m["heavy_kick"] = lib.axe_kick(S, (15, 4, 23), vfx="booster_flame")
    m["crouch_light"] = lib.crouch_jab(S, (7, 2, 12))
    m["crouch_light_kick"] = lib.crouch_kick(S, (8, 2, 15))
    m["crouch_heavy"] = lib.crouch_launcher(S, (10, 4, 28), vfx="rocket_exhaust")
    m["crouch_heavy_kick"] = lib.sweep(S, (14, 3, 28))
    m["air_attack"] = lib.air_punch(S, (8, 6, 8), extra={"rh": (0.8, -0.5, 0.05), "spitch": 26.0})
    m["air_kick"] = lib.air_kick(S, (7, 7, 8))

    # The Walrus (air D+HP, special `the_walrus` on main): a belly-flop dive that ground-bounces.
    flat = put(lib.air(S), ppitch=72.0, spitch=82.0, npitch=40.0, hpitch=20.0, pz=-0.62, px=0.1,
               lf=(-0.55, 0.12, 0.42), rf=(-0.6, 0.18, 0.36), lfp=60.0, rfp=60.0, lko=0.1, rko=0.1,
               lh=(0.35, -0.2, 0.75), rh=(0.3, -0.25, 0.8),
               lfist=0.0, rfist=0.0, pyaw=0.0, syaw=-10.0)
    tuck = put(lib.air(S), spitch=20.0, lh=(0.4, 0.5, 0.3), rh=(0.35, 0.5, 0.2), lfist=0.0, rfist=0.0)
    m["air_dive"] = seq(lib.air(S), [(1, tuck, "out"), (2, put(flat, pz=-0.45), "io"),
                                     (1, flat, "lin", ["hit", "vfx:walrus_dive"]),
                                     (2, put(flat, lh=(0.4, -0.15, 0.85), rh=(0.35, -0.2, 0.9)), "io"),
                                     (1, put(flat, pz=-0.7, spitch=86.0), "snap", "vfx:ground_bounce"),
                                     (2, put(flat, pz=-0.6), "io")], note="The Walrus; set anim: 'air_dive' on the_walrus in the data to use it")

    # F+HK Cybertruck Charge (the data maps it to heavy_punch; this is a dedicated shoulder charge).
    kk, a, r = timing(16, 4, 22)
    load = {"pz": S["pz"] - 0.06, "spitch": 22.0, "syaw": S["syaw"] + 20, "rh": (0.1, -0.5, 0.1)}
    charge = {"px": 0.16, "pz": S["pz"] - 0.08, "spitch": 34.0, "syaw": S["syaw"] + 75, "pyaw": S["pyaw"] + 40,
              "lf": (0.55, 0.15, 0.0), "rf": (-0.45, 0.18, 0.0), "rfp": 45.0, "rtp": 0.0,
              "lh": (0.2, -0.45, -0.3), "rh": (0.15, -0.5, 0.25)}
    m["cybertruck_charge"] = seq(S, [(kk, load, "in"), (a, charge, "snap", ["hit", "vfx:cybertruck_dust"])]
                                 + lib.recover(r, S), note="F+HK; set anim: 'cybertruck_charge' in the data to use it")

    # Throw "Cage Match": lifts the opponent overhead and tosses them.
    grab = {"lh": (0.8, -0.35, -0.05), "rh": (0.75, -0.4, -0.2), "lfist": 1.0, "rfist": 1.0, "spitch": 26.0,
            "pz": S["pz"] - 0.08}
    up = {"lh": (0.25, 0.95, -0.15), "rh": (0.2, 0.95, -0.3), "spitch": -10.0, "pz": S["pz"] + 0.04,
          "hpitch": -14.0}
    toss = {"lh": (0.9, 0.25, -0.1), "rh": (0.85, 0.2, -0.25), "lfist": 0.0, "rfist": 0.0, "spitch": 18.0,
            "px": 0.06, "lf": (S["lf"][0] + 0.1, S["lf"][1], 0.0), "hpitch": 0.0}
    m["throw"] = seq(S, [(2, grab, "out", "hit"), (2, up, "io"), (1, {}, "lin"), (2, toss, "snap"),
                         (1, {}, "lin"), (3, S, "io")], fps=15)

    # Not-a-Flamethrower: braces the torch and sweeps a cartoon flame stream.
    kk, a, r = timing(12, 18, 22)
    aim = {"rh": (0.55, -0.25, -0.1), "lh": (0.62, -0.25, -0.3), "rfist": 1.0, "lfist": 1.0,
           "syaw": S["syaw"] + 20, "pyaw": S["pyaw"] + 10, "spitch": 6.0,
           "props": {"flamethrower": True, "nozzle_glow": True}}
    fire = put(aim, rh=(0.72, -0.12, -0.12), lh=(0.78, -0.12, -0.3), spitch=0.0, px=0.02)
    segs = [(kk, aim, "io"), (1, fire, "snap", ["hit", "vfx:flame_stream"])]
    for dz in (0.06, -0.04, 0.05, -0.05, 0.02):
        segs.append((1, put(fire, rh=(0.72, -0.12 + dz, -0.12), lh=(0.78, -0.12 + dz, -0.3),
                            sroll=S["sroll"] + dz * 40), "io"))
    segs += [(2, {}, "lin"), (r - 2, put(S, props={}), "io")]
    m["special_1"] = seq(S, segs)

    # Mechazilla Catch: chopstick arms rise behind him; he mimes the clamp overhead and pulls it down.
    kk, a, r = timing(7, 6, 34)
    wide = {"lh": (0.1, 0.8, 0.55), "rh": (0.05, 0.8, 0.6), "lfist": 0.0, "rfist": 0.0, "spitch": -6.0,
            "hpitch": -16.0, "pz": S["pz"] + 0.04}
    clamp = {"lh": (0.3, 0.92, -0.1), "rh": (0.25, 0.92, -0.25), "lfist": 1.0, "rfist": 1.0}
    pull = {"lh": (0.5, 0.2, -0.1), "rh": (0.45, 0.15, -0.25), "spitch": 16.0, "pz": S["pz"] - 0.05, "hpitch": 0.0}
    m["special_2"] = seq(S, [(kk, wide, "out", "vfx:mechazilla_arms"), (a, clamp, "snap", "hit"), (2, {}, "lin"),
                             (2, pull, "io"), (r - 4, S, "io")])

    # Armor Glass: lobs the steel ball in an arc (the Cybertruck window demo).
    kk, a, r = timing(18, 2, 28)
    wind = {"rh": (-0.35, 0.3, 0.3), "syaw": S["syaw"] - 26, "pyaw": S["pyaw"] - 10,
            "spitch": 0.0, "lh": (0.7, 0.1, -0.05), "lfist": 0.0, "props": {"steel_ball": True}}
    release = {"rh": (0.9, 0.45, -0.1), "syaw": S["syaw"] + 50, "pyaw": S["pyaw"] + 26,
               "spitch": 14.0, "rfp": 30.0, "rtp": 0.0, "px": 0.06, "rfist": 0.0, "props": {}}
    m["special_3"] = seq(S, [(1, {"props": {"steel_ball": True}}, "lin"), (kk - 1, wind, "io"),
                             (a, release, "snap", ["hit", "vfx:steel_ball_lob"])] + lib.recover(r, S))

    # Colossus Launch: server racks slam up, a jumping uppercut flurry onto the Starship, a landing.
    segs = [(2, put(C, rh=(0.2, -0.55, 0.0), spitch=30.0), "in", "vfx:colossus_racks")]
    for i in range(4):
        side, other = ("rh", "lh") if i % 2 == 0 else ("lh", "rh")
        segs.append((1, {side: (0.45, 0.95, -0.12), other: (0.4, -0.1, -0.1), "pz": S["pz"] + 0.1 + 0.12 * i,
                         "spitch": -6.0, "lf": (0.2, 0.12, 0.08 + 0.12 * i), "rf": (-0.1, 0.16, 0.2 + 0.12 * i),
                         "lfp": 30.0, "rfp": 40.0, "syaw": S["syaw"] + (30 if side == "rh" else -10)},
                     "snap", "hit" if i == 0 else []))
    segs.append((2, {"rh": (0.3, 0.95, 0.1), "lh": (0.2, -0.4, 0.3), "hpitch": -30.0, "npitch": -14.0},
                 "out", "vfx:starship_launch"))
    segs.append((3, put(C, hpitch=-24.0, npitch=-10.0), "in"))
    segs.append((3, S, "io"))
    m["super"] = seq(S, segs)

    # Finisher "To the Moon": the Shiba rocket lands; he salutes it off and watches it go, laughing.
    salute = {"rh": (0.05, 0.75, -0.25), "rfist": 0.0, "pz": -0.04, "spitch": 0.0,
              "lf": (0.2, 0.12, 0.0), "rf": (-0.2, 0.14, 0.0)}
    watch = {"rh": (0.5, 0.85, 0.1), "hpitch": -32.0, "npitch": -16.0, "spitch": -8.0}
    laugh = {"spitch": 10.0, "hpitch": -10.0, "lh": (0.3, -0.45, 0.1), "rh": (0.25, -0.4, 0.0), "rfist": 0.6}
    m["finisher"] = seq(S, [(3, salute, "io", "vfx:shiba_rocket"), (2, {}, "lin"), (3, watch, "io"),
                            (2, {}, "lin", "vfx:moon_flag"), (2, laugh, "io"),
                            (1, {"spitch": 4.0}, "lin"), (1, {"spitch": 10.0}, "lin"), (2, {}, "lin")], fps=10)

    # Intro: glances at his phone and chuckles, then rolls his shoulders into the stance.
    phone = put(S, pz=-0.03, spitch=4.0, lf=(0.14, 0.11, 0.0), rf=(-0.16, 0.13, 0.0), lfy=10.0, rfy=16.0,
                rh=(0.45, -0.15, -0.1), lh=(0.0, -0.8, 0.12), rfist=0.6, lfist=0.3, hpitch=16.0, npitch=8.0,
                props={"phone": True})
    m["intro"] = seq(phone, [(2, {}, "lin"), (1, {"spitch": 10.0, "hpitch": 10.0}, "io"),
                             (1, {"spitch": 4.0, "hpitch": 16.0}, "io"), (1, {"spitch": 10.0}, "io"),
                             (2, {"rh": (0.0, -0.75, 0.1), "props": {}, "hpitch": 0.0, "npitch": 2.0}, "io"),
                             (2, put(S, sroll=-4.0), "io"), (2, put(S, sroll=5.0), "io"), (1, S, "io")], fps=8)
    # Victory: "To the moon!" Points at the sky, laughing.
    point = put(S, pz=-0.03, spitch=-6.0, lf=(0.18, 0.12, 0.0), rf=(-0.2, 0.14, 0.0), lfy=10.0, rfy=16.0,
                rh=(0.35, 0.95, -0.05), rfist=0.3, lh=(-0.05, -0.55, 0.35), lfist=0.6,
                hpitch=-20.0, npitch=-10.0)
    m["victory"] = seq(S, [(3, point, "out", "vfx:to_the_moon"), (2, {}, "lin"),
                           (1, {"spitch": 2.0, "hpitch": -12.0}, "io"), (1, {"spitch": -6.0, "hpitch": -20.0}, "io"),
                           (1, {"spitch": 2.0, "hpitch": -12.0}, "io"), (3, {}, "lin")], fps=8)
    return m


HEADS = {"super": "shout", "victory": "victory"}


def animations(fighter_id, sk, cfg, ctx=None):
    if fighter_id != "elon":
        return {}
    k = Kit(sk, cfg, ctx)
    make_props(k)
    return {name: k.anim(m, head=HEADS.get(name, "threequarter")) for name, m in moves(k).items()}
