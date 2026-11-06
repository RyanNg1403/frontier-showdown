"""Shared fighting-game states, the same for every fighter (proportions come from the fighter's rig).

States are authored as keyframes of a small parameter set layered over the orthodox guard (`GUARD`): foot
placement, crouch, lean, chest twist, arm swing/elbow, whole-body rotation for falls and throws, FK legs for
sitting, kneeling and lying. `pose_from` turns one parameter set into a `gait.Pose`; `keyed` builds a list of
poses from keyframes (dicts are merged over the guard, so a key only lists what changes).

Naming: the "lead" side is the rig's left (the far side, leading in an orthodox guard facing right), the
"rear" side is the rig's right (the near, camera side). Lengths are in leg lengths (`sk.leg`), angles in
degrees. Arm tuples are (swing forward from hanging, elbow bend, splay out), relative to the chest.

Move modules under `moves/` can import `Anim`, `GUARD`, `pose_from`, `keyed` and `tween` from here.
"""

import math
from dataclasses import dataclass, field

from gait import FWD, RUN, UP, WALK, Pose, fit_pelvis, foot_on_ground, locomotion, params_from, rx, ry, rz

GUARD = dict(
    lead_f=0.30, rear_f=-0.34, lead_x=0.11, rear_x=-0.14, lead_lift=0.0, rear_lift=0.0,
    lead_pitch=0.0, rear_pitch=0.0, lead_toe=14.0, rear_toe=38.0, knee_lead=0.2, knee_rear=0.35,
    crouch=0.16, pelvis_h=None, fwd=0.0,
    yaw=-24.0, lean=5.0, chest_yaw=-36.0, chest_lean=7.0, neck=2.0, head=-1.0, head_roll=0.0,
    lead_arm=(66.0, 108.0, 8.0), rear_arm=(26.0, 132.0, 20.0), fist=1.0, fist_lead=None, fist_rear=None,
    twist=40.0, body=0.0, roll=0.0, lead_fk=None, rear_fk=None,
)


@dataclass
class Anim:
    poses: list
    fps: float
    loop: bool = True
    events: list = field(default_factory=list)   # [{"frame": k, "type": "hit"}, ...]
    head: str = "threequarter"                     # 2D head view: threequarter | profile | hurt | <custom>
    locomotion: bool = False                       # strideSpeed is measured from the planted foot
    derived: list = field(default_factory=list)    # [{"name", "reverse", "speed"}] extra atlas entries


def pose_from(sk, p):
    q = dict(GUARD)
    q.update(p)
    L = sk.leg
    pose = Pose()
    for side, pre in (("l", "lead"), ("r", "rear")):
        lift = q[pre + "_lift"]
        pitch = q[pre + "_pitch"]
        pose.ankle[side] = foot_on_ground(sk, side, q[pre + "_f"] * L, pitch, q[pre + "_x"]) + UP * (lift * L)
        fk = q[pre + "_fk"]
        planted = lift <= 0.002 and fk is None
        pose.contact[side] = planted
        pose.foot_pitch[side] = pitch
        pose.toe_pitch[side] = 0.0 if (planted and pitch > 0) else None
        pose.foot_yaw[side] = q[pre + "_toe"]
        pose.knee_out[side] = q["knee_" + pre]
        if fk is not None:
            pose.leg_fk[side] = tuple(fk) + (0.0,) * (3 - len(fk))
        f = q["fist_" + pre]
        pose.fist_side[side] = q["fist"] if f is None else f
        pose.hand_twist[side] = q["twist"]
    pose.arm = {"l": tuple(q["lead_arm"]), "r": tuple(q["rear_arm"])}
    pose.fist = q["fist"]
    rest_h = sk.pelvis.z - sk.ground
    z = (q["pelvis_h"] * L - rest_h) if q["pelvis_h"] is not None else -q["crouch"] * L
    pose.pelvis_offset = FWD * (q["fwd"] * L) + UP * z
    yaw, lean, cy, cl = q["yaw"], q["lean"], q["chest_yaw"], q["chest_lean"]
    pose.pelvis = rz(yaw) @ rx(lean * 0.6)
    pose.spine = (rz(yaw * 1.1) @ rx(lean * 0.8), rz((yaw + cy) / 2) @ rx((lean + cl) / 2), rz(cy) @ rx(cl))
    pose.neck = rz(cy * 0.4) @ rx(q["neck"])
    pose.head = rz(cy * 0.15) @ rx(q["head"]) @ ry(q["head_roll"])
    pose.body = rx(q["body"]) @ ry(q["roll"])
    return pose


def tween(a, b, t):
    """Blend two parameter dicts (merged over the guard). Tuples blend element-wise; None takes the nearer key."""
    qa, qb = dict(GUARD), dict(GUARD)
    qa.update(a)
    qb.update(b)
    out = {}
    for k in qa:
        va, vb = qa[k], qb[k]
        if va is None or vb is None:
            out[k] = va if t < 0.5 else vb
        elif isinstance(va, tuple) or isinstance(vb, tuple):
            out[k] = tuple(x + (y - x) * t for x, y in zip(va, vb))
        else:
            out[k] = va + (vb - va) * t
    return out


def keyed(sk, keys):
    return [pose_from(sk, k) for k in keys]


# ------------------------------------------------------------------------------------------- states

LYING = dict(body=-90.0, pelvis_h=0.13, fwd=-0.08, lead_fk=(12, 8, 0), rear_fk=(5, 4, 0), yaw=-10, chest_yaw=-14,
             lean=0, chest_lean=0, neck=0, head=-8, head_roll=12, lead_arm=(165, 15, 35), rear_arm=(18, 20, 45),
             fist=0.25, twist=0)
SNAP = dict(lean=-14, chest_lean=-22, neck=-20, head=-18, head_roll=6, crouch=0.17, fwd=-0.04,
            lead_arm=(20, 30, 30), rear_arm=(-25, 30, 30), fist=0.5, lead_f=0.26, rear_f=-0.38)


def idle(sk, frames=8):
    keys = []
    for f in range(frames):
        b = math.sin(2 * math.pi * f / frames)
        keys.append(dict(crouch=0.16 + 0.008 * (1 + b) / 2, chest_lean=7 + 1.5 * b, lean=5 + 0.6 * b,
                         lead_arm=(66 + 2 * b, 108, 8), rear_arm=(26 + 2 * b, 132, 20)))
    return Anim(keyed(sk, keys), 8)


def dash_fwd(sk):
    keys = [
        dict(),
        dict(lead_f=0.18, rear_f=-0.42, rear_pitch=35, crouch=0.18, lean=16, chest_lean=18),
        dict(lead_f=0.36, lead_lift=0.12, lead_pitch=-10, rear_f=-0.56, rear_pitch=55, crouch=0.17, lean=22,
             chest_lean=24),
        dict(lead_f=0.50, lead_lift=0.05, rear_f=-0.46, rear_pitch=40, crouch=0.16, lean=18, chest_lean=18),
        dict(lead_f=0.38, rear_f=-0.34, rear_pitch=12, lean=11, chest_lean=11),
        dict(lead_f=0.31),
    ]
    return Anim(keyed(sk, keys), 15, loop=False)


def dash_back(sk):
    keys = [
        dict(),
        dict(lead_pitch=30, lead_f=0.26, crouch=0.20, lean=-6, chest_lean=0),
        dict(lead_lift=0.10, lead_f=0.22, lead_pitch=-5, rear_lift=0.14, rear_f=-0.42, crouch=0.12, lean=-10,
             chest_lean=-4, head=4),
        dict(lead_lift=0.06, rear_lift=0.04, rear_f=-0.46, crouch=0.13, lean=-6, chest_lean=-1),
        dict(rear_f=-0.40, lead_f=0.26, lead_lift=0.03, crouch=0.22, lean=2, chest_lean=4),
        dict(),
    ]
    return Anim(keyed(sk, keys), 15, loop=False)


def jump_start(sk):
    keys = [
        dict(crouch=0.22, lean=10, chest_lean=12, lead_arm=(30, 80, 10), rear_arm=(5, 90, 18)),
        dict(crouch=0.31, lean=15, chest_lean=17, lead_f=0.26, rear_f=-0.30, lead_arm=(-12, 40, 12),
             rear_arm=(-25, 40, 18), fist=0.8),
        dict(crouch=0.0, lead_pitch=42, rear_pitch=48, lean=2, chest_lean=2, lead_arm=(115, 30, 12),
             rear_arm=(92, 40, 18), fist=0.8),
    ]
    return Anim(keyed(sk, keys), 15, loop=False)


def jump_air(sk):
    keys = [
        dict(crouch=0.0, lead_lift=0.12, rear_lift=0.07, lead_f=0.18, rear_f=-0.18, lead_pitch=30, rear_pitch=40,
             lead_arm=(105, 45, 12), rear_arm=(85, 55, 18), lean=2),
        dict(crouch=0.0, lead_lift=0.36, lead_f=0.24, rear_lift=0.28, rear_f=-0.06, lead_pitch=10, rear_pitch=25,
             lean=6, chest_lean=8),
        dict(crouch=0.0, lead_lift=0.42, lead_f=0.24, rear_lift=0.34, rear_f=-0.04, lead_pitch=8, rear_pitch=20,
             lean=8, chest_lean=10),
        dict(crouch=0.0, lead_lift=0.32, lead_f=0.24, rear_lift=0.22, rear_f=-0.14, lead_pitch=10, rear_pitch=25,
             lean=6, chest_lean=8),
    ]
    return Anim(keyed(sk, keys), 10, loop=False)


def jump_land(sk):
    keys = [
        dict(crouch=0.30, lean=14, chest_lean=16, lead_f=0.28, rear_f=-0.30, lead_arm=(35, 65, 14),
             rear_arm=(12, 75, 22)),
        dict(crouch=0.23, lean=9, chest_lean=11, lead_arm=(52, 90, 10), rear_arm=(20, 110, 20)),
        dict(crouch=0.18, lean=6, chest_lean=8),
    ]
    return Anim(keyed(sk, keys), 15, loop=False)


CROUCH = dict(crouch=0.62, lead_f=0.30, rear_f=-0.34, lead_x=0.13, rear_x=-0.16, rear_pitch=38, lean=16,
              chest_lean=20, chest_yaw=-30, lead_arm=(50, 112, 8), rear_arm=(20, 128, 20), neck=-4, head=-10,
              knee_lead=0.3, knee_rear=0.45)


def crouch(sk, frames=4):
    keys = []
    for f in range(frames):
        b = math.sin(2 * math.pi * f / frames)
        k = dict(CROUCH)
        k.update(crouch=0.62 + 0.006 * (1 + b) / 2, chest_lean=20 + 1.2 * b)
        keys.append(k)
    return Anim(keyed(sk, keys), 6)


BLOCK = dict(crouch=0.20, lean=2, chest_lean=12, neck=10, head=14, lead_arm=(74, 118, 8), rear_arm=(50, 134, 18),
             twist=10, fwd=-0.02)


def block(sk):
    a, b = dict(BLOCK), dict(BLOCK)
    b.update(crouch=0.205, fwd=-0.03)
    return Anim(keyed(sk, [a, b]), 8)


def crouch_block(sk):
    a = dict(CROUCH)
    a.update(neck=10, head=14, lean=12, chest_lean=18, lead_arm=(74, 118, 8), rear_arm=(50, 134, 18), twist=10)
    b = dict(a)
    b.update(crouch=0.625)
    return Anim(keyed(sk, [a, b]), 8)


def hit_high(sk):
    impact = dict(SNAP)
    impact.update(lean=-10, chest_lean=-18, neck=-18, head=-22, lead_arm=(30, 40, 25), rear_arm=(-15, 35, 30))
    keys = [impact, SNAP,
            dict(lean=-6, chest_lean=-8, neck=-6, head=-6, lead_arm=(45, 80, 12), rear_arm=(10, 100, 20), fist=0.8),
            dict(lean=0, chest_lean=3, lead_arm=(60, 100, 9), rear_arm=(22, 125, 20))]
    return Anim(keyed(sk, keys), 12, loop=False, head="hurt")


def hit_low(sk):
    base = dict(lean=26, chest_lean=46, neck=16, head=20, crouch=0.25, fwd=-0.05, lead_arm=(12, 112, 4),
                rear_arm=(8, 118, 8), fist=0.6, twist=0)
    keys = [base, dict(base, lean=30, chest_lean=50, crouch=0.28, neck=20),
            tween(base, {}, 0.45), tween(base, {}, 0.8)]
    return Anim(keyed(sk, keys), 12, loop=False, head="hurt")


def knockdown(sk):
    flung = dict(lead_arm=(150, 20, 30), rear_arm=(130, 30, 30), fist=0.3, twist=0, head=-10, neck=-8)
    keys = [
        SNAP,
        dict(flung, body=-25, lead_lift=0.10, rear_lift=0.16, lead_f=0.34, rear_f=-0.12, crouch=0.0, lean=-6,
             chest_lean=-8),
        dict(flung, body=-50, pelvis_h=1.0, lead_fk=(40, 45, 0), rear_fk=(20, 30, 0), lean=-4),
        dict(flung, body=-80, pelvis_h=0.72, lead_fk=(30, 25, 0), rear_fk=(14, 12, 0), lean=0, chest_lean=0),
        dict(LYING, pelvis_h=0.14, lead_fk=(36, 32, 0), rear_fk=(22, 22, 0), lead_arm=(170, 20, 45),
             rear_arm=(150, 25, 40)),
        dict(LYING, body=-85, pelvis_h=0.2, lead_fk=(50, 42, 0), rear_fk=(32, 26, 0), lead_arm=(150, 25, 45),
             rear_arm=(60, 30, 40), head=-4),
        dict(LYING, lead_fk=(24, 18, 0), rear_fk=(14, 10, 0), rear_arm=(30, 20, 45)),
        dict(LYING),
        dict(LYING),
    ]
    return Anim(keyed(sk, keys), 12, loop=False, head="hurt")


def getup(sk):
    keys = [
        dict(LYING),
        dict(LYING, body=-55, pelvis_h=0.13, lead_fk=(75, 100, 0), rear_fk=(55, 70, 0), lead_arm=(-35, 10, 25),
             rear_arm=(-45, 10, 25), head=10, head_roll=0, neck=8, fist=0.4),
        dict(LYING, body=-28, pelvis_h=0.14, lead_fk=(98, 125, 0), rear_fk=(85, 115, 0), lead_arm=(-25, 15, 25),
             rear_arm=(-30, 15, 25), head=6, head_roll=0, neck=6, fist=0.5),
        dict(crouch=0.45, lean=34, chest_lean=30, lead_f=0.18, rear_f=-0.24, rear_pitch=30,
             lead_arm=(40, 60, 14), rear_arm=(15, 70, 22), head=-12, neck=-6),
        dict(crouch=0.32, lean=18, chest_lean=18, lead_arm=(55, 100, 10), rear_arm=(20, 120, 20), head=-6),
        dict(crouch=0.22, lean=9, chest_lean=10),
        dict(),
    ]
    return Anim(keyed(sk, keys), 12, loop=False)


def ko(sk):
    limp = dict(lead_arm=(8, 18, 18), rear_arm=(-6, 15, 18), fist=0.15, twist=0)
    keys = [
        SNAP,
        dict(limp, rear_f=-0.42, lead_f=0.14, lead_lift=0.05, lean=-12, chest_lean=-15, head=-15, neck=-10),
        dict(limp, crouch=0.30, lean=4, chest_lean=8, neck=15, head=12, lead_f=0.2, rear_f=-0.3, rear_pitch=20),
        dict(limp, pelvis_h=0.62, lead_fk=(8, 100, 30), rear_fk=(-8, 105, 30), lean=4, chest_lean=6, neck=18,
             head=16),
        dict(limp, body=-35, pelvis_h=0.36, lead_fk=(40, 100, 20), rear_fk=(30, 105, 20), neck=10, head=6,
             lead_arm=(40, 20, 30)),
        dict(limp, body=-70, pelvis_h=0.2, lead_fk=(55, 80, 10), rear_fk=(42, 70, 10), lead_arm=(90, 20, 40),
             rear_arm=(60, 25, 35)),
        dict(LYING, lead_fk=(38, 48, 0), rear_fk=(26, 30, 0), lead_arm=(160, 20, 50), rear_arm=(40, 25, 40),
             fist=0.15),
        dict(LYING, lead_fk=(20, 16, 0), rear_fk=(10, 8, 0), lead_arm=(170, 15, 45), rear_arm=(15, 20, 50),
             head_roll=20, fist=0.15),
        dict(LYING, lead_fk=(20, 16, 0), rear_fk=(10, 8, 0), lead_arm=(170, 15, 45), rear_arm=(15, 20, 50),
             head_roll=20, fist=0.15),
    ]
    return Anim(keyed(sk, keys), 10, loop=False, head="hurt")


def dazed(sk, frames=8):
    keys = []
    for f in range(frames):
        ph = 2 * math.pi * f / frames
        b, c = math.sin(ph), math.cos(ph)
        keys.append(dict(crouch=0.14 + 0.02 * (1 + c) / 2, lean=2 + 4 * b, yaw=-20 + 6 * c, chest_yaw=-30 + 8 * c,
                         roll=3 * b, head=12 + 5 * c, head_roll=8 * b, neck=6, lead_arm=(15 + 6 * b, 35, 18),
                         rear_arm=(5 - 6 * b, 30, 22), fist=0.3, twist=0, lead_f=0.24, rear_f=-0.28))
    return Anim(keyed(sk, keys), 8, head="hurt")


def thrown(sk):
    flail = dict(lead_arm=(130, 30, 40), rear_arm=(100, 30, 40), fist=0.3, twist=0)
    keys = [
        dict(lean=-6, crouch=0.12, head=-10, neck=-6, lead_arm=(40, 40, 30), rear_arm=(20, 40, 30), fist=0.4,
             rear_pitch=30, lead_pitch=20, twist=0),
        dict(flail, body=40, pelvis_h=1.1, lead_fk=(30, 60, 0), rear_fk=(10, 40, 0), head=-6),
        dict(flail, body=110, pelvis_h=1.15, lead_fk=(40, 50, 0), rear_fk=(20, 30, 0), head=4),
        dict(flail, body=180, pelvis_h=1.0, lead_fk=(30, 40, 0), rear_fk=(15, 25, 0), lead_arm=(160, 20, 40)),
        dict(flail, body=235, pelvis_h=0.7, lead_fk=(30, 35, 0), rear_fk=(15, 20, 0)),
        dict(LYING, body=270, lead_fk=(30, 26, 0), rear_fk=(18, 16, 0), lead_arm=(165, 20, 45),
             rear_arm=(40, 25, 40)),
    ]
    return Anim(keyed(sk, keys), 12, loop=False, head="hurt")


def tag_in(sk):
    keys = [
        dict(crouch=-0.12, lead_lift=0.30, lead_f=0.30, rear_lift=0.24, rear_f=-0.2, lean=10, chest_lean=10,
             lead_arm=(105, 60, 20), rear_arm=(65, 60, 25), lead_pitch=10, rear_pitch=20),
        dict(crouch=0.30, lean=14, chest_lean=15, lead_arm=(40, 70, 14), rear_arm=(20, 80, 22)),
        dict(crouch=0.21, lean=8, chest_lean=9),
        dict(crouch=0.16, rear_arm=(150, 30, 22), chest_lean=3, head=-6),
        dict(crouch=0.155, rear_arm=(158, 22, 22), chest_lean=2, head=-7),
        dict(),
    ]
    return Anim(keyed(sk, keys), 12, loop=False)


def tag_out(sk):
    wave = dict(rear_arm=(165, 15, 30), fist_rear=0.0, twist=0)
    keys = [
        dict(),
        dict(wave, chest_lean=2),
        dict(wave, lean=-4, chest_lean=-2),
        dict(wave, lead_pitch=30, lead_f=0.26, crouch=0.20, lean=-6, chest_lean=0),
        dict(wave, lead_lift=0.10, lead_f=0.22, rear_lift=0.14, rear_f=-0.42, crouch=0.12, lean=-10,
             chest_lean=-4, rear_arm=(125, 30, 30)),
        dict(lead_lift=0.16, lead_f=0.18, rear_lift=0.2, rear_f=-0.46, crouch=0.08, lean=-12, chest_lean=-6,
             fwd=-0.12, rear_arm=(100, 40, 30)),
    ]
    return Anim(keyed(sk, keys), 12, loop=False)


def walk(sk, rest, posing, cfg, ppm):
    gcfg = cfg.get("gait", {})
    p = params_from(WALK, gcfg.get("walk"))
    poses = fit_pelvis(sk, rest, locomotion(sk, p), posing)
    fps = _cadence(p, sk, ppm, gcfg.get("walk", {}).get("speed", cfg.get("speeds", {}).get("walk", 200)))
    return Anim(poses, fps, locomotion=True, derived=[{"name": "walk_back", "reverse": True, "speed": 0.8}])


def run(sk, rest, posing, cfg, ppm):
    gcfg = cfg.get("gait", {})
    p = params_from(RUN, gcfg.get("run"))
    poses = fit_pelvis(sk, rest, locomotion(sk, p), posing)
    fps = _cadence(p, sk, ppm, gcfg.get("run", {}).get("speed", cfg.get("speeds", {}).get("run", 460)))
    return Anim(poses, fps, locomotion=True, head="profile")


def _cadence(p, sk, ppm, target_speed):
    stride_px = 2 * p.step * sk.leg * ppm
    return max(6, round(p.frames * target_speed / stride_px))


SIMPLE = {
    "idle": idle, "dash_fwd": dash_fwd, "dash_back": dash_back, "jump_start": jump_start, "jump_air": jump_air,
    "jump_land": jump_land, "crouch": crouch, "block": block, "crouch_block": crouch_block,
    "hit_high": hit_high, "hit_low": hit_low, "knockdown": knockdown, "getup": getup, "ko": ko, "dazed": dazed,
    "thrown": thrown, "tag_in": tag_in, "tag_out": tag_out,
}
ORDER = ["idle", "walk_fwd", "run", "dash_fwd", "dash_back", "jump_start", "jump_air", "jump_land", "crouch",
         "block", "crouch_block", "hit_high", "hit_low", "knockdown", "getup", "ko", "dazed", "thrown", "tag_in",
         "tag_out"]


def shared_states(sk, rest, posing, cfg, ppm, only=None):
    """All shared states for one fighter, in atlas order (walk_back is derived from walk_fwd)."""
    out = {}
    for name in ORDER:
        if only and name not in only:
            continue
        if name == "walk_fwd":
            out[name] = walk(sk, rest, posing, cfg, ppm)
        elif name == "run":
            out[name] = run(sk, rest, posing, cfg, ppm)
        else:
            out[name] = SIMPLE[name](sk)
    return out
