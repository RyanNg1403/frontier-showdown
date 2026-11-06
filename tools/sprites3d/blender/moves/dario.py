"""Dario Amodei, "The Responsible Scaler" (roster doc 3.2; frame data: src/characters/dario.js).

Upright and earnest: one open palm forward ("please, let's be careful"), the other hand low. Measured,
never flashy; he leans in slightly before every special as if weighing the risk.
"""

from _kit import Kit, box, cylinder, hexagon, merge, put, seq, timing
import _library as lib

TERRACOTTA = "#f29a68"
CREAM = "#f3e7cf"


def make_props(k):
    k.prop("hex_shield", hexagon("hex_shield", 0.17, 0.018, axis="Y"), TERRACOTTA, "hand_l",
           offset=(0.0, 0.07, 0.0), rot=(0, 0, 90), part="prop_back", contrast=0.5)
    k.prop("hex_shield_r", hexagon("hex_shield_r", 0.15, 0.018, axis="Y"), TERRACOTTA, "hand_r",
           offset=(0.0, 0.07, 0.0), rot=(0, 0, 90), contrast=0.5)
    k.prop("scroll", merge("scroll", cylinder("roll", 0.03, 0.26, axis="X"),
                           box("sheet", 0.22, 0.004, 0.2, at=(0, 0, -0.1))),
           CREAM, "hand_r", offset=(0.0, 0.06, 0.02), rot=(0, 0, 0), contrast=0.6)
    k.prop("rack", merge("rack", box("rack", 0.16, 0.12, 0.24),
                         box("lights", 0.13, 0.13, 0.02, at=(0, 0, 0.06))),
           "#2d313a", "hand_l", offset=(0.0, 0.12, 0.0), part="prop_back")


def palm(S, fd, side, target, lean=6.0, vfx=None, extra=None):
    m = lib.jab(S, fd, side=side, target=target, lean=lean, vfx=vfx,
                extra=dict({side + "fist": 0.0}, **(extra or {})))
    return m


def moves(k):
    S = k.stance()
    lean_in = {"spitch": 12.0, "px": 0.03, "npitch": 6.0}
    m = {}

    m["light_punch"] = palm(S, (7, 2, 12), "l", (1.0, 0.02, -0.06))
    m["heavy_punch"] = lib.straight(S, (12, 3, 21), vfx="log_log_trail")
    m["light_kick"] = lib.front_kick(S, (9, 3, 13), height=0.3, reach=0.78, toe=10.0)
    m["heavy_kick"] = lib.roundhouse(S, (15, 4, 23), height=0.78)
    m["crouch_light"] = lib.crouch_jab(S, (7, 2, 12), extra={"lfist": 0.15})
    m["crouch_light_kick"] = lib.crouch_kick(S, (8, 2, 13))
    m["crouch_heavy"] = lib.crouch_launcher(S, (11, 3, 31), side="r", vfx="lab_burst",
                                            extra={"rfist": 0.0, "props": {"hex_shield_r": True}})
    m["crouch_heavy_kick"] = lib.sweep(S, (13, 3, 29))
    m["air_attack"] = lib.air_punch(S, (8, 6, 8), extra={"lh": (0.8, -0.45, -0.05), "rh": (0.82, -0.5, -0.2),
                                                        "lfist": 0.0, "rfist": 0.0})
    m["air_kick"] = lib.air_kick(S, (8, 7, 8))

    # Safeguard Palm: the counter-stance follow-up (engine default anim heavy_punch; data: counter.anim).
    m["safeguard_palm"] = lib.straight(S, (8, 3, 20), step=0.12, vfx="lab_burst",
                                       extra={"rfist": 0.0, "rh": (1.0, 0.0, -0.1)})
    m["safeguard_palm"].note = "ASL Safeguard counter; set parry.counter.anim: 'safeguard_palm' to use it"

    # Throw "Race to the Top": grab, carry the opponent up a glowing ladder, drop them from the top rung.
    grab = {"lh": (0.85, -0.1, -0.05), "rh": (0.8, -0.15, -0.2), "lfist": 1.0, "rfist": 1.0, "spitch": 14.0}
    lift = {"lh": (0.35, 0.85, -0.15), "rh": (0.3, 0.85, -0.3), "spitch": -6.0, "pz": S["pz"] + 0.04}
    climb1 = {"lf": (0.2, 0.1, 0.25), "lfp": 20.0, "pz": S["pz"] + 0.1}
    climb2 = {"lf": S["lf"], "rf": (0.05, 0.14, 0.3), "rfp": 25.0, "pz": S["pz"] + 0.16}
    drop = {"lh": (0.9, 0.3, -0.1), "rh": (0.85, 0.25, -0.25), "lfist": 0.0, "rfist": 0.0, "spitch": 10.0,
            "rf": S["rf"], "pz": S["pz"]}
    m["throw"] = seq(S, [(2, grab, "out", "hit"), (2, lift, "io", "vfx:glowing_ladder"), (2, climb1, "io"),
                         (2, climb2, "io"), (2, drop, "snap"), (3, S, "io")], fps=15)

    # Constitutional Barrier: unrolls the constitution scroll and raises the wall with an open palm.
    kk, a, r = timing(18, 2, 20)
    hold = put(lean_in, rh=(0.5, -0.05, -0.15), rfist=0.6, props={"scroll": True})
    raise_ = {"rh": (0.7, 0.3, -0.15), "lh": (0.95, 0.15, -0.05), "lfist": 0.0, "spitch": 4.0, "px": 0.06,
              "props": {"scroll": True}}
    m["special_1"] = seq(S, [(2, hold, "io"), (kk - 2, put(hold, rh=(0.6, 0.15, -0.15)), "io"),
                             (a, raise_, "snap", ["hit", "vfx:constitution_wall"]), (2, {}, "lin"),
                             (r - 2, put(S, props={}), "io")])
    # Country of Geniuses: a miniature datacenter rack opens and releases the geniuses.
    kk, a, r = timing(17, 2, 30)
    present = put(lean_in, lh=(0.55, -0.15, 0.0), lfist=0.7, rh=(0.45, -0.2, -0.2), rfist=0.2,
                  props={"rack": True})
    release = {"lh": (0.9, 0.0, -0.05), "rh": (0.75, 0.25, -0.15), "rfist": 0.0, "syaw": S["syaw"] + 10,
               "px": 0.06, "props": {"rack": True}}
    m["special_2"] = seq(S, [(kk, present, "io"), (a, release, "snap", ["hit", "vfx:geniuses_release"]),
                             (2, {}, "lin"), (r - 2, put(S, props={}), "io")])
    # ASL Safeguard: counter stance behind a hexagonal shield.
    kk, a, r = timing(4, 18, 26)
    guard = {"lh": (0.6, 0.0, -0.08), "lfist": 0.0, "rh": (0.3, -0.25, -0.15), "spitch": 8.0, "pz": S["pz"] - 0.03,
             "props": {"hex_shield": True}}
    m["special_3"] = seq(S, [(kk, guard, "snap"), (1, {"lh": (0.62, 0.02, -0.08)}, "lin", ["hit", "vfx:amber_hex"]),
                             (a - 1, {"lh": (0.6, -0.01, -0.08), "pz": S["pz"] - 0.035}, "io"),
                             (2, {}, "lin"), (r - 2, put(S, props={}), "io")])

    # Compressed Century: opens a datacenter door; geniuses rush out.
    door = put(lean_in, lh=(0.6, -0.05, 0.25), rh=(0.55, -0.05, -0.45), lfist=0.6, rfist=0.6)
    swing = {"lh": (0.85, 0.05, 0.55), "rh": (0.75, 0.05, -0.75), "lfist": 0.0, "rfist": 0.0, "spitch": 2.0,
             "syaw": S["syaw"] + 20, "px": 0.02}
    present = {"lh": (0.9, 0.2, 0.1), "rh": (0.4, -0.2, -0.1), "syaw": S["syaw"] + 10}
    m["super"] = seq(S, [(2, door, "io"), (1, swing, "snap", ["hit", "vfx:datacenter_door"]),
                         (3, present, "io", "vfx:geniuses_rush"), (3, {}, "lin"), (5, S, "io")])

    # Finisher "Not to Claude": turns to the jumbotron, presents the ad card, polite nod.
    point = {"rh": (0.35, 0.85, 0.25), "rfist": 0.4, "syaw": S["syaw"] + 30, "hpitch": -18.0, "npitch": -8.0}
    present = {"rh": (0.7, 0.1, 0.35), "lh": (0.6, 0.0, 0.2), "rfist": 0.0, "lfist": 0.0, "hpitch": 0.0,
               "npitch": 2.0, "syaw": S["syaw"] + 10}
    nod = {"hpitch": 14.0, "npitch": 8.0, "spitch": 10.0}
    m["finisher"] = seq(S, [(3, point, "io", "vfx:jumbotron_ad_break"), (3, {}, "lin"), (3, present, "io"),
                            (2, nod, "io"), (2, {"hpitch": 0.0, "npitch": 2.0, "spitch": S["spitch"]}, "io"),
                            (2, {}, "lin")], fps=10)

    # Intro: explaining with both hands, twirls a curl, settles into the open-palm guard.
    talk = put(S, pz=-0.03, lh=(0.55, -0.15, 0.15), rh=(0.5, -0.2, -0.05), lfist=0.0, rfist=0.0, spitch=2.0,
               lf=(0.15, 0.1, 0.0), rf=(-0.15, 0.12, 0.0), lfy=8.0, rfy=14.0)
    m["intro"] = seq(talk, [(2, {"lh": (0.6, -0.05, 0.25), "rh": (0.55, -0.1, -0.15)}, "io"),
                            (2, {"lh": (0.5, -0.2, 0.1), "rh": (0.45, -0.25, 0.0)}, "io"),
                            (2, {"rh": (0.0, 0.85, 0.0), "rfist": 0.6, "hpitch": -4.0}, "io"),
                            (2, {"rh": (0.02, 0.88, 0.02)}, "lin"), (3, S, "io"), (1, {}, "lin")], fps=8)
    # Victory: "We don't have to do any code reds." Adjusts his glasses, open-palm shrug.
    rel = put(S, pz=-0.03, lf=(0.15, 0.1, 0.0), rf=(-0.15, 0.12, 0.0), lfy=8.0, rfy=14.0, spitch=1.0,
              lh=(0.1, -0.8, 0.1), rh=(0.1, -0.8, 0.1), lfist=0.3, rfist=0.3)
    m["victory"] = seq(rel, [(2, {"rh": (0.15, 0.7, -0.2), "rfist": 0.7}, "io"),
                             (2, {"rh": (0.17, 0.72, -0.22)}, "lin"),
                             (2, {"rh": (0.5, -0.3, 0.4), "lh": (0.5, -0.3, 0.4), "rfist": 0.0, "lfist": 0.0,
                                  "sroll": 3.0, "hpitch": -6.0}, "io"),
                             (3, {}, "lin"), (2, {"rh": (0.1, -0.8, 0.1), "lh": (0.1, -0.8, 0.1)}, "io")], fps=8)
    return m



def animations(fighter_id, sk, cfg, ctx=None):
    if fighter_id != "dario":
        return {}
    k = Kit(sk, cfg, ctx)
    make_props(k)
    return {name: k.anim(m) for name, m in moves(k).items()}
