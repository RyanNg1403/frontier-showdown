"""Head-image measurements shared by the Blender build (skin tone) and the post stage (placement).

numpy only, so it runs inside Blender's Python too. Images are (h, w, 4) uint8 RGBA arrays, facing right.
"""

import glob
import json
import os

import numpy as np

VIEW_ALIASES = {"": "threequarter", "tq": "threequarter", "3q": "threequarter", "three-quarter": "threequarter",
                "34": "threequarter", "side": "profile"}
FALLBACK = {"profile": ["threequarter"], "hurt": ["threequarter"]}


def key_background(rgb, tol=110):
    """Foreground mask of an image on a flat background colour (estimated from the corners)."""
    corners = np.concatenate([rgb[:8, :8].reshape(-1, 3), rgb[:8, -8:].reshape(-1, 3),
                              rgb[-8:, :8].reshape(-1, 3), rgb[-8:, -8:].reshape(-1, 3)])
    bg = np.median(corners, axis=0)
    return np.abs(rgb.astype(np.int32) - bg).sum(axis=-1) > tol


def views_from_config(heads_dir, cfg):
    """{view: (path, row overrides)} from the config's head block, else from the files in heads/.

    `head.views.<view>` entries may carry `image` (relative to tools/sprites3d), `source_height` and
    `crown`/`chin`/`neck_cut` rows in source_height units; `head.image` alone names the three-quarter view."""
    head = cfg.get("head") or {}
    root = os.path.dirname(os.path.abspath(heads_dir))
    out = {}
    for view, vc in (head.get("views") or {}).items():
        if vc.get("image"):
            out[VIEW_ALIASES.get(view, view)] = (os.path.join(root, vc["image"]), vc)
    if head.get("image") and "threequarter" not in out:
        out["threequarter"] = (os.path.join(root, head["image"]), {})
    if not out:
        out = {v: (p, {}) for v, p in discover(heads_dir, cfg["id"]).items()}
    return {v: (p, o) for v, (p, o) in out.items() if os.path.exists(p)}


def scaled_rows(overrides, image_height):
    """Row overrides converted from `source_height` units to this image's rows."""
    o = dict(overrides or {})
    sh = o.get("source_height")
    if sh:
        for k in ("crown", "chin", "neck_cut"):
            if k in o:
                o[k] = o[k] * image_height / sh
    return o


def discover(heads_dir, fighter_id):
    """{view: path} for tools/sprites3d/heads/<id>.png and <id>-<view>.png (or <id>_<view>.png)."""
    views = {}
    for path in sorted(glob.glob(os.path.join(heads_dir, fighter_id + "*.png"))):
        stem = os.path.basename(path)[:-4]
        rest = stem[len(fighter_id):]
        if rest and rest[0] not in "-_":
            continue  # another fighter whose id starts with this one
        view = rest.lstrip("-_").lower()
        views[VIEW_ALIASES.get(view, view)] = path
    return views


def sidecar(path):
    js = path[:-4] + ".json"
    if os.path.exists(js):
        with open(js) as fh:
            return json.load(fh)
    return {}


def resolve_view(views, wanted):
    if wanted in views:
        return wanted
    for alt in FALLBACK.get(wanted, []) + ["threequarter"]:
        if alt in views:
            return alt
    return next(iter(views), None)


def measure(rgba, overrides=None):
    """Crown, chin and neck-cut rows plus the neck skin tone (hex).

    The chin is where the front (right) edge of the silhouette recedes fastest in the lower half of the
    head: the jaw line turning into the neck. Values in `overrides` (same keys, image rows) win."""
    o = scaled_rows(overrides, rgba.shape[0])
    alpha = rgba[..., 3] > 127
    rows = np.nonzero(alpha.any(axis=1))[0]
    top, bottom = int(rows[0]), int(rows[-1])
    h = bottom - top + 1
    front = np.array([np.nonzero(alpha[y])[0].max() if alpha[y].any() else -1 for y in range(rgba.shape[0])])
    crown = int(round(o.get("crown", top)))
    if "chin" in o:
        chin = int(round(o["chin"]))
    else:
        k = max(3, h // 25)
        lo, hi = top + int(0.5 * h), min(bottom - k, top + int(0.97 * h))
        if hi <= lo:
            chin = bottom
        else:
            drops = [front[y] - front[y + k] for y in range(lo, hi)]
            chin = lo + int(np.argmax(drops)) + k // 2
            if max(drops) < 0.04 * h:
                chin = bottom  # no neck below the jaw
    neck_cut = int(round(o.get("neck_cut", min(bottom, chin + 0.10 * (chin - crown)))))
    # Skin: lit skin-coloured pixels on the lower face and the neck (hair framing the neck is excluded by hue).
    band = slice(crown + int(0.55 * (chin - crown)), max(chin + 2, min(neck_cut, chin + int(0.15 * (chin - crown)))))
    pix = rgba[band][alpha[band]][:, :3].astype(int)
    skinlike = pix[(pix[:, 0] > pix[:, 1]) & (pix[:, 1] > pix[:, 2]) & (pix[:, 0] - pix[:, 2] > 30)
                   & (pix.mean(axis=1) > 70)]
    pix = skinlike if len(skinlike) > 20 else pix
    skin = None
    if len(pix):
        lum = pix.mean(axis=1)
        mid = pix[(lum >= np.percentile(lum, 55)) & (lum <= np.percentile(lum, 92))]
        c = np.median(mid if len(mid) else pix, axis=0).astype(int)
        skin = "#%02x%02x%02x" % tuple(int(v) for v in c)
    return {"crown": crown, "chin": chin, "neck_cut": neck_cut, "bottom": bottom, "skin": skin}
