#!/usr/bin/env python3
"""Build parallax stage layers from the generated source art in ../_source.

Every output PNG is stored at the native pixel grid (2x smaller than the
1280x720 logical canvas) and drawn at 2x with smoothing off.

    python3 assets/stages/_pipeline/build_stages.py [stage-id ...]

Writes assets/stages/<id>/{far,mid,near,floor,fg}.png, *-glow.png emissive
masks, and src/stages/layers.generated.js (geometry, glow tiles, swatches).
Requires Pillow and numpy.
"""
import json
import random
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[3]
SRC = ROOT / "assets/stages/_source"
OUT = ROOT / "assets/stages"
GEN_JS = ROOT / "src/stages/layers.generated.js"

PX = 2                      # logical pixels per native pixel
VIEW_W, VIEW_H = 1280, 720
WORLD_W = 1920
FLOOR_TOP = 536             # logical y of the floor's far edge
GROUND_Y = 640              # logical y of the fighters' feet
SCROLL = WORLD_W - VIEW_W

PARALLAX = {"far": 0.15, "mid": 0.45, "near": 0.75, "fg": 1.3}
FLOOR_PARALLAX = (0.7, 1.0)  # at FLOOR_TOP and at GROUND_Y; extrapolated below
GLOW_TILE = 32

# Per-stage tuning: prop heights are native px for the tallest prop in a sheet.
STAGES = {
    "grand-palais-ai-action-summit": dict(mid=dict(h=150, gap=96), near=dict(h=62, strip=True), floor_crop=(0.28, 1.0), fg=0),
    "bharat-mandapam-ai-impact-summit": dict(mid=dict(h=140, gap=90), near=dict(h=60, strip=True), floor_crop=(0.25, 1.0), fg=1),
    "musk-v-openai-oakland": dict(mid=dict(h=150, gap=118), near=dict(h=58, strip=True), floor_crop=(0.22, 1.0), fg=0),
    "openai-mission-bay": dict(mid=dict(h=150, gap=86), near=dict(h=44, gap=54), floor_crop=(0.07, 0.62), floor_cols=(0.3, 0.7), fg=0),
    "anthropic-500-howard": dict(mid=dict(h=150, gap=80), near=dict(h=52, gap=50), floor_crop=(0.38, 1.0), fg=1),
    "deepmind-kings-cross": dict(mid=dict(h=140, gap=112), near=dict(h=48, gap=50), floor_crop=(0.25, 1.0), fg=0),
    "meta-hacker-square": dict(mid=dict(h=150, gap=96), near=dict(h=40, gap=52), floor_crop=(0.25, 1.0), fg=1,
                               floor_decal=dict(text="HACK", x=960, width=310, rows=(14, 84), color=(176, 174, 168), edge=(98, 100, 104), alpha=165)),
    "nvidia-voyager": dict(mid=dict(h=150, gap=80), near=dict(h=40, gap=50), floor_crop=(0.25, 1.0), fg=0),
    "xai-colossus-memphis": dict(mid=dict(h=150, gap=66), near=dict(h=44, gap=48), floor_crop=(0.25, 1.0), fg=0),
    "microsoft-fairwater": dict(mid=dict(h=150, gap=64), near=dict(h=42, gap=48), floor_crop=(0.32, 1.0), fg=3),
    "deepseek-hangzhou": dict(mid=dict(h=146, gap=84), near=dict(h=42, gap=52), floor_crop=(0.25, 1.0), fg=3),
    "ami-labs-paris": dict(mid=dict(h=150, gap=104), near=dict(h=42, gap=50), floor_crop=(0.25, 1.0), fg=0),
}


def layer_width(parallax):
    return int(round((VIEW_W + SCROLL * parallax) / PX))


def to_np(img):
    return np.asarray(img.convert("RGB"), dtype=np.float32)


def quantize(rgba, colors):
    """Reduce to a limited palette without dithering; keeps alpha as-is."""
    rgb = Image.fromarray(rgba[..., :3].astype(np.uint8), "RGB")
    q = rgb.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
    out = np.dstack([np.asarray(q), rgba[..., 3]]).astype(np.uint8)
    return out


def key_mask(src):
    """True where the pixel belongs to the flat chroma-key background."""
    border = np.concatenate([src[:6].reshape(-1, 3), src[-6:].reshape(-1, 3),
                             src[:, :6].reshape(-1, 3), src[:, -6:].reshape(-1, 3)])
    key = np.median(border, axis=0)
    dist = np.sqrt(((src - key) ** 2).sum(-1))
    r, g, b = src[..., 0], src[..., 1], src[..., 2]
    if key[1] > key[0] and key[1] > key[2]:
        dominance = g - np.maximum(r, b)
    else:
        dominance = np.minimum(r, b) - g
    return (dist < 110) | (dominance > 90), key


def downsample_keyed(src, solid, factor):
    """Box-downsample by a float factor, averaging only non-key samples."""
    h, w = solid.shape
    nw, nh = int(round(w / factor)), int(round(h / factor))
    ys = (np.arange(nh + 1) * h / nh).astype(int)
    xs = (np.arange(nw + 1) * w / nw).astype(int)
    out = np.zeros((nh, nw, 4), np.float32)
    s = solid.astype(np.float32)
    cs = np.cumsum(np.cumsum(np.pad(s, ((1, 0), (1, 0))), 0), 1)
    rgbw = src * s[..., None]
    crgb = np.cumsum(np.cumsum(np.pad(rgbw, ((1, 0), (1, 0), (0, 0))), 0), 1)

    def box(c, y0, y1, x0, x1):
        return c[y1][:, x1] - c[y0][:, x1] - c[y1][:, x0] + c[y0][:, x0]

    y0, y1 = ys[:-1], ys[1:]
    x0, x1 = xs[:-1], xs[1:]
    Y0, X0 = np.meshgrid(y0, x0, indexing="ij")
    Y1, X1 = np.meshgrid(y1, x1, indexing="ij")
    area = (Y1 - Y0) * (X1 - X0)
    cnt = cs[Y1, X1] - cs[Y0, X1] - cs[Y1, X0] + cs[Y0, X0]
    tot = crgb[Y1, X1] - crgb[Y0, X1] - crgb[Y1, X0] + crgb[Y0, X0]
    cov = cnt / np.maximum(area, 1)
    out[..., :3] = tot / np.maximum(cnt, 1)[..., None]
    out[..., 3] = np.where(cov >= 0.5, 255, 0)
    return out


def despill(rgba, key):
    a = rgba[..., 3] > 0
    edge = a & ~(np.roll(a, 1, 0) & np.roll(a, -1, 0) & np.roll(a, 1, 1) & np.roll(a, -1, 1))
    edge = edge | (a & ~(np.roll(edge, 1, 0) & np.roll(edge, -1, 0)) & (np.roll(edge, 1, 1) | np.roll(edge, -1, 1)))
    r, g, b = rgba[..., 0], rgba[..., 1], rgba[..., 2]
    if key[1] > key[0] and key[1] > key[2]:
        cap = np.maximum(r, b)
        rgba[..., 1] = np.where(edge & (g > cap), cap, g)
    else:
        m = np.minimum(r, b)
        spill = np.clip(m - g, 0, None)
        rgba[..., 0] = np.where(edge, r - spill * 0.6, r)
        rgba[..., 2] = np.where(edge, b - spill * 0.6, b)
    # Darken the outermost ring slightly so sprites read cleanly against busy far art.
    rgba[..., :3] = np.where(edge[..., None], rgba[..., :3] * 0.72, rgba[..., :3])
    return rgba


def segment_props(solid):
    """Split a prop sheet into column runs separated by empty gaps."""
    occ = solid.sum(0) > 2
    runs, start, gap = [], None, 0
    for x, o in enumerate(occ):
        if o:
            if start is None:
                start = x
            gap = 0
        elif start is not None:
            gap += 1
            if gap >= 8:
                runs.append((start, x - gap + 1))
                start, gap = None, 0
    if start is not None:
        runs.append((start, len(occ)))
    props = []
    for x0, x1 in runs:
        rows = np.where(solid[:, x0:x1].sum(1) > 1)[0]
        if len(rows) == 0:
            continue
        y0, y1 = rows[0], rows[-1] + 1
        if (x1 - x0) < 24 or (y1 - y0) < 24:
            continue
        props.append((x0, y0, x1, y1))
    return props


def despeckle(rgba, key):
    """Darken leftover key-tinted pixels trapped inside a sprite (perforations, grilles)."""
    dist = np.sqrt(((rgba[..., :3] - key) ** 2).sum(-1))
    trapped = (rgba[..., 3] > 0) & (dist < 170)
    rgba[..., :3] = np.where(trapped[..., None], np.array([10, 14, 20], np.float32), rgba[..., :3])
    return rgba


def load_props(path, target_h, clean=False):
    src = to_np(Image.open(path))
    solid, key = key_mask(src)
    boxes = segment_props(~solid)
    tallest = max(b[3] - b[1] for b in boxes)
    factor = tallest / target_h
    sprites = []
    for x0, y0, x1, y1 in boxes:
        pad = 4
        crop_src = src[max(0, y0 - pad):y1 + pad, max(0, x0 - pad):x1 + pad]
        crop_solid = ~solid[max(0, y0 - pad):y1 + pad, max(0, x0 - pad):x1 + pad]
        spr = despill(downsample_keyed(crop_src, crop_solid, factor), key)
        if clean:
            spr = despeckle(spr, key)
        spr = trim(spr)
        sprites.append(spr)
    return sprites, key, boxes, src.shape


def trim(rgba):
    a = rgba[..., 3] > 0
    ys, xs = np.where(a)
    return rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def paste(canvas, spr, x, y_bottom):
    h, w = spr.shape[:2]
    y = y_bottom - h
    cx0, cy0 = max(0, x), max(0, y)
    cx1, cy1 = min(canvas.shape[1], x + w), min(canvas.shape[0], y + h)
    if cx1 <= cx0 or cy1 <= cy0:
        return
    part = spr[cy0 - y:cy1 - y, cx0 - x:cx1 - x]
    m = part[..., 3:4] > 0
    canvas[cy0:cy1, cx0:cx1] = np.where(m, part, canvas[cy0:cy1, cx0:cx1])


def layout_props(sprites, width, height, baseline, gap, seed):
    rng = random.Random(seed)
    canvas = np.zeros((height, width, 4), np.float32)
    order = list(range(len(sprites)))
    rng.shuffle(order)
    x = int(gap * 0.4)
    i = 0
    while x < width:
        spr = sprites[order[i % len(order)]]
        if rng.random() < 0.35:
            spr = spr[:, ::-1]
        paste(canvas, spr, x, baseline)
        x += spr.shape[1] + int(gap * rng.uniform(0.7, 1.3))
        i += 1
        if i % len(order) == 0:
            rng.shuffle(order)
    return canvas


def build_strip(path, target_h, width, height, baseline):
    src = to_np(Image.open(path))
    solid, key = key_mask(src)
    rows = np.where((~solid).sum(1) > src.shape[1] * 0.02)[0]
    y0 = rows[0]
    factor = (src.shape[0] - y0) / target_h
    strip = despill(downsample_keyed(src[y0:], ~solid[y0:], factor), key)
    strip = strip[:, 1:-1]
    tile = np.concatenate([strip, strip[:, ::-1]], axis=1)
    reps = int(np.ceil(width / tile.shape[1])) + 1
    row = np.concatenate([tile] * reps, axis=1)[:, :width]
    canvas = np.zeros((height, width, 4), np.float32)
    paste(canvas, row, 0, baseline + 6)
    return canvas


def build_far(path):
    w = layer_width(PARALLAX["far"])
    img = Image.open(path).convert("RGB")
    h = int(round(img.height * w / img.width))
    rgb = np.asarray(img.resize((w, h), Image.Resampling.BOX), np.float32)
    rgba = np.dstack([rgb, np.full(rgb.shape[:2], 255, np.float32)])
    return rgba


def build_floor(path, crop, col_crop=(0.18, 0.82)):
    img = Image.open(path).convert("RGB")
    W, H = img.size
    rows = (int(H * crop[0]), int(H * crop[1]))
    cols = (int(W * col_crop[0]), int(W * col_crop[1]))
    region = img.crop((cols[0], rows[0], cols[1], rows[1]))
    floor_h = (VIEW_H - FLOOR_TOP) // PX
    tile_w = (cols[1] - cols[0]) // PX
    arr = np.asarray(region.resize((tile_w, floor_h), Image.Resampling.BOX), np.float32)
    k = 40
    body = arr[:, :-k].copy()
    t = np.linspace(0, 1, k)[None, :, None]
    body[:, :k] = arr[:, -k:] * (1 - t) + arr[:, :k] * t
    # Depth falloff toward the horizon, and a contact shadow at the far edge.
    depth = np.linspace(0.55, 1.0, floor_h) ** 0.8
    body *= depth[:, None, None]
    body[0] *= 0.35
    body[1] *= 0.6
    return np.dstack([body, np.full(body.shape[:2], 255, np.float32)])


def build_floor_decal(cfg, floor_h):
    """Lettering set into the floor plane, foreshortened to match the generated floor perspective."""
    font = ImageFont.truetype(cfg.get("font", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"), 420)
    text = cfg["text"]
    tmp = Image.new("L", (420 * len(text) + 200, 560), 0)
    ImageDraw.Draw(tmp).text((60, 40), text, font=font, fill=255)
    mask = np.asarray(tmp, np.float32) / 255
    ys, xs = np.where(mask > 0.5)
    mask = mask[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    hp, wp = mask.shape
    solid = mask > 0.5
    edge = solid & ~(np.roll(solid, 6, 0) & np.roll(solid, -6, 0) & np.roll(solid, 6, 1) & np.roll(solid, -6, 1))
    rng = np.random.default_rng(7)
    plane = np.zeros((hp, wp, 4), np.float32)
    base = np.array(cfg.get("color", (206, 202, 192)), np.float32)
    plane[..., :3] = base + rng.normal(0, 7, (hp, wp, 1))
    plane[..., :3] = np.where(edge[..., None], np.array(cfg.get("edge", (70, 72, 76)), np.float32), plane[..., :3])
    plane[..., 3] = np.where(solid, 255, 0)

    width_n = cfg["width"]
    out_w = int(width_n * 1.3)
    out = np.zeros((floor_h, out_w, 4), np.float32)
    r0, r1 = cfg["rows"]
    depth = np.linspace(0.55, 1.0, floor_h) ** 0.8
    for r in range(r0, r1 + 1):
        t = (r - r0) / (r1 - r0)
        v = 1 - (1 - t) ** 1.6
        src_row = plane[int(round(v * (hp - 1)))]
        row_w = max(2, int(round(width_n * (0.72 + 0.5 * t))))
        idx = np.clip((np.arange(row_w) * wp / row_w).astype(int), 0, wp - 1)
        row = src_row[idx]
        x0 = (out_w - row_w) // 2
        out[r, x0:x0 + row_w] = row
        out[r, :, :3] *= depth[r]
    out[..., 3] = np.where(out[..., 3] > 0, cfg.get("alpha", 225), 0)
    return out


def build_fg(sprites, which, key_light):
    w = layer_width(PARALLAX["fg"])
    h = VIEW_H // PX
    canvas = np.zeros((h, w, 4), np.float32)
    spr = sprites[min(which, len(sprites) - 1)]
    big = np.asarray(Image.fromarray(spr.astype(np.uint8), "RGBA").resize(
        (spr.shape[1] * 2, spr.shape[0] * 2), Image.Resampling.NEAREST), np.float32).copy()
    a = big[..., 3] > 0
    lum = big[..., :3].mean(-1, keepdims=True)
    big[..., :3] = 6 + lum * 0.12
    rim = a & ~np.roll(a, 2, 1)
    big[..., :3] = np.where(rim[..., None], np.array(key_light) * 0.55, big[..., :3])
    left = big
    right = big[:, ::-1].copy()
    rim_r = right[..., 3] > 0
    rim_r = rim_r & ~np.roll(rim_r, -2, 1)
    right[..., :3] = np.where(rim_r[..., None], np.array(key_light) * 0.55, right[..., :3])
    paste(canvas, left, -left.shape[1] // 3, h + 8)
    paste(canvas, right, w - right.shape[1] * 2 // 3, h + 8)
    return canvas


def glow_mask(rgba, pct=96.5, floor=85):
    """Emissive pixels: bright relative to their surroundings and saturated or near-white."""
    rgb = rgba[..., :3]
    lum = rgb @ np.array([0.299, 0.587, 0.114], np.float32)
    sat = rgb.max(-1) - rgb.min(-1)
    vis = rgba[..., 3] > 0
    if not vis.any():
        return np.zeros_like(rgba)
    local = np.asarray(Image.fromarray(np.clip(lum, 0, 255).astype(np.uint8)).filter(
        ImageFilter.BoxBlur(5)), np.float32)
    thr = max(floor, np.percentile(lum[vis], pct))
    core = vis & (lum >= thr) & (lum - local > 22) & ((sat > 45) | (lum > 190))
    halo = vis & ~core & (np.roll(core, 1, 0) | np.roll(core, -1, 0) | np.roll(core, 1, 1) | np.roll(core, -1, 1))
    out = np.zeros_like(rgba)
    out[..., :3] = np.clip(rgb * 1.15 + 20, 0, 255)
    out[..., 3] = np.where(core, 255, np.where(halo, 96, 0))
    return out


def glow_tiles(glow):
    tiles = []
    h, w = glow.shape[:2]
    for ty in range(0, h, GLOW_TILE):
        for tx in range(0, w, GLOW_TILE):
            if (glow[ty:ty + GLOW_TILE, tx:tx + GLOW_TILE, 3] > 200).sum() >= 3:
                tiles.append([tx, ty])
    return tiles


def _median_colors(pixels, n):
    img = Image.fromarray(pixels.reshape(1, -1, 3).astype(np.uint8), "RGB")
    pal = img.quantize(colors=n, method=Image.Quantize.MEDIANCUT).getpalette()[:n * 3]
    return [tuple(pal[i:i + 3]) for i in range(0, n * 3, 3)]


def swatches(layers, base=5, accents=3):
    """Dominant tones sorted dark to light, followed by the brightest saturated accents."""
    stack = np.concatenate([l[..., :3][l[..., 3] > 0] for l in layers])
    lum = stack @ np.array([0.299, 0.587, 0.114], np.float32)
    sat = stack.max(-1) - stack.min(-1)
    cols = _median_colors(stack, base)
    cols.sort(key=lambda c: 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2])
    pop = stack[(sat > 50) & (lum > 90)]
    if len(pop) >= accents * 20:
        acc = _median_colors(pop, accents)
        acc.sort(key=lambda c: 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2])
        cols += acc
    return ["#%02x%02x%02x" % c for c in cols]


def save(rgba, path):
    Image.fromarray(np.clip(rgba, 0, 255).astype(np.uint8), "RGBA").save(path, optimize=True)


def build_stage(sid, cfg):
    out = OUT / sid
    out.mkdir(parents=True, exist_ok=True)
    view_h = VIEW_H // PX
    floor_top_n = FLOOR_TOP // PX

    far = quantize(build_far(SRC / f"{sid}-far.jpg"), 72)

    mid_sprites, _, _, _ = load_props(SRC / f"{sid}-mid.jpg", cfg["mid"]["h"], cfg["mid"].get("despeckle", False))
    mid = layout_props(mid_sprites, layer_width(PARALLAX["mid"]), view_h, floor_top_n + 3,
                       cfg["mid"]["gap"], seed=sid + "mid")
    mid = quantize(mid, 64)

    near_w = layer_width(PARALLAX["near"])
    fp0, fp1 = FLOOR_PARALLAX
    near_base_y = FLOOR_TOP + (PARALLAX["near"] - fp0) / (fp1 - fp0) * (GROUND_Y - FLOOR_TOP)
    near_base = int(round(near_base_y / PX))
    if cfg["near"].get("strip"):
        near = build_strip(SRC / f"{sid}-near.jpg", cfg["near"]["h"], near_w, view_h, near_base)
    else:
        near_sprites, _, _, _ = load_props(SRC / f"{sid}-near.jpg", cfg["near"]["h"])
        near = layout_props(near_sprites, near_w, view_h, near_base, cfg["near"]["gap"], seed=sid + "near")
    near = quantize(near, 64)

    floor = quantize(build_floor(SRC / f"{sid}-floor.jpg", cfg["floor_crop"], cfg.get("floor_cols", (0.18, 0.82))), 48)

    sw = swatches([far, mid, near, floor])
    lights = [tuple(int(sw[-1][i:i + 2], 16) for i in (1, 3, 5))]
    fg = build_fg(mid_sprites, cfg["fg"], lights[0])
    fg = quantize(fg, 24)

    meta = {"px": PX, "layers": {}, "swatches": sw}
    for name, img in (("far", far), ("mid", mid), ("near", near), ("floor", floor), ("fg", fg)):
        save(img, out / f"{name}.png")
        info = {"src": f"assets/stages/{sid}/{name}.png", "w": int(img.shape[1]), "h": int(img.shape[0])}
        if name in PARALLAX:
            info["parallax"] = PARALLAX[name]
        if name in ("far", "mid", "near"):
            g = glow_mask(img.astype(np.float32), pct=96 if name == "far" else 95)
            tiles = glow_tiles(g)
            if tiles:
                save(g, out / f"{name}-glow.png")
                info["glow"] = {"src": f"assets/stages/{sid}/{name}-glow.png", "tile": GLOW_TILE, "tiles": tiles}
        meta["layers"][name] = info
    meta["layers"]["floor"]["parallax"] = list(FLOOR_PARALLAX)
    if "floor_decal" in cfg:
        decal = quantize(build_floor_decal(cfg["floor_decal"], floor.shape[0]), 20)
        save(decal, out / "floor-decal.png")
        meta["layers"]["floorDecal"] = {
            "src": f"assets/stages/{sid}/floor-decal.png", "w": int(decal.shape[1]), "h": int(decal.shape[0]),
            "x": int(cfg["floor_decal"]["x"] - decal.shape[1] * PX / 2),
        }
    else:
        (out / "floor-decal.png").unlink(missing_ok=True)
    meta["layers"]["near"]["baseY"] = near_base * PX
    return meta


def main():
    ids = sys.argv[1:] or list(STAGES)
    existing = {}
    if GEN_JS.exists():
        text = GEN_JS.read_text()
        start = text.index("{", text.index("STAGE_LAYERS"))
        existing = json.loads(text[start:text.rindex("}") + 1])
    for sid in ids:
        print("building", sid)
        existing[sid] = build_stage(sid, STAGES[sid])
    geometry = {"px": PX, "viewW": VIEW_W, "viewH": VIEW_H, "worldW": WORLD_W,
                "floorTop": FLOOR_TOP, "groundY": GROUND_Y}
    GEN_JS.write_text(
        "// Generated by assets/stages/_pipeline/build_stages.py. Do not edit by hand.\n"
        f"export const STAGE_GEOMETRY = {json.dumps(geometry)};\n\n"
        "export const STAGE_LAYERS = " + json.dumps({k: existing[k] for k in STAGES if k in existing}, indent=1) + ";\n"
    )


if __name__ == "__main__":
    main()
