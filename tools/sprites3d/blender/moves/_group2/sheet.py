#!/usr/bin/env python3
"""Contact sheet of a fighter's move-file animations, cut from the merged atlas.

    python3 tools/sprites3d/blender/moves/_group2/sheet.py <id> <out.png>

Reads assets/fighters/<id>/atlas.{png,json} and the build record in tools/sprites3d/build/<id>/render to
keep only the animations a move module provided. 1x pixels; a red bar marks the hit frame.
"""

import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", ".."))
CELL, GROUND = 256, 244

TIMING = {
    "andrej": "timing: src/characters/andrej.js (main)",
    "yann": "timing: src/characters/yann.js (main)",
    "jensen": "timing: src/characters/jensen.js (main)",
    "ilya": "timing: src/characters/ilya.js (main)",
    "arthur": "timing: src/characters/arthur.js (main)",
}


def main():
    fid, out = sys.argv[1], sys.argv[2]
    atlas = np.asarray(Image.open(os.path.join(ROOT, "assets", "fighters", fid, "atlas.png")).convert("RGBA"))
    meta = json.load(open(os.path.join(ROOT, "assets", "fighters", fid, "atlas.json")))
    build = json.load(open(os.path.join(ROOT, "tools", "sprites3d", "build", fid, "render", "build.json")))
    names = [r["name"] for r in build["anims"] if str(r.get("source", "")).startswith("moves/")]
    rows = []
    for name in names:
        a = meta["animations"][name]
        frames = [atlas[f["y"]:f["y"] + CELL, f["x"]:f["x"] + CELL] for f in a["frames"]]
        hit = next((e["frame"] for e in a.get("events", []) if e.get("type") == "hit"), None)
        alpha = np.zeros((CELL, CELL), bool)
        for f in frames:
            alpha |= f[..., 3] > 0
        ys, xs = np.nonzero(alpha)
        rows.append((name, a, frames, hit, max(0, xs.min() - 3), min(CELL, xs.max() + 4), ys.min()))

    font, big = ImageFont.load_default(size=14), ImageFont.load_default(size=20)
    top = max(0, min(r[6] for r in rows) - 4)
    ch, label_h, gap = CELL - top, 22, 6
    width = max(900, max(len(r[2]) * (r[5] - r[4] + gap) for r in rows) + 16)
    sheet = Image.new("RGBA", (width, 62 + len(rows) * (label_h + ch + 10)), (30, 33, 41, 255))
    d = ImageDraw.Draw(sheet)
    d.text((10, 8), f"{meta.get('id', fid)}: move animations (3D pipeline, 1x; red bar = hit frame)", fill=(240, 242, 248, 255), font=big)
    d.text((10, 34), TIMING.get(fid, ""), fill=(170, 176, 192, 255), font=font)
    y = 62
    for name, a, frames, hit, x0, x1, _ in rows:
        w = x1 - x0
        label = f"{name}  ·  {len(frames)}f @ {a['fps']} fps" + ("  ·  loop" if a.get("loop") else "")
        if hit is not None:
            label += f"  ·  hit event on frame {hit}"
        d.text((10, y + 3), label, fill=(225, 228, 238, 255), font=font)
        y += label_h
        for i, f in enumerate(frames):
            x = 8 + i * (w + gap)
            cell = Image.new("RGBA", (w, ch), (43, 47, 58, 255))
            cd = ImageDraw.Draw(cell)
            cd.rectangle([0, GROUND - top, w, ch], fill=(33, 36, 45, 255))
            cd.line([0, GROUND - top, w, GROUND - top], fill=(96, 102, 120, 255))
            cell.alpha_composite(Image.fromarray(np.ascontiguousarray(f[top:, x0:x1])))
            sheet.alpha_composite(cell, (x, y))
            if i == hit:
                d.rectangle([x, y + ch - 3, x + w - 1, y + ch - 1], fill=(255, 70, 90, 255))
            d.text((x + 3, y + 2), str(i), fill=(150, 156, 175, 255), font=font)
        y += ch + 10
    sheet.convert("RGB").save(out, optimize=True)
    print(f"wrote {out}: {len(rows)} moves, {sum(len(r[2]) for r in rows)} frames")


if __name__ == "__main__":
    main()
