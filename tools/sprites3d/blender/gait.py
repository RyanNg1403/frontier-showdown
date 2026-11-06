"""Locomotion and stance poses authored in code.

Everything here is in armature space (MakeHuman: forward is -Y, up is +Z, the rig's left is +X). A pose
generator returns, per frame, a `Pose`: pelvis translation and absolute bone rotations ("deltas": the
rotation from the rest orientation to the posed one, in armature space), ankle targets for the legs and
arm swing angles. `posing.apply_pose` turns that into keyframes, solving the legs with an analytic
two-bone IK so the ankles land exactly where the gait put them.

Cycles are in place: the planted foot moves backwards at a constant speed, which is the speed the engine
must move the fighter at (`strideSpeed`). The foot pivots on the heel at contact and on the ball at
toe-off, and the pivot point never moves relative to the ground, so there is no foot sliding by
construction. The renderer measures the real travel of the planted foot afterwards anyway.
"""

import math
from dataclasses import dataclass, field

from mathutils import Quaternion, Vector

FWD = Vector((0.0, -1.0, 0.0))
UP = Vector((0.0, 0.0, 1.0))
LAT = Vector((1.0, 0.0, 0.0))


def rx(deg):
    """Pitch: positive tilts up-vectors forward and lifts heels."""
    return Quaternion(LAT, math.radians(deg))


def rz(deg):
    """Yaw: positive brings the rig's right side forward."""
    return Quaternion(UP, math.radians(deg))


def ry(deg):
    """Roll: positive drops the rig's left side."""
    return Quaternion(FWD, math.radians(-deg))


def lerp(a, b, t):
    return a + (b - a) * t


def smooth(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def keyed(t, keys):
    """Piecewise smooth interpolation through (t, value) keys sorted by t, t in [0, 1]."""
    if t <= keys[0][0]:
        return keys[0][1]
    for (t0, v0), (t1, v1) in zip(keys, keys[1:]):
        if t <= t1:
            return lerp(v0, v1, smooth((t - t0) / (t1 - t0)))
    return keys[-1][1]


@dataclass
class Pose:
    pelvis_offset: Vector = field(default_factory=Vector)
    pelvis: Quaternion = field(default_factory=Quaternion)
    spine: tuple = (Quaternion(), Quaternion(), Quaternion())
    neck: Quaternion = field(default_factory=Quaternion)
    head: Quaternion = field(default_factory=Quaternion)
    ankle: dict = field(default_factory=dict)        # side -> armature-space ankle position
    foot_pitch: dict = field(default_factory=dict)   # side -> degrees, + lifts the heel
    toe_pitch: dict = field(default_factory=dict)    # side -> world pitch of the toes, None = rigid with foot
    foot_yaw: dict = field(default_factory=dict)     # side -> degrees of toe-out
    knee_out: dict = field(default_factory=dict)     # side -> lateral knee direction bias
    arm: dict = field(default_factory=dict)          # side -> (swing deg, elbow deg, splay deg) relative to the chest
    fist: float = 0.3
    fist_side: dict = field(default_factory=dict)  # side -> fist amount, overrides `fist`
    hand_twist: dict = field(default_factory=dict)  # side -> wrist twist about the forearm, degrees
    contact: dict = field(default_factory=dict)      # side -> True while the foot is planted
    body: Quaternion = field(default_factory=Quaternion)  # whole-body rotation about the pelvis (falls, throws)
    leg_fk: dict = field(default_factory=dict)       # side -> (hip, knee, foot) degrees: FK leg instead of IK


class Skeleton:
    """Rest measurements the generators need."""

    def __init__(self, rest, feet):
        self.rest = rest
        self.hip = {s: rest[f"thigh_{s}"]["head"] for s in "lr"}
        self.ankle = {s: rest[f"foot_{s}"]["head"] for s in "lr"}
        self.ball = {s: rest[f"ball_{s}"]["head"] for s in "lr"}
        self.heel = {s: feet[s]["heel"] for s in "lr"}
        self.thigh = rest["thigh_l"]["length"]
        self.calf = rest["calf_l"]["length"]
        self.leg = self.thigh + self.calf
        self.pelvis = rest["pelvis"]["head"]
        self.ground = min(feet[s]["ground"] for s in "lr")
        self.ankle_h = self.ankle["l"].z - self.ground


# --------------------------------------------------------------------------------------------- feet

def foot_on_ground(sk, side, flat_f, pitch, lateral):
    """Ankle position for a planted foot whose flat placement is `flat_f` metres forward, pitched about the
    heel (pitch < 0) or the ball (pitch > 0)."""
    a = Vector((lateral, sk.ankle[side].y, sk.ankle[side].z)) + FWD * flat_f
    if abs(pitch) < 1e-6:
        return a
    pivot_rest = sk.heel[side] if pitch < 0 else sk.ball[side]
    off = Vector((0.0, pivot_rest.y - sk.ankle[side].y, pivot_rest.z - sk.ankle[side].z))
    if pitch > 0:
        off.z = sk.ground - sk.ankle[side].z  # the ball pivots on the floor
    pivot = a + off
    return pivot + rx(pitch) @ (a - pivot)


@dataclass
class GaitParams:
    frames: int = 12
    duty: float = 0.6            # fraction of the cycle a foot is planted
    step: float = 0.74           # step length in leg lengths
    strike_bias: float = 0.02    # how far ahead of centre the foot lands (fraction of stance travel)
    strike_pitch: float = -16.0  # toes up at contact
    flat_at: float = 0.10        # cycle phase where the foot is flat ("down")
    heel_off: float = 0.32       # cycle phase where the heel starts lifting
    toe_off_pitch: float = 38.0
    # swing path keys: (swing fraction, fraction of the way from toe-off to strike, ankle lift in leg lengths)
    swing_keys: tuple = ((0.25, 0.22, 0.16), (0.55, 0.6, 0.085), (0.85, 1.03, 0.045))
    # swing foot pitch keys: (swing fraction, degrees); the ends come from toe_off_pitch and strike_pitch
    swing_pitch: tuple = ((0.25, 20.0), (0.6, 4.0), (0.85, -6.0))
    width: float = 0.085         # half the distance between the feet, metres
    crouch: float = 0.025        # constant pelvis drop, leg lengths
    bob: float = 0.022           # pelvis bob amplitude, leg lengths
    bob_low: float = 0.08        # cycle phase of the lowest pelvis ("down")
    lean: float = 3.0            # forward torso lean, degrees
    pelvis_tilt: float = 2.0     # extra anterior pelvis tilt
    lean_pulse: float = 1.0      # torso pitch oscillation (twice per cycle)
    pelvis_yaw: float = 6.0
    pelvis_roll: float = 3.0
    shoulder_counter: float = 0.9
    arm_swing: float = 20.0
    arm_offset: float = 2.0
    arm_lag: float = 0.04
    elbow: float = 14.0
    elbow_swing: float = 16.0
    arm_splay: float = 9.0
    head_level: float = 0.8      # how much the head cancels the torso lean
    fist: float = 0.35


WALK = GaitParams()

RUN = GaitParams(
    frames=10, duty=0.38, step=1.25, strike_bias=-0.12, strike_pitch=-6.0, flat_at=0.05, heel_off=0.15,
    toe_off_pitch=52.0,
    swing_keys=((0.2, 0.3, 0.4), (0.45, 0.62, 0.46), (0.7, 0.97, 0.27), (0.88, 1.08, 0.09)),
    swing_pitch=((0.2, 70.0), (0.5, 40.0), (0.8, 4.0)),
    width=0.06, crouch=0.03, bob=0.05, bob_low=0.19, lean=19.0, pelvis_tilt=5.0,
    lean_pulse=1.5, pelvis_yaw=9.0, pelvis_roll=2.0, shoulder_counter=1.0, arm_swing=46.0, arm_offset=8.0,
    arm_lag=0.02, elbow=84.0, elbow_swing=20.0, arm_splay=12.0, head_level=0.7, fist=1.0)


def params_from(base, overrides):
    p = GaitParams(**base.__dict__)
    for k, v in (overrides or {}).items():
        setattr(p, k, v)
    return p


def _leg(sk, p, side, phase):
    """Ankle position, foot pitch, toe pitch and contact flag for one leg at its own phase (0 = contact)."""
    L = sk.leg
    stride = 2 * p.step * L
    beta = p.duty
    f_strike = stride * beta * (0.5 + p.strike_bias)
    lateral = p.width if side == "l" else -p.width

    def stance_pitch(ph):
        if ph < p.flat_at:
            return lerp(p.strike_pitch, 0.0, smooth(ph / p.flat_at))
        if ph < p.heel_off:
            return 0.0
        u = (ph - p.heel_off) / (beta - p.heel_off)
        return p.toe_off_pitch * u ** 1.6

    if phase < beta:
        pitch = stance_pitch(phase)
        ankle = foot_on_ground(sk, side, f_strike - stride * phase, pitch, lateral)
        toe = 0.0 if pitch > 0 else None
        return ankle, pitch, toe, True

    s = (phase - beta) / (1 - beta)
    f_off = f_strike - stride * beta
    a0 = foot_on_ground(sk, side, f_off, p.toe_off_pitch, lateral)
    a1 = foot_on_ground(sk, side, f_strike, p.strike_pitch, lateral)
    pts = [(0.0, a0)]
    for ks, kf, kh in p.swing_keys:
        q = Vector((lateral, sk.ankle[side].y, sk.ankle[side].z + kh * L)) + FWD * lerp(f_off, f_strike, kf)
        pts.append((ks, q))
    pts.append((1.0, a1))
    ground_v = -FWD * (stride * (1 - beta))  # planted feet move back at ground speed (per unit of swing)
    ankle = hermite(pts, s, ground_v + UP * (0.6 * L), ground_v * 0.35 - UP * (0.25 * L))
    pitch = keyed(s, [(0.0, p.toe_off_pitch)] + list(p.swing_pitch) + [(1.0, p.strike_pitch)])
    toe = None if s > 0.12 else 0.0
    return ankle, pitch, toe, False


def hermite(points, s, v_start, v_end):
    """Cubic Hermite spline through (s, Vector) points with Catmull-Rom tangents and given end velocities."""
    n = len(points)
    tangents = []
    for i in range(n):
        if i == 0:
            tangents.append(v_start)
        elif i == n - 1:
            tangents.append(v_end)
        else:
            (s0, p0), (s2, p2) = points[i - 1], points[i + 1]
            tangents.append((p2 - p0) / (s2 - s0))
    for i in range(n - 1):
        (s0, p0), (s1, p1) = points[i], points[i + 1]
        if s <= s1 or i == n - 2:
            h = s1 - s0
            t = (s - s0) / h
            h00, h10 = 2 * t ** 3 - 3 * t ** 2 + 1, t ** 3 - 2 * t ** 2 + t
            h01, h11 = -2 * t ** 3 + 3 * t ** 2, t ** 3 - t ** 2
            return p0 * h00 + tangents[i] * (h10 * h) + p1 * h01 + tangents[i + 1] * (h11 * h)
    return points[-1][1]


def locomotion(sk, p):
    """Frames of a walk or run cycle. Frame 0 is the right foot's contact pose."""
    L = sk.leg
    poses = []
    for f in range(p.frames):
        ph = f / p.frames
        pose = Pose(fist=p.fist)
        for side, off in (("r", 0.0), ("l", 0.5)):
            lp = (ph + off) % 1.0
            ankle, pitch, toe, contact = _leg(sk, p, side, lp)
            pose.ankle[side] = ankle
            pose.foot_pitch[side] = pitch
            pose.toe_pitch[side] = toe
            pose.contact[side] = contact
            pose.foot_yaw[side] = 4.0

        yaw = p.pelvis_yaw * math.cos(2 * math.pi * ph)
        roll = p.pelvis_roll * math.sin(2 * math.pi * ph)
        bob = -p.bob * L * math.cos(2 * math.pi * 2 * (ph - p.bob_low))
        pulse = p.lean_pulse * math.cos(2 * math.pi * 2 * (ph - p.bob_low))
        pose.pelvis_offset = Vector((0.0, 0.0, -p.crouch * L + bob))
        pose.pelvis = rz(yaw) @ rx(p.lean * 0.5 + p.pelvis_tilt) @ ry(roll)
        lean = p.lean + pulse
        pose.spine = (rz(yaw * 0.45) @ rx(lean * 0.8),
                      rz(-yaw * 0.1) @ rx(lean),
                      rz(-yaw * p.shoulder_counter) @ rx(lean))
        pose.neck = rz(-yaw * 0.4) @ rx(lean * (1 - p.head_level) + 4)
        pose.head = rz(-yaw * 0.1) @ rx(lean * (1 - p.head_level))

        for side, sign in (("r", -1.0), ("l", 1.0)):
            c = math.cos(2 * math.pi * (ph - p.arm_lag))
            swing = p.arm_offset + sign * p.arm_swing * c
            fwd = max(0.0, swing / max(p.arm_swing, 1e-3))
            pose.arm[side] = (swing, p.elbow + p.elbow_swing * fwd, p.arm_splay)
            pose.hand_twist[side] = 35.0 * p.fist
        poses.append(pose)
    return poses


def fit_pelvis(sk, rest, poses, posing):
    """Lower the pelvis on frames where a leg could not reach its ankle target (a straight leg would lift
    the planted foot and make it slide)."""
    limit = 0.992 * sk.leg
    for pose in poses:
        for _ in range(40):
            hips = posing.hip_positions(rest, pose)
            planted = [s for s in "lr" if pose.contact.get(s)] or []
            if not planted:
                break
            worst = max((pose.ankle[s] - hips[s]).length for s in planted)
            if worst <= limit:
                break
            pose.pelvis_offset.z -= worst - limit + 0.001
    return poses


# --------------------------------------------------------------------------------------------- stances
# Kept for callers of the first pipeline version; the shared states live in shared.py.

def fighting_stance(sk, frames=8, **_):
    import shared
    return shared.idle(sk, frames).poses


def idle_breathing(sk, frames=8):
    return fighting_stance(sk, frames)


def dash_forward(sk, frames=6):
    import shared
    return shared.dash_fwd(sk).poses
