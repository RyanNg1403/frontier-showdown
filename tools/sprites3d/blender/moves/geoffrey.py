"""Geoffrey Hinton, "Godfather of AI" (roster doc 3.13): the professor at the front of the lecture hall, upright,
long deliberate pokes. Props: chalk, the glass flask (finisher), the gold medal (victory)."""

from _group3 import library as lib
from _group3.common import Prop, air_strike, crouch_strike, scripted, sequence, strike, throw, export, load_framedata

HAND = (0.0, 0.0, 0.0)
BEHIND_BACK = dict(ar_sw=-38, ar_el=95, ar_sp=-22, fist_r=0.4)
LECTURE = lib.f(lib.RELAXED, BEHIND_BACK, al_sw=105, al_el=115, al_sp=6, fist_l=0.55, c_pitch=0, h_pitch=-2,
                drop=0.02)
POINT_L = dict(fist_l=0.55)
CHALK = Prop("chalk", bone="hand_r", offset=(0.0, 0.02, 0.0), upright=False)


def moves(fd):
    n, sp = fd["normals"], fd["specials"]
    return [
        strike("light_punch", n["lp"], lib.f(lib.JAB_WIND, POINT_L), lib.f(lib.JAB, POINT_L, c_pitch=2),
               reach="al", note="Finger-Point Jab"),
        strike("heavy_punch", n["hp"], lib.SWIPE_WIND, lib.SWIPE, follow=dict(ar_sp=-30, pfwd=0.08), reach="ar",
               props=[CHALK], note="Chalk-Hand Swipe: long open-hand arc"),
        strike("light_kick", n["lk"], lib.FRONT_CHAMBER, lib.f(lib.FRONT_KICK, c_pitch=-4), reach="lf",
               note="Long Straight Kick"),
        strike("heavy_kick", n["hk"], dict(drop=0.3, rf_f=-0.2, c_pitch=14), lib.LONG_SWEEP,
               follow=dict(lib.LONG_SWEEP, rf_l=0.12), reach="rf", note="Lecture-Hall Sweep: the longest normal"),
        strike("heavy_punch_forward", n["f_hp"], lib.OVER_WIND, lib.OVERHEAD, reach="ar", props=[CHALK],
               note="Capsule (F+HP overhead)"),
        crouch_strike("crouch_light", n["c_lp"], lib.f(dict(al_sw=60, al_el=125), POINT_L),
                      lib.f(lib.CROUCH_JAB, POINT_L), reach="al", note="Pointer Tap (c.LP)"),
        crouch_strike("crouch_heavy", n["c_hp"], lib.CROUCH_RISE_WIND, lib.CROUCH_RISE, reach="ar",
                      note="Gradient Ascent: rising palm anti-air"),
        air_strike("air_attack", n["j_k"], dict(lf_f=0.1, lf_h=0.42), lib.AIR_KICK, reach="lf",
                   note="Professorial Boot (j.K)"),
        throw(toss=lib.f(lib.SPREAD, pfwd=0.06), note="t-SNE: scatters the opponent into dots"),
        sequence("special_1", sp[0], [
            ("wind", lib.f(BEHIND_BACK, al_sw=95, al_el=105, fist_l=0.0), "in"),
            ("hit", lib.f(BEHIND_BACK, lib.RAISE_L, al_sw=112, al_el=70, c_pitch=-2, drop=0.14), "out"),
            ("hold", lib.f(BEHIND_BACK, lib.RAISE_L, al_sw=114, al_el=68, c_pitch=-3, drop=0.14))],
            note="Backpropagation: raises a hand as the network diagram appears (counter window)"),
        sequence("special_2", sp[1], [
            (1, dict(drop=0.24, c_pitch=14, al_sw=40, al_el=130, ar_sw=30, ar_el=130)),
            ("wind", dict(drop=0.28, c_pitch=18, al_sw=36, al_el=134, ar_sw=28, ar_el=134), "in"),
            ("hit", lib.f(lib.CROSS, lib.PALM_R, pfwd=0.1), "out"),
            ("hold", lib.f(lib.CROSS, lib.PALM_R, pfwd=0.1))],
            note="Dropout: blinks out (intangible), re-enters with a palm"),
        sequence("special_3", sp[2], [
            ("wind", lib.f(lib.PULL_BOTH, al_sp=-20, ar_sp=-20, al_el=110, ar_el=110), "in"),
            ("hit", lib.f(lib.PUSH_BOTH, al_el=36, ar_el=36, al_sp=10, ar_sp=10), "out"),
            ("hold+1", lib.f(lib.PUSH_BOTH, al_el=40, ar_el=40, al_sp=16, ar_sp=16))],
            note="Boltzmann Machine: releases a drifting thermal cloud"),
        sequence("super", fd["super"], [
            ("wind", lib.f(lib.CROSS_WIND, fist_r=0.0, fist_l=0.0), "in"),
            ("hit", lib.f(lib.CROSS, lib.PALM_R, fist_l=0.0, pfwd=0.12), "out"),
            ("hold+1", lib.f(lib.CROSS, lib.PALM_R, fist_l=0.0, pfwd=0.12)),
            (0.42, lib.f(lib.JAB_WIND, fist_l=0.0, fist_r=0.0, pfwd=0.06), "in"),
            (0.52, lib.f(lib.JAB, lib.PALM_L, fist_r=0.0, pfwd=0.16, al_ah=0.05), "out"),
            (0.7, lib.f(lib.JAB, lib.PALM_L, fist_r=0.0, pfwd=0.16, al_ah=0.05))], post=12,
            events=None, note="Forward-Forward: positive palm, then negative palm (second wave)"),
        scripted("finisher", 18, 8.0, [
            (2, lib.f(BEHIND_BACK, ar_sw=60, ar_el=95, ar_sp=-10, fist_r=0.8)),
            (5, lib.f(ar_sw=62, ar_el=95, ar_sp=-12, fist_r=0.8, al_sw=95, al_el=120, al_sp=-20, fist_l=0.7)),
            (7, lib.f(ar_sw=62, ar_el=95, ar_sp=-12, fist_r=0.8, al_sw=130, al_el=80, al_sp=-6, fist_l=0.7)),
            (10, lib.f(ar_sw=80, ar_el=50, ar_sp=-4, fist_r=0.8, al_sw=60, al_el=100, fist_l=0.3)),
            (13, lib.f(ar_sw=80, ar_el=50, ar_sp=-4, fist_r=0.8, al_sw=60, al_el=100, fist_l=0.3, h_pitch=12)),
            ("end", lib.f(LECTURE, al_sw=60, al_el=100))], hit=7, base=lib.GUARD,
            props=[Prop("flask", bone="hand_r", offset=HAND, frames=(1, "end"))],
            note="Distillation: uncorks the flask, the student version lands inside"),
        scripted("intro", 14, 8.0, [
            ("start", lib.f(lib.RELAXED, BEHIND_BACK)), (4, LECTURE), (7, lib.f(LECTURE, al_sw=112, h_pitch=4)),
            (10, LECTURE)], note="Hand behind his back, the other raised to make a point"),
        scripted("victory", 12, 8.0, [
            (3, lib.f(lib.RELAXED, BEHIND_BACK, al_sw=40, al_el=60)),
            (6, lib.f(lib.RELAXED, BEHIND_BACK, al_sw=150, al_el=30, al_sp=8, fist_l=0.8, h_pitch=-8)),
            ("end", lib.f(lib.RELAXED, BEHIND_BACK, al_sw=152, al_el=28, al_sp=8, fist_l=0.8, h_pitch=-6))],
            props=[Prop("medal", bone="hand_l", offset=HAND, frames=(4, "end"))],
            note="Holds up the medal: \"I'm flabbergasted.\""),
    ]


def animations(fighter_id, sk, cfg, ctx=None):
    if fighter_id != "geoffrey":
        return {}
    return export("geoffrey", moves(load_framedata("geoffrey")), sk, ctx)
