"""Parametric MakeHuman body through MPFB: macros + targets from the fighter config, game_engine rig."""

import bpy
from mathutils import Vector

from bl_ext.user_default.mpfb.services.humanservice import HumanService
from bl_ext.user_default.mpfb.services.targetservice import TargetService


def clear_scene():
    for collection in (bpy.data.objects, bpy.data.meshes, bpy.data.armatures, bpy.data.materials, bpy.data.cameras):
        for block in list(collection):
            collection.remove(block)


def _expand_target_names(name):
    # "lr-upperarm-fat-decr" applies to both sides
    if name.startswith("lr-"):
        return ["l-" + name[3:], "r-" + name[3:]]
    return [name]


def build_human(body_cfg):
    macro = TargetService.get_default_macro_info_dict()
    for key in ("gender", "age", "muscle", "weight", "proportions", "height", "cupsize", "firmness"):
        if key in body_cfg:
            macro[key] = body_cfg[key]
    race = {"asian": 0.0, "caucasian": 0.0, "african": 0.0}
    race.update(body_cfg.get("race", {"caucasian": 1.0}))
    total = sum(race.values()) or 1.0
    macro["race"] = {k: v / total for k, v in race.items()}

    body = HumanService.create_human(macro_detail_dict=macro)
    for name, weight in body_cfg.get("targets", {}).items():
        for target in _expand_target_names(name):
            path = TargetService.target_full_path(target)
            if path is None:
                raise ValueError(f"unknown MakeHuman target {target}")
            TargetService.load_target(body, path, weight=weight)

    # The rig is fitted to the current (shape-keyed) mesh, then the shape is baked so outfit meshes can be
    # derived from plain vertex data.
    rig = HumanService.add_builtin_rig(body, "game_engine")
    TargetService.bake_targets(body)
    body.name = "body"
    rig.name = "rig"
    return body, rig


def bone_rest(rig):
    """Rest-pose data per bone in armature space."""
    data = {}
    for b in rig.data.bones:
        data[b.name] = {
            "head": b.head_local.copy(),
            "tail": b.tail_local.copy(),
            "rot": b.matrix_local.to_quaternion(),
            "length": b.length,
            "parent": b.parent.name if b.parent else None,
        }
    return data


def foot_landmarks(body, side):
    """Heel, ball and toe-tip points of one foot (armature space, rest pose)."""
    gi = {g.name: g.index for g in body.vertex_groups}
    foot = {gi["foot_" + side], gi["ball_" + side]}
    body_gi = gi["body"]
    pts = []
    for v in body.data.vertices:
        groups = {g.group: g.weight for g in v.groups}
        if groups.get(body_gi, 0) < 0.5:
            continue
        w = sum(groups.get(i, 0) for i in foot)
        if w > 0.5:
            pts.append(v.co.copy())
    low = [p for p in pts if p.z < min(q.z for q in pts) + 0.02]
    heel = max(low, key=lambda p: p.y)  # forward is -Y in MakeHuman space
    toe = min(low, key=lambda p: p.y)
    ground = min(p.z for p in pts)
    return {"heel": Vector((heel.x, heel.y, ground)), "toe": Vector((toe.x, toe.y, ground)), "ground": ground}
