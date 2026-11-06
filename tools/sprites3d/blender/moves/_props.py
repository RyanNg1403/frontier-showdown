"""Prop meshes for move files (helper; `_` keeps it out of move discovery).

Props are simple meshes parented to rig bones (`_kit.Kit.prop`). A move frame lists the props it shows in its
spec's `props`; `_kit` copies that onto the `gait.Pose` as `pose.props`. The shared renderer has no prop
hook yet, so `register` wraps `posing.apply_pose` once: it calls the original unchanged, then keys each
registered prop's render visibility for that frame (hidden on frames whose pose has no `props`, which covers
the shared states). Builds without registered props are untouched.
"""

import posing

_REGISTRY = {}


def register(name, obj):
    _REGISTRY[name] = obj
    _install()


def _install():
    original = posing.apply_pose
    if getattr(original, "_sprites3d_props", False):
        return

    def apply_pose(rig, rest, order, pose, frame):
        original(rig, rest, order, pose, frame)
        visible = getattr(pose, "props", None) or {}
        for name, obj in _REGISTRY.items():
            if frame == 1 and obj.animation_data:
                obj.animation_data_clear()
            obj.hide_render = not visible.get(name, False)
            obj.keyframe_insert("hide_render", frame=frame)

    apply_pose._sprites3d_props = True
    posing.apply_pose = apply_pose
