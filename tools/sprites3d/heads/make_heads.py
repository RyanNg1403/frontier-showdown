#!/usr/bin/env python3
"""Cut a generated four-view head sheet into the pipeline's likeness heads, and build likeness QA images.

    python3 tools/sprites3d/heads/make_heads.py build [<id> ...]
    python3 tools/sprites3d/heads/make_heads.py split sheet.jpg <id> [--view profile=single.jpg] [--chin ROW] [--long-hair]
    python3 tools/sprites3d/heads/make_heads.py qa <id> --photo ref.jpg --portrait portrait.png --out qa.png

`build` reruns `split` for every fighter in heads/source/recipes.json (the generated sheets, per-view
overrides, chin rows and the likeness references each was generated from). `split` expects one row of four heads (three-quarter neutral, right profile, three-quarter hurt,
three-quarter shout), all facing right, head and neck only, on a flat background. It keys each view,
scales all four by one factor so the three-quarter head matches heads/sam.png (crown at source row 101,
chin at row 728 of 1024), keeps the views' vertical placement from the sheet with every neck
centred on the same column, and records the
crown, chin and neck-cut rows of every file in heads/heads.json in the configs' 1024-row units (all four
views record the three-quarter head's crown-to-chin height, so they paste at one scale).
"""

import argparse
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
sys.path.insert(0, os.path.join(HERE, "..", "post"))
from process import HeadSprite, key_background, outer_outline  # noqa: E402

VIEWS = ("tq", "profile", "hurt", "shout")
SIZE = 512
SOURCE_HEIGHT = 1024
CROWN_ROW = 51           # heads/sam.png at 512 px
CHIN_ROW = 364
NECK_COL = 266           # neck centre column of heads/sam.png
CHIN_RATIO = (728 - 101) / (908 - 101)   # chin position between crown and neck bottom, from sam.json
NECK_BELOW_CHIN = (830 - 728) / (728 - 101)  # neck cut below the chin, in head heights
MANIFEST = os.path.join(HERE, "heads.json")
RECIPES = os.path.join(HERE, "source", "recipes.json")


def foreground(rgb, tol):
    """Key a flat background; returns (mask, chroma). Magenta gets a chroma key so dark skin shadows,
    outlines and the background seen through glasses lenses are all keyed correctly."""
    c = rgb.astype(np.int32)
    corners = np.concatenate([c[:8, :8].reshape(-1, 3), c[:8, -8:].reshape(-1, 3),
                              c[-8:, :8].reshape(-1, 3), c[-8:, -8:].reshape(-1, 3)])
    br, bg, bb = np.median(corners, axis=0)
    if bg < 60 and br - bg > 80 and bb - bg > 40:
        r, g, b = c[..., 0], c[..., 1], c[..., 2]
        return ~((r - g > 0.3 * (br - bg)) & (b - g > 0.3 * (bb - bg))), True
    return key_background(rgb, tol), False


def despill(rgba):
    """Pull the magenta tint out of fringe pixels (red and blue both above green); skin, hair and dark
    frames have blue at or below green and are left alone."""
    out = rgba.astype(np.int32).copy()
    r, g, b = out[..., 0], out[..., 1], out[..., 2]
    spill = np.clip(np.minimum(r, b) - g, 0, None) * (out[..., 3] > 0)
    out[..., 0] -= spill
    out[..., 2] -= spill
    out[..., 3] = np.where(spill > 45, 0, out[..., 3])
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


def blobs(rgb, tol, count=4):
    mask, chroma = foreground(rgb, tol)
    mask = ndimage.binary_opening(mask, iterations=2)
    lab, n = ndimage.label(mask)
    sizes = ndimage.sum(mask, lab, range(1, n + 1))
    keep = 1 + np.argsort(sizes)[::-1][:count]
    out = []
    for k in keep:
        # The chroma key leaves real see-through gaps open (lenses past the face, gaps between curls).
        m = (lab == k) if chroma else ndimage.binary_fill_holes(lab == k)
        ys, xs = np.nonzero(m)
        out.append((xs.min(), m))
    if len(out) < count:
        raise SystemExit(f"found {len(out)} heads on the sheet, expected {count}")
    return [m for _, m in sorted(out, key=lambda t: t[0])]


def chin_row(mask, crown, bottom):
    """Row where the face-front contour turns back into the neck; falls back to the sam.json ratio."""
    rows = np.arange(int(crown + 0.5 * (bottom - crown)), int(crown + 0.93 * (bottom - crown)))
    front = np.array([np.nonzero(mask[r])[0].max() if mask[r].any() else 0 for r in rows], float)
    front = ndimage.uniform_filter1d(front, 5)
    step = front[6:] - front[:-6]
    if len(step) == 0 or step.min() > -12:
        return crown + CHIN_RATIO * (bottom - crown)
    return rows[int(np.argmin(step)) + 3]


def largest_blob(rgb, tol):
    return blobs(rgb, tol, count=1)[0]


def crown_chin(mask):
    rows = np.nonzero(mask.any(1))[0]
    return rows.min(), chin_row(mask, rows.min(), rows.max())


def split(sheet, fighter_id, tol, overrides, long_hair=False, chin=None):
    rgb = np.asarray(Image.open(sheet).convert("RGB"))
    masks = blobs(rgb, tol)
    tq = masks[0]
    tq_crown, tq_chin = crown_chin(tq)
    chin_override = chin
    if chin is not None:
        tq_chin = chin
    scale = (CHIN_ROW - CROWN_ROW) / (tq_chin - tq_crown)
    dy = CROWN_ROW - tq_crown * scale
    sources = [(rgb, m, scale, dy) for m in masks]
    for view, path in overrides.items():
        # A separately generated view: match the three-quarter head's crown-to-chin size and crown row.
        o_rgb = np.asarray(Image.open(path).convert("RGB"))
        o_mask = largest_blob(o_rgb, tol)
        crown, chin = crown_chin(o_mask)
        o_scale = scale * (tq_chin - tq_crown) / (chin - crown)
        sources[VIEWS.index(view)] = (o_rgb, o_mask, o_scale, CROWN_ROW - crown * o_scale)
    manifest = json.load(open(MANIFEST)) if os.path.exists(MANIFEST) else {}
    for view, (src, m, sc, oy) in zip(VIEWS, sources):
        bys, bxs = np.nonzero(m)
        y0, y1, x0, x1 = bys.min(), bys.max() + 1, bxs.min(), bxs.max() + 1
        crop = np.dstack([src[y0:y1, x0:x1], np.where(m[y0:y1, x0:x1], 255, 0).astype(np.uint8)])
        w, h = round(crop.shape[1] * sc), round(crop.shape[0] * sc)
        small = np.asarray(Image.fromarray(crop).resize((w, h), Image.LANCZOS)).copy()
        small[..., 3] = np.where(small[..., 3] > 127, 255, 0)
        neck_rows = slice(y0 + int(0.85 * (y1 - y0)), y1)
        own_neck = np.nonzero(m[neck_rows].any(0))[0].mean()
        px = round(NECK_COL - (own_neck - x0) * sc)
        py = round(y0 * sc + oy)
        canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
        canvas.alpha_composite(Image.fromarray(small), (max(0, min(SIZE - w, px)), max(0, py)))
        path = os.path.join(HERE, f"{fighter_id}_{view}.png")
        canvas = despill(np.asarray(canvas))
        canvas.save(path, optimize=True)
        crown, chin = crown_chin(np.asarray(canvas)[..., 3] > 0)
        if view == VIEWS[0]:
            head_h = CHIN_ROW - CROWN_ROW if chin_override is not None else chin - crown
        # Every view is drawn at the three-quarter head's scale, so they all record its crown-to-chin
        # height: process.py sizes the head from (chin - crown), and open jaws or profiles would skew it.
        chin = crown + head_h
        neck_cut = chin + NECK_BELOW_CHIN * head_h
        if long_hair:
            # Hair that hangs past the collar stays in the paste; the cut moves to the bottom of the hair.
            neck_cut = np.nonzero((np.asarray(canvas)[..., 3] > 0).any(1))[0].max() + 1
        k = SOURCE_HEIGHT / SIZE
        manifest[f"{fighter_id}_{view}"] = {
            "image": f"heads/{fighter_id}_{view}.png", "source_height": SOURCE_HEIGHT,
            "crown": int(round(crown * k)), "chin": int(round(chin * k)),
            "neck_cut": int(round(neck_cut * k))}
        print(f"wrote {path}: {manifest[f'{fighter_id}_{view}']}")
    with open(MANIFEST, "w") as f:
        json.dump(dict(sorted(manifest.items())), f, indent=1)
        f.write("\n")


def game_head(fighter_id, view, height_px, heads_tall):
    entry = json.load(open(MANIFEST))[f"{fighter_id}_{view}"]
    cfg = {"head": dict(entry, heads_tall=heads_tall, colors=18)}
    small = HeadSprite(cfg, height_px).get(0)
    pad = np.zeros((small.shape[0] + 2, small.shape[1] + 2, 4), np.uint8)
    pad[1:-1, 1:-1] = small
    return Image.fromarray(outer_outline(pad))


def ingame_crop(fighter_id):
    path = os.path.join(ROOT, "assets", "fighters", fighter_id, "3d", "atlas.json")
    if not os.path.exists(path):
        return None
    atlas = json.load(open(path))
    anims = atlas["animations"]
    fr = (anims.get("stance") or anims.get("idle") or next(iter(anims.values())))["frames"][0]
    img = Image.open(os.path.join(os.path.dirname(path), "atlas.png")).convert("RGBA")
    cell = img.crop((fr["x"], fr["y"], fr["x"] + fr["w"], fr["y"] + fr["h"]))
    bb = cell.getbbox()
    return cell.crop((bb[0] - 4, bb[1] - 4, bb[2] + 4, bb[1] + 70))


def checker(w, h, c0=(54, 56, 70), c1=(62, 64, 80), s=12):
    yy, xx = np.mgrid[:h, :w]
    a = np.where(((yy // s + xx // s) % 2)[..., None] == 0, c0, c1).astype(np.uint8)
    return Image.fromarray(a).convert("RGBA")


def qa(fighter_id, photo, portrait, out, label):
    cfg_path = os.path.join(HERE, "..", "fighters", f"{fighter_id}.json")
    cfg = json.load(open(cfg_path))
    height_px = cfg["height_px"]
    heads_tall = (cfg.get("head") or {}).get("heads_tall", 7.0)
    H = 360
    tiles = []
    ph = Image.open(photo).convert("RGBA")
    ph = ph.resize((round(ph.width * H / ph.height), H), Image.LANCZOS)
    tiles.append(("reference: " + label, ph))
    if portrait:
        po = Image.open(portrait).convert("RGBA").resize((H, H), Image.LANCZOS)
        tiles.append(("approved select portrait", po))
    for v in VIEWS:
        im = Image.open(os.path.join(HERE, f"{fighter_id}_{v}.png")).resize((H, H), Image.LANCZOS)
        tiles.append((f"{v} (source)", im))
    small = [game_head(fighter_id, v, height_px, heads_tall) for v in VIEWS]
    game = []
    for v, s in zip(VIEWS, small):
        game.append((f"{v} in-game 3x", s.resize((s.width * 3, s.height * 3), Image.NEAREST)))
    crop = ingame_crop(fighter_id)
    if crop is not None:
        game.append(("current 3D sprite 3x", crop.resize((crop.width * 3, crop.height * 3), Image.NEAREST)))
    top_w = sum(t.width for _, t in tiles) + 16 * (len(tiles) + 1)
    bot_h = max(t.height for _, t in game)
    sheet = checker(top_w, H + bot_h + 100)
    d = ImageDraw.Draw(sheet)
    x = 16
    for name, t in tiles:
        sheet.alpha_composite(t, (x, 30))
        d.text((x, 12), name, fill=(235, 235, 240))
        x += t.width + 16
    x = 16
    for name, t in game:
        sheet.alpha_composite(t, (x, H + 70))
        d.text((x, H + 52), name, fill=(235, 235, 240))
        x += t.width + 24
    os.makedirs(os.path.dirname(out), exist_ok=True)
    sheet.convert("RGB").save(out)
    print(f"wrote {out}")


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("split")
    s.add_argument("sheet")
    s.add_argument("id")
    s.add_argument("--tol", type=int, default=110)
    s.add_argument("--view", action="append", default=[], metavar="VIEW=IMAGE",
                   help="replace one view with a separately generated single-head image")
    s.add_argument("--chin", type=int,
                   help="chin row of the three-quarter head on the sheet, when hair hides the jaw contour")
    s.add_argument("--long-hair", action="store_true",
                   help="keep hair that hangs below the neck cut (neck_cut becomes the bottom of the hair)")
    b = sub.add_parser("build")
    b.add_argument("ids", nargs="*")
    b.add_argument("--tol", type=int, default=110)
    q = sub.add_parser("qa")
    q.add_argument("id")
    q.add_argument("--photo", required=True)
    q.add_argument("--portrait")
    q.add_argument("--label", default="photo")
    q.add_argument("--out", required=True)
    args = ap.parse_args()
    if args.cmd == "build":
        recipes = json.load(open(RECIPES))
        for fid in args.ids or sorted(recipes):
            r = recipes[fid]
            views = {v: os.path.join(HERE, p) for v, p in r.get("views", {}).items()}
            split(os.path.join(HERE, r["sheet"]), fid, args.tol, views, r.get("long_hair", False), r.get("chin"))
    elif args.cmd == "split":
        split(args.sheet, args.id, args.tol, dict(v.split("=", 1) for v in args.view), args.long_hair, args.chin)
    else:
        qa(args.id, args.photo, args.portrait, args.out, args.label)


if __name__ == "__main__":
    main()
