"""Noam Shazeer, "The T in GPT" (roster doc 3.14): shy and deadpan, loose hands, eyes darting. Mixture of
Experts swaps his HP or HK per expert stance; the five stance heavies noam.js defines each get their own clip."""

from _group3 import library as lib
from _group3.common import air_strike, crouch_strike, scripted, sequence, strike, throw, export, load_framedata

LOOSE = lib.f(lib.RELAXED, al_sw=20, al_el=40, ar_sw=14, ar_el=40, fist_l=0.2, fist_r=0.2)
GLANCE_A = dict(h_yaw=-28, n_yaw=-20)
GLANCE_B = dict(h_yaw=6, n_yaw=-4)


def moves(fd):
    n, sp, ex = fd["normals"], fd["specials"], fd["experts"]
    hp, hk = n["hp"], n["hk"]
    return [
        strike("light_punch", n["lp"], lib.JAB_WIND, lib.JAB, reach="al", note="Token Jab"),
        strike("heavy_punch", hp, lib.CROSS_WIND, lib.CROSS, follow=dict(pfwd=0.09), reach="ar",
               note="Feed-Forward (router stance)"),
        strike("light_kick", n["lk"], lib.SNAP_CHAMBER, lib.SNAP_KICK, reach="lf", note="Skip Connection"),
        strike("heavy_kick", hk, lib.ROUND_CHAMBER, lib.ROUNDHOUSE, reach="rf", note="Layer-Norm Roundhouse"),
        crouch_strike("crouch_light", n["c_lp"], dict(al_sw=60, al_el=125), lib.CROUCH_JAB, reach="al",
                      note="Low Logit (c.LP)"),
        crouch_strike("crouch_heavy", n["c_hp"], lib.f(lib.CROUCH_RISE_WIND, fist_r=1.0),
                      lib.f(lib.UPPERCUT, drop=0.1), follow=lib.f(lib.UPPERCUT, ar_sw=160, drop=0.12),
                      reach="ar", note="Residual: uppercut that leaves a copy"),
        air_strike("air_attack", n["j_k"], dict(lf_f=0.1, lf_h=0.42), lib.AIR_KICK, reach="lf",
                   note="Decoder Kick (j.K)"),
        throw(pull=dict(c_yaw=60, p_yaw=34, lf_yaw=80), toss=dict(c_yaw=-40, p_yaw=-30),
              note="Did You Mean: spell-check swap that flips the opponent"),

        # Expert stances
        strike("heavy_punch_striker", ex["hp_striker"], lib.f(lib.CROSS_WIND, c_yaw=-40), lib.CROSS,
               follow=dict(pfwd=0.1), reach="ar", note="Striker: Expert Cross, faster"),
        strike("heavy_kick_striker", ex["hk_striker"], lib.f(lib.ROUND_CHAMBER, rf_h=0.4), lib.ROUNDHOUSE,
               reach="rf", note="Striker: Expert Roundhouse"),
        sequence("heavy_punch_grappler", ex["hp_grappler"], [
            ("wind", dict(drop=0.22, al_sw=50, al_el=60, ar_sw=40, ar_el=70, fist_l=0.0, fist_r=0.0), "in"),
            ("hit", lib.f(lib.GRAB, al_ah=-0.2, ar_ah=-0.2, pfwd=0.1, drop=0.24), "out"),
            ("hold", lib.f(lib.GRAB, al_ah=-0.2, ar_ah=-0.2, pfwd=0.1, drop=0.24)),
            (0.7, lib.f(lib.GRAB_PULL, c_yaw=10, p_yaw=0))],
            note="Grappler: Gated Grab, short command grab"),
        sequence("heavy_kick_zoner", ex["hk_zoner"], [
            ("wind", lib.f(lib.FRONT_CHAMBER, p_yaw=10, c_yaw=-20), "in"),
            ("hit", lib.f(lib.FRONT_KICK, p_yaw=20, c_yaw=-6, lf_yaw=60, lk_up=0.6, c_pitch=-14), "out"),
            ("hold", lib.f(lib.FRONT_KICK, p_yaw=20, c_yaw=-6, lf_yaw=60, lk_up=0.6, c_pitch=-14))],
            reach="lf", note="Zoner: Attention Dart side kick"),
        sequence("heavy_punch_guard", ex["hp_guard"], [
            ("wind", lib.f(lib.RAISE_L, al_sw=90, al_el=100, drop=0.18), "in"),
            ("hit", lib.f(lib.RAISE_L, al_sw=100, al_el=40, al_sp=-8, pfwd=-0.02, drop=0.18, c_pitch=0), "out"),
            ("hold", lib.f(lib.RAISE_L, al_sw=100, al_el=42, al_sp=-8, pfwd=-0.02, drop=0.18, c_pitch=-1))],
            note="Guard: parry palm held out"),

        sequence("special_1", sp[0], [
            ("wind", lib.f(lib.HAND_TO_FACE, ar_sw=70, ar_el=150, al_sw=70, al_el=60, fist_l=0.5), "in"),
            ("hit", lib.f(lib.HAND_TO_FACE, ar_sw=72, ar_el=150, al_aim=1.0, al_ah=0.05, al_el=4, fist_l=0.55,
                          pfwd=0.02), "out"),
            ("hold", lib.f(lib.HAND_TO_FACE, ar_sw=72, ar_el=150, al_aim=1.0, al_ah=0.0, al_el=4, fist_l=0.55,
                           pfwd=0.02))], note="Attention Is All You Need: two fingers to the temple, beam locks"),
        sequence("special_2", sp[1], [
            ("wind", lib.f(lib.SPREAD, al_sw=40, ar_sw=40, al_el=60, ar_el=60, al_sp=40, ar_sp=40), "in"),
            ("hit", lib.f(lib.SPREAD, al_sw=60, ar_sw=60, al_el=40, ar_el=40, al_sp=55, ar_sp=55, **GLANCE_A),
             "out"),
            (0.6, lib.f(lib.SPREAD, al_sw=62, ar_sw=62, al_el=40, ar_el=40, al_sp=55, ar_sp=55, **GLANCE_B)),
            (0.8, lib.f(lib.SPREAD, al_sw=60, ar_sw=60, al_el=40, ar_el=40, al_sp=55, ar_sp=55, **GLANCE_A))],
            post=8, note="Mixture of Experts: opens the router, eyes dart between experts"),
        sequence("special_3", sp[2], [
            ("wind", dict(drop=0.22, c_pitch=-6, pfwd=-0.04, al_sw=40, ar_sw=20), "in"),
            ("hit", dict(drop=0.28, c_pitch=26, n_pitch=14, h_pitch=18, pfwd=0.16, al_sw=-20, al_el=40,
                         ar_sw=-30, ar_el=40, rf_p=34), "out"),
            ("hold", dict(drop=0.28, c_pitch=28, n_pitch=16, h_pitch=20, pfwd=0.18, al_sw=-24, al_el=40,
                          ar_sw=-34, ar_el=40, rf_p=34))],
            note="One Write-Head: lunges head-first behind three ghost heads"),
        sequence("super", fd["super"], [
            (1, lib.f(lib.SHRUG, h_yaw=-40, n_yaw=-30)),
            ("wind", lib.f(lib.SHRUG, h_yaw=-36, n_yaw=-28), "in"),
            ("hit", lib.f(lib.PUSH_BOTH, pfwd=0.06), "out"),
            ("hold", lib.f(lib.PUSH_BOTH, pfwd=0.06, al_ah=0.0, ar_ah=0.0))], pre=3, post=10,
            note="Divine Benevolence: shrugs at the camera, fires the gated beam"),
        scripted("finisher", 16, 8.0, [
            (2, lib.f(al_sw=80, al_el=30, fist_l=0.55)),
            (4, lib.f(al_aim=1.0, al_el=4, fist_l=0.55, pfwd=0.03)),
            (5, lib.f(al_sw=82, al_el=26, fist_l=0.55)),
            (7, lib.f(al_aim=1.0, al_el=4, fist_l=0.55, pfwd=0.03)),
            (10, lib.f(LOOSE, h_yaw=-30, n_yaw=-20)),
            ("end", lib.f(LOOSE, lib.SHRUG, h_yaw=-34, n_yaw=-24))], hit=7,
            note="Did You Mean...?: clicks yes, the opponent shrinks into the dropdown"),
        scripted("intro", 14, 8.0, [
            ("start", lib.f(LOOSE, **GLANCE_B)), (3, lib.f(LOOSE, **GLANCE_A)), (6, lib.f(LOOSE, **GLANCE_B)),
            (9, lib.f(LOOSE, **GLANCE_A))], note="Hands loose, eyes darting between targets"),
        scripted("victory", 12, 8.0, [
            (3, LOOSE), (6, lib.f(LOOSE, lib.SHRUG, h_yaw=-36, n_yaw=-26)),
            ("end", lib.f(LOOSE, lib.SHRUG, h_yaw=-36, n_yaw=-26))],
            note="Deadpan shrug, waiting for the laugh"),
    ]


def animations(fighter_id, sk, cfg, ctx=None):
    if fighter_id != "noam":
        return {}
    return export("noam", moves(load_framedata("noam")), sk, ctx)
