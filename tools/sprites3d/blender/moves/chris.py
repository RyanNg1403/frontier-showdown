"""Chris Olah, "The Interpreter" (roster doc 3.15): curious and gentle, leaning in to peer through his lens.
Props: the brass-rimmed magnifying lens, the tiny Golden Gate Bridge, the 3D-printed toy-model figurine."""

from _group3 import library as lib
from _group3.common import Prop, air_strike, crouch_strike, scripted, sequence, strike, throw, export, load_framedata

LENS = Prop("lens", bone="hand_l", rotation=(0, 0, 45))
LENS_EYE = dict(al_sw=92, al_el=96, al_sp=-26, fist_l=0.7, c_pitch=10, n_pitch=6, h_pitch=4, pfwd=0.03)
PEER = lib.f(lib.RELAXED, LENS_EYE, c_pitch=14)


def moves(fd):
    n, sp = fd["normals"], fd["specials"]
    return [
        strike("light_punch", n["lp"], lib.JAB_WIND, lib.f(lib.JAB, fist_l=0.7), reach="al", props=[LENS],
               note="Lens Tap"),
        strike("heavy_punch", n["hp"], lib.f(lib.SWIPE_WIND, ar_sp=70), lib.f(lib.CROSS, lib.PALM_R),
               follow=dict(pfwd=0.1, ar_sp=-10), reach="ar", note="Feature Swirl Palm"),
        strike("light_kick", n["lk"], lib.SNAP_CHAMBER, lib.SNAP_KICK, reach="lf", note="Neat Step Kick"),
        strike("heavy_kick", n["hk"], lib.SPIN_TURN, lib.SPIN_KICK, reach="rf",
               note="Activation Atlas Spin: spinning kick"),
        crouch_strike("crouch_light", n["c_lp"], dict(al_sw=60, al_el=125), lib.f(lib.CROUCH_JAB, fist_l=0.7),
                      reach="al", props=[LENS], note="Neuron Probe (c.LP)"),
        crouch_strike("crouch_light_kick", n["c_lk"], dict(lf_f=0.2), lib.CROUCH_LOW_KICK, reach="lf",
                      note="Low Attribution (c.LK)"),
        crouch_strike("crouch_heavy", n["c_hp"], lib.f(lib.CROUCH_RISE_WIND, al_sw=20, al_el=110, fist_l=0.0),
                      lib.f(lib.CROUCH_RISE, al_sw=150, al_el=40, al_sp=10, fist_l=0.0),
                      follow=lib.f(lib.CROUCH_RISE, al_sw=172, al_el=20, ar_sw=150, ar_el=40, fist_l=0.0),
                      reach="ar", note="Superposition: two rising arms, hits twice"),
        crouch_strike("crouch_heavy_kick", n["c_hk"], dict(rf_f=-0.1, drop=0.46), lib.SWEEP_LOW, reach="rf",
                      note="Circuit Sweep (c.HK)"),
        air_strike("air_kick", n["j_k"], dict(lf_f=0.1, lf_h=0.42), lib.AIR_KICK, reach="lf",
                   note="Diagram Kick (j.K)"),
        air_strike("air_attack", n["j_p"], lib.f(dict(al_sw=160, al_el=60), fist_l=0.7),
                   dict(al_sw=60, al_el=8, al_aim=0.7, al_ah=-0.7, c_pitch=22, p_pitch=14, fist_l=0.7),
                   reach="al", props=[LENS], note="Lens Drop (j.P)"),
        throw(pull=dict(c_yaw=50, p_yaw=30), toss=dict(c_yaw=-30),
              note="Understanding LSTMs: wraps them in diagram arrows and spins them"),
        sequence("special_1", sp[0], [
            ("wind", lib.f(lib.PULL_BOTH, al_sw=55, ar_sw=50, al_el=100, ar_el=100, al_sp=-24, ar_sp=-20), "in"),
            ("hit", lib.f(lib.PUSH_BOTH, al_el=20, ar_el=20, pfwd=0.04), "out"),
            ("hold+1", lib.f(lib.PUSH_BOTH, al_el=24, ar_el=24, pfwd=0.04))], reach="al",
            note="Feature Visualization: shapes and releases the psychedelic orb"),
        sequence("special_2", sp[1], [
            ("wind", lib.f(lib.CROUCH_PLACE, ar_aim=0.0, ar_sw=40, ar_el=60, drop=0.3, c_pitch=30), "in"),
            ("hit", lib.CROUCH_PLACE, "out"), ("hold", lib.CROUCH_PLACE),
            (0.75, lib.f(lib.CROUCH_PLACE, drop=0.3, ar_sw=40, ar_aim=0.0, ar_el=50, fist_r=0.0))],
            props=[Prop("bridge", bone="hand_r", offset=(0.0, -0.03, -0.03), frames=("start", "wind")),
                   Prop("bridge:floor", offset=(0.0, 0.62, 0.0), frames=("hit", "end"))],
            note="Golden Gate: sets the tiny glowing bridge on the floor"),
        sequence("special_3", sp[2], [
            ("wind", lib.f(lib.PRESENT_L, al_aim=1.0, al_el=4, fist_l=0.55, c_yaw=-30), "in"),
            ("hit", lib.f(lib.CROSS, lib.PALM_R, pfwd=0.16, drop=0.2, al_sw=40, al_el=110), "out"),
            ("hold", lib.f(lib.CROSS, lib.PALM_R, pfwd=0.17, drop=0.2, al_sw=40, al_el=110))], reach="ar",
            note="Circuit Trace: traces the attribution line, dashes into a palm"),
        sequence("super", fd["super"], [
            ("wind", lib.f(al_sw=80, al_el=110, fist_l=0.7, c_pitch=4), "in"),
            ("hit", lib.f(LENS_EYE, al_sw=140, al_el=40, al_sp=-8, c_pitch=-6, h_pitch=-10), "out"),
            ("hold", lib.f(LENS_EYE, al_sw=142, al_el=38, al_sp=-8, c_pitch=-6, h_pitch=-10)),
            (0.8, lib.f(LENS_EYE))], props=[LENS], post=10,
            note="Scaling Monosemanticity: raises the lens, the opponent splits into feature tiles"),
        scripted("finisher", 18, 8.0, [
            (3, lib.f(lib.RELAXED, ar_sw=70, ar_el=80, fist_r=0.7, h_pitch=8)),
            (6, lib.f(lib.RELAXED, ar_sw=72, ar_el=82, fist_r=0.7, h_pitch=10, c_pitch=8)),
            (9, lib.f(lib.RELAXED, ar_sw=60, ar_el=20, ar_aim=0.6, ar_ah=-0.6, fist_r=0.7, c_pitch=16, pfwd=0.04)),
            (11, lib.f(lib.RELAXED, ar_sw=40, ar_el=30, fist_r=0.0, c_pitch=8)),
            (13, lib.f(lib.RELAXED, lib.NOD, al_sw=40, al_el=130, al_sp=-20)),
            (15, lib.f(lib.RELAXED, al_sw=40, al_el=130, al_sp=-20, h_pitch=4)),
            ("end", lib.f(lib.RELAXED, lib.NOD, al_sw=40, al_el=130, al_sp=-20))], hit=9,
            props=[Prop("figurine", bone="hand_r", frames=(2, 10)),
                   Prop("desk", offset=(0.0, 0.74, 0.0), frames=(4, "end")),
                   Prop("figurine:desk", offset=(0.0, 0.7, 0.59), frames=(11, "end"))],
            note="Toy Model: sets the figurine on his desk, a thoughtful nod"),
        scripted("intro", 14, 8.0, [
            ("start", lib.RELAXED), (4, lib.f(lib.RELAXED, lib.BOW)), (6, lib.RELAXED), (9, PEER), (11, PEER)],
            props=[LENS], note="A slight polite bow, then peers through the lens"),
        scripted("victory", 12, 8.0, [
            (3, PEER), (6, lib.f(PEER, ar_sw=100, ar_el=120, ar_sp=10, fist_r=1.0, h_pitch=-4)),
            ("end", lib.f(PEER, ar_sw=110, ar_el=110, ar_sp=10, fist_r=1.0, h_pitch=-6))], props=[LENS],
            note="\"Oh, interesting!\": peering through the lens, small fist pump"),
    ]


def animations(fighter_id, sk, cfg, ctx=None):
    if fighter_id != "chris":
        return {}
    return export("chris", moves(load_framedata("chris")), sk, ctx)
