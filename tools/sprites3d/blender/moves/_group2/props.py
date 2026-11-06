"""Prop meshes for the group 2 fighters, managed by the renderer's official props hook (blender/props.py).

A prop spec:
    {"parts": [(shape, {size..., "color": "#hex", "at": (x, y, z), "rot": (deg, deg, deg)}), ...],
     "attach": "hand_r", "offset": (x, y, z), "rot": (deg, deg, deg), "scale": 1, "vis": 1,
     "part": "prop_front"}
Shapes: box (size), cyl (r, l; along local Y), sphere (r), torus (R, r, arc degrees). Parts can have their
own colours, so the mesh is built here and handed to `props.register`, parented at the bone's head with
no offset; `offset`, `rot` and `scale` are then sent on every frame through `pose.props` (bone frame, Y
along the bone). Props without `attach` hang off the rig's `Root` bone in armature rest space, so their
offsets read as armature coordinates (forward is -Y, up is +Z).

A `"ribbon"` spec (Arthur's scarf) is built as `phases` pre-shaped ribbons in armature rest space around its
bone; `scarf_props` picks the phase for a frame, so the tail flutters by cycling visibility.
"""

import math

import bmesh
import bpy
from mathutils import Euler, Matrix, Quaternion, Vector

import outfit
import props as hook
import toon

_SPECS = {}


def _xf(at=(0, 0, 0), rot=(0, 0, 0)):
    return Matrix.Translation(Vector(at)) @ Euler([math.radians(a) for a in rot]).to_matrix().to_4x4()


def _torus(bm, R, r, arc, m, seg=16, ring=8):
    closed = arc >= 359.9
    n = seg if closed else seg + 1
    rows = []
    for i in range(n):
        a = math.radians(arc) * i / seg - (0 if closed else math.radians(arc) / 2)
        c = Vector((math.cos(a) * R, math.sin(a) * R, 0))
        out = Vector((math.cos(a), math.sin(a), 0))
        rows.append([bm.verts.new(m @ (c + out * (r * math.cos(2 * math.pi * j / ring))
                                       + Vector((0, 0, r * math.sin(2 * math.pi * j / ring)))))
                     for j in range(ring)])
    for i in range(seg):
        a, b = rows[i], rows[(i + 1) % n]
        for j in range(ring):
            bm.faces.new((a[j], a[(j + 1) % ring], b[(j + 1) % ring], b[j]))


def _shape(bm, kind, p):
    m = _xf(p.get("at", (0, 0, 0)), p.get("rot", (0, 0, 0)))
    if kind == "box":
        sx, sy, sz = p["size"]
        bmesh.ops.create_cube(bm, size=1.0, matrix=m @ Matrix.Diagonal((sx, sy, sz, 1)))
    elif kind == "cyl":
        bmesh.ops.create_cone(bm, cap_ends=True, segments=p.get("seg", 12), radius1=p["r"], radius2=p.get("r2", p["r"]),
                              depth=p["l"], matrix=m @ Euler((math.radians(-90), 0, 0)).to_matrix().to_4x4())
    elif kind == "sphere":
        bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=8, radius=p["r"], matrix=m)
    elif kind == "torus":
        _torus(bm, p["R"], p["r"], p.get("arc", 360), m)
    else:
        raise ValueError(kind)


def _material(obj, color, contrast):
    key = f"g2prop_{color}_{contrast}"
    mat = bpy.data.materials.get(key) or toon.make_toon_material(key, color, contrast=contrast)
    mats = obj.data.materials
    for i, m in enumerate(mats):
        if m == mat:
            return i
    mats.append(mat)
    return len(mats) - 1


def _new_object(name, part):
    mesh = bpy.data.meshes.new("prop_" + name)
    obj = bpy.data.objects.new("prop_" + name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def _finish(obj, part, rig, bone, armature_space=False):
    mesh = obj.data
    pid = mesh.attributes.new("pid", "FLOAT_COLOR", "FACE")
    for p in mesh.polygons:
        pid.data[p.index].color = outfit.part_color(part)
    b = rig.data.bones[bone]
    obj.parent = rig
    obj.parent_type = "BONE"
    obj.parent_bone = bone
    obj.matrix_parent_inverse = (b.matrix_local @ Matrix.Translation((0.0, b.length, 0.0))).inverted()
    obj.matrix_basis = Matrix.Identity(4) if armature_space else b.matrix_local.copy()
    return obj


def _build_parts(name, spec, rig):
    obj = _new_object(name, spec.get("part"))
    bm = bmesh.new()
    for kind, p in spec["parts"]:
        idx = _material(obj, p["color"], p.get("contrast", 1.0))
        before = set(bm.faces)
        _shape(bm, kind, p)
        for f in set(bm.faces) - before:
            f.material_index = idx
    bm.normal_update()
    bm.to_mesh(obj.data)
    bm.free()
    bone = spec.get("attach")
    return _finish(obj, spec.get("part", "prop_front"), rig, bone or "Root", armature_space=not bone)


def _build_ribbon(name, spec, rig, phase):
    """One flutter phase of a scarf tail, in armature rest space (it follows its bone from there)."""
    r = spec["ribbon"]
    n = r.get("segments", 14)
    b = rig.data.bones[r.get("bone", "neck_01")]
    p0 = b.matrix_local @ Vector(r.get("anchor", (0, 0, 0)))
    trail = Vector(r.get("dir", (0.0, 1.0, -0.2))).normalized()
    side = Vector((1, 0, 0))
    up = trail.cross(side).normalized()
    up = up if up.z >= 0 else -up
    amp, length, width = r.get("wind", 0.07), r.get("length", 0.9), r.get("width", 0.07)
    obj = _new_object(name, spec.get("part"))
    bm = bmesh.new()
    idx = [_material(obj, c, 0.8) for c in r["colors"]]
    rows = []
    for i in range(n + 1):
        t = i / n
        c = p0 + trail * (length * t) + up * (amp * t * math.sin(2 * math.pi * (1.6 * t - phase)))
        c += side * (amp * 0.4 * t * math.cos(2 * math.pi * (1.1 * t - phase)))
        wv = (up * 0.85 + side * 0.5).normalized() * (width / 2)
        rows.append((bm.verts.new(c - wv), bm.verts.new(c + wv)))
    for i in range(n):
        f = bm.faces.new((rows[i][0], rows[i][1], rows[i + 1][1], rows[i + 1][0]))
        f.material_index = idx[min(len(idx) - 1, i * len(idx) // n)]
    bm.to_mesh(obj.data)
    bm.free()
    return _finish(obj, spec.get("part", "torso"), rig, r.get("bone", "neck_01"), armature_space=True)


def install(specs):
    """Build the fighter's props once and register them with the renderer's props hook."""
    if _SPECS:
        return
    rig = bpy.data.objects["rig"]
    for name, spec in specs.items():
        if spec.get("ribbon"):
            for k in range(spec["ribbon"].get("phases", 4)):
                hook.register(f"{name}_{k}", _build_ribbon(f"{name}_{k}", spec, rig, k / spec["ribbon"].get("phases", 4)))
        else:
            hook.register(name, _build_parts(name, spec, rig))
        _SPECS[name] = spec


def _bone_rotation(rest, pose, bone, cache):
    """Posed armature-space rotation of `bone` (rest included), the chain posing.apply_pose builds."""
    if "D" not in cache:
        import posing
        cache["D"], cache["local"] = posing.solve(rest, pose)
        cache["Dfull"] = {}
    D_abs, local, Dfull = cache["D"], cache["local"], cache["Dfull"]

    def delta(name):
        if name not in Dfull:
            r = rest[name]
            Dp = delta(r["parent"]) if r["parent"] else Quaternion()
            Dfull[name] = D_abs[name] if name in D_abs else Dp @ r["rot"] @ local.get(name, Quaternion()) @ r["rot"].inverted()
        return Dfull[name]

    return (delta(bone) @ rest[bone]["rot"]).to_matrix()


def _hook_rot(m):
    """A 3x3 matrix as the props hook's rotation (XYZ degrees composed Rx @ Ry @ Rz)."""
    e = m.to_euler("ZYX")
    return (math.degrees(e.x), math.degrees(e.y), math.degrees(e.z))


def pose_props(states, frame_index, pose=None, rest=None):
    """This frame's prop states (spec defaults merged with the key's channels) -> `pose.props` for the hook.
    `rot` is Blender XYZ Euler degrees in the bone frame; `upright` instead holds the prop at that armature-space
    orientation whatever the bone does (a cup tower stays vertical, a tray flat)."""
    out = {}
    cache = {}
    for name, spec in _SPECS.items():
        st = {**{k: spec.get(k) for k in ("offset", "rot", "scale", "vis", "upright")}, **(states.get(name) or {})}
        if name not in states and not spec.get("always"):
            continue
        vis = st.get("vis")
        if (1 if vis is None else vis) < 0.5:
            continue
        if spec.get("ribbon"):
            phases = spec["ribbon"].get("phases", 4)
            k = int(round(st.get("phase", frame_index / 2.0) * phases)) % phases
            out[f"{name}_{k}"] = True
            continue
        s = st.get("scale") or 1.0
        rot = Euler([math.radians(a) for a in (st.get("rot") or (0, 0, 0))]).to_matrix()
        if st.get("upright") is not None and spec.get("attach") and pose is not None and rest is not None:
            want = Euler([math.radians(a) for a in st["upright"]]).to_matrix()
            rot = _bone_rotation(rest, pose, spec["attach"], cache).inverted() @ want
        out[name] = {"offset": tuple(st.get("offset") or (0, 0, 0)), "rot": _hook_rot(rot),
                     "scale": s if isinstance(s, (int, float)) else tuple(s)}
    return out
