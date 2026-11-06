"""Fei-Fei Li, "Godmother of AI" (roster doc 3.16): feet planted, one palm up as if presenting a picture, calm and
warm but unyielding, never rushing. Prop: a small labelled ImageNet photo tile."""

from _group3 import library as lib
from _group3.common import Prop, air_strike, crouch_strike, scripted, sequence, strike, throw, export, load_framedata

TILE = Prop("photo_tile", bone="hand_l", offset=(0.0, -0.03, 0.03), rotation=(0, 0, 40))
PRESENTING = lib.f(lib.RELAXED, lib.PRESENT_R, ar_sw=58, ar_el=60, ar_sp=14, drop=0.03)
FRAME_HANDS = dict(al_sw=95, al_el=70, al_sp=-6, ar_sw=88, ar_el=80, ar_sp=-2, fist_l=0.0, fist_r=0.0, c_yaw=-22)


def moves(fd):
    n, sp = fd["normals"], fd["specials"]
    return [
        strike("light_punch", n["lp"], lib.f(lib.JAB_WIND, fist_l=0.0), lib.f(lib.JAB, lib.PALM_L), reach="al",
               props=[TILE], note="Photo Tile Palm"),
        strike("heavy_punch", n["hp"], lib.SWIPE_WIND, lib.SWIPE, follow=dict(ar_sp=-34, pfwd=0.08), reach="ar",
               note="Tile Row Sweep: sweeping arm lays a row of tiles"),
        strike("light_kick", n["lk"], lib.SNAP_CHAMBER, lib.SNAP_KICK, reach="lf", note="Short Kick"),
        strike("heavy_kick", n["hk"], lib.SPIN_TURN, lib.SPIN_KICK, reach="rf", note="Wireframe Spin Kick"),
        crouch_strike("crouch_light", n["c_lp"], dict(al_sw=60, al_el=125), lib.CROUCH_JAB, reach="al",
                      note="Bounding Box Jab (c.LP)"),
        crouch_strike("crouch_heavy", n["c_hp"],
                      lib.f(lib.CROUCH_RISE_WIND, al_sw=10, al_el=100, fist_l=0.0, drop=0.5),
                      lib.f(lib.CROUCH_RISE, al_sw=165, al_el=26, al_sp=12, fist_l=0.0),
                      reach="ar", note="Splat Pillar: both palms raise the pillar (anti-air)"),
        air_strike("air_attack", n["j_k"], dict(lf_f=0.1, lf_h=0.42), lib.AIR_KICK, reach="lf",
                   note="Wireframe Kick (j.K)"),
        throw(grab=dict(fist_r=0.0), pull=dict(ar_sw=90, ar_el=20, ar_aim=1.0, fist_r=0.0, c_yaw=0),
              note="Label It: slaps on a bounding box and class label, then tosses"),
        sequence("special_1", sp[0], [
            ("wind", lib.f(lib.PRESENT_L, al_sw=50, al_el=70, c_yaw=-40), "in"),
            ("hit", lib.f(lib.JAB, lib.PALM_L, al_el=10, pfwd=0.05), "out"),
            ("hold+1", lib.f(lib.JAB, lib.PALM_L, al_el=12, pfwd=0.05))], reach="al",
            props=[Prop("photo_tile", bone="hand_l", offset=(0.0, -0.03, 0.03), rotation=(0, 0, 40),
                        frames=("start", "wind"))],
            note="ImageNet: presents the palm and fires the tile row"),
        sequence("special_2", sp[1], [
            ("wind", lib.f(lib.PUSH_BOTH, al_ah=-0.9, ar_ah=-0.9, al_el=30, ar_el=30, drop=0.26, c_pitch=18),
             "in"),
            ("hit", lib.f(lib.PUSH_BOTH, al_ah=0.15, ar_ah=0.15, al_el=40, ar_el=40, al_sp=10, ar_sp=12,
                          drop=0.12), "out"),
            ("hold+1", lib.f(lib.PUSH_BOTH, al_ah=0.2, ar_ah=0.2, al_el=44, ar_el=44, al_sp=14, ar_sp=16,
                             drop=0.12))],
            note="Marble World: lifts the Gaussian-splat construct up from the floor"),
        sequence("special_3", sp[2], [
            ("wind", dict(drop=0.3, c_pitch=20, al_sw=40, al_el=140, al_sp=-30, ar_sw=40, ar_el=140, ar_sp=-30),
             "in"),
            ("hit", dict(drop=0.4, c_pitch=30, p_pitch=16, al_sw=30, al_el=150, al_sp=-36, ar_sw=30, ar_el=150,
                         ar_sp=-36, h_pitch=20, lf_f=0.12, rf_f=-0.14)),
            ("hold+2", lib.f(PRESENTING, drop=0.06))],
            note="Spatial Step: folds into a wireframe (vanishes on the hit frame), reappears"),
        sequence("super", fd["super"], [
            ("wind", lib.f(lib.PULL_BOTH, al_sp=-20, ar_sp=-20), "in"),
            ("hit", lib.SPREAD, "out"), ("hold", lib.f(lib.SPREAD, al_sw=96, ar_sw=96, h_pitch=-6)),
            (0.85, lib.f(lib.SPREAD, al_sw=70, ar_sw=70))], post=10,
            note="The Worlds I See: opens her hands and the stage folds through worlds"),
        scripted("finisher", 16, 8.0, [
            (3, lib.f(lib.RELAXED, FRAME_HANDS)), (6, lib.f(lib.RELAXED, FRAME_HANDS, h_pitch=-4)),
            (9, PRESENTING), (12, lib.f(PRESENTING, lib.NOD)), ("end", PRESENTING)], hit=6,
            note="Labeled: frames the opponent with her hands, the tile is captioned, a warm nod"),
        scripted("intro", 14, 8.0, [
            ("start", PRESENTING), (5, lib.f(PRESENTING, ar_sw=64)), (8, lib.f(PRESENTING, ar_sw=60))],
            props=[Prop("photo_tile", bone="hand_r", offset=(0.0, -0.03, 0.05), rotation=(0, 0, 40),
                        frames=("start", 8))],
            note="One palm up, presenting a picture to the opponent"),
        scripted("victory", 12, 8.0, [
            (4, PRESENTING), (7, lib.f(PRESENTING, lib.NOD)), ("end", PRESENTING)],
            note="Calm and warm: palm up, a small nod"),
    ]


def animations(fighter_id, sk, cfg, ctx=None):
    if fighter_id != "feifei":
        return {}
    return export("feifei", moves(load_framedata("feifei")), sk, ctx)
