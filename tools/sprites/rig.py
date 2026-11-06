"""
Kinematic locomotion rig.

Computes joint positions for walk and run cycles from a few physical parameters, so every cycle
has correct contact / down / passing / up poses, arm counter-swing, a centre-of-mass bob, and a
known stride. The poses feed the pose guides that image generation redraws (see poseguide.py), and
the stance-foot speed is the target `strideSpeed` the normaliser locks feet to.

Units are fractions of standing height H. x grows toward the facing direction (right), y grows up,
the ground is y = 0 and the hip sits at x = 0 in every frame (the body is stationary in the cell,
the world scrolls under it at strideSpeed).
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

# Body proportions for a ~7.25-head adult (fractions of standing height).
ANKLE_H = 0.045
THIGH = 0.245
SHIN = 0.24
HIP_H = ANKLE_H + THIGH + SHIN  # standing hip height (straight legs)
TORSO = 0.29  # hip to shoulder
NECK = 0.035
HEAD_R = 0.066
UPPER_ARM = 0.17
FOREARM = 0.15
HAND = 0.055
FOOT = 0.14
HEEL = 0.035  # heel behind the ankle
NEAR_SHOULDER_DX = -0.05  # 3/4 view: the near shoulder forms the back contour of the torso
FAR_SHOULDER_DX = 0.03
HIP_SPREAD = 0.02


@dataclass
class Gait:
    name: str
    frames: int
    duty: float  # fraction of the cycle a foot is on the ground
    contact_x: float  # stance foot ankle x at touchdown (relative to hip)
    toeoff_x: float  # stance foot ankle x at lift-off
    hip_mid: float  # hip height (above ground) at mid-stance
    bob: float  # hip height variation (peak to trough)
    bob_low_phase: float  # phase within a step where the hip is lowest (0 = contact)
    lean_deg: float
    arm_swing_deg: float
    elbow_base_deg: float
    elbow_swing_deg: float
    swing_keys: list[tuple[float, float, float]] = field(default_factory=list)
    # swing ankle path keys (s in 0..1 of the swing, x, lift above ground)
    fps: int = 12


def walk_gait(frames: int = 10) -> Gait:
    return Gait(
        name="walk",
        frames=frames,
        duty=0.6,
        contact_x=0.165,
        toeoff_x=-0.175,
        hip_mid=HIP_H - 0.004,
        bob=0.026,
        bob_low_phase=0.12,
        lean_deg=3.0,
        arm_swing_deg=31.0,
        elbow_base_deg=17.0,
        elbow_swing_deg=11.0,
        swing_keys=[
            (0.0, -0.175, 0.0),
            (0.3, -0.07, 0.07),
            (0.6, 0.08, 0.055),
            (0.85, 0.16, 0.025),
            (1.0, 0.165, 0.0),
        ],
        fps=12,
    )


def run_gait(frames: int = 10) -> Gait:
    return Gait(
        name="run",
        frames=frames,
        duty=0.36,
        contact_x=0.10,
        toeoff_x=-0.21,
        hip_mid=HIP_H - 0.006,
        bob=0.034,
        bob_low_phase=0.17,
        lean_deg=17.0,
        arm_swing_deg=42.0,
        elbow_base_deg=84.0,
        elbow_swing_deg=-12.0,
        swing_keys=[
            (0.0, -0.21, 0.0),
            (0.2, -0.17, 0.19),
            (0.42, -0.07, 0.29),
            (0.65, 0.13, 0.23),
            (0.86, 0.15, 0.09),
            (1.0, 0.10, 0.0),
        ],
        fps=15,
    )


GAITS = {"walk": walk_gait, "run": run_gait}


def _catmull(keys: list[tuple[float, float, float]], s: float) -> tuple[float, float]:
    s = min(max(s, 0.0), 1.0)
    for i in range(len(keys) - 1):
        if keys[i][0] <= s <= keys[i + 1][0]:
            break
    p0 = keys[max(i - 1, 0)]
    p1, p2 = keys[i], keys[i + 1]
    p3 = keys[min(i + 2, len(keys) - 1)]
    u = (s - p1[0]) / (p2[0] - p1[0] or 1.0)

    def cr(a: float, b: float, c: float, d: float) -> float:
        return 0.5 * (
            2 * b
            + (-a + c) * u
            + (2 * a - 5 * b + 4 * c - d) * u * u
            + (-a + 3 * b - 3 * c + d) * u * u * u
        )

    return cr(p0[1], p1[1], p2[1], p3[1]), max(0.0, cr(p0[2], p1[2], p2[2], p3[2]))


def _ik(hip: tuple[float, float], ankle: tuple[float, float], l1: float, l2: float,
        bend: float = 1.0) -> tuple[float, float]:
    """Two-bone IK; bend=+1 puts the joint forward (knee), -1 backward (elbow)."""
    dx, dy = ankle[0] - hip[0], ankle[1] - hip[1]
    d = min(math.hypot(dx, dy), l1 + l2 - 1e-6)
    a = math.atan2(dy, dx)
    cos_k = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)
    k = math.acos(max(-1.0, min(1.0, cos_k)))
    ang = a + bend * k
    return hip[0] + l1 * math.cos(ang), hip[1] + l1 * math.sin(ang)


def _leg(g: Gait, t: float, hip: tuple[float, float]) -> dict:
    """Ankle / knee / toe / heel and contact state for one leg at cycle phase t (0 = touchdown)."""
    t %= 1.0
    if t < g.duty:
        s = t / g.duty
        ax = g.contact_x + (g.toeoff_x - g.contact_x) * s
        # foot roll: heel strike (toe up) -> flat -> heel off rolling over the toe
        if s < 0.12:
            pitch = 14.0 * (1 - s / 0.12)
        elif s < 0.62:
            pitch = 0.0
        else:
            pitch = -34.0 * ((s - 0.62) / 0.38) ** 1.4
        contact = True
    else:
        s = (t - g.duty) / (1 - g.duty)
        ax, lift = _catmull(g.swing_keys, s)
        contact = False

    def knee_for(ankle: tuple[float, float]) -> tuple[float, float]:
        # knees bend forward: keep the IK solution whose knee lies in front of the hip-ankle line
        knee = _ik(hip, ankle, THIGH, SHIN, bend=1.0)
        hx, hy = hip
        cross = (ankle[0] - hx) * (knee[1] - hy) - (ankle[1] - hy) * (knee[0] - hx)
        return knee if cross >= 0 else _ik(hip, ankle, THIGH, SHIN, bend=-1.0)

    heel_l, toe_l = (-HEEL, -ANKLE_H), (FOOT - HEEL, -ANKLE_H)
    ball_l = ((FOOT - HEEL) * 0.7, -ANKLE_H)
    if not contact:
        # a swinging foot hangs off the shin: perpendicular to it, plantar-flexed after toe-off
        ankle = (ax, ANKLE_H + lift)
        knee = knee_for(ankle)
        shin = math.degrees(math.atan2(ankle[1] - knee[1], ankle[0] - knee[0]))
        pitch = shin + 90.0 - 38.0 * (1 - s) ** 1.5 + 6.0 * max(0.0, (s - 0.7) / 0.3)
    p = math.radians(pitch)
    c, sn = math.cos(p), math.sin(p)

    def rot(q: tuple[float, float]) -> tuple[float, float]:
        return q[0] * c - q[1] * sn, q[0] * sn + q[1] * c

    if contact and pitch > 0:  # rolling on the heel
        h = rot(heel_l)
        ankle = (ax - HEEL - h[0], -h[1])
    elif contact and pitch < 0:  # rolling over the ball of the foot
        b = rot(ball_l)
        ankle = (ax + ball_l[0] - b[0], -b[1])
    elif contact:
        ankle = (ax, ANKLE_H)
    if not contact:  # keep the swinging foot above the ground
        low = min(rot(heel_l)[1], rot(toe_l)[1]) + ankle[1]
        if low < 0.006:
            ankle = (ankle[0], ankle[1] + 0.006 - low)
    knee = knee_for(ankle)
    toe = (ankle[0] + rot(toe_l)[0], max(0.0, ankle[1] + rot(toe_l)[1]))  # toes flex at the ball
    heel = (ankle[0] + rot(heel_l)[0], ankle[1] + rot(heel_l)[1])
    return {"hip": hip, "knee": knee, "ankle": ankle, "toe": toe, "heel": heel,
            "contact": contact, "x_rel": ax}


def _hip_height(g: Gait, t: float) -> float:
    # two bobs per cycle, lowest just after each touchdown
    step = (t * 2.0) % 1.0
    return g.hip_mid - g.bob / 2 + g.bob / 2 * (1 - math.cos(2 * math.pi * (step - g.bob_low_phase)))


def pose(g: Gait, t: float) -> dict:
    """Full body pose at phase t. Near (camera-side) limbs are the right arm and the left leg."""
    hip_y = _hip_height(g, t)
    lean = math.radians(g.lean_deg)
    pelvis = (0.0, hip_y)
    hip_near = (pelvis[0] - HIP_SPREAD / 2, hip_y)  # 3/4 view: the near side sits slightly back
    hip_far = (pelvis[0] + HIP_SPREAD / 2, hip_y)
    near_leg = _leg(g, t, hip_near)  # touches down at t = 0
    far_leg = _leg(g, t + 0.5, hip_far)
    neck = (pelvis[0] + math.sin(lean) * TORSO, hip_y + math.cos(lean) * TORSO)
    head = (neck[0] + math.sin(lean) * (NECK + HEAD_R) + 0.012, neck[1] + math.cos(lean) * (NECK + HEAD_R))
    arms = {}
    for side, leg_x, sx in (("near", far_leg["x_rel"], NEAR_SHOULDER_DX),
                             ("far", near_leg["x_rel"], FAR_SHOULDER_DX)):
        # an arm swings with the opposite leg: forward when that leg is forward
        span = (g.contact_x - g.toeoff_x) / 2
        mid = (g.contact_x + g.toeoff_x) / 2
        swing = max(-1.2, min(1.2, (leg_x - mid) / span))
        sh_ang = math.radians(g.arm_swing_deg * swing) + lean * 0.6
        shoulder = (neck[0] + sx, neck[1] - 0.03)
        elbow = (shoulder[0] + UPPER_ARM * math.sin(sh_ang), shoulder[1] - UPPER_ARM * math.cos(sh_ang))
        el = math.radians(g.elbow_base_deg + g.elbow_swing_deg * swing)
        fa = sh_ang + el
        wrist = (elbow[0] + FOREARM * math.sin(fa), elbow[1] - FOREARM * math.cos(fa))
        hand = (wrist[0] + HAND * math.sin(fa), wrist[1] - HAND * math.cos(fa))
        arms[side] = {"shoulder": shoulder, "elbow": elbow, "wrist": wrist, "hand": hand}
    return {
        "t": t,
        "pelvis": pelvis,
        "neck": neck,
        "head": head,
        "legs": {"near": near_leg, "far": far_leg},
        "arms": arms,
        "contact": [k for k, leg in (("near", near_leg), ("far", far_leg)) if leg["contact"]],
    }


def cycle(g: Gait) -> list[dict]:
    return [pose(g, i / g.frames) for i in range(g.frames)]


def stance_speed(g: Gait) -> float:
    """Ground speed (H per second) that keeps the stance foot planted."""
    cycle_s = g.frames / g.fps
    return (g.contact_x - g.toeoff_x) / (g.duty * cycle_s)


def lowest_point(p: dict) -> float:
    return min(min(leg["toe"][1], leg["heel"][1]) for leg in p["legs"].values())


def describe(g: Gait) -> list[str]:
    """Human-readable key-pose name per frame, used in prompts and previews."""
    out = []
    for i, p in enumerate(cycle(g)):
        t = i / g.frames
        step = (t * 2) % 1.0
        lead = "near" if t < 0.5 else "far"
        if not p["contact"]:
            name = "flight"
        elif step < 0.05:
            name = "contact"
        elif step < 0.3:
            name = "down"
        elif step < 0.55:
            name = "passing"
        else:
            name = "up"
        out.append(f"{name} ({lead} leg leading)")
    return out
