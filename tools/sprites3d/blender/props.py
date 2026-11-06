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

Always-on props (a fighter's signature prop, in the shared states too): `set_always(name)` shows a prop on
every frame whose pose doesn't mention it, at its `set_default` transform; a pose can still hide it
(`False` / `{"visible": False}`) or move it. A name with no prop of its own but registered members
`name_0 .. name_k` (pre-shaped flutter phases, like a scarf) is a cycling group: one member per frame. The
renderer turns these on from the fighter config's `"props": {"always": [...]}`.
"""

import math

import bpy
from mathutils import Matrix, Vector

_REGISTRY = {}  # name -> (object, attachment matrix_basis)
_DEFAULTS = {}  # name -> transform dict used when the prop is shown with True or by being always-on
_ALWAYS = set()
_GROUPS = []    # cycling always-on groups: lists of member names


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


def set_default(name, spec):
    """The transform a prop takes when shown without one (a pose's True, or always-on)."""
    _DEFAULTS[name] = dict(spec)


def set_always(name, on=True):
    """Make a prop (or a cycling group `name_0..name_k`) visible on every frame that doesn't mention it.
    Returns False when nothing by that name is registered."""
    if name in _REGISTRY:
        (_ALWAYS.add if on else _ALWAYS.discard)(name)
        return True
    members = sorted((n for n in _REGISTRY if n.startswith(name + "_") and n[len(name) + 1:].isdigit()),
                     key=lambda n: int(n[len(name) + 1:]))
    if not members:
        return False
    _GROUPS[:] = [g for g in _GROUPS if g != members]
    if on:
        _GROUPS.append(members)
    return True


def registered():
    return {name: obj for name, (obj, _) in _REGISTRY.items()}


def clear_animation():
    for obj, _ in _REGISTRY.values():
        obj.animation_data_clear()


def apply(pose, frame):
    """Key visibility and placement of every registered prop for this frame."""
    wanted = dict(getattr(pose, "props", None) or {})
    for group in _GROUPS:
        if not any(n in wanted for n in group):
            wanted[group[(frame - 1) % len(group)]] = True
    for name, (obj, base) in _REGISTRY.items():
        spec = wanted.get(name, name in _ALWAYS)
        if spec is True and name in _DEFAULTS:
            spec = _DEFAULTS[name]
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
