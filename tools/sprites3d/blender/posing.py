"""Turns `gait.Pose` objects into keyframes on the game_engine rig.

Bones are posed by absolute armature-space rotations D (rest orientation -> posed orientation). Blender's
local basis rotation follows from D and the parent's D:  Q = Rrest^-1 · Dparent^-1 · D · Rrest.
Legs use an analytic two-bone IK with the bone lengths of the rig, so the ankle lands exactly on target.
"""

import math

from mathutils import Matrix, Quaternion, Vector

import props
from gait import FWD, LAT, rx, rz

FINGERS = ("thumb", "index", "middle", "ring", "pinky")
# Fist: per-joint curl (degrees at fist = 1) about each finger bone's local axis.
FIST = {"f_axis": (1, 0, 0), "f": (85, 100, 70), "t_axis": (1, 0, 0), "t": (30, 40, 40)}
FIST_OVERRIDE = None


def bone_order(rig):
    order, todo = [], [b for b in rig.data.bones if b.parent is None]
    while todo:
        b = todo.pop(0)
        order.append(b.name)
        todo.extend(b.children)
    return order


def _frame(d, ref):
    d = d.normalized()
    r = ref - d * ref.dot(d)
    if r.length < 1e-6:
        r = LAT.cross(d) if abs(d.dot(LAT)) < 0.9 else FWD.cross(d)
    r.normalize()
    c = d.cross(r)
    return Matrix((d, r, c)).transposed()


def aim(rest_dir, rest_ref, tgt_dir, tgt_ref):
    return (_frame(tgt_dir, tgt_ref) @ _frame(rest_dir, rest_ref).inverted()).to_quaternion()


def hip_positions(rest, pose):
    pelvis = rest["pelvis"]["head"] + pose.pelvis_offset
    rot = pose.body @ pose.pelvis
    return {s: pelvis + rot @ (rest[f"thigh_{s}"]["head"] - rest["pelvis"]["head"]) for s in "lr"}


def _sagittal(rot, angle, lateral=0.0):
    """Direction at `angle` degrees forward of 'down' in the frame `rot`, and its forward-facing normal."""
    a = math.radians(angle)
    return (rot @ Vector((lateral, -math.sin(a), -math.cos(a))), rot @ Vector((0.0, -math.cos(a), math.sin(a))))


def two_bone_ik(hip, ankle, l1, l2, pole):
    d_vec = ankle - hip
    d = max(abs(l1 - l2) + 1e-4, min(l1 + l2 - 1e-5, d_vec.length))
    u = d_vec.normalized()
    a = (l1 * l1 - l2 * l2 + d * d) / (2 * d)
    h = math.sqrt(max(0.0, l1 * l1 - a * a))
    v = pole - u * pole.dot(u)
    v.normalize()
    knee = hip + u * a + v * h
    return knee, v


def _arm_dir(chest, swing, splay, sign):
    s, a = math.radians(splay), math.radians(swing)
    local = Vector((sign * math.sin(s), -math.sin(a) * math.cos(s), -math.cos(a) * math.cos(s)))
    return chest @ local


def solve(rest, pose):
    """Absolute rotations for every driven bone, plus explicit local rotations for fingers."""
    b = pose.body
    D = {"pelvis": b @ pose.pelvis, "spine_01": b @ pose.spine[0], "spine_02": b @ pose.spine[1],
         "spine_03": b @ pose.spine[2], "neck_01": b @ pose.neck, "head": b @ pose.head}
    hips = hip_positions(rest, pose)
    for s in "lr":
        sign = 1.0 if s == "l" else -1.0
        thigh_rest = rest[f"calf_{s}"]["head"] - rest[f"thigh_{s}"]["head"]
        calf_rest = rest[f"foot_{s}"]["head"] - rest[f"calf_{s}"]["head"]
        yaw = rz(-sign * pose.foot_yaw.get(s, 0.0))  # toe-out
        if s in pose.leg_fk:
            # FK leg in the pelvis frame: (hip flexion, knee flexion, foot pitch), degrees.
            hip_a, knee_a, foot_a = pose.leg_fk[s]
            pel = D["pelvis"]
            t_dir, t_ref = _sagittal(pel, hip_a, sign * 0.04)
            c_dir, c_ref = _sagittal(pel, hip_a - knee_a, sign * 0.02)
            D[f"thigh_{s}"] = aim(thigh_rest, FWD, t_dir, t_ref)
            D[f"calf_{s}"] = aim(calf_rest, FWD, c_dir, c_ref)
            D[f"foot_{s}"] = pel @ yaw @ rx(foot_a)
        else:
            hip, ankle = hips[s], pose.ankle[s]
            pole = FWD + LAT * (sign * pose.knee_out.get(s, 0.08))
            knee, v = two_bone_ik(hip, ankle, rest[f"thigh_{s}"]["length"], rest[f"calf_{s}"]["length"], pole)
            D[f"thigh_{s}"] = aim(thigh_rest, FWD, knee - hip, v)
            D[f"calf_{s}"] = aim(calf_rest, FWD, ankle - knee, v)
            D[f"foot_{s}"] = yaw @ rx(pose.foot_pitch[s])
            if pose.toe_pitch.get(s) is not None:
                D[f"ball_{s}"] = yaw @ rx(pose.toe_pitch[s])

        swing, elbow, splay = pose.arm[s]
        chest = D["spine_03"]
        up_t = _arm_dir(chest, swing, splay, sign)
        fore_t = _arm_dir(chest, swing + max(elbow, 4.0), splay * 0.5, sign)
        up_rest = rest[f"lowerarm_{s}"]["head"] - rest[f"upperarm_{s}"]["head"]
        fore_rest = rest[f"hand_{s}"]["head"] - rest[f"lowerarm_{s}"]["head"]
        D[f"upperarm_{s}"] = aim(up_rest, fore_rest, up_t, fore_t)
        D[f"lowerarm_{s}"] = aim(fore_rest, -up_rest, fore_t, -up_t)
        twist = pose.hand_twist.get(s, 0.0) if pose.hand_twist else 0.0
        if twist:
            D[f"hand_{s}"] = Quaternion(fore_t.normalized(), math.radians(sign * twist)) @ D[f"lowerarm_{s}"]

    local = {}
    spec = FIST_OVERRIDE or FIST
    for name in rest:
        base = name.split("_")[0]
        if base in FINGERS:
            side = name[-1]
            amount = pose.fist_side.get(side, pose.fist) if pose.fist_side else pose.fist
            seg = int(name.split("_")[1]) - 1
            key = "t" if base == "thumb" else "f"
            axis = Vector(spec[key + "_axis"] if not (key == "t" and seg == 0) else spec.get("t1_axis", spec["t_axis"]))
            if side == "r" and spec.get("mirror_" + key):
                axis = Vector((axis.x, -axis.y, -axis.z))
            local[name] = Quaternion(axis.normalized(), math.radians(spec[key][seg] * amount))
    return D, local


def apply_pose(rig, rest, order, pose, frame):
    D_abs, local = solve(rest, pose)
    D = {}
    for name in order:
        r = rest[name]
        parent = r["parent"]
        Dp = D[parent] if parent else Quaternion()
        Rb = r["rot"]
        pb = rig.pose.bones[name]
        pb.rotation_mode = "QUATERNION"
        if name in D_abs:
            D[name] = D_abs[name]
            q = Rb.inverted() @ Dp.inverted() @ D_abs[name] @ Rb
        else:
            q = local.get(name, Quaternion())
            D[name] = Dp @ Rb @ q @ Rb.inverted()
        pb.rotation_quaternion = q
        pb.keyframe_insert("rotation_quaternion", frame=frame)
        if name == "pelvis":
            pb.location = Rb.inverted() @ pose.pelvis_offset
            pb.keyframe_insert("location", frame=frame)
    props.apply(pose, frame)
