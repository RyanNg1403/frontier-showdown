#!/usr/bin/env python3
"""Side-by-side of the old run atlas against the new 3D-pipeline cycles, same 1 atlas px = 1 world px scale.

    python3 tools/sprites3d/post/compare.py --old assets/frontier-sam-run-atlas.png --old-row 3 \
        --atlas assets/fighters/sam/3d --out compare.png [--zoom 2]
"""

import argparse
import json
import os

from PIL import Image, ImageDraw, ImageFont

CELL = 256


def row_frames(img, y, count, crop):
    x0 = (CELL - crop) // 2
    return [img.crop((i * CELL + x0, y, i * CELL + x0 + crop, y + CELL)) for i in range(count)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--old", required=True)
    ap.add_argument("--old-row", type=int, default=3)
    ap.add_argument("--old-count", type=int, default=8)
    ap.add_argument("--atlas", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--zoom", type=int, default=2)
    ap.add_argument("--crop", type=int, default=144)
    args = ap.parse_args()

    old = Image.open(args.old).convert("RGBA")
    new = Image.open(os.path.join(args.atlas, "atlas.png")).convert("RGBA")
    meta = json.load(open(os.path.join(args.atlas, "atlas.json")))
    anims = meta["animations"]
    rows = [(f"OLD  {os.path.basename(args.old)}  (right-facing run row, {args.old_count} frames, chibi)",
             row_frames(old, args.old_row * CELL, args.old_count, args.crop))]
    for name in ("run", "walk_fwd"):
        a = anims[name]
        label = (f"NEW  3D pipeline {name}  ({len(a['frames'])} frames @ {a['fps']} fps, "
                 f"strideSpeed {a.get('strideSpeed')} px/s measured from foot travel)")
        rows.append((label, row_frames(new, a["frames"][0]["y"], len(a["frames"]), args.crop)))

    z, crop, label_h = args.zoom, args.crop, 34
    font = ImageFont.load_default(size=20)
    cols = max(len(f) for _, f in rows)
    w, h = cols * crop * z, len(rows) * (CELL * z + label_h)
    sheet = Image.new("RGBA", (w, h), (43, 47, 58, 255))
    d = ImageDraw.Draw(sheet)
    for r, (label, frames) in enumerate(rows):
        y = r * (CELL * z + label_h)
        d.rectangle([0, y, w, y + label_h - 1], fill=(30, 33, 41, 255))
        d.text((10, y + 6), label, fill=(232, 234, 242, 255), font=font)
        gy = y + label_h + 244 * z
        d.rectangle([0, gy, w, y + label_h + CELL * z], fill=(33, 36, 45, 255))
        d.line([0, gy, w, gy], fill=(96, 102, 120, 255), width=z)
        for i, f in enumerate(frames):
            sheet.alpha_composite(f.resize((crop * z, CELL * z), Image.NEAREST), (i * crop * z, y + label_h))
    sheet.convert("RGB").save(args.out, optimize=True)
    print(f"wrote {args.out} ({w}x{h})")


if __name__ == "__main__":
    main()
