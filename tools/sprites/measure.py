"""
Measurements on normalised cells: stride speed from the planted foot, centre-of-mass bob, and
scale / registration stability. Used for the atlas `strideSpeed`, the QA report and previews.
"""

from __future__ import annotations

import numpy as np

import spritekit as sk


def contact_band(frame: np.ndarray, ground: int, band: int = 4) -> np.ndarray:
    return frame[ground - band + 1: ground + 1, :, 3] >= sk.ALPHA_CUT


def planted_shift(a: np.ndarray, b: np.ndarray, ground: int, max_shift: int = 40) -> tuple[int, float] | None:
    """
    How far the planted foot moved backward (px, positive = toward -x) between frames a -> b.
    Searches the shift that best overlays a's ground-contact pixels onto b's.
    """
    ba, bb = contact_band(a, ground), contact_band(b, ground)
    if ba.sum() < 6 or bb.sum() < 6:
        return None
    best, best_score = None, -1.0
    for d in range(0, max_shift + 1):
        shifted = np.zeros_like(ba)
        shifted[:, : ba.shape[1] - d] = ba[:, d:]
        inter = (shifted & bb).sum()
        score = inter / max(1, min(shifted.sum(), bb.sum()))
        if score > best_score + 1e-6:
            best, best_score = d, score
    return best, float(best_score)


def stride_speed(frames: list[np.ndarray], fps: float, ground: int) -> dict:
    shifts = []
    for i in range(len(frames)):
        r = planted_shift(frames[i], frames[(i + 1) % len(frames)], ground)
        if r and r[1] > 0.6:
            shifts.append(r[0])
    if not shifts:
        return {"strideSpeed": 0.0, "shifts": []}
    return {"strideSpeed": float(np.median(shifts) * fps), "shifts": shifts}


def top_y(frame: np.ndarray) -> int:
    rows = np.where((frame[..., 3] >= sk.ALPHA_CUT).any(axis=1))[0]
    return int(rows.min()) if len(rows) else -1


def upper_centroid_y(frame: np.ndarray, frac: float = 0.45) -> float:
    a = frame[..., 3] >= sk.ALPHA_CUT
    rows = np.where(a.any(axis=1))[0]
    if not len(rows):
        return 0.0
    top, bot = rows.min(), rows.max()
    cut = top + int((bot - top) * frac)
    ys, _ = np.where(a[top:cut])
    return float(ys.mean() + top)


def head_width(frame: np.ndarray) -> int:
    a = frame[..., 3] >= sk.ALPHA_CUT
    rows = np.where(a.any(axis=1))[0]
    if not len(rows):
        return 0
    top = rows.min()
    widths = []
    for y in range(top + 4, top + 22):
        xs = np.where(a[y])[0]
        if len(xs):
            widths.append(xs.max() - xs.min() + 1)
    return int(np.median(widths)) if widths else 0


def report(frames: list[np.ndarray], fps: float, ground: int) -> dict:
    tops = [top_y(f) for f in frames]
    cy = [round(upper_centroid_y(f), 1) for f in frames]
    hw = [head_width(f) for f in frames]
    out = {
        "frames": len(frames),
        "headTop": tops,
        "bobPx": int(max(tops) - min(tops)) if tops else 0,
        "upperCentroidY": cy,
        "headWidth": hw,
        "headWidthSpread": int(max(hw) - min(hw)) if hw else 0,
    }
    out.update(stride_speed(frames, fps, ground))
    return out
