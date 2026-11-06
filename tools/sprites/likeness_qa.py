"""
Likeness QA: the reference photo next to the sprite head at in-game scale (3x, nearest) and the
full-resolution source head, so a reviewer can judge recognisability where it matters.

    python3 tools/sprites/likeness_qa.py <id> <photo> [--model PATH] [--out PATH] [--atlas]

--atlas uses the idle frame of the built atlas instead of the model sheet's neutral pose.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageOps

import spritekit as sk

ROOT = Path(__file__).resolve().parents[2]
STORE = Path("/cursor/stores/bc-104b886f-f07d-4daa-86b7-4f55ef10bb9f")


def sprite_head(figure: np.ndarray, height: int, frac: float = 0.17) -> tuple[np.ndarray, np.ndarray]:
    """(game-scale head, source-resolution head) from a full-body figure crop."""
    src_head = figure[: int(figure.shape[0] * frac)]
    game = sk.binarize(sk.resize_rgba(figure, height / figure.shape[0], Image.BOX))
    return game[: int(game.shape[0] * frac)], src_head


def make_qa(char_id: str, photo: Path, model: Path | None, out: Path, use_atlas: bool = False) -> Path:
    spec = json.loads((ROOT / "assets" / "fighters" / char_id / "spec.json").read_text())
    height = spec["height"]
    if use_atlas:
        atlas_dir = ROOT / "assets" / "fighters" / char_id
        meta = json.loads((atlas_dir / "atlas.json").read_text())
        r = meta["animations"]["idle"]["frames"][0]
        cell = sk.load_rgba(atlas_dir / "atlas.png")[r["y"]: r["y"] + r["h"], r["x"]: r["x"] + r["w"]]
        figure = sk.crop_exact(cell, sk.bbox(cell))
        game_head = figure[: int(figure.shape[0] * 0.17)]
        src_head = game_head
    else:
        sheet = sk.remove_background(sk.load_rgba(model or ROOT / "assets" / "fighters" / char_id / "source" / "model.jpg"))
        figure = sk.crop_exact(sheet, sk.split_counts(sheet, [4])[0][1])
        game_head, src_head = sprite_head(figure, height)
    H = 360
    ph = ImageOps.exif_transpose(Image.open(photo)).convert("RGB")
    ph = ph.resize((int(ph.width * H / ph.height), H), Image.LANCZOS)
    g3 = sk.to_image(game_head).resize((game_head.shape[1] * 3, game_head.shape[0] * 3), Image.NEAREST)
    srch = sk.to_image(src_head)
    srch = srch.resize((int(srch.width * H / srch.height), H), Image.LANCZOS)
    bg = (52, 56, 68)
    w = ph.width + srch.width + g3.width + 60
    img = Image.new("RGB", (w, H + 40), bg)
    draw = ImageDraw.Draw(img)
    x = 10
    for label, im in (("reference photo", ph), ("sprite source head", srch), (f"in-game head x3 ({height}px body)", g3)):
        y = 30 + (H - im.height) // 2
        if im.mode == "RGBA":
            img.paste(im, (x, y), im)
        else:
            img.paste(im, (x, y))
        draw.text((x, 8), label, fill=(230, 230, 240))
        x += im.width + 20
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out)
    return out


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("id")
    p.add_argument("photo", type=Path)
    p.add_argument("--model", type=Path)
    p.add_argument("--out", type=Path)
    p.add_argument("--atlas", action="store_true")
    a = p.parse_args()
    out = a.out or STORE / "internal" / "likeness-qa" / f"sprite-{a.id}.png"
    print(make_qa(a.id, a.photo, a.model, out, a.atlas))


if __name__ == "__main__":
    main()
