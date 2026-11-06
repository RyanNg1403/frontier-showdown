"""Simple clothing meshes cut from the body by region and pushed out along the normals.

A garment is a copy of the body's faces in its region, so it keeps the skin weights and deforms with the
rig without any cloth fitting. Each garment carries:
  * a face colour attribute `pid` (part id, for the ID render pass used by the 2D post-processing),
  * a point attribute `far` (1 on the limbs of the side turned away from the camera, darkened by the shader),
  * a point attribute `trim` (1 near open edges: cuffs, hems, collars, waistbands).
"""

import bmesh
import bpy
from mathutils import Vector

PART_IDS = {
    # name: (id, depth rank used for inner lines; higher draws in front)
    "head": (1, 5), "hair": (2, 5), "neck": (3, 4),
    "torso": (4, 4), "arm_near": (5, 8), "arm_far": (6, 1),
    "hand_near": (7, 8), "hand_far": (8, 1),
    "legs": (9, 3), "leg_near": (10, 6), "leg_far": (11, 2),
    "shoe_near": (12, 6), "shoe_far": (13, 2),
    "outer_torso": (14, 4), "outer_arm_near": (15, 8), "outer_arm_far": (16, 1),
}


def part_color(name):
    pid = PART_IDS[name][0]
    return (pid / 32.0, 0.0, 0.0, 1.0)


FINGERS = ("thumb", "index", "middle", "ring", "pinky")


class BodyInfo:
    """Per-vertex classification of the baked body mesh."""

    def __init__(self, body, rest):
        self.body = body
        self.rest = rest
        names = {g.index: g.name for g in body.vertex_groups}
        bones = set(rest.keys())
        body_gi = body.vertex_groups["body"].index
        scalp_gi = body.vertex_groups["scalp"].index
        n = len(body.data.vertices)
        self.in_body = [False] * n
        self.scalp = [0.0] * n
        self.dominant = [None] * n
        self.co = [v.co.copy() for v in body.data.vertices]
        self.normal = [v.normal.copy() for v in body.data.vertices]
        for v in body.data.vertices:
            best, best_w = None, 0.0
            for g in v.groups:
                if g.group == body_gi:
                    self.in_body[v.index] = g.weight > 0.5
                elif g.group == scalp_gi:
                    self.scalp[v.index] = g.weight
                else:
                    name = names[g.group]
                    if name in bones and g.weight > best_w:
                        best, best_w = name, g.weight
            self.dominant[v.index] = best
        self.arm_t = [self._limb_param(i, "arm") for i in range(n)]
        self.leg_t = [self._limb_param(i, "leg") for i in range(n)]

    def side(self, i):
        d = self.dominant[i] or ""
        if d.endswith("_l"):
            return "l"
        if d.endswith("_r"):
            return "r"
        return "m"

    def kind(self, i):
        d = self.dominant[i] or ""
        base = d.rsplit("_", 1)[0] if d.endswith(("_l", "_r")) else d
        base = base.split("_0")[0]
        if base in ("upperarm", "lowerarm"):
            return "arm"
        if base == "hand" or base in FINGERS:
            return "hand"
        if base == "clavicle":
            return "clavicle"
        if base in ("thigh", "calf"):
            return "leg"
        if base in ("foot", "ball"):
            return "foot"
        if base in ("spine", "pelvis"):
            return "torso"
        if base == "neck":
            return "neck"
        if base == "head":
            return "head"
        return "other"

    def _limb_param(self, i, limb):
        """0 at the shoulder/hip, 1 at the wrist/ankle, by projection onto the two-bone chain."""
        s = self.side(i)
        if s == "m":
            return 0.0
        if limb == "arm":
            a, b, c = (self.rest[f"upperarm_{s}"]["head"], self.rest[f"lowerarm_{s}"]["head"],
                       self.rest[f"hand_{s}"]["head"])
        else:
            a, b, c = (self.rest[f"thigh_{s}"]["head"], self.rest[f"calf_{s}"]["head"],
                       self.rest[f"foot_{s}"]["head"])
        p = self.co[i]
        l1, l2 = (b - a).length, (c - b).length
        t1 = max(0.0, min(1.0, (p - a).dot(b - a) / (l1 * l1)))
        t2 = max(0.0, (p - b).dot(c - b) / (l2 * l2))
        d1 = (a + (b - a) * t1 - p).length
        d2 = (b + (c - b) * min(t2, 1.0) - p).length
        if d1 < d2:
            return t1 * l1 / (l1 + l2)
        return (l1 + t2 * l2) / (l1 + l2)


def _region_top(info, i, g):
    k = info.kind(i)
    z = info.co[i].z
    pelvis_z = info.rest["pelvis"]["head"].z
    neck_z = info.rest["neck_01"]["head"].z
    neck_len = info.rest["neck_01"]["length"]
    if k in ("arm", "clavicle", "hand"):
        return k == "clavicle" or info.arm_t[i] <= g.get("sleeve", 1.0)
    hem_z = pelvis_z + g.get("hem", -0.03)
    if k == "leg" and hem_z < pelvis_z:
        # A hem below the hip wraps the tops of the thighs instead of cutting up between them.
        return z >= hem_z and info.leg_t[i] < 0.5
    if k == "torso":
        if z < hem_z:
            return False
        open_front = g.get("open_front", 0.0)
        if open_front > 0 and info.co[i].y < 0 and abs(info.co[i].x) < open_front:
            return z < pelvis_z + g.get("open_from", 0.25)
        collar = g.get("collar", "crew")
        if collar in ("open", "vneck") and info.co[i].y < 0:
            depth = g.get("v_depth", 0.1 if collar == "open" else 0.14)
            v_top = neck_z + 0.01
            if z > v_top - depth and abs(info.co[i].x) < g.get("v_width", 0.07) * (z - (v_top - depth)) / depth:
                return False
        return True
    if k == "neck":
        collar = {"crew": 0.0, "turtle": 0.75, "open": 0.0, "vneck": 0.0, "shirt": 0.3}[g.get("collar", "crew")]
        return z < neck_z + neck_len * collar
    return False


def _region_tie(info, i, g):
    """A strip down the front of the chest, from the collar to the belt."""
    if info.kind(i) not in ("torso", "neck") or info.co[i].y >= 0:
        return False
    z = info.co[i].z
    top = info.rest["neck_01"]["head"].z + 0.01
    bottom = info.rest["pelvis"]["head"].z + g.get("bottom", 0.08)
    if not bottom < z < top:
        return False
    knot = top - z < 0.04
    return abs(info.co[i].x) < (g.get("knot", 0.02) if knot else g.get("width", 0.032) * (1 - 0.3 * (top - z) / (top - bottom)))


def _region_belt(info, i, g):
    if info.kind(i) != "torso":
        return False
    waist_z = info.rest["pelvis"]["head"].z + g.get("waist", 0.07)
    return waist_z - g.get("width", 0.04) < info.co[i].z < waist_z


def _region_bottom(info, i, g):
    k = info.kind(i)
    z = info.co[i].z
    waist_z = info.rest["pelvis"]["head"].z + g.get("waist", 0.07)
    if k == "torso":
        return z < waist_z
    if k in ("leg", "foot"):
        return info.leg_t[i] <= g.get("length", 1.0) and (k == "leg" or info.leg_t[i] < 0.995)
    return False


def _region_shoes(info, i, g):
    k = info.kind(i)
    if k == "foot":
        return True
    ankle_z = info.rest["foot_l"]["head"].z
    return k == "leg" and info.co[i].z < ankle_z + g.get("collar", 0.02)


REGIONS = {"top": _region_top, "outer": _region_top, "bottom": _region_bottom, "shoes": _region_shoes,
           "tie": _region_tie, "belt": _region_belt}


def _part_name(info, i, garment_kind):
    k = info.kind(i)
    s = info.side(i)
    near = "near" if s == "r" else "far"  # the rig's right side faces the camera
    if garment_kind in ("top", "outer"):
        prefix = "outer_" if garment_kind == "outer" else ""
        if k in ("arm", "hand"):
            return f"{prefix}arm_{near}"
        return f"{prefix}torso"
    if garment_kind == "bottom":
        return f"leg_{near}" if k in ("leg", "foot") else "legs"
    if garment_kind == "shoes":
        return f"shoe_{near}"
    if garment_kind in ("tie", "belt"):
        return "outer_torso"
    if garment_kind == "hair":
        return "hair"
    if k == "hand":
        return f"hand_{near}"
    if k == "arm":
        return f"arm_{near}"
    if k in ("leg", "foot"):
        return f"leg_{near}"
    if k == "neck":
        return "neck"
    if k == "head":
        return "head"
    return "torso"


def _copy_body(body, name):
    obj = body.copy()
    obj.data = body.data.copy()
    obj.name = obj.data.name = name
    bpy.context.scene.collection.objects.link(obj)
    for m in list(obj.modifiers):
        if m.type == "MASK":
            obj.modifiers.remove(m)
    return obj


def _set_attributes(obj, info, index_map, garment_kind, trim_rings=0):
    mesh = obj.data
    far = mesh.attributes.new("far", "FLOAT", "POINT")
    trim = mesh.attributes.new("trim", "FLOAT", "POINT")
    pid = mesh.attributes.new("pid", "FLOAT_COLOR", "FACE")
    src = [index_map[v.index] for v in mesh.vertices]
    for v in mesh.vertices:
        far.data[v.index].value = 1.0 if info.side(src[v.index]) == "l" and info.kind(src[v.index]) != "torso" else 0.0
    for p in mesh.polygons:
        names = [_part_name(info, src[vi], garment_kind) for vi in p.vertices]
        pid.data[p.index].color = part_color(max(set(names), key=names.count))
    if trim_rings:
        bm = bmesh.new()
        bm.from_mesh(mesh)
        bm.verts.ensure_lookup_table()
        ring = {v.index for v in bm.verts if any(e.is_boundary for e in v.link_edges)}
        frontier = set(ring)
        for _ in range(trim_rings - 1):
            nxt = set()
            for vi in frontier:
                for e in bm.verts[vi].link_edges:
                    nxt.add(e.other_vert(bm.verts[vi]).index)
            frontier = nxt - ring
            ring |= nxt
        bm.free()
        for vi in ring:
            trim.data[vi].value = 1.0


def _extract(body, info, name, keep_vertex, garment_kind, offset_fn, trim_rings=0, smooth=0.0, finish=None):
    obj = _copy_body(body, name)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.verts.ensure_lookup_table()
    keep = [info.in_body[i] and keep_vertex(i) for i in range(len(bm.verts))]
    src_layer = bm.verts.layers.int.new("src")
    for v in bm.verts:
        v[src_layer] = v.index
    dead_faces = [f for f in bm.faces if not all(keep[v.index] for v in f.verts)]
    bmesh.ops.delete(bm, geom=dead_faces, context="FACES_ONLY")
    loose = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=loose, context="VERTS")
    for v in bm.verts:
        v.co = v.co + offset_fn(v[src_layer])
    if smooth > 0:
        interior = [v for v in bm.verts if not any(e.is_boundary for e in v.link_edges)]
        for _ in range(int(smooth * 10)):
            bmesh.ops.smooth_vert(bm, verts=interior, factor=0.5, use_axis_x=True, use_axis_y=True,
                                  use_axis_z=True)
    if finish:
        finish(bm, src_layer)
    bm.verts.ensure_lookup_table()
    index_map = {v.index: v[src_layer] for v in bm.verts}
    bm.to_mesh(obj.data)
    bm.free()
    _set_attributes(obj, info, index_map, garment_kind, trim_rings)
    return obj


def _shoe_finish(info, ground, g):
    """Flatten the sole: everything near the floor sits on one plane `sole` below the bare foot."""
    sole = g.get("sole", 0.006)

    def finish(bm, src_layer):
        for v in bm.verts:
            h = info.co[v[src_layer]].z - ground
            if h < 0.018:
                v.co.z = ground - sole + max(0.0, h - 0.012) * 0.5
    return finish


def _shoe_sole_band(obj, ground, g):
    """Darken the sole edge (the `trim` attribute) so a shoe reads as upper + sole."""
    band = g.get("sole_band", 0.012)
    if not band:
        return
    trim = obj.data.attributes["trim"]
    for v in obj.data.vertices:
        if v.co.z < ground + band:
            trim.data[v.index].value = 1.0


def build_outfit(body, rest, outfit_cfg, hair_cfg):
    """Returns ({object: material spec}, covered vertex flags)."""
    info = BodyInfo(body, rest)
    n = len(info.co)
    covered = [False] * n
    objects = []
    ground = min(info.co[i].z for i in range(n) if info.in_body[i])
    for g in outfit_cfg:
        region = REGIONS[g["kind"]]
        t = g.get("thickness", 0.01)
        flare = g.get("flare", 0.0)

        def offset(i, g=g, t=t, flare=flare):
            extra = 0.0
            if flare and info.kind(i) in ("leg", "foot"):
                extra = flare * info.leg_t[i]
            return info.normal[i] * (t + extra)

        finish = None
        if g["kind"] == "shoes":
            finish = _shoe_finish(info, ground, g)
        obj = _extract(body, info, g["name"], lambda i, g=g, region=region: region(info, i, g), g["kind"], offset,
                       trim_rings=g.get("trim", 0), smooth=g.get("smooth", 2.5 if g["kind"] == "shoes" else 0.0),
                       finish=finish)
        if g["kind"] == "shoes":
            _shoe_sole_band(obj, ground, g)
        objects.append((obj, g))
        for i in range(n):
            if info.in_body[i] and region(info, i, g):
                covered[i] = True

    if hair_cfg:
        top_z = max(info.co[i].z for i in range(n) if info.in_body[i])
        base_z = info.rest["head"]["head"].z

        def hair_offset(i):
            up = max(0.0, (info.co[i].z - base_z) / (top_z - base_z))
            vol = hair_cfg.get("thickness", 0.008) + hair_cfg.get("top", 0.02) * up ** 2
            fwd = Vector((0, -hair_cfg.get("forward", 0.0) * up ** 3, 0))
            return info.normal[i] * vol + fwd

        hair = _extract(body, info, "hair", lambda i: info.scalp[i] > hair_cfg.get("coverage", 0.5), "hair",
                        hair_offset, smooth=0.3)
        objects.append((hair, {"name": "hair", "color": hair_cfg["color"], "kind": "hair"}))

    # The visible body is whatever the outfit does not cover.
    skin = _extract(body, info, "skin", lambda i: not covered[i], "skin", lambda i: Vector())
    body.hide_render = True
    body.hide_viewport = True
    return skin, objects
