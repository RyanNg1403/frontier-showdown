"""Mustafa Suleyman, "The Containment Specialist" (roster doc 3.12): calm presenter, one open hand at a time,
with his amber orb companion. Props: orb, "$100,000" briefcase, the "CONTAINED" terrarium."""

from _group3 import library as lib
from _group3.common import Prop, air_strike, crouch_strike, scripted, sequence, strike, throw, export, load_framedata

HAND = (0.0, 0.0, 0.0)                      # at the grip (hand bone tail)
ORB_SHOULDER = Prop("orb", bone="spine_03", space="rig", offset=(-0.27, -0.12, 0.3))  # beside his near shoulder
COMPOSED = lib.f(lib.RELAXED, lib.STEEPLE, drop=0.04)


def moves(fd):
    n, sp = fd["normals"], fd["specials"]
    return [
        strike("light_punch", n["lp"], lib.JAB_WIND, lib.JAB, reach="al", note="Precise Jab"),
        strike("heavy_punch", n["hp"], lib.f(lib.CROSS_WIND, fist_r=0.0), lib.f(lib.CROSS, lib.PALM_R),
               follow=dict(pfwd=0.1), reach="ar", note="Hex Palm Push"),
        strike("light_kick", n["lk"], dict(lf_f=0.36, lf_h=0.14, lk_up=0.5), lib.LOW_KICK, reach="lf",
               note="Short Low Kick (low)"),
        sequence("heavy_kick", n["hk"], [("wind", lib.CRESCENT_OUT, "in"), ("hit", lib.CRESCENT_TOP, "out"),
                                         ("hold+1", lib.CRESCENT_IN), (0.82, dict(rf_f=-0.2, rf_h=0.12))],
                 reach="rf", note="Crescent Kick: wide outside-in arc"),
        crouch_strike("crouch_light", n["c_lp"], dict(al_sw=60, al_el=125), lib.CROUCH_JAB, reach="al",
                      note="Measured Tap (c.LP)"),
        crouch_strike("crouch_heavy", n["c_hp"], lib.CROUCH_RISE_WIND, lib.CROUCH_RISE, reach="ar",
                      note="Rising Hex: open-palm anti-air"),
        air_strike("air_attack", n["j_k"], dict(lf_f=0.1, lf_h=0.42), lib.AIR_KICK, reach="lf",
                   note="Presenter Kick (j.K)"),
        throw(pull=dict(ar_sw=70, ar_el=40, ar_sp=10, fist_r=0.7), toss=dict(c_yaw=-30),
              props=[Prop("briefcase", bone="hand_r", offset=HAND, frames=("hit+1", 0.7))],
              note="Modern Turing Test: hands over a briefcase and spins them out"),
        sequence("special_1", sp[0], [
            ("wind", lib.f(lib.STEEPLE, drop=0.18), "in"),
            ("hit", lib.f(lib.PUSH_BOTH, al_ah=-0.75, ar_ah=-0.75, al_sp=14, ar_sp=10, c_pitch=14, pfwd=0.03),
             "out"),
            ("hold+2", lib.f(lib.PUSH_BOTH, al_ah=-0.8, ar_ah=-0.8, al_sp=24, ar_sp=20, c_pitch=16, pfwd=0.03))],
            props=[ORB_SHOULDER], note="Containment Field: palms project the hex field onto the floor"),
        sequence("special_2", sp[1], [
            ("wind", lib.f(lib.FRONT_CHAMBER, lf_h=0.24, ar_sw=50, ar_el=60, fist_r=0.0), "in"),
            ("hit", lib.f(lib.LOW_KICK, lf_p=10, ar_sw=60, ar_el=20, ar_sp=30, fist_r=0.0, c_yaw=-20), "out"),
            ("hold+1", lib.f(lib.LOW_KICK, lf_p=10, ar_sw=60, ar_el=20, ar_sp=30, fist_r=0.0, c_yaw=-18))],
            reach="lf", note="The Coming Wave: a low sweep sends the rolling wave"),
        sequence("special_3", sp[2], [
            ("wind", lib.f(lib.PRESENT_L, al_sw=40, al_el=90), "in"),
            ("hit", lib.f(lib.PRESENT_L, al_aim=1.0, al_ah=0.1, al_el=8, pfwd=0.03), "out"),
            ("hold+1", lib.f(lib.PRESENT_L, al_aim=1.0, al_ah=0.1, al_el=12, pfwd=0.03))],
            props=[Prop("orb", bone="hand_l", offset=(0.0, -0.08, 0.0), frames=("start", "hit"))],
            note="Copilot: sends the orb companion out of his open hand"),
        sequence("super", fd["super"], [
            ("wind", lib.f(lib.PULL_BOTH, ar_sw=40, ar_el=80, fist_r=0.8), "in"),
            ("hit", lib.f(lib.PUSH_BOTH, ar_ah=-0.3, al_ah=-0.2, ar_el=20, fist_r=0.8, pfwd=0.16), "out"),
            ("hold-2", lib.f(lib.PUSH_BOTH, ar_ah=-0.3, al_ah=-0.2, ar_el=20, fist_r=0.8, pfwd=0.16)),
            ("hold", lib.f(lib.PRESENT_L, lib.PRESENT_R, ar_sw=40, ar_sp=40, pfwd=0.04)),
            (0.85, lib.f(lib.PRESENT_R, ar_sw=50, ar_sp=30))],
            props=[Prop("briefcase", bone="hand_r", offset=HAND, frames=("start", "hold-2"))], post=10,
            note="Modern Turing Test: offers the briefcase, then presents the agent swarm"),
        scripted("finisher", 18, 8.0, [
            (2, lib.f(lib.SPREAD, al_sp=50, ar_sp=50)),
            (5, lib.f(lib.PUSH_BOTH, al_sp=-30, ar_sp=-28, al_el=60, ar_el=60)),
            (8, lib.f(lib.PULL_BOTH, al_sw=70, ar_sw=70, al_el=95, ar_el=95, al_sp=-18, ar_sp=-16, drop=0.12)),
            (11, lib.f(lib.PUSH_BOTH, al_ah=0.15, ar_ah=0.15, al_el=40, ar_el=40, al_sp=-22, ar_sp=-20, drop=0.1)),
            (13, lib.f(lib.PUSH_BOTH, al_ah=0.35, ar_ah=0.35, al_el=20, ar_el=20, al_sp=-22, ar_sp=-20, drop=0.08,
                       pfwd=0.05)),
            (15, lib.f(COMPOSED, lib.PRESENT_R)), ("end", lib.f(COMPOSED, lib.PRESENT_R))], hit=5,
            props=[Prop("terrarium", bone="hand_r", offset=(0.0, -0.03, 0.0), frames=(8, 13))],
            note="Contained: folds the field into a terrarium and shelves it"),
        scripted("intro", 14, 8.0, [
            ("start", COMPOSED), (5, COMPOSED), (8, lib.f(COMPOSED, lib.PRESENT_R)),
            (11, lib.f(COMPOSED, lib.PRESENT_R, ar_sw=60))], props=[ORB_SHOULDER],
            note="Fingers steepled, orb bobbing, one open presenter hand"),
        scripted("victory", 12, 8.0, [
            (3, COMPOSED), (6, lib.f(COMPOSED, lib.PRESENT_R, ar_sp=30, h_yaw=-20)),
            ("end", lib.f(COMPOSED, lib.PRESENT_R, ar_sp=30, h_yaw=-20))],
            props=[ORB_SHOULDER], note="Composed presenter gesture, orb at his shoulder"),
    ]


def animations(fighter_id, sk, cfg, ctx=None):
    if fighter_id != "mustafa":
        return {}
    return export("mustafa", moves(load_framedata("mustafa")), sk, ctx)
