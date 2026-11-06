"""Reusable pose fragments. Each is a dict of overrides for core.GUARD; combine them with core.pose(...).

Lead side = the rig's left (far from the camera): `al_*` arm, `lf_*` foot. Rear side = the rig's right (near):
`ar_*`, `rf_*`. The opponent is straight ahead along the facing direction.
"""

from .core import pose

# ------------------------------------------------------------------------------------------ bases

GUARD = pose()

RELAXED = dict(lf_f=0.12, lf_l=0.1, rf_f=-0.12, rf_l=-0.12, lf_yaw=10, rf_yaw=18, drop=0.03, p_yaw=-14, p_pitch=2,
               c_yaw=-18, c_pitch=3, n_yaw=-6, n_pitch=2, h_yaw=-2, h_pitch=3,
               al_sw=6, al_el=14, al_sp=7, ar_sw=4, ar_el=14, ar_sp=7, fist_l=0.35, fist_r=0.35)

# shared.CROUCH in this vocabulary, so crouching attacks start and end on the shared crouch
CROUCH = dict(drop=0.626, lf_f=0.30, lf_l=0.13, rf_f=-0.34, rf_l=-0.16, rf_p=38, lk_out=0.3, rk_out=0.45,
              p_yaw=-24, p_pitch=15, c_yaw=-30, c_pitch=20, n_pitch=-4, h_pitch=-10,
              al_sw=50, al_el=112, al_sp=8, ar_sw=20, ar_el=128, ar_sp=20)

# the apex of shared.jump_air in this vocabulary
AIR = dict(drop=0.006, lf_f=0.24, lf_h=0.36, lf_p=10, rf_f=-0.06, rf_h=0.28, rf_p=25, p_pitch=5, c_pitch=8)

# ------------------------------------------------------------------------------------------ punches

JAB_WIND = dict(al_sw=62, al_el=118, c_yaw=-40, p_yaw=-27)
JAB = dict(al_aim=1.0, al_ah=0.0, al_el=4, c_yaw=-22, p_yaw=-19, pfwd=0.04, h_yaw=-3, ar_sw=30, ar_el=134)
CROSS_WIND = dict(ar_sw=20, ar_el=140, c_yaw=-44, p_yaw=-30, drop=0.18)
CROSS = dict(ar_aim=1.0, ar_ah=0.0, ar_el=4, c_yaw=12, p_yaw=-4, pfwd=0.08, rf_p=32, rf_yaw=16,
             al_sw=48, al_el=122, al_sp=14, h_yaw=0)
PALM_L = dict(fist_l=0.0)
PALM_R = dict(fist_r=0.0)
UPPER_WIND = dict(drop=0.26, c_pitch=16, c_yaw=-40, ar_sw=18, ar_el=118)
UPPERCUT = dict(drop=0.1, ar_sw=152, ar_el=58, ar_sp=4, c_pitch=-6, c_yaw=4, p_yaw=-10, rf_p=34, pfwd=0.04,
                h_pitch=-8, al_sw=58, al_el=120)
OVER_WIND = dict(ar_sw=172, ar_el=46, ar_sp=10, c_pitch=-8, c_yaw=-20, drop=0.14)
OVERHEAD = dict(ar_sw=82, ar_el=8, ar_aim=0.6, ar_ah=-0.35, c_pitch=24, c_yaw=6, p_pitch=12, pfwd=0.08, drop=0.22,
                rf_p=24)
HOOK_WIND = dict(al_sw=78, al_el=96, al_sp=58, c_yaw=-48, p_yaw=-30)
HOOK = dict(al_sw=86, al_el=88, al_sp=-12, c_yaw=-6, p_yaw=-14, pfwd=0.04)
SWIPE_WIND = dict(ar_sw=140, ar_el=40, ar_sp=55, c_yaw=-50, c_pitch=0, p_yaw=-32)
SWIPE = dict(ar_sw=78, ar_el=12, ar_sp=-18, c_yaw=10, c_pitch=14, p_yaw=-6, pfwd=0.07, rf_p=26, fist_r=0.0)

# ------------------------------------------------------------------------------------------ kicks

FRONT_CHAMBER = dict(lf_f=0.22, lf_h=0.42, lk_up=0.85, lf_p=30, drop=0.13, p_pitch=-2, c_pitch=0, rf_yaw=44)
FRONT_KICK = dict(lf_f=0.8, lf_h=0.52, lk_up=0.9, lf_p=55, drop=0.13, p_pitch=-12, c_pitch=-8, rf_yaw=50,
                  pfwd=-0.02, al_sw=58, al_el=118)
LOW_KICK = dict(lf_f=0.66, lf_h=0.06, lk_up=0.5, lf_p=25, drop=0.2, c_pitch=12, p_pitch=8, pfwd=0.02)
SNAP_CHAMBER = dict(lf_f=0.18, lf_h=0.3, lk_up=0.9, lf_p=35, drop=0.15)
SNAP_KICK = dict(lf_f=0.7, lf_h=0.36, lk_up=0.8, lf_p=50, drop=0.15, p_pitch=-6, c_pitch=-2)
ROUND_CHAMBER = dict(rf_f=0.06, rf_h=0.5, rk_up=0.95, rk_out=0.1, rf_p=40, p_yaw=8, c_yaw=-14, lf_yaw=45,
                     drop=0.13, p_pitch=-4)
ROUNDHOUSE = dict(rf_f=0.78, rf_h=0.8, rf_l=0.02, rk_up=1.0, rk_out=0.0, rf_p=62, p_yaw=48, c_yaw=22, p_pitch=-14,
                  c_pitch=-18, lf_yaw=75, drop=0.12, al_sw=40, al_el=110, ar_sw=10, ar_el=60, ar_sp=30, h_yaw=10)
CRESCENT_OUT = dict(rf_f=0.25, rf_h=0.7, rf_l=-0.42, rk_up=1.0, rk_out=-0.2, rf_p=50, p_yaw=10, c_yaw=-10,
                    lf_yaw=50, drop=0.12, p_pitch=-10, c_pitch=-12)
CRESCENT_TOP = dict(rf_f=0.62, rf_h=0.98, rf_l=-0.12, rk_up=1.0, rk_out=0.0, rf_p=55, p_yaw=30, c_yaw=10,
                    lf_yaw=60, drop=0.11, p_pitch=-16, c_pitch=-20, ar_sw=20, ar_el=40, ar_sp=40)
CRESCENT_IN = dict(rf_f=0.55, rf_h=0.55, rf_l=0.16, rk_up=0.9, rf_p=50, p_yaw=34, c_yaw=14, lf_yaw=60,
                   drop=0.12, p_pitch=-10, c_pitch=-10)
SPIN_TURN = dict(p_yaw=95, c_yaw=80, lf_yaw=110, rf_f=-0.1, rf_h=0.25, rk_up=0.6, drop=0.15, h_yaw=50, n_yaw=60,
                 al_sw=40, al_el=90, ar_sw=40, ar_el=90)
SPIN_KICK = dict(p_yaw=60, c_yaw=40, lf_yaw=100, rf_f=0.82, rf_h=0.78, rk_up=1.0, rf_p=60, drop=0.12,
                 p_pitch=-18, c_pitch=-22, h_yaw=10, n_yaw=20, al_sw=30, al_el=80, ar_sw=20, ar_el=40, ar_sp=35)
SWEEP_LOW = dict(drop=0.6, p_pitch=22, c_pitch=24, lf_f=0.14, lk_out=0.4, rf_f=0.88, rf_h=0.03, rf_l=0.04,
                 rk_up=0.5, rf_p=40, rf_yaw=0, p_yaw=34, c_yaw=10, al_sw=30, al_el=40, al_sp=30, ar_sw=-10,
                 ar_el=30, ar_sp=30, n_pitch=6, h_pitch=-10)
LONG_SWEEP = dict(SWEEP_LOW, rf_f=1.0, rf_h=0.04, drop=0.46, pfwd=0.04)

# ------------------------------------------------------------------------------------------ crouch

CROUCH_JAB = dict(al_aim=1.0, al_ah=-0.12, al_el=4, pfwd=0.04, c_yaw=-26, p_yaw=-24)
CROUCH_LOW_KICK = dict(lf_f=0.78, lf_h=0.03, lk_up=0.5, lf_p=20, pfwd=0.02, c_pitch=30)
CROUCH_RISE_WIND = dict(drop=0.48, c_pitch=32, ar_sw=10, ar_el=110, fist_r=0.0)
CROUCH_RISE = dict(drop=0.12, p_pitch=4, c_pitch=-4, c_yaw=4, p_yaw=-12, ar_sw=168, ar_el=24, ar_sp=6, rf_p=36,
                   rf_f=-0.22, h_pitch=-10, n_pitch=-4, fist_r=0.0, al_sw=60, al_el=118)

# ------------------------------------------------------------------------------------------ air

AIR_KICK = dict(lf_f=0.74, lf_h=0.16, lk_up=0.7, lf_p=55, rf_f=-0.2, rf_h=0.42, rk_up=0.6, rf_p=50, p_pitch=-16,
                c_pitch=-16, al_sw=80, al_el=100, ar_sw=50, ar_el=110)
AIR_PALM_WIND = dict(ar_sw=165, ar_el=60, c_pitch=-6, fist_r=0.0)
AIR_PALM = dict(ar_sw=58, ar_el=8, ar_aim=0.7, ar_ah=-0.7, c_pitch=22, p_pitch=14, c_yaw=-6, fist_r=0.0)

# ------------------------------------------------------------------------------------------ grabs and gestures

GRAB = dict(al_aim=1.0, al_ah=-0.05, al_el=20, ar_aim=1.0, ar_ah=-0.05, ar_el=24, ar_sp=-6, fist_l=0.6, fist_r=0.6,
            c_yaw=-12, p_yaw=-14, pfwd=0.07, drop=0.2)
GRAB_PULL = dict(al_sw=60, al_el=95, al_sp=10, ar_sw=45, ar_el=100, ar_sp=30, c_yaw=40, p_yaw=22, c_pitch=0,
                 drop=0.22, lf_yaw=60, fist_l=0.8, fist_r=0.8, h_yaw=20)
TOSS = dict(al_sw=105, al_el=12, ar_sw=110, ar_el=14, ar_sp=-8, c_yaw=-10, p_yaw=-14, pfwd=0.07, drop=0.17,
            fist_l=0.0, fist_r=0.0, rf_p=28)
PUSH_BOTH = dict(al_aim=1.0, al_ah=0.05, al_el=10, ar_aim=1.0, ar_ah=0.05, ar_el=12, fist_l=0.0, fist_r=0.0,
                 c_yaw=-8, p_yaw=-12, pfwd=0.06, rf_p=20)
PULL_BOTH = dict(al_sw=40, al_el=125, ar_sw=30, ar_el=135, fist_l=0.0, fist_r=0.0, c_yaw=-34, drop=0.2)
PRESENT_R = dict(ar_sw=72, ar_el=30, ar_sp=8, fist_r=0.0, c_yaw=-20)
PRESENT_L = dict(al_sw=72, al_el=28, al_sp=4, fist_l=0.0)
RAISE_R = dict(ar_sw=118, ar_el=100, ar_sp=12, fist_r=0.0)
RAISE_L = dict(al_sw=120, al_el=96, al_sp=6, fist_l=0.0)
SUMMON = dict(al_sw=158, al_el=26, al_sp=26, ar_sw=160, ar_el=26, ar_sp=28, fist_l=0.0, fist_r=0.0, c_pitch=-10,
              c_yaw=-24, n_pitch=-8, h_pitch=-14, drop=0.1)
SPREAD = dict(al_sw=128, al_el=18, al_sp=38, ar_sw=122, ar_el=18, ar_sp=46, fist_l=0.0, fist_r=0.0, c_yaw=-32,
              c_pitch=-8, h_pitch=-6, drop=0.1)
STEEPLE = dict(al_sw=46, al_el=102, al_sp=-26, ar_sw=44, ar_el=104, ar_sp=-22, fist_l=0.25, fist_r=0.25, c_yaw=-26)
BOW = dict(c_pitch=34, p_pitch=12, n_pitch=12, h_pitch=26, al_sw=6, al_el=10, ar_sw=6, ar_el=10)
HAND_TO_FACE = dict(ar_sw=58, ar_el=148, ar_sp=-28, fist_r=0.4, h_pitch=6)
SHRUG = dict(al_sw=22, al_el=95, al_sp=48, ar_sw=22, ar_el=95, ar_sp=50, fist_l=0.0, fist_r=0.0, h_roll=8,
             h_yaw=-20, n_yaw=-20, c_yaw=-28)
NOD = dict(h_pitch=16, n_pitch=8)
CROUCH_PLACE = dict(drop=0.4, c_pitch=40, p_pitch=26, ar_sw=60, ar_el=10, ar_aim=0.5, ar_ah=-1.2, fist_r=0.4,
                    rf_f=-0.2, h_pitch=8)


def mix(*parts, **kw):
    """Combine fragments into a full pose."""
    return pose(*parts, **kw)


def f(*parts, **kw):
    """Merge fragments (later ones win) without filling in the guard."""
    out = {}
    for part in parts:
        out.update(part)
    out.update(kw)
    return out
