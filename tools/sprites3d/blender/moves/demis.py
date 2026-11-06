"""Demis Hassabis, "The Grandmaster" (roster doc 3.5).

Timing: `src/characters/demis.js` on the Group B branch (`cursor/group-b-fighters-afea`); demis is not on main
yet. Retime by editing the FD table below.

A chess player at the board: still, upright, one hand behind the back, the other holding a Go stone
between two fingers. Never rushes; every step looks pre-computed.
"""

from _kit import Kit, cylinder, put, seq, sphere, timing
import _library as lib

FD = {
    "lp": (6, 2, 11), "hp": (12, 3, 21), "lk": (9, 3, 15), "hk": (14, 4, 22),
    "c_lp": (7, 2, 12), "c_lk": (8, 2, 14), "c_hp": (10, 3, 29), "c_hk": (13, 3, 28),
    "j_p": (8, 6, 8), "j_k": (7, 7, 8), "f_hk": (20, 3, 20),
    "move_37": (20, 2, 18), "alphafold": (18, 2, 30), "self_play": (14, 2, 16), "super": (9, 30, 52),
}
INDIGO = "#8b7cff"


def make_props(k):
    k.prop("stone", sphere("stone", 0.03, squash=(1, 1, 0.5)), "#f4f1ea", "hand_r", offset=(0.0, 0.085, 0.02),
           contrast=0.5)
    k.prop("bowl", cylinder("bowl", 0.08, 0.06, axis="Z", radius2=0.06), "#9a6a3c", "hand_l",
           offset=(0.0, 0.06, -0.03), part="hand_far")
    k.prop("medal", cylinder("medal", 0.04, 0.008, axis="Y"), "#d4af37", "hand_r", offset=(0.0, 0.08, 0.02),
           rot=(0, 0, 90), contrast=0.6)


def moves(k):
    stone = {"stone": True}
    S = k.stance()
    m = {}

    m["light_punch"] = lib.jab(S, FD["lp"], side="r", target=(1.0, 0.05, -0.15),
                               extra={"rfist": 0.25, "syaw": S["syaw"] + 20})  # precise finger-jab
    m["heavy_punch"] = lib.straight(S, FD["hp"], vfx="grid_square",
                                    extra={"rfist": 0.0, "rh": (1.0, 0.0, -0.12), "lh": S["lh"]})  # palm strike
    m["light_kick"] = lib.front_kick(S, FD["lk"], height=0.3, reach=0.78, toe=15.0,
                                     extra={"lh": S["lh"], "rh": S["rh"]})
    m["heavy_kick"] = lib.roundhouse(S, FD["hk"], height=0.72, extra={"lh": (0.3, -0.05, 0.25), "props": stone})
    m["crouch_light"] = lib.crouch_jab(S, FD["c_lp"], side="r", target=(0.98, -0.32, -0.12), extra={"rfist": 0.25})
    m["crouch_light_kick"] = lib.crouch_kick(S, FD["c_lk"])
    # Rising stone flick (cr.HP anti-air).
    m["crouch_heavy"] = lib.crouch_launcher(S, FD["c_hp"], side="r", vfx="stone_flick",
                                            extra={"rfist": 0.3, "props": stone})
    m["crouch_heavy_kick"] = lib.sweep(S, FD["c_hk"])
    m["air_attack"] = lib.air_punch(S, FD["j_p"], extra={"rfist": 0.0})
    m["air_kick"] = lib.air_kick(S, FD["j_k"])

    # "Knight's Move" (F+HK overhead): an L-shaped hop, up, then forward and down onto the opponent.
    kk, a, r = timing(*FD["f_hk"])
    hop = {"pz": S["pz"] + 0.22, "lf": (0.2, 0.11, 0.3), "rf": (-0.15, 0.14, 0.36), "lfp": 30.0, "rfp": 40.0,
           "spitch": -4.0}
    strike = {"lf": (0.85, 0.08, 0.35), "lfp": 40.0, "rf": (-0.1, 0.14, 0.45), "spitch": 6.0, "pz": S["pz"] + 0.18,
              "px": 0.08}
    m["knights_move"] = seq(S, [(1, put(S, pz=S["pz"] - 0.06), "in"), (kk - 1, hop, "out"),
                                (a, strike, "snap", ["hit", "vfx:knight_l_trail"]), (2, put(S, pz=S["pz"] - 0.05), "in"),
                                (r - 2, S, "io")], note="F+HK; set anim: 'knights_move' in the data to use it")

    # Throw "Pentamind": five rapid feints, then a sweep.
    segs = [(1, {"rh": (0.7, -0.1, -0.1), "lh": (0.5, -0.2, 0.0), "lfist": 0.3}, "snap", "hit")]
    for i in range(4):
        segs.append((1, {"rh": (0.75 - 0.25 * (i % 2), 0.1 - 0.2 * (i % 2), -0.1),
                         "lh": (0.4 + 0.3 * (i % 2), -0.2 + 0.25 * (i % 2), 0.0),
                         "syaw": S["syaw"] + (10 if i % 2 else -10)}, "snap"))
    segs.append((2, {"lh": (0.5, -0.5, 0.2), "pz": S["pz"] - 0.2, "pyaw": S["pyaw"] + 60, "syaw": S["syaw"] + 40,
                     "rf": (0.8, 0.0, 0.03), "rfp": 30.0, "lfy": 70.0, "spitch": 20.0}, "snap", "vfx:pentamind_sweep"))
    segs += [(1, {}, "lin"), (3, S, "io")]
    m["throw"] = seq(S, segs, fps=15)

    # Move 37: flicks a Go stone onto the floor.
    kk, a, r = timing(*FD["move_37"])
    lift = {"rh": (0.45, 0.35, -0.12), "spitch": -2.0, "hpitch": 6.0, "props": stone}
    flick = {"rh": (0.9, -0.4, -0.15), "rfist": 0.2, "spitch": 14.0, "px": 0.03, "props": {}}
    m["special_1"] = seq(S, [(kk, lift, "io"), (a, flick, "snap", ["hit", "vfx:go_stone_place"])]
                         + lib.recover(r, S))
    # AlphaFold: a sweeping hand draws out the ribbon of amino-acid beads.
    kk, a, r = timing(*FD["alphafold"])
    coil1 = {"rh": (0.3, 0.2, 0.25), "rfist": 0.0, "syaw": S["syaw"] - 16, "props": {}}
    coil2 = {"rh": (0.45, -0.35, -0.1), "syaw": S["syaw"] - 6}
    send = {"rh": (1.0, 0.0, -0.15), "syaw": S["syaw"] + 34, "pyaw": S["pyaw"] + 16, "spitch": 8.0, "px": 0.05}
    m["special_2"] = seq(S, [(kk // 2, coil1, "io"), (kk - kk // 2, coil2, "io"),
                             (a, send, "snap", ["hit", "vfx:protein_ribbon"])] + lib.recover(r, S))
    # Self-Play: two fingers to the temple, then an open palm releases the indigo echo.
    kk, a, r = timing(*FD["self_play"])
    think = {"rh": (0.1, 0.62, -0.42), "rfist": 0.6, "hpitch": 8.0, "props": {}}
    release = {"rh": (0.6, 0.0, 0.5), "rfist": 0.0, "hpitch": 0.0, "syaw": S["syaw"] - 10, "pz": S["pz"] - 0.02}
    m["special_3"] = seq(S, [(kk, think, "io"), (a, release, "snap", ["hit", "vfx:self_play_echo"])]
                         + lib.recover(r, S))

    # Promptable World Event: a spoken prompt, the world regenerates, events fire.
    kk, a, r = timing(*FD["super"])
    prompt = {"rh": (0.4, 0.75, -0.1), "rfist": 0.3, "hpitch": -10.0, "props": {}}
    sweep = {"lh": (0.4, 0.3, 0.75), "rh": (0.45, 0.3, 0.75), "lfist": 0.0, "rfist": 0.0,
             "spitch": -4.0, "syaw": S["syaw"] + 10}
    point = {"rh": (1.0, 0.1, -0.12), "rfist": 0.4, "lh": (-0.35, -0.6, -0.1), "lfist": 0.4, "spitch": 6.0}
    m["super"] = seq(S, [(kk, prompt, "io", "vfx:prompt_spoken"), (2, sweep, "out", ["hit", "vfx:world_regenerates"]),
                         (2, {}, "lin"), (2, point, "snap", "vfx:chess_rain"), (1, {}, "lin", "vfx:go_board_tilt"),
                         (2, {"rh": (0.95, -0.1, -0.12)}, "io", "vfx:atari_wall"), (2, {}, "lin"), (3, S, "io")])

    # Finisher "Resigns": takes a stone from the bowl and places it to close the capture; a small bow.
    bowl = put(S, lh=(0.4, -0.25, -0.05), lfist=0.7, rh=(0.42, -0.2, -0.2), props={"bowl": True})
    take = {"rh": (0.42, -0.25, -0.15), "props": {"bowl": True, "stone": True}}
    place = {"rh": (0.95, -0.55, -0.12), "spitch": 18.0, "rfist": 0.3, "props": {"bowl": True}}
    bow = {"spitch": 22.0, "npitch": 10.0, "hpitch": 12.0, "rh": (0.3, -0.5, -0.1)}
    m["finisher"] = seq(S, [(3, bowl, "io", "vfx:go_board_floor"), (2, take, "io"), (3, place, "io", "vfx:capture"),
                            (2, {}, "lin"), (3, bow, "io", "vfx:opponent_resigns"), (2, {}, "lin"),
                            (2, put(S, props={"bowl": True}), "io")], fps=10)

    # Intro: checks one of his two watches, then the hand goes behind the back and the stone appears.
    watch = put(S, lh=(0.35, -0.05, -0.25), lfist=0.6, rh=(0.42, -0.0, -0.3), rfist=0.4,
                hpitch=16.0, npitch=8.0, props={})
    m["intro"] = seq(watch, [(3, {}, "lin"), (2, {"hpitch": 0.0, "npitch": 2.0}, "io"),
                             (3, put(S, props={}), "io"), (2, {"props": stone}, "lin", "vfx:stone_appears"),
                             (2, {}, "lin")], fps=8)
    # Victory: holds up a small gold medal, then a short, reserved bow.
    m["victory"] = seq(S, [(3, {"rh": (0.45, 0.6, -0.1), "rfist": 0.6, "props": {"medal": True}, "hpitch": -8.0},
                            "io", "vfx:gold_medal_glint"),
                           (3, {}, "lin"),
                           (2, {"rh": (0.35, -0.3, -0.15), "spitch": 18.0, "npitch": 10.0, "hpitch": 10.0}, "io"),
                           (3, put(S, props={"medal": True}), "io")], fps=8)
    return m


HEADS = {"super": "shout", "victory": "victory"}


def animations(fighter_id, sk, cfg, ctx=None):
    if fighter_id != "demis":
        return {}
    k = Kit(sk, cfg, ctx)
    make_props(k)
    return {name: k.anim(m, head=HEADS.get(name, "threequarter")) for name, m in moves(k).items()}
