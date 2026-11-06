"""
Shared image operations for the fighter sprite pipeline.

Generated sources are 1280x720 JPEGs on a flat chroma background (magenta by default). Everything
here works on RGBA numpy arrays (uint8, HxWx4).
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from scipy.spatial import cKDTree

ALPHA_CUT = 128


def load_rgba(path: Path | str) -> np.ndarray:
    return np.array(Image.open(path).convert("RGBA"))


def to_image(arr: np.ndarray) -> Image.Image:
    return Image.fromarray(arr.astype(np.uint8), "RGBA")


# --------------------------------------------------------------------------- background removal
def remove_background(img: np.ndarray, tol: float = 70.0, fringe: float = 130.0) -> np.ndarray:
    """
    Key out the flat background: estimate its colour from the border, flood-fill every pixel within
    `tol` that is connected to the border, then drop a thin fringe of pixels still close to the key
    colour (JPEG halo). Interior pixels of similar colour that are enclosed by outline survive.
    """
    rgb = img[..., :3].astype(np.float32)
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    key = np.median(border, axis=0)
    dist = np.sqrt(((rgb - key) ** 2).sum(-1))
    near = dist < tol
    labels, _ = ndi.label(near)
    edge_ids = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    bg = np.isin(labels, edge_ids[edge_ids > 0])
    # enclosed holes (between an arm and the torso) are background too: the key colour never
    # appears in costumes, so any sizeable key-coloured island goes
    hole_ids = [i for i, s in enumerate(ndi.sum(near, labels, range(1, labels.max() + 1)), 1) if s >= 12]
    bg |= np.isin(labels, hole_ids) & (dist < tol * 0.85)
    # fringe: within 2 px of the background and still key-tinted
    ring = ndi.binary_dilation(bg, iterations=2) & ~bg & (dist < fringe)
    bg |= ring
    out = img.copy()
    out[..., 3] = np.where(bg, 0, 255).astype(np.uint8)
    # de-spill the remaining edge: pull key colour out of pixels next to the background
    edge = ndi.binary_dilation(bg, iterations=1) & ~bg
    if edge.any():
        px = rgb[edge]
        k = key / (np.linalg.norm(key) + 1e-6)
        proj = np.clip((px @ k)[:, None] * k[None, :] * 0.35, 0, None)
        out[..., :3][edge] = np.clip(px - proj, 0, 255).astype(np.uint8)
    return out


def drop_specks(img: np.ndarray, keep_frac: float = 0.04, min_px: int = 30) -> np.ndarray:
    alpha = img[..., 3] >= ALPHA_CUT
    labels, n = ndi.label(alpha, structure=np.ones((3, 3)))
    if n <= 1:
        return img
    sizes = ndi.sum(alpha, labels, range(1, n + 1))
    keep = [i + 1 for i, s in enumerate(sizes) if s >= max(min_px, sizes.max() * keep_frac)]
    out = img.copy()
    out[~np.isin(labels, keep), 3] = 0
    return out


# --------------------------------------------------------------------------- frame splitting
def split_blobs(img: np.ndarray, merge: int = 10, min_area: int = 1500,
                rows: int | None = None) -> list[tuple[int, int, int, int]]:
    """
    Find sprite bounding boxes (x0, y0, x1, y1) on a keyed sheet. Nearby parts (a detached fist,
    a hair tuft) are merged by dilating `merge` px. Boxes are returned in reading order: grouped
    into `rows` bands by vertical centre (auto when None), then left to right.
    """
    alpha = img[..., 3] >= ALPHA_CUT
    grown = ndi.binary_dilation(alpha, iterations=merge)
    labels, n = ndi.label(grown)
    boxes = []
    for sl in ndi.find_objects(labels):
        ys, xs = sl
        sub = alpha[sl]
        if sub.sum() < min_area:
            continue
        yy, xx = np.where(sub)
        boxes.append((xs.start + xx.min(), ys.start + yy.min(), xs.start + xx.max() + 1, ys.start + yy.max() + 1))
    if not boxes:
        return []
    cy = np.array([(b[1] + b[3]) / 2 for b in boxes])
    if rows is None:
        order = np.argsort(cy)
        bands, current = [], [order[0]]
        hs = np.median([b[3] - b[1] for b in boxes])
        for i in order[1:]:
            if cy[i] - cy[current[-1]] > hs * 0.5:
                bands.append(current)
                current = [i]
            else:
                current.append(i)
        bands.append(current)
    else:
        edges = np.linspace(0, img.shape[0], rows + 1)
        bands = [[i for i in range(len(boxes)) if edges[r] <= cy[i] < edges[r + 1]] for r in range(rows)]
    out = []
    for band in bands:
        out += sorted((boxes[i] for i in band), key=lambda b: b[0])
    return out


def _best_cut(profile: np.ndarray, lo: int, hi: int, guess: float) -> int:
    """Column/row in [lo, hi) with the least ink, ties broken toward `guess`."""
    lo, hi = max(lo, 1), min(hi, len(profile) - 1)
    seg = profile[lo:hi].astype(np.float64)
    idx = np.arange(lo, hi)
    score = seg + np.abs(idx - guess) * 1e-3
    return int(idx[np.argmin(score)])


def split_counts(img: np.ndarray, counts: list[int]) -> list[list[tuple[int, int, int, int]]]:
    """
    Split a keyed sheet into rows of known frame counts. Row and column cuts go through the
    emptiest scanlines near the evenly spaced positions, so touching neighbours still separate.
    """
    alpha = img[..., 3] >= ALPHA_CUT
    h, w = alpha.shape
    rows_prof = ndi.uniform_filter1d(alpha.sum(1).astype(float), 5)
    ys = [0]
    for r in range(1, len(counts)):
        g = h * r / len(counts)
        ys.append(_best_cut(rows_prof, int(g - h * 0.18), int(g + h * 0.18), g))
    ys.append(h)
    out = []
    for r, n in enumerate(counts):
        band = alpha[ys[r]: ys[r + 1]]
        cols = np.where(band.any(0))[0]
        if not len(cols):
            out.append([])
            continue
        x0, x1 = cols.min(), cols.max() + 1
        prof = ndi.uniform_filter1d(band.sum(0).astype(float), 3)
        step = (x1 - x0) / n
        xs = [x0]
        for k in range(1, n):
            g = x0 + step * k
            xs.append(_best_cut(prof, int(g - step * 0.42), int(g + step * 0.42), g))
        xs.append(x1)
        boxes = []
        for k in range(n):
            sub = band[:, xs[k]: xs[k + 1]]
            if not sub.any():
                continue
            yy, xx = np.where(sub)
            boxes.append((xs[k] + xx.min(), ys[r] + yy.min(), xs[k] + xx.max() + 1, ys[r] + yy.max() + 1))
        out.append(boxes)
    return out


def crop_exact(img: np.ndarray, box: tuple[int, int, int, int]) -> np.ndarray:
    """Crop without letting neighbouring frames in: pixels outside the box are not included."""
    x0, y0, x1, y1 = box
    return drop_specks(img[y0:y1, x0:x1].copy(), keep_frac=0.02)


def split_grid(img: np.ndarray, cols: int, rows: int) -> list[tuple[int, int, int, int]]:
    """Fixed grid cells, each shrunk to its opaque content."""
    h, w = img.shape[:2]
    out = []
    for r in range(rows):
        for c in range(cols):
            x0, x1 = round(c * w / cols), round((c + 1) * w / cols)
            y0, y1 = round(r * h / rows), round((r + 1) * h / rows)
            a = img[y0:y1, x0:x1, 3] >= ALPHA_CUT
            if not a.any():
                continue
            yy, xx = np.where(a)
            out.append((x0 + xx.min(), y0 + yy.min(), x0 + xx.max() + 1, y0 + yy.max() + 1))
    return out


def crop(img: np.ndarray, box: tuple[int, int, int, int], pad: int = 0) -> np.ndarray:
    x0, y0, x1, y1 = box
    h, w = img.shape[:2]
    x0, y0, x1, y1 = max(0, x0 - pad), max(0, y0 - pad), min(w, x1 + pad), min(h, y1 + pad)
    out = img[y0:y1, x0:x1].copy()
    # keep only what belongs to the dominant blob in this box (neighbouring frames can intrude)
    return drop_specks(out, keep_frac=0.02)


def bbox(img: np.ndarray) -> tuple[int, int, int, int] | None:
    a = img[..., 3] >= ALPHA_CUT
    if not a.any():
        return None
    yy, xx = np.where(a)
    return int(xx.min()), int(yy.min()), int(xx.max()) + 1, int(yy.max()) + 1


# --------------------------------------------------------------------------- resampling
def resize_rgba(img: np.ndarray, scale: float, resample=Image.LANCZOS) -> np.ndarray:
    """Premultiplied-alpha resize, so transparent pixels never bleed colour into edges."""
    h, w = img.shape[:2]
    nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
    a = img[..., 3:4].astype(np.float32) / 255.0
    pre = np.concatenate([img[..., :3].astype(np.float32) * a, a * 255.0], axis=-1)
    chans = [np.array(Image.fromarray(pre[..., i]).resize((nw, nh), resample)) for i in range(4)]
    out = np.stack(chans, axis=-1)
    alpha = np.clip(out[..., 3], 0, 255)
    rgb = np.where(alpha[..., None] > 1e-3, out[..., :3] / np.maximum(alpha[..., None] / 255.0, 1e-3), 0)
    return np.dstack([np.clip(rgb, 0, 255), alpha]).astype(np.uint8)


def pixelize(img: np.ndarray, factor: int) -> np.ndarray:
    """Area-downsample a supersampled render by an integer factor and binarise alpha."""
    h, w = img.shape[:2]
    h2, w2 = h // factor, w // factor
    a = img[: h2 * factor, : w2 * factor].astype(np.float32)
    al = a[..., 3:4] / 255.0
    pre = np.concatenate([a[..., :3] * al, al], -1)
    pre = pre.reshape(h2, factor, w2, factor, 4).mean(axis=(1, 3))
    alpha = pre[..., 3]
    rgb = pre[..., :3] / np.maximum(alpha[..., None], 1e-4)
    out = np.dstack([np.clip(rgb, 0, 255), np.where(alpha >= 0.5, 255, 0)]).astype(np.uint8)
    out[out[..., 3] == 0, :3] = 0
    return out


def binarize(img: np.ndarray) -> np.ndarray:
    out = img.copy()
    out[..., 3] = np.where(img[..., 3] >= ALPHA_CUT, 255, 0)
    out[out[..., 3] == 0, :3] = 0
    return out


# --------------------------------------------------------------------------- palette
def _lab(rgb: np.ndarray) -> np.ndarray:
    """Cheap perceptual space (OKLab) for nearest-colour matching."""
    c = rgb.astype(np.float32) / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    m1 = np.array([[0.4122214708, 0.5363325363, 0.0514459929],
                   [0.2119034982, 0.6806995451, 0.1073969566],
                   [0.0883024619, 0.2817188376, 0.6299787005]], np.float32)
    lms = np.cbrt(np.maximum(c @ m1.T, 0))
    m2 = np.array([[0.2104542553, 0.7936177850, -0.0040720468],
                   [1.9779984951, -2.4285922050, 0.4505937099],
                   [0.0259040371, 0.7827717662, -0.8086757660]], np.float32)
    return lms @ m2.T


def build_palette(images: list[np.ndarray], colors: int = 40) -> np.ndarray:
    """Median-cut palette over the opaque pixels of all given images."""
    px = np.concatenate([im[im[..., 3] >= ALPHA_CUT][:, :3] for im in images])
    if len(px) > 400_000:
        px = px[np.random.default_rng(0).choice(len(px), 400_000, replace=False)]
    side = int(np.ceil(np.sqrt(len(px))))
    pad = np.zeros((side * side - len(px), 3), np.uint8) + px[0]
    tile = Image.fromarray(np.concatenate([px, pad]).reshape(side, side, 3), "RGB")
    q = tile.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    pal = np.array(q.getpalette()[: colors * 3], np.uint8).reshape(-1, 3)
    used = np.unique(np.array(q))
    pal = pal[used]
    order = np.argsort(_lab(pal)[:, 0])
    return pal[order]


def apply_palette(img: np.ndarray, palette: np.ndarray) -> np.ndarray:
    tree = cKDTree(_lab(palette))
    out = img.copy()
    mask = out[..., 3] >= ALPHA_CUT
    _, idx = tree.query(_lab(out[..., :3][mask]))
    out[..., :3][mask] = palette[idx]
    out[~mask] = 0
    return out


def save_palette(palette: np.ndarray, path: Path) -> None:
    sw = 16
    img = Image.new("RGB", (sw * len(palette), sw))
    for i, c in enumerate(palette):
        img.paste(tuple(int(v) for v in c), (i * sw, 0, (i + 1) * sw, sw))
    img.save(path)


def load_palette(path: Path) -> np.ndarray:
    arr = np.array(Image.open(path).convert("RGB"))
    return arr[8, 8::16]


# --------------------------------------------------------------------------- outline
def outline(img: np.ndarray, palette: np.ndarray, strength: float = 0.38) -> np.ndarray:
    """
    Selective outline: silhouette-edge pixels become a dark version of their own colour (snapped
    to the palette), so the edge stays crisp after downscaling without a flat black line.
    """
    alpha = img[..., 3] >= ALPHA_CUT
    inner = ndi.binary_erosion(alpha, structure=np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]]), border_value=0)
    edge = alpha & ~inner
    out = img.copy()
    dark = (out[..., :3][edge].astype(np.float32) * strength + np.array([6, 4, 10]) ).clip(0, 255)
    lab = _lab(palette)
    dark_pal = palette[lab[:, 0] < np.percentile(lab[:, 0], 35)]
    tree = cKDTree(_lab(dark_pal))
    _, idx = tree.query(_lab(dark.astype(np.uint8)))
    out[..., :3][edge] = dark_pal[idx]
    return out


# --------------------------------------------------------------------------- placement
def place_in_cell(img: np.ndarray, cell: int, anchor: tuple[int, int], pivot: tuple[float, float]) -> np.ndarray:
    """Paste `img` into a transparent cell so that its `pivot` lands on `anchor` (integer snap)."""
    canvas = Image.new("RGBA", (cell, cell), (0, 0, 0, 0))
    ox, oy = round(anchor[0] - pivot[0]), round(anchor[1] - pivot[1])
    src = to_image(img)
    canvas.alpha_composite(src, (max(0, ox), max(0, oy)), (max(0, -ox), max(0, -oy)))
    return np.array(canvas)
