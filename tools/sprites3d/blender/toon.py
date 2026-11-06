"""Pixel-friendly toon materials.

Everything is emission: the light is a fixed direction dotted with the world normal and banded through a
constant colour ramp, so a render is exact with one sample per pixel and needs no GPU or lamps. Far-side
limbs (`far` attribute) and cuffs/hems (`trim` attribute) are darkened in the shader.
"""

import bpy
from mathutils import Vector

LIGHT_DIR = Vector((0.55, -0.6, 0.75)).normalized()  # world space: from the front, the camera side and above


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))


def linear(hex_color, scale=1.0, shift=(0.0, 0.0, 0.0)):
    r, g, b = hex_rgb(hex_color)
    rgb = [min(1.0, max(0.0, c * scale + s)) for c, s in zip((r, g, b), shift)]
    return tuple(srgb_to_linear(c) for c in rgb) + (1.0,)


def band_colors(hex_color, contrast=1.0):
    """Shadow, mid and light tones with the usual pixel-art hue shift (cool shadows, warm lights)."""
    return (
        linear(hex_color, 1.0 - 0.36 * contrast, (-0.01, -0.005, 0.02)),
        linear(hex_color),
        linear(hex_color, 1.0 + 0.22 * contrast, (0.035, 0.025, 0.0)),
    )


def make_toon_material(name, hex_color, *, contrast=1.0, bands=(0.5, 0.74), far_dark=0.28, trim_dark=0.22):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    emit = nt.nodes.new("ShaderNodeEmission")
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    dot = nt.nodes.new("ShaderNodeVectorMath")
    dot.operation = "DOT_PRODUCT"
    dot.inputs[1].default_value = LIGHT_DIR
    remap = nt.nodes.new("ShaderNodeMapRange")
    remap.inputs["From Min"].default_value = -1.0
    remap.inputs["From Max"].default_value = 1.0
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.interpolation = "CONSTANT"
    shadow, mid, light = band_colors(hex_color, contrast)
    els = ramp.color_ramp.elements
    els[0].position, els[0].color = 0.0, shadow
    els[1].position, els[1].color = bands[0], mid
    e = els.new(bands[1])
    e.color = light

    far = nt.nodes.new("ShaderNodeAttribute")
    far.attribute_name = "far"
    far_amt = nt.nodes.new("ShaderNodeMath")
    far_amt.operation = "MULTIPLY"
    far_amt.inputs[1].default_value = far_dark
    far_mix = nt.nodes.new("ShaderNodeMix")
    far_mix.data_type = "RGBA"
    far_mix.blend_type = "MULTIPLY"
    far_mix.inputs["B"].default_value = (0.55, 0.55, 0.68, 1.0)

    trim = nt.nodes.new("ShaderNodeAttribute")
    trim.attribute_name = "trim"
    trim_amt = nt.nodes.new("ShaderNodeMath")
    trim_amt.operation = "MULTIPLY"
    trim_amt.inputs[1].default_value = trim_dark
    trim_mix = nt.nodes.new("ShaderNodeMix")
    trim_mix.data_type = "RGBA"
    trim_mix.blend_type = "MULTIPLY"
    trim_mix.inputs["B"].default_value = (0.5, 0.5, 0.55, 1.0)

    L = nt.links.new
    L(geo.outputs["Normal"], dot.inputs[0])
    L(dot.outputs["Value"], remap.inputs["Value"])
    L(remap.outputs["Result"], ramp.inputs["Fac"])
    L(far.outputs["Fac"], far_amt.inputs[0])
    L(far_amt.outputs["Value"], far_mix.inputs["Factor"])
    L(ramp.outputs["Color"], far_mix.inputs["A"])
    L(trim.outputs["Fac"], trim_amt.inputs[0])
    L(trim_amt.outputs["Value"], trim_mix.inputs["Factor"])
    L(far_mix.outputs["Result"], trim_mix.inputs["A"])
    L(trim_mix.outputs["Result"], emit.inputs["Color"])
    L(emit.outputs["Emission"], out.inputs["Surface"])
    return mat


def make_id_material():
    mat = bpy.data.materials.new("part_id")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    emit = nt.nodes.new("ShaderNodeEmission")
    attr = nt.nodes.new("ShaderNodeAttribute")
    attr.attribute_name = "pid"
    nt.links.new(attr.outputs["Color"], emit.inputs["Color"])
    nt.links.new(emit.outputs["Emission"], out.inputs["Surface"])
    return mat


def assign(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(mat)
