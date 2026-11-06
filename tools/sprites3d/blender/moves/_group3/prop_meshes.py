"""Simple prop meshes from the roster doc, with toon materials and the attributes the pixel stage needs, attached
and registered with the official props hook.

Every builder returns one object, centred on its grip point, sized in metres. `part` picks the part id the
ID pass writes: "hand_near" props draw in front of the body and the 2D head, "hand_far" ones behind.
"""

import math

import bmesh
import bpy
from mathutils import Matrix, Vector

import gait
import outfit
import props
import toon


def _finish(name, bm, colours, part):
    """colours: list of (hex, contrast) indexed by each face's material_index."""
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    for i, (hex_color, contrast) in enumerate(colours):
        mesh.materials.append(toon.make_toon_material(f"{name}_{i}", hex_color, contrast=contrast))
    mesh.attributes.new("far", "FLOAT", "POINT")
    mesh.attributes.new("trim", "FLOAT", "POINT")
    pid = mesh.attributes.new("pid", "FLOAT_COLOR", "FACE")
    for p in mesh.polygons:
        pid.data[p.index].color = outfit.part_color(part)
    for p in mesh.polygons:
        p.use_smooth = False
    obj.hide_render = True
    return obj


def _paint(bm, faces, index):
    for f in faces:
        f.material_index = index


def box(bm, size, at=(0, 0, 0), index=0):
    ret = bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Translation(at) @ Matrix.Diagonal((*size, 1.0)))
    faces = list({f for v in ret["verts"] for f in v.link_faces})
    _paint(bm, faces, index)
    return faces


def cylinder(bm, radius, depth, at=(0, 0, 0), rot=None, segments=16, radius2=None, index=0):
    m = Matrix.Translation(at) @ (rot or Matrix.Identity(4))
    ret = bmesh.ops.create_cone(bm, cap_ends=True, segments=segments, radius1=radius,
                                radius2=radius if radius2 is None else radius2, depth=depth, matrix=m)
    faces = list({f for v in ret["verts"] for f in v.link_faces})
    _paint(bm, faces, index)
    return faces


def sphere(bm, radius, at=(0, 0, 0), index=0, subdiv=2):
    ret = bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=radius, matrix=Matrix.Translation(at))
    faces = list({f for v in ret["verts"] for f in v.link_faces})
    _paint(bm, faces, index)
    return faces


ROT_X = Matrix.Rotation(math.radians(90), 4, "X")


def lens(part="hand_far"):
    """Brass-rimmed magnifying lens (Chris). Handle down from the grip, the lens above it facing along Y."""
    bm = bmesh.new()
    cylinder(bm, 0.007, 0.08, at=(0, 0, -0.01), segments=8, index=0)
    cylinder(bm, 0.05, 0.012, at=(0, 0, 0.08), rot=ROT_X, segments=20, index=1)
    cylinder(bm, 0.042, 0.016, at=(0, 0, 0.08), rot=ROT_X, segments=20, index=2)
    return _finish("lens", bm, [("#4a3424", 1.0), ("#c99a3c", 1.2), ("#bfe6f2", 0.5)], part)


def briefcase(part="hand_near"):
    """'$100,000' briefcase (Mustafa). Grip at the handle, body hanging below."""
    bm = bmesh.new()
    box(bm, (0.34, 0.09, 0.25), at=(0, 0, -0.15), index=0)
    box(bm, (0.36, 0.095, 0.02), at=(0, 0, -0.07), index=1)
    box(bm, (0.1, 0.02, 0.03), at=(0, 0, -0.012), index=1)
    return _finish("briefcase", bm, [("#4b3426", 1.0), ("#c9a64a", 1.0)], part)


def orb(part="hand_near", radius=0.06):
    """Mustafa's friendly amber orb companion."""
    bm = bmesh.new()
    sphere(bm, radius, index=0)
    sphere(bm, radius * 0.45, at=(radius * 0.35, -radius * 0.55, radius * 0.25), index=1, subdiv=1)
    return _finish("orb", bm, [("#f5a623", 0.8), ("#fff1c9", 0.4)], part)


def terrarium(part="hand_near"):
    """Hexagonal 'CONTAINED' terrarium (Mustafa's finisher). Grip at the base centre."""
    bm = bmesh.new()
    cylinder(bm, 0.095, 0.14, at=(0, 0, 0.07), segments=6, index=0)
    cylinder(bm, 0.105, 0.02, at=(0, 0, 0.0), segments=6, index=1)
    cylinder(bm, 0.105, 0.016, at=(0, 0, 0.14), segments=6, index=1)
    sphere(bm, 0.03, at=(0, 0, 0.045), index=2, subdiv=1)
    return _finish("terrarium", bm, [("#d9c79a", 0.5), ("#c97d12", 1.0), ("#3d6b3a", 0.8)], part)


def medal(part="hand_near"):
    """Small gold medal on a ribbon (Geoffrey's victory). Grip at the top of the ribbon."""
    bm = bmesh.new()
    box(bm, (0.045, 0.008, 0.12), at=(0, 0, -0.06), index=0)
    cylinder(bm, 0.055, 0.012, at=(0, 0, -0.17), rot=ROT_X, segments=16, index=1)
    return _finish("medal", bm, [("#2f5fb3", 1.0), ("#e3b23c", 1.3)], part)


def flask(part="hand_near"):
    """Glass flask (Geoffrey's 'Distillation'). Grip at the neck."""
    bm = bmesh.new()
    cylinder(bm, 0.07, 0.11, at=(0, 0, -0.11), radius2=0.025, segments=14, index=0)
    cylinder(bm, 0.018, 0.07, at=(0, 0, -0.02), segments=10, index=0)
    cylinder(bm, 0.02, 0.025, at=(0, 0, 0.025), segments=10, index=1)
    return _finish("flask", bm, [("#cfe9ef", 0.5), ("#8a5a36", 1.0)], part)


def chalk(part="hand_near"):
    bm = bmesh.new()
    cylinder(bm, 0.008, 0.07, at=(0, 0.02, 0), rot=ROT_X, segments=6, index=0)
    return _finish("chalk", bm, [("#f4f2ea", 0.4)], part)


def bridge(part="hand_near", scale=1.0):
    """Tiny glowing Golden Gate Bridge (Chris). Origin at the middle of the deck's underside."""
    bm = bmesh.new()
    s = scale
    box(bm, (0.42 * s, 0.05 * s, 0.015 * s), at=(0, 0, 0.04 * s), index=0)
    for x in (-0.13, 0.13):
        box(bm, (0.02 * s, 0.05 * s, 0.16 * s), at=(x * s, 0, 0.08 * s), index=0)
    for i in range(9):
        x = -0.2 + i * 0.05
        z = 0.15 - 0.09 * math.cos((x / 0.13) * math.pi / 2) if abs(x) <= 0.13 else 0.06 + (0.2 - abs(x)) * 1.2
        box(bm, (0.05 * s, 0.01 * s, 0.008 * s), at=(x * s, 0, z * s), index=0)
    return _finish("bridge", bm, [("#e8562a", 1.0)], part)


def figurine(part="hand_near"):
    """3D-printed geometric 'toy model' figurine (Chris's finisher). Origin at its base."""
    bm = bmesh.new()
    cylinder(bm, 0.05, 0.02, at=(0, 0, 0.01), segments=5, index=0)
    sphere(bm, 0.035, at=(0, 0, 0.06), index=1, subdiv=1)
    cylinder(bm, 0.025, 0.05, at=(0, 0, 0.115), segments=5, radius2=0.012, index=1)
    return _finish("figurine", bm, [("#e8e2d4", 0.6), ("#f2a65a", 0.8)], part)


def desk(part="leg_far"):
    """Small side desk for Chris's figurine. Origin on the floor under its centre; top at 0.5 m."""
    bm = bmesh.new()
    box(bm, (0.42, 0.3, 0.03), at=(0, 0, 0.5), index=0)
    for x in (-0.18, 0.18):
        for y in (-0.12, 0.12):
            box(bm, (0.03, 0.03, 0.5), at=(x, y, 0.25), index=1)
    return _finish("desk", bm, [("#8a6440", 1.0), ("#5b4029", 1.0)], part)


def photo_tile(part="hand_near", size=0.09):
    """A small labelled ImageNet photo tile (Fei-Fei)."""
    bm = bmesh.new()
    box(bm, (size, 0.006, size), index=0)
    box(bm, (size * 0.8, 0.008, size * 0.55), at=(0, 0, size * 0.08), index=1)
    return _finish("photo_tile", bm, [("#f6f1e6", 0.4), ("#3ccf9e", 0.8)], part)


BUILDERS = {"lens": lens, "briefcase": briefcase, "orb": orb, "terrarium": terrarium, "medal": medal,
            "flask": flask, "chalk": chalk, "bridge": bridge, "figurine": figurine, "desk": desk, "photo_tile": photo_tile}


def build(name):
    """`name` may carry a suffix after a colon for a second instance, e.g. 'bridge:floor'."""
    base = name.split(":")[0]
    obj = BUILDERS[base]()
    obj.name = name
    return obj


# ------------------------------------------------------------------------------------------ runtime
# Props go through the official hook (blender/props.py): each object is built and attached here, then handed to
# `props.register`; a pose shows it by listing its key in `pose.props`, and `posing.apply_pose` keys visibility
# and resets it to this attachment on every frame. Keys are prefixed `g3:` so they never collide with another
# move module's props.
#
# Attachments:
#   bone, upright   Copy Location of the bone's tail (head for space="rig") plus an armature-axes offset; the
#                   prop keeps the rig's orientation (briefcases hang, medals face the camera)
#   bone, !upright  bone parent: offset in the bone's frame from its tail (chalk, follows the hand)
#   no bone         parented to the rig at (lateral m, forward L, up L) from the anchor (floor props)

_REGISTRY = {}


def _rig():
    return bpy.data.objects["rig"]


def _key(prop):
    return "g3:" + "|".join(str(x) for x in (prop.name, prop.bone, prop.offset, prop.rotation, prop.space,
                                             prop.upright))


def _attach(obj, prop, sk):
    rig = _rig()
    rot = (Matrix.Rotation(math.radians(prop.rotation[2]), 4, "Z") @ Matrix.Rotation(math.radians(prop.rotation[1]), 4, "Y")
           @ Matrix.Rotation(math.radians(prop.rotation[0]), 4, "X"))
    rig_rot = rig.matrix_world.to_quaternion().to_matrix().to_4x4()
    if prop.bone and prop.upright:
        obj.matrix_world = rig_rot @ rot
        obj.location = rig_rot.to_3x3() @ Vector(prop.offset)
        c = obj.constraints.new("COPY_LOCATION")
        c.target, c.subtarget = rig, prop.bone
        c.head_tail = 0.0 if prop.space == "rig" else 1.0
        c.use_offset = True
    elif prop.bone:
        obj.parent, obj.parent_type, obj.parent_bone = rig, "BONE", prop.bone
        obj.matrix_parent_inverse = Matrix.Identity(4)
        obj.matrix_basis = Matrix.Translation(prop.offset) @ rot
    else:
        L = sk.leg
        obj.parent = rig
        obj.matrix_parent_inverse = Matrix.Identity(4)
        pos = Vector((prop.offset[0], 0.0, 0.0)) + gait.FWD * (prop.offset[1] * L) + gait.UP * (prop.offset[2] * L + sk.ground)
        obj.matrix_basis = Matrix.Translation(pos) @ rot


def attach_props(poses, specs, timing, sk, resolve):
    """Mark which frames of a clip show which props (pose.props) and make sure their objects exist."""
    for pose in poses:
        pose.props = dict(getattr(pose, "props", None) or {})
    for prop in specs:
        key = _key(prop)
        if key not in _REGISTRY:
            obj = build(prop.name)
            obj.name = "g3_" + prop.name.replace(":", "_")
            _attach(obj, prop, sk)
            _REGISTRY[key] = props.register(key, obj)
        lo, hi = prop.frames or (0, timing.frames - 1)
        for i in range(round(resolve(lo, timing)), round(resolve(hi, timing)) + 1):
            if 0 <= i < len(poses):
                poses[i].props[key] = True
    return poses
