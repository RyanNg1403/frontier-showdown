"""Move authoring core for Liang, Mustafa, Geoffrey, Noam, Chris and Fei-Fei.

Keys are flat dicts of floats (see GUARD) so they interpolate component by component. `to_pose` turns a key
into a `gait.Pose` through `shared.pose_from`: every parameter is applied as a delta from this GUARD onto
`shared.GUARD`, so a clip that starts and ends on GUARD (or CROUCH / AIR in library.py) starts and ends exactly
on the shared idle (crouch, jump apex). On top of the shared vocabulary this layer adds:

    a?_aim / a?_ah  aim an arm straight at the opponent at a given rise (fitted to hitboxes)
    lk_up / rk_up   > 0.3 on a lifted foot switches that leg to FK, solved so the ankle lands on its target
    lk_ext / rk_ext minimum FK leg extension (fraction of its length); the hitbox fit sets it on strike keys
    n_yaw / h_yaw   neck and head yaw beyond what the chest twist gives (glances)

Positions are in leg lengths (L), angles in degrees, in the rig's armature space (forward -Y, the rig's left is
+X and far from the camera). Lead = left foot/arm (`lf_*`, `al_*`), rear = right (`rf_*`, `ar_*`).
"""

import math
from dataclasses import dataclass, field

from mathutils import Vector

import shared
from gait import FWD, UP, rx, rz

GUARD = {
    "lf_f": 0.30, "lf_l": 0.11, "lf_h": 0.0, "lf_p": 0.0, "lf_yaw": 14.0, "lk_up": 0.0, "lk_out": 0.2, "lk_ext": 0.0,
    "rf_f": -0.34, "rf_l": -0.14, "rf_h": 0.0, "rf_p": 0.0, "rf_yaw": 38.0, "rk_up": 0.0, "rk_out": 0.35, "rk_ext": 0.0,
    "drop": 0.166, "pfwd": 0.0, "p_yaw": -24.0, "p_pitch": 4.0, "p_roll": 0.0,
    "c_yaw": -36.0, "c_pitch": 7.0, "c_roll": 0.0,
    "n_yaw": -14.0, "n_pitch": 2.0, "h_yaw": -6.0, "h_pitch": -1.0, "h_roll": 0.0,
    "al_sw": 66.0, "al_el": 108.0, "al_sp": 8.0, "al_aim": 0.0, "al_ah": 0.0,
    "ar_sw": 26.0, "ar_el": 132.0, "ar_sp": 20.0, "ar_aim": 0.0, "ar_ah": 0.0,
    "fist_l": 1.0, "fist_r": 1.0,
}

# this vocabulary -> shared.pose_from, applied as deltas from GUARD onto shared.GUARD
DELTAS = {
    "lf_f": "lead_f", "lf_l": "lead_x", "lf_h": "lead_lift", "lf_p": "lead_pitch", "lf_yaw": "lead_toe",
    "lk_out": "knee_lead", "rf_f": "rear_f", "rf_l": "rear_x", "rf_h": "rear_lift", "rf_p": "rear_pitch",
    "rf_yaw": "rear_toe", "rk_out": "knee_rear", "drop": "crouch", "pfwd": "fwd", "p_yaw": "yaw", "p_pitch": "lean",
    "c_yaw": "chest_yaw", "c_pitch": "chest_lean", "n_pitch": "neck", "h_pitch": "head", "h_roll": "head_roll",
}


def pose(*parts, **kw):
    """Merge pose fragments left to right on top of GUARD."""
    p = dict(GUARD)
    for part in parts:
        p.update(part)
    p.update(kw)
    return p


def ease(t, mode):
    t = max(0.0, min(1.0, t))
    if mode == "linear":
        return t
    if mode == "out":   # fast start: strikes
        return 1 - (1 - t) ** 2
    if mode == "in":    # slow start: wind-ups
        return t * t
    return t * t * (3 - 2 * t)


# ------------------------------------------------------------------------------------------- timing

@dataclass
class Timing:
    frames: int
    hit: int          # first active frame (index); None for clips without one
    hold: int         # last frame of the active pose
    fps: float


def timing_from(data, pre=None, post=None, max_post=9):
    """Clip length and hit frame from startup/active/recovery (60 Hz). The engine plays frames 0..hit-1 over
    the startup and the rest over active + recovery, so only the split matters; fps makes the clip last as
    long as the move."""
    s, a, r = data["startup"], data["active"], data["recovery"]
    n_pre = pre if pre is not None else max(2, min(6, round(s / 3.5)))
    n_post = post if post is not None else max(3, min(max_post, round((a + r) / 4.5)))
    hold = n_pre + max(0, min(n_post - 2, round(a / 5.0) - 1))
    total = s + a + r - 1
    return Timing(n_pre + n_post, n_pre, hold, round((n_pre + n_post) * 60.0 / total, 2))


def free_timing(frames, fps, hit=None):
    return Timing(frames, hit, hit if hit is not None else frames - 1, fps)


def resolve(anchor, t):
    """Key anchors: an int frame, 'start', 'wind' (hit-1), 'hit', 'hold', 'mid', 'end', with optional +n/-n,
    or a float fraction of the clip."""
    if isinstance(anchor, float):
        return anchor * (t.frames - 1)
    if isinstance(anchor, int):
        return float(anchor)
    name, off = anchor, 0
    for sign in "+-":
        if sign in anchor[1:]:
            name, num = anchor.split(sign, 1)
            off = int(num) * (1 if sign == "+" else -1)
    base = {"start": 0, "end": t.frames - 1, "hit": t.hit, "hold": t.hold,
            "wind": (t.hit or 1) - 1, "mid": (t.frames - 1) / 2}[name]
    return float(base + off)


def sample(keys, t):
    """keys: [(anchor, pose dict, ease mode into this key)]. Returns one pose dict per frame."""
    pts = sorted(((resolve(k[0], t), k[1], k[2] if len(k) > 2 else "smooth") for k in keys), key=lambda x: x[0])
    out = []
    for f in range(t.frames):
        if f <= pts[0][0]:
            out.append(dict(pts[0][1]))
            continue
        if f >= pts[-1][0]:
            out.append(dict(pts[-1][1]))
            continue
        for (f0, p0, _), (f1, p1, mode) in zip(pts, pts[1:]):
            if f0 <= f <= f1:
                u = ease((f - f0) / max(f1 - f0, 1e-6), mode)
                out.append({k: p0[k] + (p1[k] - p0[k]) * u for k in p0})
                break
    return out


# ------------------------------------------------------------------------------------------ moves

@dataclass
class Prop:
    name: str
    bone: str = None                 # follow a pose bone, or None for a fixed spot on the floor
    offset: tuple = (0.0, 0.0, 0.0)  # "bone": the bone's frame (Y along the bone); "rig": armature axes in metres
                                     # from the bone head; no bone: (lateral m, forward L, up L) from the anchor
    rotation: tuple = (0.0, 0.0, 0.0)
    frames: tuple = None             # (first, last) visible frames; anchors allowed
    upright: bool = True             # keep the rig's orientation instead of the bone's
    space: str = "bone"


@dataclass
class Move:
    anim: str
    timing: Timing
    keys: list
    loop: bool = False
    props: list = field(default_factory=list)
    events: list = None              # defaults to a hit event on the first active frame
    note: str = ""
    reach: tuple = None              # (limb, hitbox): fit that limb into the move's hitbox on the hit/hold keys
    head: str = "threequarter"

    def frames(self):
        return sample(self.keys, self.timing)

    def event_list(self):
        if self.events is not None:
            return self.events
        return [{"frame": self.timing.hit, "type": "hit"}] if self.timing.hit is not None else []

    def fit(self, sk, ppm, rest):
        """Place the striking limb inside its hitbox (px from the feet anchor, y negative is up), so the art
        and the engine's box agree. Legs set the ankle target; arms set the aim of a straight arm."""
        if not self.reach:
            return
        limb, box = self.reach
        Lpx = sk.leg * ppm
        far = (box["x"] + box["w"] * 0.85) / Lpx
        height = -(box["y"] + box["h"] / 2) / Lpx
        fitted = []
        for key in self.keys:
            anchor, p = key[0], key[1]
            if anchor in ("hit", "hold") or (isinstance(anchor, str) and anchor.startswith(("hit+", "hold"))):
                p = dict(p)
                if limb in ("lf", "rf"):
                    p[limb + "_f"] = max(0.2, far - 0.24)
                    p[limb + "_h"] = max(0.03, height - 0.06 - sk.ankle_h / sk.leg)
                    p[limb[0] + "k_ext"] = 0.95
                else:
                    shoulder = (rest[f"upperarm_{limb[1]}"]["head"].z - sk.ground) / sk.leg - p["drop"]
                    p[limb + "_aim"] = 1.0
                    p[limb + "_ah"] = (height - shoulder) / max(far - p["pfwd"] - 0.1, 0.5)
            fitted.append((anchor, p) + tuple(key[2:]))
        self.keys = fitted


# ------------------------------------------------------------------------------------- to gait.Pose

def _arm(chest, p, side, sign):
    sw, el, sp = p[f"a{side}_sw"], p[f"a{side}_el"], p[f"a{side}_sp"]
    aim = p[f"a{side}_aim"]
    if aim > 0:
        d = (FWD + UP * p[f"a{side}_ah"]).normalized()
        local = chest.inverted() @ d
        aim_sp = math.degrees(math.asin(max(-1.0, min(1.0, sign * local.x))))
        aim_sw = math.degrees(math.atan2(-local.y, -local.z))
        sw, sp = sw + (aim_sw - sw) * aim, sp + (aim_sp - sp) * aim
    return (sw, el, sp)


def _ankle_target(sk, p, pre):
    L = sk.leg
    s = pre[0]
    base = Vector((p[pre + "_l"], sk.ankle[s].y, sk.ankle[s].z)) + FWD * (p[pre + "_f"] * L)
    return base + UP * (p[pre + "_h"] * L)


def _fk_leg(sk, rest, pose, side, target, pitch, ext):
    """(hip, knee, foot) degrees in the pelvis frame that put the ankle on `target` with the knee forward.
    The foot points along the shin in proportion to the authored pitch (55 or more = fully pointed)."""
    import posing
    hip = posing.hip_positions(rest, pose)[side]
    local = (pose.body @ pose.pelvis).inverted() @ (target - hip)
    l1, l2 = rest[f"thigh_{side}"]["length"], rest[f"calf_{side}"]["length"]
    d = max(abs(l1 - l2) + 1e-4, min(l1 + l2 - 1e-4, max(local.length, ext * (l1 + l2))))
    line = math.degrees(math.atan2(-local.y, -local.z))
    alpha = math.degrees(math.acos(max(-1.0, min(1.0, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)))))
    beta = math.degrees(math.acos(max(-1.0, min(1.0, (l2 * l2 + d * d - l1 * l1) / (2 * l2 * d)))))
    hip_a, knee_a = line + alpha, alpha + beta
    calf = hip_a - knee_a
    foot_a = (90.0 - calf) * max(0.0, min(1.0, pitch / 55.0))
    return (hip_a, knee_a, foot_a)


def to_pose(sk, rest, p):
    q = {}
    for mine, theirs in DELTAS.items():
        q[theirs] = shared.GUARD[theirs] + (p[mine] - GUARD[mine])
    chest = rz(q["chest_yaw"]) @ rx(q["chest_lean"])
    q["lead_arm"] = _arm(chest, p, "l", 1.0)
    q["rear_arm"] = _arm(chest, p, "r", -1.0)
    q["fist_lead"], q["fist_rear"] = p["fist_l"], p["fist_r"]
    q["fist"] = max(p["fist_l"], p["fist_r"])
    q["twist"] = shared.GUARD["twist"] * max(p["fist_l"], p["fist_r"])
    pose = shared.pose_from(sk, q)
    fk = False
    for pre, side, sh in (("lf", "l", "lead"), ("rf", "r", "rear")):
        if p[pre + "_h"] >= 0.02 and p[pre[0] + "k_up"] > 0.3:
            q[sh + "_fk"] = _fk_leg(sk, rest, pose, side, _ankle_target(sk, p, pre), p[pre + "_p"],
                                    p[pre[0] + "k_ext"])
            fk = True
    if fk:
        pose = shared.pose_from(sk, q)
    # shared.pose_from yaws the neck and head by 0.4 and 0.15 of the chest twist; add the authored glance.
    def glance(key, share, chest_yaw):
        return p[key] - share * p["c_yaw"] - (GUARD[key] - share * chest_yaw)

    pose.neck = rz(glance("n_yaw", 0.4, GUARD["c_yaw"])) @ pose.neck
    pose.head = rz(glance("h_yaw", 0.15, GUARD["c_yaw"])) @ pose.head
    return pose
