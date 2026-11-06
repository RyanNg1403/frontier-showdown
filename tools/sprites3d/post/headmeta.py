"""Head-image measurements shared by the Blender build (skin tone) and the post stage (placement).

numpy only, so it runs inside Blender's Python too. Images are (h, w, 4) uint8 RGBA arrays, facing right.
"""

import glob
import json
import os

import numpy as np

VIEW_ALIASES = {"": "threequarter", "3q": "threequarter", "three-quarter": "threequarter", "34": "threequarter",
                "side": "profile"}
FALLBACK = {"profile": ["threequarter"], "hurt": ["threequarter"]}


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
    o = overrides or {}
    alpha = rgba[..., 3] > 127
    rows = np.nonzero(alpha.any(axis=1))[0]
    top, bottom = int(rows[0]), int(rows[-1])
    h = bottom - top + 1
    front = np.array([np.nonzero(alpha[y])[0].max() if alpha[y].any() else -1 for y in range(rgba.shape[0])])
    crown = int(o.get("crown", top))
    if "chin" in o:
        chin = int(o["chin"])
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
    neck_cut = int(o.get("neck_cut", min(bottom, chin + 0.10 * (chin - crown))))
    band = alpha[max(chin, neck_cut - max(2, h // 30)):neck_cut + 1]
    pix = rgba[max(chin, neck_cut - max(2, h // 30)):neck_cut + 1][band][:, :3]
    skin = None
    if len(pix):
        lum = pix.mean(axis=1)
        mid = pix[(lum > np.percentile(lum, 30)) & (lum < np.percentile(lum, 90))]
        c = np.median(mid if len(mid) else pix, axis=0).astype(int)
        skin = "#%02x%02x%02x" % tuple(int(v) for v in c)
    return {"crown": crown, "chin": chin, "neck_cut": neck_cut, "bottom": bottom, "skin": skin}
