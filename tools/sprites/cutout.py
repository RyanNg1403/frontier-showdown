"""
Cut-out (paper-doll) renderer for locomotion.

Image generation is good at single poses but cannot draw consistent in-between frames, so walk and
run are built from generated body PARTS posed by the kinematic rig (rig.py): exact contact / down /
passing / up poses, counter-swing, bob and a known stride, with zero detail flicker between frames.

Parts are rendered at SS x the final resolution with premultiplied affine transforms, then area-
downsampled to the 256 px cell, palette-snapped and outlined like every other frame.
"""

from __future__ import annotations

import math
from pathlib import Path

import numpy as np
from PIL import Image

import rig
import spritekit as sk

SS = 3  # supersampling factor for rendering


# --------------------------------------------------------------------------- parts
class Piece:
    """A body part image with two pivots (a = proximal joint, b = distal end) in local pixels."""

    def __init__(self, img: np.ndarray, a: tuple[float, float], b: tuple[float, float]):
        self.img = img
        self.a = np.array(a, np.float32)
        self.b = np.array(b, np.float32)

    def scaled(self, length_px: float) -> "Piece":
        cur = float(np.linalg.norm(self.b - self.a))
        s = length_px / max(cur, 1e-3)
        img = sk.resize_rgba(self.img, s, Image.BICUBIC)
        sy = img.shape[0] / self.img.shape[0]
        sx = img.shape[1] / self.img.shape[1]
        return Piece(img, (self.a[0] * sx, self.a[1] * sy), (self.b[0] * sx, self.b[1] * sy))

    def darker(self, k: float, tint=(0.0, 0.0, 0.0)) -> "Piece":
        img = self.img.astype(np.float32)
        img[..., :3] = img[..., :3] * k + np.array(tint) * 255
        return Piece(np.clip(img, 0, 255).astype(np.uint8), tuple(self.a), tuple(self.b))


def _row_center(img: np.ndarray, y: int) -> float:
    a = img[max(0, min(img.shape[0] - 1, y)), :, 3] >= sk.ALPHA_CUT
    xs = np.where(a)[0]
    return float(xs.mean()) if len(xs) else img.shape[1] / 2


def _width_at(img: np.ndarray, y: int) -> int:
    a = img[max(0, min(img.shape[0] - 1, y)), :, 3] >= sk.ALPHA_CUT
    xs = np.where(a)[0]
    return int(xs.max() - xs.min() + 1) if len(xs) else 0


def limb_piece(img: np.ndarray, top_inset: float = 0.5, bottom_inset: float = 0.5,
               bottom_y: float | None = None) -> Piece:
    """Vertical limb: pivots sit half a limb-width in from each end (the joint circles)."""
    h = img.shape[0]
    wt = _width_at(img, int(h * 0.06))
    wb = _width_at(img, int(h * 0.94))
    ya = min(h * 0.3, wt * top_inset)
    yb = bottom_y if bottom_y is not None else max(h * 0.7, h - wb * bottom_inset)
    return Piece(img, (_row_center(img, int(ya)), ya), (_row_center(img, int(yb)), yb))


def round_end(img: np.ndarray, y: float, cx: float, r: float, keep: str) -> np.ndarray:
    """Cut a limb at y with a semicircular cap (keep='above' keeps the top part)."""
    h, w = img.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    inside = (xx - cx) ** 2 + (yy - y) ** 2 <= r * r
    if keep == "above":
        mask = (yy <= y) | inside
    else:
        mask = (yy >= y) | inside
    out = img.copy()
    out[~mask, 3] = 0
    return out


def split_leg(img: np.ndarray, knee_frac: float = 0.5) -> tuple[Piece, Piece]:
    h = img.shape[0]
    ky = h * knee_frac
    kx = _row_center(img, int(ky))
    r = _width_at(img, int(ky)) * 0.5
    thigh_img = round_end(img, ky, kx, r, "above")
    shin_img = round_end(img, ky, kx, r, "below")
    thigh = limb_piece(thigh_img, bottom_y=ky)
    shin_top = sk.bbox(shin_img)[1]
    shin = Piece(shin_img, (kx, ky), (_row_center(img, h - 3), h - 2))
    del shin_top
    return thigh, shin


def head_piece(img: np.ndarray) -> Piece:
    """Pivot a = bottom of the neck, b = crown."""
    bb = sk.bbox(img)
    x0, y0, x1, y1 = bb
    neck_x = _row_center(img, y1 - 3)
    return Piece(img, (neck_x, y1 - 2), (neck_x - (x1 - x0) * 0.06, y0))


def torso_piece(img: np.ndarray) -> Piece:
    """Pivot a = centre of the hem, b = centre of the collar."""
    x0, y0, x1, y1 = sk.bbox(img)
    return Piece(img, ((x0 + x1) / 2, y1 - 2), ((x0 + x1) / 2, y0 + 2))


def shoe_piece(img: np.ndarray, heel_frac: float = 0.24) -> Piece:
    """Pivot a = ankle (above the heel), b = toe along the sole."""
    x0, y0, x1, y1 = sk.bbox(img)
    length = x1 - x0
    ankle = (x0 + length * heel_frac, y0 + (y1 - y0) * 0.28)
    return Piece(img, ankle, (x1 - 2, ankle[1]))


# --------------------------------------------------------------------------- compositing
def _paste(canvas_pre: np.ndarray, piece: Piece, at: tuple[float, float], direction: tuple[float, float],
           axis: tuple[float, float]) -> None:
    """Rotate `piece` about its pivot a so that its local `axis` points along `direction`."""
    h, w = canvas_pre.shape[:2]
    phi = math.atan2(direction[1], direction[0]) - math.atan2(axis[1], axis[0])
    c, s = math.cos(phi), math.sin(phi)
    ax, ay = at
    px, py = piece.a
    data = (c, s, -c * ax - s * ay + px, -s, c, s * ax - c * ay + py)
    src = piece.img.astype(np.float32)
    al = src[..., 3:4] / 255.0
    pre = np.concatenate([src[..., :3] * al, al * 255.0], -1)
    chans = [np.array(Image.fromarray(pre[..., i]).transform((w, h), Image.AFFINE, data, Image.BICUBIC))
             for i in range(4)]
    layer = np.clip(np.stack(chans, -1), 0, 255)
    la = layer[..., 3:4] / 255.0
    canvas_pre *= 1 - la
    canvas_pre += layer


def _unpremultiply(pre: np.ndarray) -> np.ndarray:
    a = pre[..., 3:4]
    rgb = pre[..., :3] / np.maximum(a / 255.0, 1e-4)
    return np.dstack([np.clip(rgb, 0, 255), np.clip(a, 0, 255)]).astype(np.uint8)


class CutoutRig:
    def __init__(self, pieces: dict[str, Piece], height_px: float, cell: int, anchor: tuple[int, int],
                 tune: dict | None = None):
        tune = tune or {}
        self.H = height_px * SS
        self.cell = cell * SS
        self.anchor = (anchor[0] * SS, anchor[1] * SS)
        H = self.H
        L = {
            "thigh": rig.THIGH * H * tune.get("thigh", 1.0),
            "shin": (rig.SHIN + rig.ANKLE_H * 0.55) * H * tune.get("shin", 1.0),
            "upper_arm": rig.UPPER_ARM * H * 1.08 * tune.get("upper_arm", 1.0),
            "forearm": (rig.FOREARM + rig.HAND * 0.9) * H * tune.get("forearm", 1.0),
            "head": (rig.NECK + 2 * rig.HEAD_R + 0.008) * H * tune.get("head", 1.0),
            "torso": (rig.TORSO + 0.045) * H * tune.get("torso", 1.0),
            "shoe": (rig.FOOT - rig.HEEL * 0.4) * H * tune.get("shoe", 1.0),
        }
        far_k = tune.get("far_shade", 0.62)
        far_tint = tuple(tune.get("far_tint", (0.0, 0.01, 0.045)))
        self.near = {k: pieces[k].scaled(L[k]) for k in L}
        self.far = {k: v.darker(far_k, far_tint) for k, v in self.near.items()}
        self.lit = {k: v.darker(tune.get("near_arm_light", 1.14)) for k, v in self.near.items()}

    def _pt(self, q: tuple[float, float], root_y: float) -> tuple[float, float]:
        return self.anchor[0] + q[0] * self.H, self.anchor[1] - (q[1] - root_y) * self.H

    def render(self, pose: dict) -> tuple[np.ndarray, np.ndarray]:
        """Returns (body, near_arm) supersampled layers; the near arm is kept separate so it can
        get its own internal outline against the torso after pixelizing."""
        root = rig.lowest_point(pose) if pose["contact"] else 0.0
        pt = lambda q: self._pt(q, root)  # noqa: E731
        body = np.zeros((self.cell, self.cell, 4), np.float32)
        front = np.zeros_like(body)
        canvas = body

        def bone(set_, name, a, b, axis=(0.0, 1.0)):
            pa, pb = pt(a), pt(b)
            _paste(canvas, set_[name], pa, (pb[0] - pa[0], pb[1] - pa[1]), axis)

        def leg(set_, lg):
            bone(set_, "shoe", lg["ankle"], (lg["ankle"][0] + (lg["toe"][0] - lg["heel"][0]),
                                             lg["ankle"][1] + (lg["toe"][1] - lg["heel"][1])), axis=(1.0, 0.0))
            bone(set_, "shin", lg["knee"], lg["ankle"])
            bone(set_, "thigh", lg["hip"], lg["knee"])

        def arm(set_, am):
            bone(set_, "forearm", am["elbow"], am["wrist"])
            bone(set_, "upper_arm", am["shoulder"], am["elbow"])

        legs, arms = pose["legs"], pose["arms"]
        arm(self.far, arms["far"])
        leg(self.far, legs["far"])
        leg(self.near, legs["near"])
        torso_base = (pose["pelvis"][0], pose["pelvis"][1] - 0.03)
        bone(self.near, "torso", torso_base, pose["neck"], axis=(0.0, -1.0))
        neck_base = (pose["neck"][0], pose["neck"][1] - 0.012)
        bone(self.near, "head", neck_base, pose["head"], axis=(0.0, -1.0))
        canvas = front
        arm(self.lit, arms["near"])
        return _unpremultiply(body), _unpremultiply(front)

    def frame(self, pose: dict, palette: np.ndarray | None = None) -> np.ndarray:
        body, front = (sk.pixelize(x, SS) for x in self.render(pose))
        if palette is not None:
            body, front = sk.apply_palette(body, palette), sk.apply_palette(front, palette)
            front = sk.outline(front, palette, strength=0.45)
        out = body.copy()
        m = front[..., 3] > 0
        out[m] = front[m]
        return out


def render_cycle(crig: CutoutRig, gait: rig.Gait, palette: np.ndarray | None = None) -> list[np.ndarray]:
    return [crig.frame(p, palette) for p in rig.cycle(gait)]


def load_pieces(char_dir: Path, spec: dict) -> dict[str, Piece]:
    """Slice the parts sheets named in spec['parts'] into rig pieces."""
    parts = spec["parts"]
    sheets: dict[str, list[np.ndarray]] = {}
    for key, rel in parts["sheets"].items():
        img = sk.remove_background(sk.load_rgba(char_dir / rel))
        boxes = sk.split_blobs(img, merge=parts.get("merge", 4), min_area=800)
        sheets[key] = [sk.crop(img, b, pad=2) for b in boxes]

    def get(name: str) -> np.ndarray:
        ref = parts["pieces"][name]
        img = sheets[ref["sheet"]][ref["index"]]
        if ref.get("flip"):
            img = img[:, ::-1].copy()
        if "crop" in ref:  # fractional crop (x0, y0, x1, y1) of the blob
            h, w = img.shape[:2]
            x0, y0, x1, y1 = ref["crop"]
            img = img[int(y0 * h): int(y1 * h), int(x0 * w): int(x1 * w)].copy()
        return img

    thigh, shin = split_leg(get("leg"), parts["pieces"]["leg"].get("knee", 0.5))
    return {
        "head": head_piece(get("head")),
        "torso": torso_piece(get("torso")),
        "upper_arm": limb_piece(get("upper_arm")),
        "forearm": limb_piece(get("forearm"), bottom_inset=0.25),
        "thigh": thigh,
        "shin": shin,
        "shoe": shoe_piece(get("shoe")),
    }
