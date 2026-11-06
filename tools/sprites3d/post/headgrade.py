"""Hair colour grade for 2D likeness heads (`head.grade` in a fighter config).

    "grade": {"hair": "#6b4f3a", "contrast": 0.75, "highlight_cap": 1.3, "saturation": 1.1, "grey_temples": 0.5}

The hair is segmented as the darker, less saturated pixels connected to the crown (plus the bright strands
next to them), then remapped to the target hue, saturation and value with its strand texture kept but its
highlight contrast compressed (`contrast` < 1) and capped (`highlight_cap` x the target value), so a light
strand can't read as blond at sprite scale.
`grey_temples` blends the hair just above and in front of the ear toward grey. The mask is returned too,
so the hair can be quantized separately from the face.
"""

import colorsys

import numpy as np
from scipy import ndimage


def _hsv(rgb):
    x = rgb.astype(np.float32) / 255.0
    mx, mn = x.max(-1), x.min(-1)
    d = mx - mn
    s = np.where(mx > 0, d / np.maximum(mx, 1e-6), 0.0)
    r, g, b = x[..., 0], x[..., 1], x[..., 2]
    h = np.zeros_like(mx)
    m = d > 1e-6
    rm, gm = m & (mx == r), m & (mx == g) & (mx != r)
    bm = m & ~rm & ~gm
    h[rm] = ((g - b)[rm] / d[rm]) % 6
    h[gm] = (b - r)[gm] / d[gm] + 2
    h[bm] = (r - g)[bm] / d[bm] + 4
    return h / 6.0, s, mx


def _rgb(h, s, v):
    i = np.floor(h * 6).astype(int) % 6
    f = h * 6 - np.floor(h * 6)
    p, q, t = v * (1 - s), v * (1 - f * s), v * (1 - (1 - f) * s)
    out = np.zeros(h.shape + (3,), np.float32)
    for k, (a, b, c) in enumerate(((v, t, p), (q, v, p), (p, v, t), (p, q, v), (t, p, v), (v, p, q))):
        sel = i == k
        out[sel] = np.stack([a[sel], b[sel], c[sel]], -1)
    return np.clip(out * 255 + 0.5, 0, 255).astype(np.uint8)


def hair_mask(rgba, metrics):
    alpha = rgba[..., 3] > 127
    _, s, v = _hsv(rgba[..., :3])
    crown, chin = metrics["crown"], metrics["chin"]
    hh = chin - crown
    lab, _ = ndimage.label(alpha & (v < 0.66) & (s < 0.70))
    top = crown + int(0.12 * hh)
    seeds = np.unique(lab[:top][lab[:top] > 0])
    hair = np.isin(lab, seeds)
    hair[int(crown + 0.75 * hh):] = False
    near = ndimage.binary_dilation(hair, iterations=max(2, hh // 80))
    hair |= near & alpha & (v < 0.86) & (s < 0.62)
    hair[int(crown + 0.75 * hh):] = False
    hair = ndimage.binary_fill_holes(ndimage.binary_closing(hair, iterations=2)) & alpha
    return hair


def grade(rgba, metrics, spec):
    """Graded copy of `rgba` and the hair mask."""
    mask = hair_mask(rgba, metrics)
    if not mask.any():
        return rgba, mask
    t = spec["hair"].lstrip("#")
    th, ts, tv = colorsys.rgb_to_hsv(*(int(t[i:i + 2], 16) / 255.0 for i in (0, 2, 4)))
    k = spec.get("contrast", 0.7)
    h, s, v = _hsv(rgba[..., :3])
    ms, mv = float(np.median(s[mask])), float(np.median(v[mask]))
    ts *= spec.get("saturation", 1.0)
    s2 = np.clip(ts * (np.maximum(s, 1e-3) / max(ms, 1e-3)) ** k, 0, 1)
    v2 = np.clip(tv * (np.maximum(v, 1e-3) / max(mv, 1e-3)) ** k, 0, tv * spec.get("highlight_cap", 1.3))
    g = float(spec.get("grey_temples", 0.0))
    if g > 0:
        crown, chin = metrics["crown"], metrics["chin"]
        hh = chin - crown
        rows = np.arange(rgba.shape[0])[:, None]
        skin = (rgba[..., 3] > 127) & ~mask
        dist = ndimage.distance_transform_edt(~skin)
        reach = spec.get("temple_reach", 0.035) * hh
        temple = mask & (rows > crown + 0.40 * hh) & (rows < crown + 0.62 * hh) & (dist < reach)
        w = np.where(temple, g * np.clip(1 - dist / reach, 0, 1), 0.0)
        s2 = s2 * (1 - w)
        v2 = v2 * (1 - w) + w * min(1.0, tv * 1.45)
    out = rgba.copy()
    graded = _rgb(np.full_like(h, th), s2, v2)
    out[mask, :3] = graded[mask]
    return out, mask
