"""Move builders shared by the fighter files. Every builder returns a core.Move timed from frame data.

Standing moves start and end in the guard (the shared idle/stance), crouching moves in CROUCH and air moves in
AIR, so the engine can cut between states without a pop.
"""

import json
import os

from . import library as lib
from . import prop_meshes
from .core import Move, Prop, free_timing, pose, resolve, timing_from, to_pose

import shared

FRAMEDATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "framedata")

THROW_DATA = {"startup": 8, "active": 3, "recovery": 22}  # engine default (src/characters/schema.js)


def _keys(base, wind, hit, follow=None, settle=None):
    keys = [("start", base), ("wind", wind, "in"), ("hit", hit, "out"), ("hold", follow or hit)]
    if settle is not None:
        keys.append((0.8, settle))
    keys.append(("end", base))
    return keys


def strike(anim, data, wind, hit, follow=None, settle=None, base=None, props=(), note="", pre=None, post=None,
           reach=None):
    """`reach` names the striking limb (lf, rf, al, ar); it is fitted into the move's hitbox at render time."""
    base = base or lib.GUARD
    w, h = pose(base, wind), pose(base, hit)
    f = pose(base, hit, follow) if follow else None
    s = pose(base, settle) if settle else None
    box = data.get("hitbox") if reach else None
    return Move(anim, timing_from(data, pre, post), _keys(base, w, h, f, s), props=list(props), note=note,
                reach=(reach, box) if box else None)


def crouch_strike(anim, data, wind, hit, follow=None, **kw):
    base = pose(lib.CROUCH)
    return strike(anim, data, dict(lib.CROUCH, **wind), dict(lib.CROUCH, **hit),
                  dict(lib.CROUCH, **follow) if follow else None, base=base, **kw)


def air_strike(anim, data, wind, hit, **kw):
    base = pose(lib.AIR)
    return strike(anim, data, dict(lib.AIR, **wind), dict(lib.AIR, **hit), base=base, **kw)


def sequence(anim, data, keys, props=(), note="", pre=None, post=None, base=None, loop=False, events=None,
             reach=None):
    """Free-form key list [(anchor, fragment or full pose, ease)], timed from frame data. Fragments are merged
    onto `base` (the guard by default); the clip starts and ends on the base unless keys say otherwise."""
    base = base or lib.GUARD
    t = timing_from(data, pre, post) if data else None
    move = _seq(anim, t, keys, base, props, note, loop, events)
    if reach and data.get("hitbox"):
        move.reach = (reach, data["hitbox"])
    return move


def scripted(anim, frames, fps, keys, hit=None, props=(), note="", base=None, loop=False, events=None):
    """Clips without frame data (intro, victory, finisher)."""
    return _seq(anim, free_timing(frames, fps, hit), keys, base or lib.GUARD, props, note, loop, events)


def _seq(anim, t, keys, base, props, note, loop, events):
    full = []
    for k in keys:
        frag = k[1]
        p = frag if len(frag) == len(lib.GUARD) else pose(base, frag)
        full.append((k[0], p) + tuple(k[2:]))
    anchors = {k[0] for k in full}
    if "start" not in anchors:
        full.insert(0, ("start", pose(base)))
    if "end" not in anchors:
        full.append(("end", pose(base)))
    return Move(anim, t, full, loop=loop, props=list(props), note=note, events=events)


def throw(anim="throw", grab=None, pull=None, toss=None, props=(), note=""):
    return sequence(anim, THROW_DATA, [("wind", dict(lib.GRAB, drop=0.19, pfwd=0.03), "in"),
                                       ("hit", dict(lib.GRAB, **(grab or {})), "out"),
                                       (0.55, dict(lib.GRAB_PULL, **(pull or {}))),
                                       (0.78, dict(lib.TOSS, **(toss or {})), "out")],
                    props=props, note=note, post=7)


def load_framedata(fid):
    with open(os.path.join(FRAMEDATA, f"{fid}.json")) as fh:
        return json.load(fh)


def export(fid, moves, sk, ctx):
    """core.Move list -> {name: shared.Anim}, with hitboxes fitted and props attached."""
    rest, ppm = ctx["rest"], ctx["ppm"]
    out = {}
    for move in moves:
        move.fit(sk, ppm, rest)
        poses = [to_pose(sk, rest, p) for p in move.frames()]
        poses = prop_meshes.attach_props(poses, move.props, move.timing, sk, resolve)
        # head stays "threequarter" by default so process.HEAD_RULES picks the view (shout for specials, super,
        # finisher, intro and victory)
        out[move.anim] = shared.Anim(poses, move.timing.fps, loop=move.loop, events=move.event_list(),
                                     head=move.head)
    return out


__all__ = ["strike", "crouch_strike", "air_strike", "sequence", "scripted", "throw", "Prop", "lib", "pose",
           "load_framedata", "export"]
