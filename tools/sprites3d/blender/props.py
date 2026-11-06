"""Props: simple meshes parented to rig bones (flamethrower, hex shield, EWI, scarf, ...).

Create a prop once per build with `add` (or attach an object you built yourself with `register`); it starts
hidden. A pose shows it by listing it in `pose.props` (`shared.pose_from` takes a `props` key, so keyframes can
too):

    pose.props = {"hex_shield": True}                                    # visible at its attachment
    pose.props = {"ewi": {"offset": (0, 0.02, 0), "rot": (0, 0, 15)}}    # visible, moved for this frame
    pose.props = {"scarf": {"visible": True, "scale": (1, 1.4, 1)}}

A transform is relative to the prop's attachment, in the parent bone's frame (`"space": "armature"` reads
`offset` and `rot` as armature axes instead: forward is -Y, up is +Z). `posing.apply_pose` keys every
registered prop on every frame: visibility, and the transform (reset to the attachment when the pose gives
none), so props never leak into frames or animations that don't ask for them.
"""

import math

import bpy
from mathutils import Matrix, Vector

_REGISTRY = {}  # name -> (object, attachment matrix_basis)


def _rot(deg, size=4):
    R = Matrix.Identity(size)
    for axis, d in zip("XYZ", deg):
        R = R @ Matrix.Rotation(math.radians(d), size, axis)
    return R


def _rig(rig):
    return rig or bpy.data.objects.get("rig")


def add(name, mesh, color, bone, offset=(0, 0, 0), rot=(0, 0, 0), part="prop_front", contrast=1.0,
        space="bone", rig=None):
    """Attach `mesh` to `bone` as a toon-shaded prop. With space="bone", `offset` (metres) and `rot` (degrees,
    XYZ) are in the bone's rest frame at its head (Y runs along the bone); with space="armature" they are
    armature axes relative to the bone head. `part` is the part id for the depth lines and the head
    composite: prop_front (in front of everything), prop_back (behind the body), or any outfit part name."""
    import outfit
    import toon
    rig = _rig(rig)
    b = rig.data.bones[bone]
    if space == "armature":
        Rb = b.matrix_local.to_3x3()
        offset = tuple(Rb.inverted() @ Vector(offset))
        rot = tuple(math.degrees(a) for a in (Rb.inverted() @ _rot(rot, 3) @ Rb).to_euler("XYZ"))
    obj = bpy.data.objects.new("prop_" + name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    toon.assign(obj, toon.make_toon_material("prop_" + name, color, contrast=contrast))
    pid = mesh.attributes.get("pid") or mesh.attributes.new("pid", "FLOAT_COLOR", "FACE")
    for p in mesh.polygons:
        pid.data[p.index].color = outfit.part_color(part)
    obj.parent = rig
    obj.parent_type = "BONE"
    obj.parent_bone = bone
    obj.matrix_parent_inverse = (b.matrix_local @ Matrix.Translation((0.0, b.length, 0.0))).inverted()
    obj.matrix_basis = b.matrix_local @ Matrix.Translation(offset) @ _rot(rot)
    return register(name, obj)


def register(name, obj):
    """Manage an existing object (already parented and placed) as a prop; its current placement is the
    attachment that per-frame transforms are relative to."""
    obj.hide_render = True
    _REGISTRY[name] = (obj, obj.matrix_basis.copy())
    return obj


def registered():
    return {name: obj for name, (obj, _) in _REGISTRY.items()}


def clear_animation():
    for obj, _ in _REGISTRY.values():
        obj.animation_data_clear()


def apply(pose, frame):
    """Key visibility and placement of every registered prop for this frame."""
    wanted = getattr(pose, "props", None) or {}
    for name, (obj, base) in _REGISTRY.items():
        spec = wanted.get(name, False)
        if isinstance(spec, dict):
            visible = spec.get("visible", True)
            offset, rot = Vector(spec.get("offset", (0, 0, 0))), spec.get("rot", (0, 0, 0))
            scale = spec.get("scale", 1.0)
            S = Matrix.Diagonal(((scale,) * 3 if isinstance(scale, (int, float)) else tuple(scale)) + (1.0,))
            if spec.get("space") == "armature" and obj.parent_bone:
                Rb = obj.parent.data.bones[obj.parent_bone].matrix_local.to_3x3()
                offset = Rb.inverted() @ offset
                R = (Rb.inverted() @ _rot(rot, 3) @ Rb).to_4x4()
            else:
                R = _rot(rot)
            obj.matrix_basis = base @ Matrix.Translation(offset) @ R @ S
        else:
            visible = bool(spec)
            obj.matrix_basis = base
        obj.hide_render = not visible
        obj.keyframe_insert("hide_render", frame=frame)
        for path in ("location", "rotation_euler", "scale"):
            obj.keyframe_insert(path, frame=frame)
