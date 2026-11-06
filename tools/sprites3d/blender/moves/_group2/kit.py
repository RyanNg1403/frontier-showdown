"""Key-pose toolkit for the group 2 move modules (Jensen, Ilya, Arthur, Andrej, Yann).

A move is a list of key poses on a frame timeline. A key is a plain dict merged over the fighter's stance
(itself merged over `GUARD`, which mirrors `shared.GUARD`), so a key only names what changes:

    l, r      feet: {"f": forward (leg lengths), "x": lateral metres, "h": lift (leg lengths), "p": pitch,
              "yaw": toe-out}; "l" is the far (lead) foot, "r" the near (rear) foot
    drop      pelvis drop (leg lengths); "up" lifts the body (air poses); "fwd" shifts the hips forward
    pyaw, cyaw, lean, clean     hip yaw, chest yaw, lean, chest lean (defaults to lean + 2)
    npitch, hpitch, nyaw, hyaw  neck and head pitch and yaw (absolute; yaw defaults follow the chest)
    al, ar    arms (swing from hanging toward forward/up, elbow bend, splay) relative to the chest
    fist, twist, kl, kr, body   fist amount, wrist twist, knee bias, whole-body pitch
    props     {name: {"vis": 0/1, "offset", "rot", "scale"}} (see props.py; sent through the props hook)

Every key converts to `shared.pose_from` parameters, so moves share the shared states' guard and crouch.
Numbers interpolate; easing is per key ("ease": smooth | linear | out | in).
"""

import copy
import math

import shared
from gait import rx, rz

_G = shared.GUARD
GUARD = {
    "l": {"f": _G["lead_f"], "x": _G["lead_x"], "h": 0.0, "p": 0.0, "yaw": _G["lead_toe"]},
    "r": {"f": _G["rear_f"], "x": _G["rear_x"], "h": 0.0, "p": 0.0, "yaw": _G["rear_toe"]},
    "drop": _G["crouch"], "up": 0.0, "fwd": 0.0,
    "pyaw": _G["yaw"], "cyaw": _G["chest_yaw"], "lean": _G["lean"], "clean": None,
    "npitch": _G["neck"], "hpitch": _G["head"], "nyaw": None, "hyaw": None,
    "al": tuple(_G["lead_arm"]), "ar": tuple(_G["rear_arm"]),
    "fist": 1.0, "twist": _G["twist"], "kl": _G["knee_lead"], "kr": _G["knee_rear"], "body": 0.0,
    "props": {},
}
_C = shared.CROUCH
CROUCH = {"drop": _C["crouch"], "lean": 18, "cyaw": _C["chest_yaw"], "npitch": _C["neck"], "hpitch": _C["head"],
          "l": {"f": _C["lead_f"], "x": _C["lead_x"]}, "r": {"f": _C["rear_f"], "x": _C["rear_x"], "p": _C["rear_pitch"]},
          "kl": _C["knee_lead"], "kr": _C["knee_rear"]}
AIR = {"drop": -0.02, "l": {"f": 0.16, "h": 0.3, "p": 20}, "r": {"f": -0.18, "h": 0.22, "p": 30}, "kl": 0.1, "kr": 0.1}


def merge(base, over):
    out = copy.deepcopy(base)
    for k, v in (over or {}).items():
        if k == "ease":
            continue
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            if k == "props":
                for pk, pv in v.items():
                    out["props"][pk] = {**out["props"].get(pk, {}), **pv}
            else:
                out[k] = {**out[k], **v}
        else:
            out[k] = v
    return out


def _mix(a, b, t):
    if isinstance(a, dict) or isinstance(b, dict):
        a, b = a or {}, b or {}
        return {k: _mix(a.get(k, b.get(k)), b.get(k, a.get(k)), t) for k in set(a) | set(b)}
    if isinstance(a, (tuple, list)):
        return tuple(_mix(x, y, t) for x, y in zip(a, b))
    if a is None or b is None or isinstance(a, (bool, str)) or isinstance(b, (bool, str)):
        return b if t >= 0.5 else a
    return a + (b - a) * t


EASE = {
    "smooth": lambda t: t * t * (3 - 2 * t),
    "linear": lambda t: t,
    "out": lambda t: 1 - (1 - t) ** 3,     # snaps toward the key: strikes
    "in": lambda t: t ** 2.2,              # slow start: wind-ups
}


def _fill(p):
    """Neck and head yaw follow the chest like shared.pose_from unless a key sets them."""
    if p.get("nyaw") is None:
        p["nyaw"] = p["cyaw"] * 0.4
    if p.get("hyaw") is None:
        p["hyaw"] = p["cyaw"] * 0.15
    return p


def timeline(base, keys, n):
    """keys: [(frame, overrides)] with frames in [0, n-1]. Returns n resolved key dicts."""
    resolved = [(f, _fill(merge(base, over)), (over or {}).get("ease", "smooth"))
                for f, over in sorted(keys, key=lambda k: k[0])]
    out = []
    for i in range(n):
        if i <= resolved[0][0]:
            out.append(resolved[0][1])
        elif i >= resolved[-1][0]:
            out.append(resolved[-1][1])
        else:
            for (f0, p0, _), (f1, p1, e1) in zip(resolved, resolved[1:]):
                if f0 <= i <= f1:
                    out.append(_mix(p0, p1, EASE[e1]((i - f0) / (f1 - f0) if f1 > f0 else 1.0)))
                    break
    return out


# ------------------------------------------------------------------------------------------- timing

def frames_for(fd, k_min=1, k_max=7, after_min=3, after_max=12):
    """Atlas frames for a move from its 60 Hz frame data: (hit frame index, total frames, fps).

    The engine plays frames 0..k-1 over the startup and k..end over active + recovery, so the split, not
    the fps, is what has to match; fps is set so the clip's natural length equals the move's."""
    startup, active, recovery = fd["startup"], fd.get("active", 2), fd.get("recovery", 20)
    k = max(k_min, min(k_max, round((startup - 1) / 3)))
    n = k + max(after_min, min(after_max, round((active + recovery) / 4)))
    return k, n, fps_for(fd, n)


def fps_for(fd, n):
    """fps that makes an n-frame clip last as long as the move (startup + active + recovery - 1 frames)."""
    total = fd["startup"] + fd.get("active", 1) + fd.get("recovery", 0) - 1
    return round(n * 60.0 / total, 2)


# ------------------------------------------------------------------------------------------- poses

def to_params(d):
    """A key dict as `shared.pose_from` parameters."""
    l, r = d["l"], d["r"]
    return dict(
        lead_f=l["f"], lead_x=l["x"], lead_lift=l["h"], lead_pitch=l["p"], lead_toe=l["yaw"],
        rear_f=r["f"], rear_x=r["x"], rear_lift=r["h"], rear_pitch=r["p"], rear_toe=r["yaw"],
        crouch=d["drop"] - d["up"], fwd=d["fwd"], yaw=d["pyaw"], lean=d["lean"], chest_yaw=d["cyaw"],
        chest_lean=d["clean"] if d.get("clean") is not None else d["lean"] + 2,
        neck=d["npitch"], head=d["hpitch"], lead_arm=tuple(d["al"]), rear_arm=tuple(d["ar"]),
        fist=d["fist"], twist=d["twist"], knee_lead=d["kl"], knee_rear=d["kr"], body=d["body"])


_CTX = {}


def to_pose(sk, d, i=0):
    from _group2.props import pose_props
    pose = shared.pose_from(sk, to_params(d))
    pose.props = pose_props(d["props"], i, pose, _CTX.get("rest"))
    pose.neck = rz(d["nyaw"]) @ rx(d["npitch"])
    pose.head = rz(d["hyaw"]) @ rx(d["hpitch"])
    return pose


# ------------------------------------------------------------------------------------------ builders

class Move:
    def __init__(self, name, frames, fps, hit=None, loop=False, note="", head="threequarter"):
        self.name, self.frames, self.fps, self.hit, self.loop, self.note, self.head = (
            name, frames, fps, hit, loop, note, head)


def merge_partial(guard, over, t):
    """Overrides that move `t` of the way from the guard toward `over`."""
    full = _mix(guard, merge(guard, over), t)
    return {k: v for k, v in full.items() if guard.get(k) != v}


def strike(name, guard, fd, windup, hit, recover=None, hold=1, follow=None, note="", **kw):
    """A standard attack: anticipation -> wind-up -> strike on the first active frame -> hold -> recovery.
    `follow` is an optional key between the hold and the return to guard (follow-through)."""
    k, n, fps = frames_for(fd, **kw)
    keys = [(0, windup if k == 1 else merge_partial(guard, windup, 0.5))]
    if k >= 2:
        keys.append((k - 1, {**windup, "ease": "in"}))
    keys.append((k, {**hit, "ease": "out"}))
    end_hold = min(n - 2, k + hold)
    keys.append((end_hold, {**hit, "ease": "linear"}))
    if follow is not None and end_hold + 1 < n - 1:
        keys.append(((end_hold + n - 1) // 2 + 1 if n - end_hold > 3 else end_hold + 1, follow))
    keys.append((n - 1, recover or {}))
    return Move(name, timeline(guard, keys, n), fps, hit=k, note=note)


def sequence(name, guard, keys, n, fps, hit=None, loop=False, note="", head="threequarter"):
    return Move(name, timeline(guard, keys, n), fps, hit=hit, loop=loop, note=note, head=head)


def wave(i, n, amp=1.0, cycles=1.0, phase=0.0):
    return amp * math.sin(2 * math.pi * (cycles * i / n + phase))


SHOUT = ("special_1", "special_2", "special_3", "super", "intro", "victory")  # the likeness heads' shout view


def export(moves, sk, ctx=None):
    """Move list -> {name: shared.Anim}; each pose carries its frame's props for the renderer's props hook."""
    _CTX.update(ctx or {})
    anims = {}
    for m in moves:
        poses = [to_pose(sk, d, i) for i, d in enumerate(m.frames)]
        events = [{"frame": m.hit, "type": "hit"}] if m.hit is not None else []
        head = "shout" if m.head == "threequarter" and m.name in SHOUT else m.head
        anims[m.name] = shared.Anim(poses, m.fps, loop=m.loop, events=events, head=head)
    return anims



# ------------------------------------------------------------------------------------------ templates
# Crouching and jumping kicks. The engine plays them once the character data sets `anim:` on c_lk, c_hk
# and j_k (otherwise those moves fall back to crouch_light, crouch_heavy and air_attack).

def low_kick(crouch_guard, fd, note):
    return strike("crouch_light_kick", crouch_guard, fd,
                  windup={"l": {"f": 0.22, "h": 0.06, "p": 10}, "lean": 14},
                  hit={"l": {"f": 0.8, "h": 0.03, "p": -6}, "lean": 10, "fwd": 0.04, "kl": 0.05}, note=note)


def sweep(crouch_guard, fd, note):
    return strike("crouch_heavy_kick", crouch_guard, fd,
                  windup={"pyaw": -55, "cyaw": -62, "r": {"f": -0.42, "h": 0.04, "p": 10}},
                  hit={"pyaw": 35, "cyaw": 0, "r": {"f": 0.78, "x": 0.02, "h": 0.03, "p": 0, "yaw": 80}, "kr": 0.9,
                       "lean": 16, "drop": 0.7, "al": (40, 60, 40)},
                  follow={"pyaw": 45, "cyaw": 10, "r": {"f": 0.55, "h": 0.03}}, note=note)


def air_kick(air_guard, fd, note):
    return strike("air_kick", air_guard, fd,
                  windup={"l": {"f": 0.05, "h": 0.45, "p": 30}, "lean": 4},
                  hit={"l": {"f": 0.64, "h": 0.3, "p": 15}, "r": {"f": -0.2, "h": 0.2}, "lean": -8, "kl": 0.0},
                  hold=2, note=note)
