"""
Walk and run: rig-posed guides, per-frame repaint prompts, and foot-locked assembly.

The kinematic rig (rig.py) owns timing, stride, contact frames and strideSpeed. For each frame it
renders a grey mannequin (generic cut-out parts in tools/sprites/mannequin/, blurred, blank head) as
a 1024x1024 pose guide. Image generation repaints each guide as one coherent drawing of the fighter,
with the model sheet as the second reference. Assembly then:

  * keys and crops each painted frame,
  * applies ONE scale for the whole cycle (median of rig height / painted height), so nothing pops,
  * registers each frame onto its rig pose: the planted foot's ground contact is moved onto the
    rig's planted foot (exact stride, no sliding); airborne frames match the rig silhouette,
  * snaps contact frames to the ground line and snaps to the fighter's palette.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

import cutout
import rig
import spritekit as sk

MANNEQUIN = Path(__file__).resolve().parent / "mannequin"
MANNEQUIN_SPEC = {
    "parts": {
        "sheets": {"body": "parts-body.jpg", "legs": "parts-legs.jpg"},
        "pieces": {
            "head": {"sheet": "body", "index": 0},
            "torso": {"sheet": "body", "index": 1, "crop": [0.1, 0, 0.9, 1]},
            "upper_arm": {"sheet": "body", "index": 2},
            "forearm": {"sheet": "body", "index": 3},
            "leg": {"sheet": "legs", "index": 0, "knee": 0.5},
            "shoe": {"sheet": "legs", "index": 2},
        },
    }
}
GUIDE_SIZE = 1024
GUIDE_H = 266  # cut-out height in guide units (x SS = 798 px figure in a 1024 guide)
GUIDE_CELL = 342
GUIDE_ANCHOR = (171, 326)

_pieces_cache: dict | None = None


def _pieces() -> dict:
    global _pieces_cache
    if _pieces_cache is None:
        _pieces_cache = cutout.load_pieces(MANNEQUIN, MANNEQUIN_SPEC)
    return _pieces_cache


def gait_for(spec: dict, name: str) -> rig.Gait:
    anim = spec["animations"][{"walk": "walk_fwd", "run": "run"}[name]]
    g = rig.GAITS[name](anim.get("frames", 10))
    for k, v in anim.get("gait", {}).items() if isinstance(anim.get("gait"), dict) else []:
        setattr(g, k, v)
    return g


# --------------------------------------------------------------------------- guides
def _hex(c: str) -> np.ndarray:
    return np.array([int(c[i:i + 2], 16) for i in (1, 3, 5)], np.float32)


def _tint(piece: cutout.Piece, color: str | None) -> cutout.Piece:
    """Recolour the low-saturation (cloth) pixels of a mannequin part; skin keeps its colour."""
    if not color:
        return piece
    img = piece.img.astype(np.float32)
    rgb = img[..., :3] / 255
    sat = rgb.max(-1) - rgb.min(-1)
    lum = rgb @ np.array([0.3, 0.59, 0.11], np.float32)
    cloth = sat < 0.22
    target = _hex(color)
    shade = np.clip(0.55 + (lum - lum[cloth].mean() if cloth.any() else 0) * 2.2, 0.25, 1.6)
    img[..., :3][cloth] = np.clip(target[None, :] * shade[cloth][:, None], 0, 255)
    return cutout.Piece(img.astype(np.uint8), tuple(piece.a), tuple(piece.b))


def _model_head(char_dir: Path, spec: dict) -> np.ndarray:
    """Head (crown to chin) of the neutral pose on the fighter's model sheet."""
    sheet = sk.remove_background(sk.load_rgba(char_dir / "source" / "model.jpg"))
    figure = sk.crop_exact(sheet, sk.split_counts(sheet, [4])[0][1])
    h = figure.shape[0]
    head = figure[: int(h * spec.get("head_frac", 0.16))].copy()
    return sk.drop_specks(head, keep_frac=0.3)


def render_guide(pose: dict, char_dir: Path, spec: dict) -> Image.Image:
    """
    Rough colour draft of the fighter in the rig pose: mannequin cut-out tinted to the costume
    (spec `guide.top/bottom/shoes`), the chest logo muted, and the fighter's own head from the model
    sheet pasted on. An image-like draft is followed far more closely by the repaint than a blank
    mannequin.
    """
    tint = spec.get("guide", {})
    groups = {"torso": "top", "upper_arm": "top", "forearm": "top", "thigh": "bottom", "shin": "bottom",
              "shoe": "shoes", "head": None}
    pieces = {k: _tint(v, tint.get(groups[k]) if groups[k] else None) for k, v in _pieces().items()}
    blank = pieces["head"].img.copy()
    blank[..., 3] = 0
    pieces["head"] = cutout.Piece(blank, tuple(pieces["head"].a), tuple(pieces["head"].b))
    crig = cutout.CutoutRig(pieces, GUIDE_H, GUIDE_CELL, GUIDE_ANCHOR)
    body, front = crig.render(pose)
    img = body.astype(np.float32)
    f = front.astype(np.float32)
    m = f[..., 3:4] / 255
    img = img * (1 - m) + f * m
    alpha = img[..., 3] / 255
    rgb = img[..., :3]
    # mute bright, unsaturated marks above the shoes (the mannequin's chest logo)
    yy = np.arange(rgb.shape[0])[:, None]
    above_shoes = yy < crig.anchor[1] - 0.09 * crig.H
    sat = rgb.max(-1) - rgb.min(-1)
    lum = rgb @ np.array([0.3, 0.59, 0.11], np.float32)
    logo = above_shoes & (sat < 40) & (lum > lum[alpha > 0.5].mean() + 60)
    logo = ndi.binary_dilation(logo, iterations=3) & (alpha > 0.5)
    if logo.any():
        ys, xs = np.where(logo)
        y0, y1, x0, x1 = max(0, ys.min() - 30), ys.max() + 30, max(0, xs.min() - 30), xs.max() + 30
        sub = rgb[y0:y1, x0:x1]
        blurred = np.stack([ndi.median_filter(sub[..., c], 25) for c in range(3)], -1)
        sub[logo[y0:y1, x0:x1]] = blurred[logo[y0:y1, x0:x1]]
    out = np.dstack([np.clip(rgb, 0, 255), alpha * 255]).astype(np.uint8)
    canvas = Image.new("RGBA", (GUIDE_SIZE, GUIDE_SIZE), (255, 0, 255, 255))
    canvas.alpha_composite(Image.fromarray(out[:GUIDE_SIZE, :GUIDE_SIZE], "RGBA"))
    head = _model_head(char_dir, spec)
    root = rig.lowest_point(pose) if pose["contact"] else 0.0
    nx, ny = crig._pt(pose["neck"], root)
    hx, hy = crig._pt(pose["head"], root)
    # true proportion: the crop is the top `head_frac` of the standing model, so it spans
    # head_frac * standing height; its crown sits on the rig's crown
    target_h = spec.get("head_frac", 0.16) * crig.H
    hs = sk.resize_rgba(head, target_h / head.shape[0], Image.LANCZOS)
    lean = np.degrees(np.arctan2(hx - nx, ny - hy)) * 0.6
    hs_img = sk.to_image(hs).rotate(-lean, resample=Image.BICUBIC, expand=True)
    crown_y = hy - rig.HEAD_R * crig.H * 1.15
    canvas.alpha_composite(hs_img, (int(hx - hs_img.width * 0.55), int(crown_y)))
    return canvas.convert("RGB")


def write_guides(char_dir: Path, spec: dict, gait_name: str, out_dir: Path) -> list[Path]:
    g = gait_for(spec, gait_name)
    out_dir.mkdir(parents=True, exist_ok=True)
    paths = []
    for i, p in enumerate(rig.cycle(g)):
        path = out_dir / f"{gait_name}-{i:02d}.png"
        render_guide(p, char_dir, spec).save(path)
        paths.append(path)
    return paths


def frame_prompt(spec: dict, gait_name: str, index: int) -> str:
    """
    Edit-style prompt. Naming the action ("sprint", "contact frame") makes the image model fall back
    to a stock pose; asking it to edit the draft in place without moving anything keeps the rig pose.
    """
    g = gait_for(spec, gait_name)
    airborne = not rig.cycle(g)[index]["contact"]
    feet = "Both feet are in the air." if airborne else "The same foot touches the bottom."
    return (
        "Edit the FIRST image. It is a rough paper cut-out of a man; turn it into a finished, seamless "
        "semi-realistic digitized pixel-art sprite (like Mortal Kombat II) of the man shown in the SECOND image, "
        f"keeping the same face, hair and clothes as the SECOND image ({spec['outfit']}). DO NOT MOVE ANYTHING: "
        "the head, torso, both arms, both hands, both legs and both feet must stay exactly where they are in the "
        f"FIRST image, at the same angles, the same size and the same place in the frame. {feet} Only repaint "
        "the surfaces: join the cut-out pieces into one natural body, add realistic cloth folds where the knees "
        "and elbows bend, correct foreshortening of the shoes, photographic shading lit from the top left, the "
        "far-side limbs darker, no logo or emblem on the clothes. Keep the flat magenta background, no floor, no shadow, no text."
    )


# --------------------------------------------------------------------------- assembly
def _rig_frames(gait: rig.Gait, height: float, cell: int, anchor: tuple[int, int]) -> list[np.ndarray]:
    crig = cutout.CutoutRig(_pieces(), height, cell, anchor)
    return [crig.frame(p) for p in rig.cycle(gait)]


def _contact_x(frame: np.ndarray, ground: int, band: int = 5) -> float | None:
    a = frame[ground - band + 1: ground + 1, :, 3] >= sk.ALPHA_CUT
    xs = np.where(a.any(0))[0]
    return float(xs.mean()) if len(xs) >= 3 else None


def _stance_contact_x(frame: np.ndarray, ground: int, foot_x: float, band: int = 5) -> float | None:
    """x centroid of the ground-contact blob nearest the rig's stance foot."""
    a = frame[ground - band + 1: ground + 1, :, 3] >= sk.ALPHA_CUT
    cols = a.any(0)
    labels, n = ndi.label(cols)
    if n == 0:
        return None
    best, best_d = None, 1e9
    for k in range(1, n + 1):
        xs = np.where(labels == k)[0]
        if len(xs) < 3:
            continue
        d = abs(xs.mean() - foot_x)
        if d < best_d:
            best, best_d = float(xs.mean()), d
    return best


def _best_shift(src: np.ndarray, ref: np.ndarray, search: int = 24) -> tuple[int, int]:
    """Translation of src that best overlaps ref (alpha IoU), coarse-to-fine."""
    a = src[..., 3] >= sk.ALPHA_CUT
    b = ref[..., 3] >= sk.ALPHA_CUT
    best, best_s = (0, 0), -1.0
    for dy in range(-search, search + 1, 2):
        for dx in range(-search, search + 1, 2):
            s = (np.roll(np.roll(a, dy, 0), dx, 1) & b).sum()
            if s > best_s:
                best, best_s = (dx, dy), s
    bx, by = best
    for dy in range(by - 1, by + 2):
        for dx in range(bx - 1, bx + 2):
            s = (np.roll(np.roll(a, dy, 0), dx, 1) & b).sum()
            if s > best_s:
                best, best_s = (dx, dy), s
    return best


def _shift(img: np.ndarray, dx: int, dy: int) -> np.ndarray:
    out = np.zeros_like(img)
    h, w = img.shape[:2]
    ys, yd = (slice(0, h - dy), slice(dy, h)) if dy >= 0 else (slice(-dy, h), slice(0, h + dy))
    xs, xd = (slice(0, w - dx), slice(dx, w)) if dx >= 0 else (slice(-dx, w), slice(0, w + dx))
    out[yd, xd] = img[ys, xs]
    return out


def head_width(img: np.ndarray, ref_h: float | None = None, frac=(0.025, 0.075)) -> float:
    """
    Width of the head (hair + face) just below the crown: the widest opaque run that contains the
    crown column, measured over a band of the figure height. Arms and fists beside the head are
    separate runs, so they don't count. The head is the one rigid part, so its width fixes scale.
    """
    a = img[..., 3] >= sk.ALPHA_CUT
    rows = np.where(a.any(1))[0]
    top, bottom = rows.min(), rows.max()
    h = ref_h or (bottom - top)
    crown_x = int(np.where(a[top + 2])[0].mean())
    widths = []
    for y in range(top + int(h * frac[0]), top + int(h * frac[1]) + 1):
        row = a[y]
        if not row[crown_x]:
            continue
        l = crown_x
        while l > 0 and row[l - 1]:
            l -= 1
        r = crown_x
        while r < len(row) - 1 and row[r + 1]:
            r += 1
        widths.append(r - l + 1)
    return float(np.median(widths)) if widths else 0.0


def _fit_leg_length(img: np.ndarray, target_h: int, waist: float = 0.45, limit: float = 0.12) -> np.ndarray:
    """
    The repaint keeps limb angles but not body height (it adds knee bend or straightens a leg), which
    shows up as a jumpy bob. The head is rigid and already scaled, so only the region below the
    waist is resampled vertically until the figure is as tall as the rig pose (within +-limit).
    """
    h = img.shape[0]
    cut = int(h * waist)
    lower_h = h - cut
    want = int(round(np.clip(target_h - cut, lower_h * (1 - limit), lower_h * (1 + limit))))
    if want == lower_h:
        return img
    pil = sk.to_image(img[cut:]).resize((img.shape[1], want), Image.LANCZOS)
    lower = sk.binarize(np.array(pil))
    return np.concatenate([img[:cut], lower], axis=0)


def assemble(painted: list[np.ndarray], spec: dict, gait_name: str, cell: int, anchor: tuple[int, int],
             palette: np.ndarray | None, head_px: float) -> tuple[list[np.ndarray], dict]:
    """
    Normalise repainted frames (keyed RGBA crops) onto the rig cycle. `head_px` is the fighter's
    head width at game scale (from the model sheet); every frame is scaled so its head matches it,
    which keeps the fighter one size even when the repaint drew a frame larger or smaller.
    """
    g = gait_for(spec, gait_name)
    height = spec["height"]
    poses = rig.cycle(g)
    rig_frames = _rig_frames(g, height, cell, anchor)
    ref_h = float(np.median([p.shape[0] for p in painted])) * 1.1
    heads = [head_width(p, ref_h) for p in painted]
    raw = np.array([head_px / max(h, 1.0) for h in heads])
    med = float(np.median(raw))
    frame_scales = np.clip(raw, med * 0.94, med * 1.06)
    ground = anchor[1]
    out = []
    shifts = []
    for i, (src, ref, pose) in enumerate(zip(painted, rig_frames, poses)):
        rb = sk.bbox(ref)
        small = sk.binarize(sk.resize_rgba(src, float(frame_scales[i]), Image.BOX))
        if pose["contact"]:
            small = _fit_leg_length(small, rb[3] - rb[1])
        canvas = sk.place_in_cell(small, cell, ((rb[0] + rb[2]) // 2, rb[3]),
                                  (small.shape[1] / 2, small.shape[0]))
        dx, dy = _best_shift(canvas, ref, search=20)
        canvas = _shift(canvas, dx, dy)
        if pose["contact"]:
            # lock the planted foot onto the rig's planted foot and the sole onto the ground
            stance = pose["legs"][pose["contact"][0]]
            crig_pt_x = anchor[0] + (stance["heel"][0] + stance["toe"][0]) / 2 * height
            ddy = ground - (sk.bbox(canvas)[3] - 1)
            canvas = _shift(canvas, 0, ddy)
            fx = _stance_contact_x(canvas, ground, crig_pt_x)
            rx = _stance_contact_x(ref, ground, crig_pt_x)
            ddx = int(round(rx - fx)) if (fx is not None and rx is not None) else 0
            if abs(ddx) > 24:
                ddx = 0
            canvas = _shift(canvas, ddx, 0)
            dx, dy = dx + ddx, dy + ddy
        shifts.append([dx, dy])
        out.append(canvas)
    # airborne frames have no ground to pin to: put them at the top of the bob, just above the
    # highest ground-contact frame, so the centre of mass peaks in flight
    contact_tops = [sk.bbox(f)[1] for f, p in zip(out, poses) if p["contact"]]
    for i, p in enumerate(poses):
        if not p["contact"] and contact_tops:
            lift = (min(contact_tops) - 2) - sk.bbox(out[i])[1]
            out[i] = _shift(out[i], 0, lift)
            shifts[i][1] += lift
    if palette is not None:
        out = [sk.outline(sk.apply_palette(f, palette), palette) for f in out]
    return out, {"scale": round(med, 4), "frameScales": [round(float(x), 4) for x in frame_scales],
                 "heads": heads, "shifts": shifts,
                 "rigStrideSpeed": round(rig.stance_speed(g) * height, 1), "fps": g.fps}
