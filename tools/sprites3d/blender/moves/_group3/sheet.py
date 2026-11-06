#!/usr/bin/env python3
"""Contact sheet of one fighter's character moves (from the merged atlas), hit frames outlined in red.

    python3 tools/sprites3d/blender/moves/_group3/sheet.py <id> <out.png>

Reads assets/fighters/<id>/atlas.{png,json} and tools/sprites3d/build/<id>/render/build.json (which says which
animations a move module authored). Run after tools/sprites3d/build_all.sh.
"""

import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", ".."))
CELL, CROP, TOP, LABEL = 256, 150, 28, 200


def main():
    fid, out = sys.argv[1], sys.argv[2]
    atlas = Image.open(os.path.join(ROOT, "assets", "fighters", fid, "atlas.png")).convert("RGBA")
    data = json.load(open(os.path.join(ROOT, "assets", "fighters", fid, "atlas.json")))
    build = json.load(open(os.path.join(ROOT, "tools", "sprites3d", "build", fid, "render", "build.json")))
    names = [a["name"] for a in build["anims"] if a["source"] == f"moves/{fid}.py"]
    anims = [(n, data["animations"][n]) for n in names if n in data["animations"]]
    font, small = ImageFont.load_default(size=15), ImageFont.load_default(size=12)
    cols = max(len(a["frames"]) for _, a in anims)
    row_h = CELL - TOP + 6
    w, h = LABEL + cols * CROP, 36 + len(anims) * row_h
    sheet = Image.new("RGBA", (w, h), (30, 33, 41, 255))
    d = ImageDraw.Draw(sheet)
    d.text((8, 9), f"{fid}: character moves, 1x from the merged atlas ({len(anims)} animations; red = first active "
                   f"frame, hit event)", fill=(236, 238, 245, 255), font=font)
    x0 = (CELL - CROP) // 2
    for r, (name, a) in enumerate(anims):
        y = 36 + r * row_h
        d.rectangle([0, y, w, y + row_h - 3], fill=(43, 47, 58, 255))
        d.line([LABEL, y + 244 - TOP, w, y + 244 - TOP], fill=(96, 102, 120, 255))
        d.text((8, y + 8), name, fill=(236, 238, 245, 255), font=font)
        d.text((8, y + 28), f"{len(a['frames'])}f @ {a['fps']} fps", fill=(170, 176, 192, 255), font=small)
        hits = {e["frame"] for e in a.get("events", []) if e.get("type") == "hit"}
        for c, fr in enumerate(a["frames"]):
            cell = atlas.crop((fr["x"] + x0, fr["y"] + TOP, fr["x"] + x0 + CROP, fr["y"] + CELL))
            x = LABEL + c * CROP
            sheet.alpha_composite(cell, (x, y))
            if c in hits:
                d.rectangle([x + 1, y + 1, x + CROP - 2, y + row_h - 5], outline=(235, 70, 70, 255), width=2)
            d.text((x + 4, y + 3), str(c), fill=(130, 136, 152, 255), font=small)
    sheet.convert("RGB").save(out, optimize=True)
    print(f"wrote {out} ({len(anims)} moves)")


if __name__ == "__main__":
    main()
