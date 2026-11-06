#!/usr/bin/env python3
"""2D stage of the 3D-to-pixel pipeline: supersampled toon renders -> one fighter atlas.

    python3 tools/sprites3d/post/process.py --config tools/sprites3d/fighters/sam.json \
        --build tools/sprites3d/build/sam/render --out assets/fighters/sam [--preview-dir DIR] [--sheet PNG]

Per frame:
  1. Mode downscale (supersample -> 1x): every output pixel takes the most common part id and, inside that
     part, the most common toon colour of its block. No blending, so the palette stays the material bands.
  2. Likeness head: the 3D head and hair are erased and a 2D head view (`heads/<id>[-<view>].png`, picked per
     animation) is pasted at the head bone, rotated about a pivot calibrated once per fighter on the idle pose.
     Near the neck cut the 3D neck and collar win, so the joint shows no seam.
  3. Inner lines where a nearer limb overlaps a farther part, a 1 px outer outline, one shared palette.
Then the atlas: every animation in `build.json` (shared states and move-module animations), plus derived
entries (walk_back = walk_fwd reversed at 80% speed). Frames are trimmed to their pixels, de-duplicated and
shelf-packed into the smallest sheet (each rect carries its own feet `anchor`), with `strideSpeed` measured
from the planted foot and footstep events on contact frames of locomotion cycles. PNG plus lossless WebP.

Requires: numpy, pillow.
"""

import argparse
import json
import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFont

import headgrade
import headmeta

key_background = headmeta.key_background  # used by prep_head.py and heads/make_heads.py

HERE = os.path.dirname(os.path.abspath(__file__))
HEADS = os.path.join(HERE, "..", "heads")

# Mirrors outfit.PART_IDS (id: depth rank). Kept here so this script runs without Blender.
PART_RANK = {1: 5, 2: 5, 3: 4, 4: 4, 5: 8, 6: 1, 7: 8, 8: 1, 9: 3, 10: 6, 11: 2, 12: 6, 13: 2, 14: 4, 15: 8, 16: 1,
             17: 9, 18: 0}
HEAD_PARTS = (1, 2)
NECK_PARTS = (3,)
TORSO_PARTS = (4, 14)
FRONT_PARTS = tuple(k for k, r in PART_RANK.items() if r > 5)
CELL = 256
ANCHOR = (128, 244)
OUTLINE = np.array([24, 22, 30], dtype=np.uint8)


# ------------------------------------------------------------------------------------------- loading

def load_pair(anim_dir, i):
    beauty = np.asarray(Image.open(os.path.join(anim_dir, f"beauty_{i:04d}.png")).convert("RGBA"))
    ids = np.asarray(Image.open(os.path.join(anim_dir, f"id_{i:04d}.png")).convert("RGBA"))
    pid = np.rint(ids[..., 0].astype(np.float32) / 255.0 * 32.0).astype(np.int32)
    pid[ids[..., 3] < 128] = 0
    return beauty, pid


def downscale(beauty, pid, ss, min_cover):
    h = beauty.shape[0] // ss
    v = pid.reshape(h, ss, h, ss)
    counts = np.stack([(v == c).sum(axis=(1, 3)) for c in range(33)], axis=0)
    opaque_count = ss * ss - counts[0]
    counts[0] = -1
    ids = np.where(opaque_count >= min_cover, counts.argmax(axis=0), 0)

    rgb = beauty[..., :3].astype(np.int32)
    key = np.where(pid > 0, (rgb[..., 0] << 16) | (rgb[..., 1] << 8) | rgb[..., 2], -1)
    blocks_key = key.reshape(h, ss, h, ss).transpose(0, 2, 1, 3).reshape(h, h, ss * ss)
    blocks_pid = pid.reshape(h, ss, h, ss).transpose(0, 2, 1, 3).reshape(h, h, ss * ss)
    out = np.zeros((h, h, 4), dtype=np.uint8)
    ys, xs = np.nonzero(ids)
    for y, x in zip(ys, xs):
        vals, cnt = np.unique(blocks_key[y, x][blocks_pid[y, x] == ids[y, x]], return_counts=True)
        c = int(vals[cnt.argmax()])
        out[y, x] = ((c >> 16) & 255, (c >> 8) & 255, c & 255, 255)
    return out, ids


# ---------------------------------------------------------------------------------------------- heads

def quantize_rgba(img, colors):
    arr = np.asarray(img)
    alpha = arr[..., 3] > 127
    q = img.convert("RGB").quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    return np.dstack([np.asarray(q.convert("RGB")), np.where(alpha, 255, 0).astype(np.uint8)])


def quantize_regions(img, region, n_region, n_total, region_palette=None):
    """Quantize `region` (e.g. the hair) and the rest separately, so they never share palette entries. With
    `region_palette` the region snaps to those fixed colours instead."""
    arr = np.asarray(img).copy()
    alpha = arr[..., 3] > 127
    out = np.zeros_like(arr)
    for mask, n in ((region & alpha, n_region), (~region & alpha, max(2, n_total - n_region))):
        if not mask.any():
            continue
        if n == n_region and region_palette is not None:
            px = arr[mask][:, :3].astype(np.int32)
            d = ((px[:, None, :] - region_palette[None, :, :]) ** 2).sum(-1)
            out[mask, :3] = region_palette[d.argmin(1)].astype(np.uint8)
            continue
        part = arr.copy()
        part[~mask, :3] = np.median(arr[mask][:, :3], axis=0).astype(np.uint8)
        part[..., 3] = 255
        q = quantize_rgba(Image.fromarray(part), n)
        out[mask] = q[mask]
    out[..., 3] = np.where(alpha, 255, 0)
    return out


class HeadView:
    """One 2D head image, cut below the jaw and scaled to 1/`heads_tall` of the fighter's height."""

    def __init__(self, path, cfg, view_cfg):
        view_cfg = {**headmeta.sidecar(path), **view_cfg}
        src = np.asarray(Image.open(path).convert("RGBA")).copy()
        if view_cfg.get("flip"):
            src = src[:, ::-1].copy()
        m = headmeta.measure(src, view_cfg)
        self.metrics = m
        # Pixels below the cut go; the band just above it is the "neck zone" where the 3D body wins.
        rows = np.arange(src.shape[0])[:, None]
        src[rows[:, 0] > m["neck_cut"], :, 3] = 0
        blend = max(2, int(0.06 * (m["chin"] - m["crown"])))
        zone = ((rows >= m["neck_cut"] - blend) & (src[..., 3:4][..., 0] > 127)).astype(np.uint8) * 255
        hcfg = cfg.get("head") or {}
        hair = np.zeros(src.shape[:2], bool)
        if hcfg.get("grade"):
            src, hair = headgrade.grade(src, m, hcfg["grade"])
        self.src = Image.fromarray(src)
        self.zone = Image.fromarray(zone[..., 0] if zone.ndim == 3 else zone)
        self.hair = Image.fromarray(hair.astype(np.uint8) * 255)
        self.hair_colors = hcfg.get("grade", {}).get("colors", 6) if hair.any() else 0
        self.hair_palette = headgrade.ramp(hcfg["grade"]) if hair.any() else None
        target = cfg["height_px"] / hcfg.get("heads_tall", 7.2) * view_cfg.get("scale", hcfg.get("scale", 1.0))
        self.scale = target / max(1, m["chin"] - m["crown"])
        self.colors = hcfg.get("colors", 18)
        self.tilt_step = hcfg.get("tilt_step", 4)
        self.pivot = None  # in source pixels, set by calibrate()
        self.cache = {}

    def scaled_unrotated(self):
        w, h = max(1, round(self.src.width * self.scale)), max(1, round(self.src.height * self.scale))
        return self.src.resize((w, h), Image.LANCZOS)

    def calibrate(self, top3d, front3d, base, bias=(0, 0)):
        """Crown on the 3D crown, face front on the 3D face front, for an upright reference frame."""
        img = np.asarray(self.scaled_unrotated())
        alpha = img[..., 3] > 127
        chin = int(self.metrics["chin"] * self.scale)
        ys, xs = np.nonzero(alpha[:max(1, chin)])
        ox = front3d - xs.max() + bias[0]
        oy = top3d - ys.min() + bias[1]
        self.pivot = ((base[0] - ox) / self.scale, (base[1] - oy) / self.scale)

    def get(self, tilt):
        """(rgba, zone, pivot) at this tilt; the pivot is the head bone base in sprite pixels."""
        t = int(round(tilt / self.tilt_step) * self.tilt_step)
        if t not in self.cache:
            px, py = self.pivot
            w, h = self.src.size
            r = int(math.ceil(max(math.hypot(px - x, py - y) for x in (0, w) for y in (0, h)))) + 2
            canvas = Image.new("RGBA", (2 * r, 2 * r), (0, 0, 0, 0))
            zone = Image.new("L", (2 * r, 2 * r), 0)
            hair = Image.new("L", (2 * r, 2 * r), 0)
            off = (int(round(r - px)), int(round(r - py)))
            canvas.paste(self.src, off)
            zone.paste(self.zone, off)
            hair.paste(self.hair, off)
            if t:
                canvas = canvas.rotate(-t, resample=Image.BICUBIC, center=(r, r))
                zone = zone.rotate(-t, resample=Image.NEAREST, center=(r, r))
                hair = hair.rotate(-t, resample=Image.NEAREST, center=(r, r))
            size = max(1, round(2 * r * self.scale))
            mid = canvas.resize((size * 4, size * 4), Image.LANCZOS)
            small = mid.resize((size, size), Image.BOX)
            if self.hair_colors:
                hm = np.asarray(hair.resize((size, size), Image.BOX)) > 127
                rgba = quantize_regions(small, hm, self.hair_colors, self.colors, self.hair_palette)
            else:
                rgba = quantize_rgba(small, self.colors)
            z = np.asarray(zone.resize((size, size), Image.NEAREST)) > 0
            self.cache[t] = (rgba, z, (size / 2.0, size / 2.0))
        return self.cache[t]


def load_heads(cfg):
    return {view: HeadView(path, cfg, rows) for view, (path, rows) in headmeta.views_from_config(HEADS, cfg).items()}


class HeadSprite:
    """Unrotated game-size head from a config `head` block (`image` plus source rows), for heads/make_heads.py."""

    def __init__(self, cfg, height_px):
        head = cfg["head"]
        path = os.path.join(os.path.dirname(os.path.abspath(HEADS)), head["image"])
        self.view = HeadView(path, {"height_px": height_px, "head": head}, head)

    def get(self, tilt=0):
        return quantize_rgba(self.view.scaled_unrotated(), self.view.colors)


# Head view per animation when the animation itself asks for the default view. First match wins.
HEAD_RULES = [
    (("walk_back", "dash_fwd", "dash_back", "dash"), "profile"),
    (("hit_high", "hit_low", "hit", "knockdown", "ko", "dazed", "thrown"), "hurt"),
    (("special", "super", "victory", "intro", "finisher"), "shout"),
]


def head_for(name, requested, cfg):
    """An animation's explicit non-default view wins; then the config's `head.by_anim`; then HEAD_RULES."""
    by_anim = (cfg.get("head") or {}).get("by_anim", {})
    if name in by_anim:
        return by_anim[name]
    if requested and requested != "threequarter":
        return requested
    for prefixes, view in HEAD_RULES:
        if any(name == p or name.startswith(p + "_") or (p in ("special", "super") and name.startswith(p))
               for p in prefixes):
            return view
    return "threequarter"


def head_tilt(fr, rest):
    def ang(h):
        return math.degrees(math.atan2(h["tip"][0] - h["base"][0], h["base"][1] - h["tip"][1]))
    return ang(fr) - (ang(rest) if rest else 0.0)


def composite_head(img, ids, view, fr, rest):
    rgba, zone, pivot = view.get(head_tilt(fr["head"], rest))
    img = img.copy()
    hm = np.isin(ids, HEAD_PARTS)
    img[hm] = 0
    ids = np.where(hm, 0, ids)
    ox = int(round(fr["head"]["base"][0] - pivot[0]))
    oy = int(round(fr["head"]["base"][1] - pivot[1]))
    h, w = rgba.shape[:2]
    y0, x0, y1, x1 = max(0, oy), max(0, ox), min(CELL, oy + h), min(CELL, ox + w)
    if y1 <= y0 or x1 <= x0:
        return img, ids
    layer = np.zeros((CELL, CELL, 4), np.uint8)
    zl = np.zeros((CELL, CELL), bool)
    layer[y0:y1, x0:x1] = rgba[y0 - oy:y1 - oy, x0 - ox:x1 - ox]
    zl[y0:y1, x0:x1] = zone[y0 - oy:y1 - oy, x0 - ox:x1 - ox]
    lm = layer[..., 3] > 0
    body_in_zone = zl & np.isin(ids, NECK_PARTS + TORSO_PARTS)
    paste = lm & ~np.isin(ids, FRONT_PARTS) & ~body_in_zone
    img[paste] = layer[paste]
    ids = np.where(paste, 1, ids)
    return img, ids


# --------------------------------------------------------------------------------------------- lines

def neighbours(a, fill):
    up = np.vstack([np.full((1,) + a.shape[1:], fill, a.dtype), a[:-1]])
    down = np.vstack([a[1:], np.full((1,) + a.shape[1:], fill, a.dtype)])
    left = np.hstack([np.full((a.shape[0], 1) + a.shape[2:], fill, a.dtype), a[:, :-1]])
    right = np.hstack([a[:, 1:], np.full((a.shape[0], 1) + a.shape[2:], fill, a.dtype)])
    return up, down, left, right


RANK_LUT = np.array([PART_RANK.get(i, 0) for i in range(33)])


def inner_lines(img, ids, strength=0.55):
    rank = RANK_LUT[ids]
    out = img.copy()
    mask = np.zeros(ids.shape, bool)
    for n_ids, n_rank in zip(neighbours(ids, 0), neighbours(rank, 0)):
        mask |= (ids > 0) & (n_ids > 0) & (n_rank >= rank + 2) & (n_ids != ids)
    out[mask, :3] = (out[mask, :3].astype(np.float32) * strength).astype(np.uint8)
    return out


def outer_outline(img):
    a = img[..., 3] > 0
    grow = np.zeros_like(a)
    for n in neighbours(a, False):
        grow |= n
    edge = grow & ~a
    out = img.copy()
    out[edge, :3] = OUTLINE
    out[edge, 3] = 255
    return out


def snap_palette(frames, max_colors, reserved=None):
    """One shared palette of at most `max_colors` colours (median cut over all opaque pixels, no dither).
    `reserved` colours (e.g. a graded hair ramp) are always kept as they are."""
    reserved = np.zeros((0, 3), np.int32) if reserved is None else np.asarray(reserved, np.int32)
    max_colors -= len(reserved)
    stack = np.concatenate([f.reshape(-1, 4) for f in frames])
    opaque = stack[stack[:, 3] > 0][:, :3]
    side = int(math.ceil(math.sqrt(len(opaque))))
    mosaic = np.zeros((side * side, 3), np.uint8)
    mosaic[:len(opaque)] = opaque
    mosaic[len(opaque):] = opaque[0]
    q = Image.fromarray(mosaic.reshape(side, side, 3)).quantize(
        colors=max_colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    palette = np.array(q.getpalette()[:max_colors * 3], np.int32).reshape(-1, 3)[np.unique(np.asarray(q))]
    palette = np.concatenate([palette, reserved]) if len(reserved) else palette
    out = []
    for f in frames:
        g = f.copy()
        m = g[..., 3] > 0
        px = g[m][:, :3].astype(np.int32)
        d = ((px[:, None, :] - palette[None, :, :]) ** 2).sum(-1)
        g[m, :3] = palette[d.argmin(1)].astype(np.uint8)
        out.append(g)
    return out, palette


# --------------------------------------------------------------------------------------- measurement

def measure_stride(meta, contact_px=0.6):
    """strideSpeed in px/s from the planted foot's travel between consecutive frames (heel or ball, whichever
    is on the floor in both frames, so the heel-to-toe roll is not mistaken for travel)."""
    frames = meta["frames"]
    n = len(frames)
    samples = []
    for i in range(n):
        a, b = frames[i], frames[(i + 1) % n]
        for s in "lr":
            for k, key in ((0, "heel_z"), (1, "ball_z")):
                if a[s][key] < contact_px and b[s][key] < contact_px:
                    samples.append(b[s]["world_x"][k] - a[s]["world_x"][k])
    if not samples:
        return None, []
    return abs(float(np.median(samples))) * meta["fps"], samples


def footsteps(contacts):
    """Frames where a foot lands (contact goes false -> true, cyclically) as atlas events."""
    n = len(contacts)
    events = []
    for i in range(n):
        for s in "lr":
            if contacts[i].get(s) and not contacts[i - 1].get(s):
                events.append({"frame": i, "type": "footstep", "foot": s})
    return sorted(events, key=lambda e: e["frame"])


# ----------------------------------------------------------------------------------------- per frame

def process_frames(anim_dir, ss, min_cover):
    meta = json.load(open(os.path.join(anim_dir, "meta.json")))
    return [downscale(*load_pair(anim_dir, i), ss, min_cover) for i in range(len(meta["frames"]))], meta


def calibrate_heads(heads, raw, meta, cfg):
    img0, ids0 = raw[0]
    ys, xs = np.nonzero(np.isin(ids0, HEAD_PARTS))
    if len(ys) == 0:
        return False
    hcfg = cfg.get("head") or {}
    for name, view in heads.items():
        vcfg = hcfg.get("views", {}).get(name, {})
        bias = (vcfg.get("front_bias", hcfg.get("front_bias", 0)), vcfg.get("top_bias", hcfg.get("top_bias", 0)))
        view.calibrate(ys.min(), xs.max(), meta["frames"][0]["head"]["base"], bias)
    return True


def finish(raw, meta, heads, view_name):
    view = heads.get(headmeta.resolve_view(heads, view_name)) if heads else None
    out = []
    for i, (img, ids) in enumerate(raw):
        if view is not None:
            img, ids = composite_head(img, ids, view, meta["frames"][i], meta.get("head_rest"))
        out.append(outer_outline(inner_lines(img, ids)))
    return out


# ------------------------------------------------------------------------------------------- outputs

def background(w, h, scale=1, tick_offset=0.0):
    bg = Image.new("RGBA", (w, h), (43, 47, 58, 255))
    d = ImageDraw.Draw(bg)
    gy = ANCHOR[1] * scale
    d.rectangle([0, gy, w, h], fill=(33, 36, 45, 255))
    d.line([0, gy, w, gy], fill=(96, 102, 120, 255), width=scale)
    spacing = 32 * scale
    x = -((tick_offset * scale) % spacing)
    while x < w:
        d.line([x, gy, x, gy + 5 * scale], fill=(150, 156, 175, 255), width=scale)
        x += spacing
    return bg


def save_combined_gif(frames, fps, speed, path, label):
    """1x and 3x side by side; ground ticks scroll at strideSpeed so planted feet must hold still on them."""
    font = ImageFont.load_default(size=16)
    w, h = CELL + CELL * 3 + 24, CELL * 3 + 30
    ims, travel = [], 0.0
    for f in frames:
        canvas = Image.new("RGBA", (w, h), (30, 33, 41, 255))
        one = background(CELL, CELL, 1, travel)
        one.alpha_composite(Image.fromarray(f))
        canvas.alpha_composite(one, (8, h - CELL - 8))
        three = background(CELL * 3, CELL * 3, 3, travel)
        three.alpha_composite(Image.fromarray(f).resize((CELL * 3, CELL * 3), Image.NEAREST))
        canvas.alpha_composite(three, (CELL + 16, 22))
        ImageDraw.Draw(canvas).text((8, 3), label, fill=(232, 234, 242, 255), font=font)
        ims.append(canvas.convert("RGB").quantize(colors=255, method=Image.Quantize.MEDIANCUT,
                                                  dither=Image.Dither.NONE))
        travel += (speed or 0.0) / fps
    ms = int(round(1000 / fps / 10.0)) * 10
    ims[0].save(path, save_all=True, append_images=ims[1:], duration=ms, loop=0, disposal=2)


def contact_sheet(entries, path, title, crop=(208, 244)):
    """Every atlas animation as a labelled row of 1x frames."""
    font = ImageFont.load_default(size=15)
    small = ImageFont.load_default(size=12)
    cw, ch = crop
    label_w = 150
    cols = max(len(e["frames"]) for e in entries)
    sheet = Image.new("RGBA", (label_w + cols * cw, 34 + len(entries) * ch), (30, 33, 41, 255))
    d = ImageDraw.Draw(sheet)
    d.text((8, 8), title, fill=(240, 242, 248, 255), font=font)
    x0, y0 = (CELL - cw) // 2, CELL - ch + 4
    for r, e in enumerate(entries):
        y = 34 + r * ch
        sheet.alpha_composite(background(cols * cw, CELL).crop((0, y0, cols * cw, y0 + ch)), (label_w, y))
        for i, f in enumerate(e["frames"]):
            sheet.alpha_composite(Image.fromarray(f).crop((x0, y0, x0 + cw, y0 + ch)), (label_w + i * cw, y))
        d.text((8, y + 8), e["name"], fill=(240, 242, 248, 255), font=font)
        info = f"{len(e['frames'])}f @ {e['fps']:g} fps" + ("" if e["loop"] else ", once")
        d.text((8, y + 28), info, fill=(170, 176, 190, 255), font=small)
        if e.get("strideSpeed"):
            d.text((8, y + 44), f"stride {e['strideSpeed']:.0f} px/s", fill=(170, 176, 190, 255), font=small)
        if e.get("source", "shared") != "shared":
            d.text((8, y + 60), e["source"], fill=(150, 200, 170, 255), font=small)
        d.line([0, y + ch - 1, sheet.width, y + ch - 1], fill=(60, 64, 78, 255))
    sheet.convert("RGB").save(path, optimize=True)


def trim(frame):
    """(crop, left, top) of a 256 px cell cut to its opaque pixels."""
    ys, xs = np.nonzero(frame[..., 3])
    if len(ys) == 0:
        return frame[:1, :1], 0, 0
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    return frame[y0:y1, x0:x1], int(x0), int(y0)


def shelf_pack(sizes, width, gap):
    """Shelf packing of (w, h) boxes, tallest first. Returns ({index: (x, y)}, height) or None if a box is
    wider than the sheet."""
    order = sorted(range(len(sizes)), key=lambda i: (-sizes[i][1], -sizes[i][0]))
    pos, x, y, shelf = {}, 0, 0, 0
    for i in order:
        w, h = sizes[i]
        if w > width:
            return None
        if x + w > width:
            x, y, shelf = 0, y + shelf + gap, 0
        pos[i] = (x, y)
        x += w + gap
        shelf = max(shelf, h)
    return pos, y + shelf


def build_atlas(fighter_id, entries, out_dir, max_side=4096, gap=1):
    """Pack trimmed, de-duplicated frames into the smallest sheet (sides at most `max_side`).

    Frame rects keep the contract format ({x, y, w, h}); each also carries `anchor`, the feet anchor inside
    its rect (the engine draws `frame.anchor || atlas.anchor`). Writes atlas.png and a lossless atlas.webp."""
    uniq, keys, refs = [], {}, []
    for e in entries:
        row = []
        for f in e["frames"]:
            crop, x0, y0 = trim(f)
            key = (x0, y0, crop.shape, crop.tobytes())
            if key not in keys:
                keys[key] = len(uniq)
                uniq.append((crop, x0, y0))
            row.append(keys[key])
        refs.append(row)
    sizes = [(c.shape[1], c.shape[0]) for c, _, _ in uniq]
    best = None
    for width in range(512, max_side + 1, 128):
        packed = shelf_pack(sizes, width, gap)
        if not packed:
            continue
        pos, height = packed
        height = (height + 3) // 4 * 4
        if height > max_side:
            continue
        area = width * height
        if best is None or area < best[0] or (area == best[0] and abs(width - height) < abs(best[1] - best[2])):
            best = (area, width, height, pos)
    _, W, H, pos = best
    atlas = np.zeros((H, W, 4), dtype=np.uint8)
    rects = []
    for i, (crop, x0, y0) in enumerate(uniq):
        x, y = pos[i]
        atlas[y:y + crop.shape[0], x:x + crop.shape[1]] = crop
        rects.append({"x": x, "y": y, "w": int(crop.shape[1]), "h": int(crop.shape[0]),
                      "anchor": {"x": ANCHOR[0] - x0, "y": ANCHOR[1] - y0}})
    anims = {}
    for e, row in zip(entries, refs):
        entry = {"fps": e["fps"], "loop": e["loop"], "frames": [dict(rects[k]) for k in row]}
        if e.get("strideSpeed"):
            entry["strideSpeed"] = round(e["strideSpeed"], 1)
        if e.get("events"):
            entry["events"] = e["events"]
        anims[e["name"]] = entry
    img = Image.fromarray(atlas)
    img.save(os.path.join(out_dir, "atlas.png"), optimize=True)
    img.save(os.path.join(out_dir, "atlas.webp"), lossless=True, quality=100, method=6)
    data = {"id": fighter_id, "cell": {"w": CELL, "h": CELL}, "anchor": {"x": ANCHOR[0], "y": ANCHOR[1]},
            "image": "atlas.png", "images": {"png": "atlas.png", "webp": "atlas.webp"},
            "size": {"w": W, "h": H, "decodedBytes": W * H * 4},
            "source": "tools/sprites3d (MPFB/MakeHuman body, Blender toon render, 2D likeness head)",
            "animations": anims}
    with open(os.path.join(out_dir, "atlas.json"), "w") as fh:
        json.dump(data, fh, separators=(",", ":"))
    return data


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", required=True)
    ap.add_argument("--build", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--preview-dir")
    ap.add_argument("--sheet", help="also write the contact sheet here")
    ap.add_argument("--gifs", default="walk_fwd,run", help="animations to preview as 1x+3x GIFs")
    ap.add_argument("--min-cover", type=int, default=7)
    args = ap.parse_args()
    cfg = json.load(open(args.config))
    build = json.load(open(os.path.join(args.build, "build.json")))
    ss = build["supersample"]
    heads = load_heads(cfg)
    if not heads:
        print(f"[sprites3d] no likeness head for {cfg['id']}: keeping the 3D head (see README, 'Likeness heads')")
    os.makedirs(args.out, exist_ok=True)
    preview = args.preview_dir or os.path.join(args.out, "preview")
    os.makedirs(preview, exist_ok=True)

    records = build["anims"]
    rendered = {r["name"]: process_frames(os.path.join(args.build, r["name"]), ss, args.min_cover) for r in records}
    if heads:
        ref = "idle" if "idle" in rendered else records[0]["name"]
        if not calibrate_heads(heads, *rendered[ref], cfg):
            heads = {}

    entries, report = [], {"heads": {v: {k: h.metrics[k] for k in ("crown", "chin", "neck_cut")}
                                     for v, h in heads.items()}, "skin": build.get("skin")}
    for r in records:
        raw, meta = rendered[r["name"]]
        frames = finish(raw, meta, heads, head_for(r["name"], r.get("head"), cfg))
        contacts = [f["contact"] for f in meta["frames"]]
        speed, samples = measure_stride(meta) if r.get("locomotion") else (None, [])
        events = list(r.get("events") or [])
        if r.get("locomotion"):
            events += footsteps(contacts)
        entries.append({"name": r["name"], "frames": frames, "fps": r["fps"], "loop": r["loop"], "events": events,
                        "strideSpeed": speed, "source": r.get("source", "shared")})
        if speed is not None:
            arr = np.array(samples)
            report[r["name"]] = {"strideSpeed": round(speed, 1), "fps": r["fps"], "frames": len(frames),
                                 "cycle_px": round(len(frames) * speed / r["fps"], 1),
                                 "slip_px_max": round(float(np.abs(arr - np.median(arr)).max()), 3)}
        for d in r.get("derived") or []:
            view = head_for(d["name"], d.get("head"), cfg)
            base = frames if view == head_for(r["name"], r.get("head"), cfg) else finish(raw, meta, heads, view)
            seq = base[::-1] if d.get("reverse") else base
            dc = contacts[::-1] if d.get("reverse") else contacts
            scale = d.get("speed", 1.0)
            entries.append({"name": d["name"], "frames": seq, "fps": round(r["fps"] * scale, 2), "loop": r["loop"],
                            "events": footsteps(dc) if r.get("locomotion") else [],
                            "strideSpeed": speed * scale if speed else None, "source": r.get("source", "shared")})

    reserved = [v.hair_palette for v in heads.values() if getattr(v, "hair_palette", None) is not None]
    reserved = np.unique(np.concatenate(reserved), axis=0) if reserved else None
    snapped, palette = snap_palette([f for e in entries for f in e["frames"]], cfg.get("palette_colors", 64), reserved)
    k = 0
    for e in entries:
        n = len(e["frames"])
        e["frames"] = snapped[k:k + n]
        k += n

    data = build_atlas(cfg["id"], entries, args.out)
    for e in entries:
        if e["name"] in args.gifs.split(","):
            save_combined_gif(e["frames"], e["fps"], e.get("strideSpeed"),
                              os.path.join(preview, f"{cfg['id']}-{e['name']}-1x-3x.gif"),
                              f"{cfg['name']} {e['name']}: 1x and 3x, {len(e['frames'])}f @ {e['fps']:g} fps"
                              + (f", strideSpeed {e['strideSpeed']:.0f} px/s" if e.get("strideSpeed") else ""))
    head_note = ", ".join(sorted(heads)) if heads else "3D head (no likeness head yet)"
    title = (f"{cfg['name']} ({cfg['id']}): shared states, 1 atlas px = 1 world px, feet anchor at y 244. "
             f"Head views: {head_note}")
    sheet = args.sheet or os.path.join(preview, f"shared-{cfg['id']}.png")
    contact_sheet(entries, sheet, title)
    report["palette_size"] = int(len(palette))
    report["atlas"] = {"w": data["size"]["w"], "h": data["size"]["h"], "decoded_mb": round(data["size"]["decodedBytes"] / 2**20, 2),
                       "frames": sum(len(a["frames"]) for a in data["animations"].values()),
                       "unique_frames": len({(f["x"], f["y"]) for a in data["animations"].values() for f in a["frames"]}),
                       "png_kb": round(os.path.getsize(os.path.join(args.out, "atlas.png")) / 1024),
                       "webp_kb": round(os.path.getsize(os.path.join(args.out, "atlas.webp")) / 1024)}
    report["animations"] = {n: len(a["frames"]) for n, a in data["animations"].items()}
    with open(os.path.join(preview, "report.json"), "w") as fh:
        json.dump(report, fh, indent=1)
    print(json.dumps({k: v for k, v in report.items() if k != "animations"}, indent=1))
    print("atlas:", json.dumps(report["atlas"]))
    print("animations:", ", ".join(f"{k} ({len(v['frames'])}f)" for k, v in data["animations"].items()))


if __name__ == "__main__":
    main()
