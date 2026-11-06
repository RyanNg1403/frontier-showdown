#!/usr/bin/env python3
"""2D stage of the 3D-to-pixel pipeline: supersampled toon renders -> 256 px game cells.

    python3 tools/sprites3d/post/process.py --config tools/sprites3d/fighters/sam.json \
        --build build/sprites3d/sam --out assets/fighters/sam/3d [--preview-dir DIR]

Per frame:
  1. Mode downscale (supersample -> 1x): every output pixel takes the most common part id and, inside that
     part, the most common toon colour of its block. No blending, so the palette stays the material bands.
  2. Likeness head: the 3D head and hair are erased and the fighter's 2D head sprite is pasted at the head
     bone (calibrated once per animation against the 3D head, so it moves with the bob but never jitters).
  3. Inner lines where a nearer limb overlaps a farther part, a 1 px outer outline, palette snap.
Then: atlas.png + atlas.json (with `strideSpeed` measured from the planted foot), GIFs and a contact sheet.

Requires: numpy, pillow.
"""

import argparse
import json
import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))

# Mirrors outfit.PART_IDS (id: depth rank). Kept here so this script runs without Blender.
PART_RANK = {1: 5, 2: 5, 3: 4, 4: 4, 5: 8, 6: 1, 7: 8, 8: 1, 9: 3, 10: 6, 11: 2, 12: 6, 13: 2, 14: 4, 15: 8, 16: 1}
HEAD_PARTS = (1, 2)
TORSO_PARTS = (4, 14)
CELL = 256
ANCHOR = (128, 244)
OUTLINE = np.array([24, 22, 30], dtype=np.uint8)

ANIM_SLOTS = {  # build animation -> atlas animations (name, reverse, speed scale, loop)
    "walk": [("walk_fwd", False, 1.0, True), ("walk_back", True, 0.8, True)],
    "run": [("run", False, 1.0, True)],
    "idle": [("idle", False, 1.0, True)],
    "stance": [("stance", False, 1.0, True)],
    "dash": [("dash_fwd", False, 1.0, False)],
}


# ------------------------------------------------------------------------------------------- loading

def load_pair(anim_dir, i):
    beauty = np.asarray(Image.open(os.path.join(anim_dir, f"beauty_{i:04d}.png")).convert("RGBA"))
    ids = np.asarray(Image.open(os.path.join(anim_dir, f"id_{i:04d}.png")).convert("RGBA"))
    pid = np.rint(ids[..., 0].astype(np.float32) / 255.0 * 32.0).astype(np.int32)
    pid[ids[..., 3] < 128] = 0
    return beauty, pid


def block_mode(values, ss, k):
    """Most common value (0..k-1) of every ss x ss block."""
    h, w = values.shape
    v = values.reshape(h // ss, ss, w // ss, ss)
    counts = np.stack([(v == c).sum(axis=(1, 3)) for c in range(k)], axis=0)
    return counts.argmax(axis=0), counts


def downscale(beauty, pid, ss, min_cover):
    h = beauty.shape[0] // ss
    ids, counts = block_mode(pid, ss, 33)
    opaque_count = ss * ss - counts[0]
    # A block is opaque when enough of it is covered; it then takes its most common non-empty part.
    counts[0] = -1
    best_part = counts.argmax(axis=0)
    ids = np.where(opaque_count >= min_cover, best_part, 0)

    rgb = beauty[..., :3].astype(np.int32)
    key = (rgb[..., 0] << 16) | (rgb[..., 1] << 8) | rgb[..., 2]
    key = np.where(pid > 0, key, -1)
    out = np.zeros((h, h, 4), dtype=np.uint8)
    blocks_key = key.reshape(h, ss, h, ss).transpose(0, 2, 1, 3).reshape(h, h, ss * ss)
    blocks_pid = pid.reshape(h, ss, h, ss).transpose(0, 2, 1, 3).reshape(h, h, ss * ss)
    ys, xs = np.nonzero(ids)
    for y, x in zip(ys, xs):
        cand = blocks_key[y, x][blocks_pid[y, x] == ids[y, x]]
        vals, cnt = np.unique(cand, return_counts=True)
        c = int(vals[cnt.argmax()])
        out[y, x] = ((c >> 16) & 255, (c >> 8) & 255, c & 255, 255)
    return out, ids


# ---------------------------------------------------------------------------------------------- head

def key_background(rgb, tol=110):
    corners = np.concatenate([rgb[:8, :8].reshape(-1, 3), rgb[:8, -8:].reshape(-1, 3),
                              rgb[-8:, :8].reshape(-1, 3), rgb[-8:, -8:].reshape(-1, 3)])
    bg = np.median(corners, axis=0)
    dist = np.abs(rgb.astype(np.int32) - bg).sum(axis=-1)
    return dist > tol


def quantize_rgba(img, colors):
    alpha = np.asarray(img)[..., 3] > 127
    rgb = img.convert("RGB")
    q = rgb.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
    arr = np.dstack([np.asarray(q), np.where(alpha, 255, 0).astype(np.uint8)])
    return arr


class HeadSprite:
    """The fighter's 2D likeness head, prepared once at the target pixel size (one variant per tilt step)."""

    def __init__(self, cfg, height_px):
        hcfg = cfg["head"]
        path = os.path.join(ROOT, "tools", "sprites3d", hcfg["image"])
        src = Image.open(path).convert("RGBA")
        arr = np.asarray(src).copy()
        if hcfg.get("key_background", False):
            arr[..., 3] = np.where(key_background(arr[..., :3]), 255, 0)
        crown, chin, cut = hcfg["crown"], hcfg["chin"], hcfg["neck_cut"]
        arr[int(cut * src.height / hcfg["source_height"]):, :, 3] = 0
        self.src = Image.fromarray(arr)
        scale_src = src.height / hcfg["source_height"]
        heads_tall = hcfg.get("heads_tall", 7.5)
        target = height_px / heads_tall * hcfg.get("scale", 1.0)
        self.scale = target / ((chin - crown) * scale_src)
        self.colors = hcfg.get("colors", 18)
        self.tilt_step = hcfg.get("tilt_step", 4)
        self.cache = {}

    def get(self, tilt_deg):
        t = int(round(tilt_deg / self.tilt_step) * self.tilt_step)
        if t not in self.cache:
            img = self.src.rotate(-t, resample=Image.BICUBIC, expand=False) if t else self.src
            w = max(1, round(img.width * self.scale))
            h = max(1, round(img.height * self.scale))
            # Two-step reduction keeps edges crisper than one big Lanczos jump.
            mid = img.resize((w * 4, h * 4), Image.LANCZOS)
            small = mid.resize((w, h), Image.BOX)
            arr = quantize_rgba(small, self.colors)
            self.cache[t] = arr
        return self.cache[t]


def head_metrics(arr):
    ys, xs = np.nonzero(arr[..., 3])
    return ys.min(), xs.max(), (xs.min() + xs.max()) / 2


# --------------------------------------------------------------------------------------------- lines

def neighbours(a, fill):
    up = np.vstack([np.full((1,) + a.shape[1:], fill, a.dtype), a[:-1]])
    down = np.vstack([a[1:], np.full((1,) + a.shape[1:], fill, a.dtype)])
    left = np.hstack([np.full((a.shape[0], 1) + a.shape[2:], fill, a.dtype), a[:, :-1]])
    right = np.hstack([a[:, 1:], np.full((a.shape[0], 1) + a.shape[2:], fill, a.dtype)])
    return up, down, left, right


def inner_lines(img, ids, strength=0.55):
    rank = np.vectorize(lambda v: PART_RANK.get(int(v), 0))(ids)
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


def snap_palette(frames, max_colors):
    """Reduce every frame to one shared palette of at most `max_colors` colours (median cut over all
    opaque pixels of all frames, no dithering)."""
    stack = np.concatenate([f.reshape(-1, 4) for f in frames])
    opaque = stack[stack[:, 3] > 0][:, :3]
    side = int(math.ceil(math.sqrt(len(opaque))))
    mosaic = np.zeros((side * side, 3), np.uint8)
    mosaic[:len(opaque)] = opaque
    mosaic[len(opaque):] = opaque[0]
    q = Image.fromarray(mosaic.reshape(side, side, 3)).quantize(
        colors=max_colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    palette = np.array(q.getpalette()[:max_colors * 3], np.int32).reshape(-1, 3)
    used = np.unique(np.asarray(q))
    palette = palette[used]
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
    """strideSpeed in px/s from the planted foot's travel between consecutive frames.

    Uses whichever landmark (heel or ball) is on the floor in both frames, so the heel-to-toe roll is not
    mistaken for travel. Returns (speed, per-frame travel samples)."""
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
    travel = float(np.median(samples))
    return abs(travel) * meta["fps"], samples


# ----------------------------------------------------------------------------------------- per frame

def process_animation(anim_dir, head, ss, min_cover):
    meta = json.load(open(os.path.join(anim_dir, "meta.json")))
    n = len(meta["frames"])
    raw = [downscale(*load_pair(anim_dir, i), ss, min_cover) for i in range(n)]

    rest = meta.get("head_rest")
    base_angle = 0.0
    if rest:
        base_angle = math.degrees(math.atan2(rest["tip"][0] - rest["base"][0], rest["base"][1] - rest["tip"][1]))

    if head is None:
        return [outer_outline(inner_lines(img, ids)) for img, ids in raw], meta

    # Calibrate the paste offset on the first frame: 2D crown on the 3D crown, 2D face front on the 3D one.
    img0, ids0 = raw[0]
    head_mask = np.isin(ids0, HEAD_PARTS)
    ys, xs = np.nonzero(head_mask)
    top3d, front3d = ys.min(), xs.max()
    base0 = meta["frames"][0]["head"]["base"]
    spr0 = head.get(0)
    top2d, front2d, _ = head_metrics(spr0)
    offset = (front3d - front2d - base0[0] + head.front_bias, top3d - top2d - base0[1] + head.top_bias)

    out = []
    for i, (img, ids) in enumerate(raw):
        fr = meta["frames"][i]["head"]
        tilt = math.degrees(math.atan2(fr["tip"][0] - fr["base"][0], fr["base"][1] - fr["tip"][1])) - base_angle
        spr = head.get(tilt)
        img = img.copy()
        hm = np.isin(ids, HEAD_PARTS)
        img[hm] = 0
        ids = np.where(hm, 0, ids)
        ox = int(round(fr["base"][0] + offset[0]))
        oy = int(round(fr["base"][1] + offset[1]))
        layer = np.zeros_like(img)
        h, w = spr.shape[:2]
        y0, x0 = max(0, oy), max(0, ox)
        y1, x1 = min(CELL, oy + h), min(CELL, ox + w)
        layer[y0:y1, x0:x1] = spr[y0 - oy:y1 - oy, x0 - ox:x1 - ox]
        lm = layer[..., 3] > 0
        # The body stays in front of the 2D head where it should: near limbs always, and the sweater collar
        # below the head bone so the neckline overlaps the 2D neck.
        neck_y = int(round(fr["base"][1])) + head.collar_drop
        rows = np.arange(CELL)[:, None]
        front = np.isin(ids, [k for k, r in PART_RANK.items() if r > 5]) | (np.isin(ids, TORSO_PARTS) & (rows >= neck_y))
        paste = lm & ~front
        img[paste] = layer[paste]
        ids = np.where(paste, 1, ids)
        img = inner_lines(img, ids)
        out.append(outer_outline(img))
    return out, meta


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


def save_gif(frames, fps, speed, path, scale):
    ims = []
    travel = 0.0
    for f in frames:
        im = Image.fromarray(f)
        if scale != 1:
            im = im.resize((CELL * scale, CELL * scale), Image.NEAREST)
        bg = background(CELL * scale, CELL * scale, scale, travel)
        bg.alpha_composite(im)
        ims.append(bg.convert("RGB").quantize(colors=255, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE))
        travel += (speed or 0.0) / fps
    ms = int(round(1000 / fps / 10.0)) * 10
    ims[0].save(path, save_all=True, append_images=ims[1:], duration=ms, loop=0, optimize=False, disposal=2)


def save_combined_gif(frames, fps, speed, path, label):
    """1x and 3x side by side in one GIF; ground ticks scroll at strideSpeed so planted feet must hold still
    against them."""
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


def build_atlas(fighter_id, results, out_dir):
    rows, anims = [], {}
    for name, (frames, fps, speed, loop) in results.items():
        y = len(rows) * CELL
        rows.append(frames)
        entry = {"fps": fps, "loop": loop,
                 "frames": [{"x": i * CELL, "y": y, "w": CELL, "h": CELL} for i in range(len(frames))]}
        if speed is not None:
            entry["strideSpeed"] = round(speed, 1)
        anims[name] = entry
    cols = max(len(r) for r in rows)
    atlas = np.zeros((len(rows) * CELL, cols * CELL, 4), dtype=np.uint8)
    for r, frames in enumerate(rows):
        for c, f in enumerate(frames):
            atlas[r * CELL:(r + 1) * CELL, c * CELL:(c + 1) * CELL] = f
    Image.fromarray(atlas).save(os.path.join(out_dir, "atlas.png"), optimize=True)
    data = {"id": fighter_id, "cell": {"w": CELL, "h": CELL}, "anchor": {"x": ANCHOR[0], "y": ANCHOR[1]},
            "source": "tools/sprites3d (MPFB/MakeHuman body, Blender toon render, 2D likeness head)",
            "animations": anims}
    with open(os.path.join(out_dir, "atlas.json"), "w") as fh:
        json.dump(data, fh, indent=1)
    return data


def contact_sheet(frames, path, scale=1, label=None):
    n = len(frames)
    sheet = background(CELL * n * scale, CELL * scale, scale)
    for i, f in enumerate(frames):
        im = Image.fromarray(f)
        if scale != 1:
            im = im.resize((CELL * scale, CELL * scale), Image.NEAREST)
        sheet.alpha_composite(im, (i * CELL * scale, 0))
    if label:
        ImageDraw.Draw(sheet).text((6, 6), label, fill=(230, 232, 240, 255))
    sheet.save(path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", required=True)
    ap.add_argument("--build", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--preview-dir")
    ap.add_argument("--min-cover", type=int, default=7)
    args = ap.parse_args()
    cfg = json.load(open(args.config))
    build = json.load(open(os.path.join(args.build, "build.json")))
    ss = build["supersample"]
    head = None
    hcfg = cfg.get("head") or {}
    if hcfg.get("image") and os.path.exists(os.path.join(ROOT, "tools", "sprites3d", hcfg["image"])):
        head = HeadSprite(cfg, cfg["height_px"])
        head.front_bias = hcfg.get("front_bias", 0)
        head.top_bias = hcfg.get("top_bias", 0)
        head.collar_drop = hcfg.get("collar_drop", 2)
    else:
        print(f"[sprites3d] no likeness head for {cfg['id']}: keeping the 3D head (see README, 'Likeness heads')")
    os.makedirs(args.out, exist_ok=True)
    preview = args.preview_dir or os.path.join(args.out, "preview")
    os.makedirs(preview, exist_ok=True)

    processed = {}
    for anim in build["anims"]:
        frames, meta = process_animation(os.path.join(args.build, anim), head, ss, args.min_cover)
        speed, samples = measure_stride(meta) if anim in ("walk", "run") else (None, [])
        processed[anim] = (frames, meta, speed, samples)

    all_frames = [f for v in processed.values() for f in v[0]]
    snapped, palette = snap_palette(all_frames, cfg.get("palette_colors", 64))
    k = 0
    results, report = {}, {}
    for anim, (frames, meta, speed, samples) in processed.items():
        frames = snapped[k:k + len(frames)]
        k += len(frames)
        fps = meta["fps"]
        for slot, reverse, scale, loop in ANIM_SLOTS[anim]:
            seq = frames[::-1] if reverse else frames
            slot_fps = round(fps * scale, 2)
            slot_speed = speed * scale if speed is not None else None
            results[slot] = (seq, slot_fps, slot_speed, loop)
        if speed is not None:
            arr = np.array(samples)
            report[anim] = {"strideSpeed": round(speed, 1), "fps": fps, "frames": len(frames),
                            "cycle_px": round(len(frames) * speed / fps, 1),
                            "planted_travel_px_per_frame": round(float(np.median(arr)), 3),
                            "slip_px_max": round(float(np.abs(arr - np.median(arr)).max()), 3),
                            "samples": len(samples)}
        save_gif(frames, fps, speed, os.path.join(preview, f"{cfg['id']}-{anim}-1x.gif"), 1)
        save_combined_gif(frames, fps, speed, os.path.join(preview, f"{cfg['id']}-{anim}-1x-3x.gif"),
                          f"{cfg['name']} {anim}: 1x and 3x, {len(frames)}f @ {fps} fps"
                          + (f", strideSpeed {speed:.0f} px/s" if speed else ""))
        contact_sheet(frames, os.path.join(preview, f"{cfg['id']}-{anim}-sheet.png"))

    data = build_atlas(cfg["id"], results, args.out)
    report["palette_size"] = int(len(palette))
    with open(os.path.join(preview, "report.json"), "w") as fh:
        json.dump(report, fh, indent=1)
    print(json.dumps(report, indent=1))
    print("animations:", ", ".join(f"{k} ({len(v['frames'])}f @ {v['fps']})" for k, v in data["animations"].items()))


if __name__ == "__main__":
    main()
