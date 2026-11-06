"""Liang Wenfeng, "The Quiet Whale" (roster doc 3.11): crisp and minimal, long stillness then precise strikes."""

from _group3 import library as lib
from _group3.common import air_strike, crouch_strike, scripted, sequence, strike, throw, export, load_framedata

STILL = dict(lib.RELAXED, n_pitch=10, h_pitch=12)  # head slightly lowered, hands relaxed at his sides


def moves(fd):
    n, sp = fd["normals"], fd["specials"]
    return [
        strike("light_punch", n["lp"], lib.JAB_WIND, lib.JAB, reach="al", note="6-Frame Jab, the fastest in the game"),
        strike("heavy_punch", n["hp"], lib.CROSS_WIND, lib.CROSS, follow=dict(pfwd=0.09), reach="ar",
               note="Cobalt Straight"),
        strike("light_kick", n["lk"], lib.SNAP_CHAMBER, lib.SNAP_KICK, reach="lf", note="Snap Kick"),
        strike("heavy_kick", n["hk"], lib.ROUND_CHAMBER, lib.ROUNDHOUSE, reach="rf", note="Turning Kick"),
        crouch_strike("crouch_light", n["c_lp"], dict(al_sw=60, al_el=125), lib.CROUCH_JAB, reach="al", note="Quiet Tap (c.LP)"),
        crouch_strike("crouch_light_kick", n["c_lk"], dict(lf_f=0.2), lib.CROUCH_LOW_KICK, reach="lf", note="Low Ripple (c.LK)"),
        crouch_strike("crouch_heavy", n["c_hp"], dict(lib.CROUCH_RISE_WIND, ar_sp=40),
                      dict(lib.CROUCH_RISE, ar_sw=172, ar_el=12, ar_sp=-10),
                      follow=dict(lib.CROUCH_RISE, ar_sw=150, ar_el=20, ar_sp=-30, drop=0.14),
                      note="Whale Tail: rising tail-fin arc, launcher"),
        crouch_strike("crouch_heavy_kick", n["c_hk"], dict(rf_f=-0.1, drop=0.46), lib.SWEEP_LOW, reach="rf",
                      note="Price Cut Sweep (c.HK)"),
        air_strike("air_kick", n["j_k"], dict(lf_f=0.1, lf_h=0.42), lib.AIR_KICK, reach="lf", note="Cobalt Dropkick (j.K)"),
        air_strike("air_attack", n["j_p"], lib.AIR_PALM_WIND, lib.AIR_PALM, reach="ar", note="Falling Palm (j.P)"),
        throw(note="Price War: quick wrist-lock"),
        sequence("special_1", sp[0], [
            ("wind", dict(lib.RAISE_R, ar_sw=90, ar_el=120, c_pitch=2), "in"),
            ("hit", dict(lib.RAISE_R, ar_sw=128, ar_el=118, ar_sp=-4, fist_r=0.55, c_pitch=-4, h_pitch=6,
                         drop=0.15, pfwd=-0.03, al_sw=40, al_el=125), "out"),
            ("hold", dict(lib.RAISE_R, ar_sw=130, ar_el=118, ar_sp=-4, fist_r=0.55, c_pitch=-5, h_pitch=8,
                          drop=0.15, pfwd=-0.03, al_sw=40, al_el=125))],
            note="Aha Moment: freezes mid-thought, one finger raised (parry window)"),
        sequence("special_2", sp[1], [
            ("wind", dict(al_sw=40, al_el=140, al_sp=-20, fist_l=0.5, c_yaw=-44), "in"),
            ("hit", dict(lib.JAB, al_el=10, fist_l=0.3, pfwd=0.03), "out"),
            ("hold", dict(lib.JAB, al_el=12, fist_l=0.3, pfwd=0.03))], reach="al",
            note="Latent Attention: flicks a tiny compressed pellet"),
        sequence("special_3", sp[2], [
            ("wind", dict(drop=0.24, c_pitch=18, pfwd=-0.02, al_sw=50, al_el=125), "in"),
            ("hit", dict(lib.JAB, pfwd=0.14, drop=0.2, al_ah=0.1, rf_p=30), "out"),
            ("hold", dict(lib.CROSS, pfwd=0.16, drop=0.24, ar_ah=-0.15)),
            (0.72, dict(lib.LOW_KICK, pfwd=0.08))],
            note="Group Relative Strike: high, mid, low with three shadows"),
        sequence("super", fd["super"], [
            ("wind", dict(drop=0.36, c_pitch=30, p_pitch=16, al_sw=30, al_el=20, al_sp=30, ar_sw=30, ar_el=20,
                          ar_sp=30, fist_l=0.0, fist_r=0.0, h_pitch=-6), "in"),
            ("hit", lib.SUMMON, "out"),
            ("hold+2", dict(lib.SUMMON, al_sw=150, ar_sw=152, drop=0.12)),
            (0.8, dict(lib.SUMMON, al_sw=120, ar_sw=120, al_el=40, ar_el=40, drop=0.14))],
            note="The Whale Breach: palms rise and the whale breaches", post=9),
        scripted("finisher", 16, 8.0, [
            (2, dict(lib.PUSH_BOTH, al_sp=-24, ar_sp=-20, al_el=40, ar_el=40, pfwd=0.02)),
            (5, dict(lib.PUSH_BOTH, al_sp=-30, ar_sp=-28, al_el=70, ar_el=70, drop=0.18)),
            (8, dict(lib.RAISE_R, ar_sw=150, ar_el=30, fist_r=0.0, c_pitch=-4, h_pitch=-10)),
            (11, dict(STILL, h_pitch=14)),
            (13, dict(STILL, h_pitch=22, n_pitch=14)),
            ("end", dict(STILL, h_pitch=10))], hit=8,
            note="MIT License: compresses the opponent, uploads it, small nod"),
        scripted("intro", 14, 8.0, [
            ("start", STILL), (4, STILL),
            (7, lib.f(STILL, lib.HAND_TO_FACE)), (9, lib.f(STILL, lib.HAND_TO_FACE, h_pitch=4)),
            (11, dict(STILL, h_pitch=6))], note="Very still, adjusts his glasses, settles into guard"),
        scripted("victory", 12, 8.0, [
            (3, STILL), (6, lib.f(STILL, lib.HAND_TO_FACE)), (8, lib.f(STILL, lib.HAND_TO_FACE, h_pitch=3)),
            ("end", dict(STILL, h_pitch=8))], note="Quiet nod, adjusts his glasses"),
    ]


def animations(fighter_id, sk, cfg, ctx=None):
    if fighter_id != "liang":
        return {}
    return export("liang", moves(load_framedata("liang")), sk, ctx)
