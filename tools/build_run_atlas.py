#!/usr/bin/env python3
"""
Build normalized run/idle atlases for the Frontier Showdown characters.

The generated source sheets (assets/frontier-*-run-*.png) are AI art: every frame has a slightly
different scale, anchor and padding, and the sheets disagree with each other. The browser used to
fit each frame/direction to the sprite box separately, which is where the size jumps and jitter
between left / right / up / down came from.

This tool normalizes the frames offline so the runtime can draw them with ONE scale and ONE pivot:

  * detached specks are removed,
  * every direction is scaled so the head (the one rigid part of the body) has the same width,
  * the torso centroid is pinned to the cell's horizontal centre and the support foot to a fixed
    ground line, so a frame never drifts relative to its neighbours.

Output (per skin): assets/frontier-<skin>-run-atlas.png + .json
  rows = down, up, left, right (run cycles, `frames` columns) followed by idle rows in the same order.

Usage: python3 tools/build_run_atlas.py [--debug-dir DIR]
Requires: numpy, scipy, pillow
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"

CELL = 256  # output cell size (px)
GROUND = 246  # y of the support-foot line inside a cell
ALPHA_MIN = 24
DIRECTIONS = ("down", "up", "left", "right")


# --------------------------------------------------------------------------- source description
# Each group names a source sheet, the grid, which cells make up the cycle (in play order) and
# whether the art faces the opposite way and has to be mirrored.
SKINS = {
    "dario": {
        "head_target": 84,
        "groups": {
            "down": {
                "sheet": "frontier-dario-run-source.png",
                "grid": (8, 4),
                "cells": [(c, 0) for c in range(8)],
            },
            "up": {
                "sheet": "frontier-dario-run-source.png",
                "grid": (8, 4),
                "cells": [(c, 1) for c in range(8)],
            },
            "right": {
                "sheet": "frontier-dario-direction-source.png",
                "grid": (4, 4),
                "cells": [(c, r) for r in (0, 1) for c in range(4)],
            },
            "left": {
                "sheet": "frontier-dario-direction-source.png",
                "grid": (4, 4),
                "cells": [(c, r) for r in (2, 3) for c in range(4)],
            },
        },
    },
    "sam": {
        "head_target": 84,
        # one generation pass drew every direction at the same scale, so keep it (side-view hair is
        # wider than the front view, matching head widths would shrink the profile body)
        "shared_scale": "down",
        "groups": {
            "down": {
                "sheet": "frontier-sam-run-source.png",
                "grid": (8, 4),
                "cells": [(c, 0) for c in range(8)],
            },
            "up": {
                "sheet": "frontier-sam-run-source.png",
                "grid": (8, 4),
                "cells": [(c, 1) for c in range(8)],
            },
            "right": {
                "sheet": "frontier-sam-run-source.png",
                "grid": (8, 4),
                "cells": [(c, 2) for c in range(8)],
            },
            "left": {
                "sheet": "frontier-sam-run-source.png",
                "grid": (8, 4),
                "cells": [(c, 3) for c in range(8)],
            },
        },
    },
}


# --------------------------------------------------------------------------- image helpers
def load_cells(
    sheet: str, grid: tuple[int, int], cells: list[tuple[int, int]]
) -> list[np.ndarray]:
    image = np.array(Image.open(ASSETS / sheet).convert("RGBA"))
    cols, rows = grid
    height, width = image.shape[:2]
    cw, ch = width / cols, height / rows
    out = []
    for col, row in cells:
        x0, x1 = round(col * cw), round((col + 1) * cw)
        y0, y1 = round(row * ch), round((row + 1) * ch)
        out.append(image[y0:y1, x0:x1].copy())
    return out


def clean(cell: np.ndarray) -> np.ndarray:
    """Drop detached specks (stray dashes / dots the generator leaves around the character)."""
    alpha = cell[..., 3] > ALPHA_MIN
    labels, count = ndi.label(alpha, structure=np.ones((3, 3)))
    if count <= 1:
        return cell
    sizes = ndi.sum(alpha, labels, range(1, count + 1))
    keep_ids = [i + 1 for i, size in enumerate(sizes) if size >= sizes.max() * 0.05]
    keep = np.isin(labels, keep_ids)
    cell = cell.copy()
    cell[~keep, 3] = 0
    return cell


def metrics(cell: np.ndarray) -> dict:
    alpha = cell[..., 3] > ALPHA_MIN
    ys = np.where(alpha)[0]
    top, bottom = int(ys.min()), int(ys.max())
    height = bottom - top + 1
    # head = widest silhouette row in the crown band (arms/hands never reach this high)
    band = alpha[top + int(height * 0.10) : top + int(height * 0.32)]
    head = 0
    for row in band:
        cols = np.where(row)[0]
        if len(cols):
            head = max(head, int(cols.max() - cols.min() + 1))
    # torso anchor = centroid of the head+torso band
    upper = alpha[top : top + int(height * 0.56)]
    ux = np.where(upper)[1]
    return {
        "top": top,
        "bottom": bottom,
        "height": height,
        "head": head,
        "cx": float(ux.mean()),
    }


def place(
    cell: np.ndarray, scale: float, cx: float, bottom: int, *, mirror: bool
) -> np.ndarray:
    """Scale a cleaned cell and paste it into a CELL x CELL canvas with the shared pivot."""
    image = Image.fromarray(cell, "RGBA")
    if mirror:
        image = image.transpose(Image.FLIP_LEFT_RIGHT)
        cx = cell.shape[1] - cx
    new_size = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
    image = image.resize(new_size, Image.LANCZOS)
    canvas = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    ox = round(CELL / 2 - cx * scale)
    oy = round(GROUND - (bottom + 1) * scale)
    canvas.alpha_composite(
        image, (max(0, ox), max(0, oy)), (max(0, -ox), max(0, -oy))
    ) if (ox < 0 or oy < 0) else canvas.alpha_composite(image, (ox, oy))
    return np.array(canvas)


# --------------------------------------------------------------------------- loop ordering
def best_cycle(masks: list[np.ndarray]) -> list[int]:
    """
    Order frames into the smoothest closed loop (frame 0 stays first).

    Frame distance = difference between lower-body silhouettes (the legs carry the run cycle).
    Nearest-neighbour start + 2-opt is plenty for <= 16 frames.
    """
    count = len(masks)
    small = []
    for mask in masks:
        im = Image.fromarray((mask * 255).astype(np.uint8)).resize(
            (32, 32), Image.BILINEAR
        )
        small.append(np.array(im, dtype=float) / 255.0)
    dist = np.array(
        [
            [np.abs(small[i] - small[j]).sum() for j in range(count)]
            for i in range(count)
        ]
    )

    def length(order: list[int]) -> float:
        return sum(dist[order[i], order[(i + 1) % count]] for i in range(count))

    order, left = [0], set(range(1, count))
    while left:
        nxt = min(left, key=lambda j: dist[order[-1], j])
        order.append(nxt)
        left.remove(nxt)
    improved = True
    while improved:
        improved = False
        for i in range(1, count - 1):
            for j in range(i + 1, count):
                candidate = order[:i] + order[i : j + 1][::-1] + order[j + 1 :]
                if length(candidate) + 1e-9 < length(order):
                    order, improved = candidate, True
    return order, dist


def resample_loop(order: list[int], dist: np.ndarray, count: int) -> list[int]:
    """
    Pick `count` frames spaced evenly in pose-space along the loop.

    The generator repeats near-identical stride poses; playing them all makes the cycle hang on the
    stride and then snap through the rest. Equal arc-length sampling gives even motion steps.
    """
    n = len(order)
    steps = [dist[order[i], order[(i + 1) % n]] for i in range(n)]
    position = [0.0]
    for step in steps[:-1]:
        position.append(position[-1] + step)
    total = sum(steps)
    picked, used = [], set()
    for k in range(count):
        target = total * k / count
        index = min(
            (i for i in range(n) if i not in used),
            key=lambda i: abs(position[i] - target),
        )
        used.add(index)
        picked.append(index)
    return [order[i] for i in sorted(picked)]


# --------------------------------------------------------------------------- build
def idle_frame(frames: list[np.ndarray]) -> np.ndarray:
    """
    Standing pose = the run frame with the narrowest lower body (legs together, "passing").

    The generator's separate standing sprites use different proportions (slimmer, smaller head), so
    swapping to them the moment the character stops made the character visibly change size. Reusing
    a run frame keeps proportions identical; the runtime adds a gentle breathing motion.
    """

    def spread(frame: np.ndarray) -> int:
        alpha = frame[GROUND - 70 : GROUND + 1, :, 3] > ALPHA_MIN
        cols = np.where(alpha.any(axis=0))[0]
        return int(cols.max() - cols.min()) if len(cols) else 10**6

    return min(frames, key=spread)


def build_skin(name: str, spec: dict, debug_dir: Path | None) -> None:
    chosen: dict[str, dict] = {}
    rows: dict[str, list[np.ndarray]] = {}
    # profile groups that mirror another one reuse its scale and frame order exactly
    for direction in sorted(
        DIRECTIONS, key=lambda d: bool(spec["groups"][d].get("like"))
    ):
        group = spec["groups"][direction]
        like = group.get("like")
        cells = [
            clean(c) for c in load_cells(group["sheet"], group["grid"], group["cells"])
        ]
        stats = [metrics(c) for c in cells]
        head = float(np.median([s["head"] for s in stats]))
        if like:
            scale = chosen[like]["scale"]
        elif spec.get("shared_scale") and direction != spec["shared_scale"]:
            scale = chosen[spec["shared_scale"]]["scale"]
        else:
            scale = spec["head_target"] / head
        placed = [
            place(c, scale, s["cx"], s["bottom"], mirror=group.get("mirror", False))
            for c, s in zip(cells, stats, strict=True)
        ]
        if like:
            order = chosen[like]["order"]
        elif group.get("resample"):
            masks = [
                (p[GROUND - 90 : GROUND + 2, :, 3] > ALPHA_MIN).astype(np.uint8)
                for p in placed
            ]
            order, dist = best_cycle(masks)
            order = resample_loop(order, dist, group["resample"])
        else:
            order = list(range(len(placed)))
        chosen[direction] = {
            "order": order,
            "head": head,
            "scale": round(scale, 4),
            "pool": len(placed),
        }
        rows[direction] = [placed[i] for i in order]
        if debug_dir:
            debug_dir.mkdir(parents=True, exist_ok=True)
            sheet = Image.new("RGBA", (CELL * len(placed), CELL), (112, 106, 90, 255))
            for i, frame in enumerate(placed):
                sheet.alpha_composite(Image.fromarray(frame, "RGBA"), (i * CELL, 0))
            sheet.save(debug_dir / f"{name}-{direction}-pool.png")
    idle_rows = {d: idle_frame(rows[d]) for d in DIRECTIONS}
    columns = max(len(frames) for frames in rows.values())
    atlas = Image.new(
        "RGBA", (CELL * columns, CELL * len(DIRECTIONS) * 2), (0, 0, 0, 0)
    )
    for row, direction in enumerate(DIRECTIONS):
        for col, frame in enumerate(rows[direction]):
            atlas.alpha_composite(
                Image.fromarray(frame, "RGBA"), (col * CELL, row * CELL)
            )
        atlas.alpha_composite(
            Image.fromarray(idle_rows[direction], "RGBA"),
            (0, (row + len(DIRECTIONS)) * CELL),
        )
    atlas.save(ASSETS / f"frontier-{name}-run-atlas.png", optimize=True)
    meta = {
        "cell": CELL,
        "ground": GROUND,
        "pivotX": CELL // 2,
        "columns": columns,
        "rows": list(DIRECTIONS),
        "idleRowOffset": len(DIRECTIONS),
        "counts": {direction: len(rows[direction]) for direction in DIRECTIONS},
        "headTarget": spec["head_target"],
        "source": chosen,
    }
    (ASSETS / f"frontier-{name}-run-atlas.json").write_text(json.dumps(meta, indent=2))
    print(name, {d: chosen[d]["order"] for d in DIRECTIONS})


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--debug-dir", type=Path)
    parser.add_argument("--skin", action="append")
    args = parser.parse_args()
    for name, spec in SKINS.items():
        if args.skin and name not in args.skin:
            continue
        build_skin(name, spec, args.debug_dir)


if __name__ == "__main__":
    main()
