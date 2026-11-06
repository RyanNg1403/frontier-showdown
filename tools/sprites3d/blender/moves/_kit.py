"""Authoring kit for character move animations (helper; `_` keeps it out of move discovery).

A move is a list of pose *specs*: flat dicts of numbers that describe the whole body relative to the
fighter's feet anchor, in armature space (forward, up, out), lengths in leg lengths L unless noted:

    px, pz                pelvis offset forward / up (L)
    pyaw, ppitch, proll   pelvis rotation (deg; yaw + brings the rig's right, camera-side hip forward)
    syaw, spitch, sroll   chest rotation (spine_03); spine_01/02 blend from the pelvis to the chest
    nyaw, npitch          neck,  hyaw, hpitch  head
    lf, rf                feet: (forward, out, lift) of the flat ankle placement (L)
    lfp, rfp              foot pitch (deg, + lifts the heel)    lfy, rfy  toe-out (deg)
    ltp, rtp              toe pitch in world (deg) or None = rigid with the foot
    lko, rko              knee-out bias for the leg IK pole
    lh, rh                hands: (forward, up, out) target relative to the shoulder, in arm lengths
    lfist, rfist          finger curl 0 (open) .. 1 (fist); guard fists also get the shared wrist twist
    props                 {prop name: True} for props visible on that frame

"l" is the rig's left (far side, the lead side in the orthodox guard), "r" the right (near, camera side).
`seq` builds frames by easing from pose to pose and records the `hit` frame and VFX hook events.
`Kit.anim` turns a move into a `shared.Anim` of `gait.Pose` objects: legs, spine and head are set directly,
and the hand targets are solved into the shared FK arm tuples (swing, elbow, splay) relative to the chest.
"""

import math

import bmesh
import bpy
from mathutils import Matrix, Vector

import shared
import toon
from gait import FWD, LAT, UP, Pose, foot_on_ground, rx, ry, rz

GUARD_TWIST = shared.GUARD["twist"]


# ----------------------------------------------------------------------------------------------- specs

def put(base, **kw):
    s = dict(base)
    s.update(kw)
    return s


def _lerp(a, b, t):
    if isinstance(a, (int, float)) and isinstance(b, (int, float)) and not isinstance(a, bool):
        return a + (b - a) * t
    if isinstance(a, tuple) and isinstance(b, tuple) and len(a) == len(b):
        return tuple(x + (y - x) * t for x, y in zip(a, b))
    return b if t >= 0.999 else a


def blend(a, b, t):
    out = {}
    for k in set(a) | set(b):
        if k not in a:
            out[k] = b[k]
        elif k not in b:
            out[k] = a[k]
        else:
            out[k] = _lerp(a[k], b[k], t)
    return out


EASES = {
    "lin": lambda t: t,
    "in": lambda t: t * t,
    "out": lambda t: 1 - (1 - t) ** 2,
    "snap": lambda t: 1 - (1 - t) ** 3,
    "io": lambda t: t * t * (3 - 2 * t),
}


class Move:
    def __init__(self, frames, hit=None, fps=20, loop=False, events=None, note=""):
        self.frames = frames
        self.hit = hit
        self.fps = fps
        self.loop = loop
        self.events = events or []
        self.note = note


def seq(start, segments, fps=20, loop=False, note=""):
    """Build a Move. `segments` are (frames, overrides, ease, mark?) tuples. Each segment eases from the
    previous target to `previous target + overrides` over `frames` frames (its last frame is the target).
    `mark` is "hit" (first active frame = the segment's last frame), "vfx:<name>" or a list of those."""
    frames = [dict(start)]
    hit, events = None, []
    cur = dict(start)
    for seg in segments:
        n, over, ease = seg[0], seg[1], seg[2] if len(seg) > 2 else "io"
        marks = seg[3] if len(seg) > 3 else []
        marks = [marks] if isinstance(marks, str) else marks
        target = put(cur, **over)
        for i in range(1, n + 1):
            frames.append(blend(cur, target, EASES[ease](i / n)))
        for m in marks:
            if m == "hit" and hit is None:
                hit = len(frames) - 1
            elif m.startswith("vfx:"):
                events.append({"frame": len(frames) - 1, "type": "vfx", "name": m[4:]})
        cur = target
    return Move(frames, hit=hit, fps=fps, loop=loop, events=events, note=note)


def timing(startup, active, recovery, scale=3.0):
    """Animation frame counts for a move's startup, active and recovery phases (60 Hz frame data)."""
    k = max(1, min(7, round((startup - 1) / scale)))
    a = max(1, min(6, round(active / scale)))
    r = max(2, min(8, round(recovery / (scale * 1.4))))
    return k, a, r


# ------------------------------------------------------------------------------------- spec -> Pose

class Kit:
    def __init__(self, sk, cfg, ctx):
        self.sk, self.cfg = sk, cfg
        self.rest = ctx["rest"] if ctx else sk.rest
        self.L = sk.leg
        r = self.rest
        self.l1 = {s: (r[f"lowerarm_{s}"]["head"] - r[f"upperarm_{s}"]["head"]).length for s in "lr"}
        self.l2 = {s: (r[f"hand_{s}"]["head"] - r[f"lowerarm_{s}"]["head"]).length for s in "lr"}
        self.rig = bpy.data.objects.get("rig")
        self.props = {}

    def stance(self, **kw):
        """The orthodox guard of the shared idle (`shared.GUARD`) in spec form, so moves start and end on the
        idle pose. Hands left unset get the guard's FK arms for the stance's chest."""
        g = shared.GUARD
        s = dict(
            px=0.0, pz=-g["crouch"], pyaw=g["yaw"], ppitch=g["lean"] * 0.6, proll=0.0,
            syaw=g["chest_yaw"], spitch=g["chest_lean"], sroll=0.0, nyaw=g["chest_yaw"] * 0.4, npitch=g["neck"],
            hyaw=g["chest_yaw"] * 0.15, hpitch=g["head"],
            lf=(g["lead_f"], g["lead_x"] / self.L, 0.0), rf=(g["rear_f"], -g["rear_x"] / self.L, 0.0),
            lfp=0.0, rfp=0.0, lfy=g["lead_toe"], rfy=g["rear_toe"], ltp=None, rtp=None,
            lko=g["knee_lead"], rko=g["knee_rear"], lh=None, rh=None, lfist=1.0, rfist=1.0, props={},
        )
        s.update(kw)
        for side in "lr":
            if s[side + "h"] is None:
                s[side + "h"] = self.guard_hand(s, side)
        return s

    def _chest(self, s):
        return rz(s["syaw"]) @ rx(s["spitch"]) @ ry(s["sroll"])

    def guard_hand(self, s, side):
        """Hand target (forward, up, out) reproducing the shared guard's FK arm for this spec's chest."""
        swing, elbow, splay = shared.GUARD["lead_arm" if side == "l" else "rear_arm"]
        sign = 1.0 if side == "l" else -1.0
        C = self._chest(s)

        def d(a, sp):
            a, sp = math.radians(a), math.radians(sp)
            return C @ Vector((sign * math.sin(sp), -math.sin(a) * math.cos(sp), -math.cos(a) * math.cos(sp)))

        h = d(swing, splay) * self.l1[side] + d(swing + max(elbow, 4.0), splay * 0.5) * self.l2[side]
        n = self.l1[side] + self.l2[side]
        return (-h.y / n, h.z / n, sign * h.x / n)

    def arm_fk(self, s, side):
        """Solve a hand target into the shared FK arm tuple (swing, elbow, splay) relative to the chest."""
        sign = 1.0 if side == "l" else -1.0
        l1, l2 = self.l1[side], self.l2[side]
        f, u, o = s[side + "h"]
        t = (FWD * f + UP * u + LAT * (sign * o)) * (l1 + l2)
        c = self._chest(s).inverted() @ t
        X, F, Dn = sign * c.x, -c.y, -c.z  # out, forward, down in the chest frame
        # splay from the lateral component: X = l1 sin(s) + l2 sin(s/2)
        lo, hi = math.radians(-70), math.radians(89)
        for _ in range(40):
            mid = (lo + hi) / 2
            if l1 * math.sin(mid) + l2 * math.sin(mid / 2) < X:
                lo = mid
            else:
                hi = mid
        sp = (lo + hi) / 2
        L1, L2 = l1 * math.cos(sp), l2 * math.cos(sp / 2)
        r = max(abs(L1 - L2) + 1e-4, min(L1 + L2 - 1e-4, math.hypot(F, Dn)))
        cos_e = max(-1.0, min(1.0, (r * r - L1 * L1 - L2 * L2) / (2 * L1 * L2)))
        e = math.acos(cos_e)
        a = math.atan2(F, Dn) - math.atan2(L2 * math.sin(e), L1 + L2 * math.cos(e))
        return (math.degrees(a), max(4.0, math.degrees(e)), math.degrees(sp))

    def pose(self, s):
        L = self.L
        pose = Pose()
        pose.pelvis_offset = FWD * (s["px"] * L) + UP * (s["pz"] * L)
        pose.pelvis = rz(s["pyaw"]) @ rx(s["ppitch"]) @ ry(s["proll"])
        sp = []
        for t in (0.33, 0.66, 1.0):
            sp.append(rz(s["pyaw"] + (s["syaw"] - s["pyaw"]) * t) @ rx(s["ppitch"] + (s["spitch"] - s["ppitch"]) * t)
                      @ ry(s["proll"] + (s["sroll"] - s["proll"]) * t))
        pose.spine = tuple(sp)
        pose.neck = rz(s["nyaw"]) @ rx(s["npitch"])
        pose.head = rz(s["hyaw"]) @ rx(s["hpitch"])
        for side in "lr":
            sign = 1.0 if side == "l" else -1.0
            fwd, out, lift = s[side + "f"]
            lateral = sign * out * L
            pitch = s[side + "fp"]
            planted = lift < 0.01
            ankle = foot_on_ground(self.sk, side, fwd * L, pitch if planted else 0.0, lateral)
            pose.ankle[side] = ankle if planted else ankle + UP * (lift * L)
            pose.foot_pitch[side] = pitch
            pose.toe_pitch[side] = s[side + "tp"]
            pose.foot_yaw[side] = s[side + "fy"]
            pose.knee_out[side] = s[side + "ko"]
            pose.contact[side] = planted
            if s[side + "h"] is None:
                s = put(s, **{side + "h": self.guard_hand(s, side)})
            pose.arm[side] = self.arm_fk(s, side)
            fist = s[side + "fist"]
            pose.fist_side[side] = fist
            pose.hand_twist[side] = GUARD_TWIST * max(0.0, min(1.0, (fist - 0.3) / 0.6))
        pose.fist = max(s["lfist"], s["rfist"])
        pose.props = dict(s.get("props") or {})
        return pose

    def anim(self, move, head="threequarter"):
        events = ([{"frame": move.hit, "type": "hit"}] if move.hit is not None else []) + move.events
        return shared.Anim([self.pose(s) for s in move.frames], move.fps, loop=move.loop, events=events, head=head)

    # ------------------------------------------------------------------------------------------ props

    def prop(self, name, mesh, color, bone, offset=(0, 0, 0), rot=(0, 0, 0), part="hand_near", contrast=1.0,
             space="bone"):
        """Attach a prop mesh to a bone. With space="bone", `offset`/`rot` (deg) are in the bone's rest frame
        at its head (Y runs along the bone); with space="armature" they are armature axes (forward is -Y)
        relative to the bone head. The prop is hidden unless a frame's spec lists it in `props`."""
        import _props
        import outfit
        if self.rig is None:
            return None
        b = self.rig.data.bones[bone]
        if space == "armature":
            Rb = b.matrix_local.to_3x3()
            Ra = Matrix.Identity(3)
            for axis, deg in zip("XYZ", rot):
                Ra = Ra @ Matrix.Rotation(math.radians(deg), 3, axis)
            offset = tuple(Rb.inverted() @ Vector(offset))
            rot = tuple(math.degrees(a) for a in (Rb.inverted() @ Ra).to_euler("XYZ"))
        obj = bpy.data.objects.new("prop_" + name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        toon.assign(obj, toon.make_toon_material("prop_" + name, color, contrast=contrast))
        pid = mesh.attributes.new("pid", "FLOAT_COLOR", "FACE")
        for p in mesh.polygons:
            pid.data[p.index].color = outfit.part_color(part)
        R = Matrix.Identity(4)
        for axis, deg in zip("XYZ", rot):
            R = R @ Matrix.Rotation(math.radians(deg), 4, axis)
        obj.parent = self.rig
        obj.parent_type = "BONE"
        obj.parent_bone = bone
        tail = b.matrix_local @ Matrix.Translation((0.0, b.length, 0.0))
        obj.matrix_parent_inverse = tail.inverted()
        obj.matrix_basis = b.matrix_local @ Matrix.Translation(offset) @ R
        obj.hide_render = True
        self.props[name] = obj
        _props.register(name, obj)
        return obj


# ------------------------------------------------------------------------------------------ prop meshes

def _mesh_from(bm, name):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    return mesh


def box(name, sx, sy, sz, at=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Translation(at) @ Matrix.Diagonal((sx, sy, sz, 1)))
    return _mesh_from(bm, name)


def cylinder(name, radius, depth, segments=12, axis="Y", at=(0, 0, 0), radius2=None):
    bm = bmesh.new()
    rot = {"X": Matrix.Rotation(math.radians(90), 4, "Y"), "Y": Matrix.Rotation(math.radians(90), 4, "X"),
           "Z": Matrix.Identity(4)}[axis]
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segments, radius1=radius,
                          radius2=radius if radius2 is None else radius2, depth=depth,
                          matrix=Matrix.Translation(at) @ rot)
    return _mesh_from(bm, name)


def sphere(name, radius, at=(0, 0, 0), squash=(1, 1, 1)):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=8, radius=radius,
                              matrix=Matrix.Translation(at) @ Matrix.Diagonal(tuple(squash) + (1,)))
    return _mesh_from(bm, name)


def hexagon(name, radius, thickness, axis="Y", at=(0, 0, 0)):
    return cylinder(name, radius, thickness, segments=6, axis=axis, at=at)


def merge(name, *meshes):
    bm = bmesh.new()
    for m in meshes:
        bm.from_mesh(m)
        bpy.data.meshes.remove(m)
    return _mesh_from(bm, name)
