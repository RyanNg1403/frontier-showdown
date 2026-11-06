"""
Likeness heads.

Describing a real person in words gives generic faces, and full-body generations copy whatever
head their body reference has. So likeness comes from the photo itself:

1. The reference photo is the edit input for a pixel-art bust (`source/likeness.jpg`: front view
   left, three-quarter view facing right on the right).
2. `composite` pastes that three-quarter head onto every figure of a sheet (model sheet, guides),
   erasing the old head first; a follow-up edit only blends the neck join.

    python3 tools/sprites/likeness.py composite <id> <sheet.jpg> <out.png> [--figures N]
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image

import spritekit as sk

ROOT = Path(__file__).resolve().parents[2]


def bust_head(bust_path: Path, view: str = "three_quarter") -> np.ndarray:
    """Head + neck (no shoulders) from the likeness bust."""
    img = sk.remove_background(sk.load_rgba(bust_path))
    boxes = sk.split_counts(img, [2])[0]
    fig = sk.crop_exact(img, boxes[1 if view == "three_quarter" else 0])
    a = fig[..., 3] >= sk.ALPHA_CUT
    widths = a.sum(1)
    # the shoulders start where the silhouette widens sharply below the neck
    top = int(np.where(widths > 0)[0].min())
    h = fig.shape[0]
    neck_band = range(int(h * 0.55), int(h * 0.85))
    neck_y = min(neck_band, key=lambda y: widths[y])
    cut = min(h, neck_y + int(h * 0.04))
    head = fig[top:cut].copy()
    return sk.drop_specks(head, keep_frac=0.3)


def head_box(figure: np.ndarray, frac: float = 0.135) -> tuple[int, int, float]:
    """(top, chin_y, centre_x) of a figure's head, using the top `frac` of its height."""
    a = figure[..., 3] >= sk.ALPHA_CUT
    rows = np.where(a.any(1))[0]
    top = int(rows.min())
    h = int(rows.max()) - top
    chin = top + int(h * frac)
    xs = np.where(a[top: chin].any(0))[0]
    band = a[top + int(h * 0.03): chin]
    cx = float(np.where(band.any(0))[0].mean()) if band.any() else float(xs.mean())
    return top, chin, cx


def paste_head(figure: np.ndarray, head: np.ndarray, frac: float = 0.135, size: float = 1.0) -> np.ndarray:
    """Replace a figure's head with `head`, scaled to the figure's head height x size."""
    top, chin, cx = head_box(figure, frac)
    out = figure.copy()
    # erase the old head (down to just under the chin, only in the head's column window)
    hh = chin - top
    x0, x1 = max(0, int(cx - 0.8 * hh)), min(out.shape[1], int(cx + 1.0 * hh))
    out[: chin + int(0.1 * hh), x0:x1, 3] = 0
    fx0, fx1 = int(cx + 0.25 * hh), min(out.shape[1], int(cx + 1.2 * hh))
    out[: chin + int(0.4 * hh), fx0:fx1, 3] = 0  # profile chins sit lower, in front of the neck
    target_h = (chin - top) * 1.18 * size
    hs = sk.resize_rgba(head, target_h / head.shape[0], Image.LANCZOS)
    canvas = Image.new("RGBA", (out.shape[1], out.shape[0] + int(target_h)), (0, 0, 0, 0))
    canvas.alpha_composite(sk.to_image(out), (0, int(target_h)))
    ox = int(cx - hs.shape[1] * 0.5)
    oy = int(target_h) + top - int(target_h * 0.02)
    canvas.alpha_composite(sk.to_image(hs), (max(0, ox), max(0, oy)))
    arr = np.array(canvas)
    return arr[int(target_h):] if oy >= int(target_h) else arr


def composite(char_id: str, sheet_path: Path, out_path: Path, figures: int = 4, size: float = 1.0) -> Path:
    char_dir = ROOT / "assets" / "fighters" / char_id
    spec = json.loads((char_dir / "spec.json").read_text())
    head = bust_head(char_dir / "source" / "likeness.jpg")
    sheet = sk.load_rgba(sheet_path)
    keyed = sk.remove_background(sheet)
    boxes = sk.split_counts(keyed, [figures])[0]
    canvas = Image.new("RGBA", (sheet.shape[1], sheet.shape[0]), (255, 0, 255, 255))
    for b in boxes:
        fig = keyed[b[1]: b[3], b[0]: b[2]].copy()
        new = paste_head(fig, head, spec.get("head_box_frac", 0.135), size * spec.get("head_scale", 1.0))
        canvas.alpha_composite(sk.to_image(new), (b[0], b[3] - new.shape[0]))
    canvas.convert("RGB").save(out_path)
    return out_path


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("cmd", choices=["composite"])
    p.add_argument("id")
    p.add_argument("sheet", type=Path)
    p.add_argument("out", type=Path)
    p.add_argument("--figures", type=int, default=4)
    p.add_argument("--size", type=float, default=1.0)
    a = p.parse_args()
    print(composite(a.id, a.sheet, a.out, a.figures, a.size))


if __name__ == "__main__":
    main()
