#!/usr/bin/env python3
"""Key a generated likeness head off its flat background and store it for the pipeline.

    python3 tools/sprites3d/post/prep_head.py generated.jpg tools/sprites3d/heads/<id>.png [--size 512]

The generated image should show only the head and neck, facing right, on a flat background colour. Save
extra views as <id>-profile.png, <id>-hurt.png, ... Crown, chin and neck cut are measured automatically
(post/headmeta.py); a sidecar <id>[-<view>].json can override them.
"""

import argparse

import numpy as np
from PIL import Image

from process import key_background


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("dst")
    ap.add_argument("--size", type=int, default=512)
    ap.add_argument("--tol", type=int, default=110)
    args = ap.parse_args()
    im = Image.open(args.src).convert("RGB")
    rgb = np.asarray(im)
    mask = key_background(rgb, args.tol)
    # Drop specks the key left behind: keep the largest connected blob only.
    from scipy import ndimage
    lab, n = ndimage.label(mask)
    if n > 1:
        sizes = ndimage.sum(mask, lab, range(1, n + 1))
        mask = lab == (1 + int(np.argmax(sizes)))
    mask = ndimage.binary_fill_holes(mask)
    rgba = np.dstack([rgb, np.where(mask, 255, 0).astype(np.uint8)])
    out = Image.fromarray(rgba)
    if args.size and args.size != im.height:
        out = out.resize((round(im.width * args.size / im.height), args.size), Image.LANCZOS)
        a = np.asarray(out).copy()
        a[..., 3] = np.where(a[..., 3] > 127, 255, 0)
        out = Image.fromarray(a)
    out.save(args.dst, optimize=True)
    print(f"wrote {args.dst} ({out.width}x{out.height}), source height {im.height}")


if __name__ == "__main__":
    main()
