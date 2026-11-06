"""Headless Blender entry point: build one fighter and render its animations.

    blender -b --factory-startup --addons ... --python tools/sprites3d/blender/build.py -- \
        --config tools/sprites3d/fighters/sam.json --out build/sprites3d/sam [--anims walk,run] [--supersample 4]

Writes, per animation, `<out>/<anim>/beauty_####.png` (toon colours), `<out>/<anim>/id_####.png` (part ids in
the red channel, id = round(r * 32)) and `<out>/<anim>/meta.json` (per-frame foot and head positions in
final-cell pixels, measured from the evaluated rig).
"""

import argparse
import json
import math
import os
import sys

import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import gait  # noqa: E402
import human  # noqa: E402
import outfit  # noqa: E402
import posing  # noqa: E402
import toon  # noqa: E402

CELL = 256
ANCHOR_Y = 244


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--anims", default="walk,run,idle,stance,dash")
    ap.add_argument("--supersample", type=int, default=4)
    ap.add_argument("--save-blend", action="store_true")
    return ap.parse_args(argv)


def mesh_bounds_z(objs):
    dg = bpy.context.evaluated_depsgraph_get()
    lo, hi = 1e9, -1e9
    for o in objs:
        ev = o.evaluated_get(dg)
        m = ev.to_mesh()
        for v in m.vertices:
            z = (o.matrix_world @ v.co).z
            lo, hi = min(lo, z), max(hi, z)
        ev.to_mesh_clear()
    return lo, hi


def setup_render(ss):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = 1
    sc.cycles.use_denoising = False
    sc.cycles.max_bounces = 0
    sc.cycles.pixel_filter_type = "BOX"
    sc.cycles.filter_width = 0.01
    sc.render.film_transparent = True
    sc.render.resolution_x = sc.render.resolution_y = CELL * ss
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    sc.render.image_settings.color_depth = "8"
    sc.render.use_persistent_data = True
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.look = "None"
    sc.view_settings.exposure = 0.0
    sc.view_settings.gamma = 1.0
    sc.world = bpy.data.worlds.new("void")
    sc.world.color = (0, 0, 0)


def setup_camera(ppm, ground_world):
    cam_data = bpy.data.cameras.new("cam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = CELL / ppm
    cam_data.clip_start = 0.1
    cam_data.clip_end = 40
    cam = bpy.data.objects.new("cam", cam_data)
    bpy.context.scene.collection.objects.link(cam)
    cam.location = (0.0, -12.0, ground_world + (ANCHOR_Y - CELL / 2) / ppm)
    cam.rotation_euler = (math.radians(90), 0.0, 0.0)
    bpy.context.scene.camera = cam
    return cam


def to_px(cam, p):
    v = world_to_camera_view(bpy.context.scene, cam, p)
    return [round(v.x * CELL, 3), round((1 - v.y) * CELL, 3)]


def build(cfg):
    human.clear_scene()
    body, rig = human.build_human(cfg["body"])
    rest = human.bone_rest(rig)
    feet = {s: human.foot_landmarks(body, s) for s in "lr"}
    skin, garments = outfit.build_outfit(body, rest, cfg["outfit"], cfg.get("hair"))

    contrast = cfg.get("contrast", 1.0)
    toon.assign(skin, toon.make_toon_material("skin", cfg["skin"], contrast=contrast * 0.8))
    for obj, g in garments:
        toon.assign(obj, toon.make_toon_material(g["name"], g["color"], contrast=contrast * g.get("contrast", 1.0)))
    objs = [skin] + [o for o, _ in garments]
    rig.rotation_euler = (0.0, 0.0, math.radians(90.0 - cfg.get("view_yaw", 20.0)))
    bpy.context.view_layer.update()
    return body, rig, rest, feet, objs


def rest_head_px(rig, cam):
    rig.animation_data_clear()
    for pb in rig.pose.bones:
        pb.rotation_mode = "QUATERNION"
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.location = (0, 0, 0)
    bpy.context.view_layer.update()
    hb = rig.pose.bones["head"]
    return {"base": to_px(cam, rig.matrix_world @ hb.head), "tip": to_px(cam, rig.matrix_world @ hb.tail)}


def render_animation(name, poses, fps, rig, rest, sk, cam, ppm, out_dir, id_mat, feet, head_rest):
    os.makedirs(out_dir, exist_ok=True)
    sc = bpy.context.scene
    rig.animation_data_clear()
    order = posing.bone_order(rig)
    for i, pose in enumerate(poses):
        posing.apply_pose(rig, rest, order, pose, i + 1)
    for fc in rig.animation_data.action.fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = "LINEAR"

    frames = []
    for i, pose in enumerate(poses):
        sc.frame_set(i + 1)
        mw = rig.matrix_world
        rec = {"contact": dict(pose.contact)}
        for s in "lr":
            fb, bb = rig.pose.bones[f"foot_{s}"], rig.pose.bones[f"ball_{s}"]
            to_foot = fb.matrix @ rig.data.bones[f"foot_{s}"].matrix_local.inverted()
            to_ball = bb.matrix @ rig.data.bones[f"ball_{s}"].matrix_local.inverted()
            heel = mw @ (to_foot @ feet[s]["heel"])
            ball = mw @ (to_ball @ Vector((rest[f"ball_{s}"]["head"].x, rest[f"ball_{s}"]["head"].y, sk.ground)))
            toe = mw @ (to_ball @ feet[s]["toe"])
            rec[s] = {"heel": to_px(cam, heel), "ball": to_px(cam, ball), "toe": to_px(cam, toe),
                      "heel_z": round((heel.z - (mw @ Vector((0, 0, sk.ground))).z) * ppm, 3),
                      "ball_z": round((ball.z - (mw @ Vector((0, 0, sk.ground))).z) * ppm, 3),
                      "world_x": [round(heel.x * ppm, 3), round(ball.x * ppm, 3)]}
        hb = rig.pose.bones["head"]
        rec["head"] = {"base": to_px(cam, mw @ hb.head), "tip": to_px(cam, mw @ hb.tail)}
        rec["neck"] = to_px(cam, mw @ rig.pose.bones["neck_01"].head)
        frames.append(rec)

        bpy.context.view_layer.material_override = None
        sc.view_settings.view_transform = "Standard"
        sc.render.filepath = os.path.join(out_dir, f"beauty_{i:04d}.png")
        bpy.ops.render.render(write_still=True)
        bpy.context.view_layer.material_override = id_mat
        sc.view_settings.view_transform = "Raw"
        sc.render.filepath = os.path.join(out_dir, f"id_{i:04d}.png")
        bpy.ops.render.render(write_still=True)
    bpy.context.view_layer.material_override = None
    sc.view_settings.view_transform = "Standard"

    rest_head = (rest["head"]["tail"] - rest["head"]["head"]).length * ppm
    meta = {"name": name, "fps": fps, "frames": frames, "ppm": ppm, "head_len_px": rest_head, "head_rest": head_rest,
            "ground_y": ANCHOR_Y, "cell": CELL}
    with open(os.path.join(out_dir, "meta.json"), "w") as fh:
        json.dump(meta, fh, indent=1)


def main():
    args = parse_args()
    with open(args.config) as fh:
        cfg = json.load(fh)
    body, rig, rest, feet, objs = build(cfg)
    sk = gait.Skeleton(rest, feet)

    lo, hi = mesh_bounds_z(objs)
    ppm = cfg["height_px"] / (hi - lo)
    setup_render(args.supersample)
    cam = setup_camera(ppm, lo)
    id_mat = toon.make_id_material()
    head_rest = rest_head_px(rig, cam)

    gcfg = cfg.get("gait", {})
    anims = args.anims.split(",")
    for name in anims:
        if name in ("walk", "run"):
            p = gait.params_from(gait.WALK if name == "walk" else gait.RUN, gcfg.get(name))
            poses = gait.fit_pelvis(sk, rest, gait.locomotion(sk, p), posing)
            stride_px = 2 * p.step * sk.leg * ppm
            target = gcfg.get(name, {}).get("speed", cfg.get("speeds", {}).get(name, 200))
            fps = max(6, round(p.frames * target / stride_px))
        elif name == "stance":
            poses, fps = gait.fighting_stance(sk, 8), 8
        elif name == "idle":
            poses, fps = gait.idle_breathing(sk, 8), 8
        elif name == "dash":
            poses, fps = gait.dash_forward(sk, 6), 15
        else:
            raise ValueError(name)
        render_animation(name, poses, fps, rig, rest, sk, cam, ppm, os.path.join(args.out, name), id_mat, feet, head_rest)
        print(f"[sprites3d] rendered {name}: {len(poses)} frames at {fps} fps", flush=True)

    with open(os.path.join(args.out, "build.json"), "w") as fh:
        json.dump({"id": cfg["id"], "ppm": ppm, "height_m": hi - lo, "anims": anims,
                   "supersample": args.supersample}, fh, indent=1)
    if args.save_blend:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(os.path.abspath(args.out), "fighter.blend"))


main()
