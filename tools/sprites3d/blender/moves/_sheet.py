#!/usr/bin/env python3
"""Contact sheet of a fighter's move animations, read from the merged atlas (system Python, no Blender).

    python3 tools/sprites3d/blender/moves/_sheet.py <id> [out.png]

Shows every animation that a move module authored (per `tools/sprites3d/build/<id>/render/build.json`), one
row per move at 1x, with the `hit` frame outlined and VFX hooks listed. Default output:
`tools/sprites3d/build/<id>/preview/moves-<id>.png`.
"""

import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", ".."))
COLS, CROP = 12, (36, 248)


def main():
    fid = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, "tools/sprites3d/build", fid, "preview",
                                                             f"moves-{fid}.png")
    adir = os.path.join(ROOT, "assets/fighters", fid)
    atlas = json.load(open(os.path.join(adir, "atlas.json")))
    img = Image.open(os.path.join(adir, atlas.get("image", "atlas.png"))).convert("RGBA")
    build = json.load(open(os.path.join(ROOT, "tools/sprites3d/build", fid, "render", "build.json")))
    sources = {r["name"]: r["source"] for r in build["anims"]}
    names = [n for n in atlas["animations"] if sources.get(n, "").startswith("moves/")]

    font, small = ImageFont.load_default(size=15), ImageFont.load_default(size=12)
    cw, ch, label_h = CROP[1] - CROP[0], atlas["cell"]["h"], 22
    rows = [(n, atlas["animations"][n]) for n in names]
    height = 34 + sum(label_h + ch * ((len(a["frames"]) + COLS - 1) // COLS) for _, a in rows)
    sheet = Image.new("RGBA", (COLS * cw, height), (30, 33, 41, 255))
    d = ImageDraw.Draw(sheet)
    d.text((8, 8), f"{fid}: move animations from {', '.join(sorted({sources[n] for n in names}))} "
                   f"(merged atlas, 1x, cells cropped to {cw} px)", fill=(236, 238, 245, 255), font=font)
    y = 34
    ground = atlas["anchor"]["y"]
    for name, a in rows:
        events = a.get("events", [])
        hit = next((e["frame"] for e in events if e["type"] == "hit"), None)
        vfx = [e["name"] for e in events if e["type"] == "vfx"]
        label = f"{name}  ({len(a['frames'])} f @ {a['fps']} fps" + (f", hit on frame {hit}" if hit is not None else "")
        label += ")" + (f"  vfx: {', '.join(vfx)}" if vfx else "")
        d.rectangle([0, y, sheet.width, y + label_h - 1], fill=(22, 24, 30, 255))
        d.text((6, y + 4), label, fill=(220, 224, 235, 255), font=small)
        y += label_h
        nrows = (len(a["frames"]) + COLS - 1) // COLS
        d.rectangle([0, y, sheet.width, y + ch * nrows - 1], fill=(43, 47, 58, 255))
        for r in range(nrows):
            d.line([0, y + r * ch + ground, sheet.width, y + r * ch + ground], fill=(96, 102, 120, 255))
        for i, fr in enumerate(a["frames"]):
            x0, y0 = (i % COLS) * cw, y + (i // COLS) * ch
            cell = img.crop((fr["x"] + CROP[0], fr["y"], fr["x"] + CROP[1], fr["y"] + fr["h"]))
            sheet.alpha_composite(cell, (x0, y0))
            if i == hit:
                d.rectangle([x0, y0, x0 + cw - 1, y0 + ch - 1], outline=(121, 228, 207, 255), width=2)
                d.text((x0 + 4, y0 + 4), "HIT", fill=(121, 228, 207, 255), font=small)
            d.text((x0 + cw - 18, y0 + 4), str(i), fill=(150, 156, 175, 255), font=small)
        y += ch * nrows
    os.makedirs(os.path.dirname(out), exist_ok=True)
    sheet.convert("RGB").save(out, optimize=True)
    print(f"wrote {out} ({len(names)} moves)")


if __name__ == "__main__":
    main()
