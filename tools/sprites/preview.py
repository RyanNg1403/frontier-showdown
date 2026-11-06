"""
Previews for critical review: contact sheets (with ground line, anchor and per-frame labels),
onion skins, and GIFs. Locomotion GIFs scroll floor ticks at strideSpeed, so a planted foot that
slides against the ticks is foot sliding the engine would show too.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

import spritekit as sk

BG = (52, 56, 68, 255)
GRID = (74, 80, 96, 255)
GROUND = (140, 150, 170, 255)


def contact_sheet(frames: list[np.ndarray], anchor: tuple[int, int], cols: int = 8,
                  labels: list[str] | None = None, scale: int = 1, title: str | None = None) -> Image.Image:
    cell = frames[0].shape[0]
    rows = (len(frames) + cols - 1) // cols
    top = 18 if title else 0
    sheet = Image.new("RGBA", (cols * cell, rows * cell + top), BG)
    draw = ImageDraw.Draw(sheet)
    if title:
        draw.text((6, 3), title, fill=(230, 230, 240, 255))
    for i, f in enumerate(frames):
        x, y = (i % cols) * cell, (i // cols) * cell + top
        draw.rectangle([x, y, x + cell - 1, y + cell - 1], outline=GRID)
        draw.line([(x, y + anchor[1]), (x + cell - 1, y + anchor[1])], fill=GROUND)
        draw.line([(x + anchor[0], y + anchor[1] - 4), (x + anchor[0], y + anchor[1] + 4)], fill=(240, 120, 90, 255))
        sheet.alpha_composite(sk.to_image(f), (x, y))
        label = f"{i}" + (f" {labels[i]}" if labels else "")
        draw.text((x + 4, y + 4), label, fill=(200, 205, 220, 255))
    if scale > 1:
        sheet = sheet.resize((sheet.width * scale, sheet.height * scale), Image.NEAREST)
    return sheet


def onion_skin(frames: list[np.ndarray], anchor: tuple[int, int], scale: int = 2) -> Image.Image:
    """All frames overlaid, coloured from blue (first) to orange (last), plus the head-top track."""
    cell = frames[0].shape[0]
    img = Image.new("RGBA", (cell, cell), BG)
    n = len(frames)
    for i, f in enumerate(frames):
        t = i / max(1, n - 1)
        color = np.array([60 + 190 * t, 120 + 30 * (1 - abs(2 * t - 1)), 240 - 190 * t])
        a = (f[..., 3] >= sk.ALPHA_CUT)
        layer = np.zeros((cell, cell, 4), np.uint8)
        layer[a, :3] = color.astype(np.uint8)
        layer[a, 3] = 70
        img.alpha_composite(Image.fromarray(layer, "RGBA"))
    draw = ImageDraw.Draw(img)
    draw.line([(0, anchor[1]), (cell, anchor[1])], fill=GROUND)
    draw.line([(anchor[0], 0), (anchor[0], cell)], fill=(90, 96, 112, 255))
    return img.resize((cell * scale, cell * scale), Image.NEAREST)


def gif(frames: list[np.ndarray], fps: float, path: Path, anchor: tuple[int, int], scale: int = 2,
        stride_speed: float = 0.0, loops: int = 1, crop: tuple[int, int, int, int] | None = None,
        direction: int = 1) -> Path:
    """
    Animated preview. With stride_speed > 0 floor ticks scroll backward at that speed (px/s) under
    the stationary character, exactly like the engine moving the camera/world.
    """
    cell = frames[0].shape[0]
    out = []
    total = len(frames) * loops
    for k in range(total):
        f = frames[k % len(frames)]
        img = Image.new("RGBA", (cell, cell), BG)
        draw = ImageDraw.Draw(img)
        draw.rectangle([0, anchor[1] + 1, cell, cell], fill=(44, 47, 58, 255))
        draw.line([(0, anchor[1] + 1), (cell, anchor[1] + 1)], fill=GROUND)
        if stride_speed:
            offset = (-direction * stride_speed * k / fps) % 32
            x = offset - 32
            while x < cell:
                draw.line([(x, anchor[1] + 2), (x, anchor[1] + 7)], fill=(160, 170, 190, 255))
                x += 32
        img.alpha_composite(sk.to_image(f))
        if crop:
            img = img.crop(crop)
        img = img.resize((img.width * scale, img.height * scale), Image.NEAREST)
        out.append(img.convert("P", palette=Image.ADAPTIVE, colors=255))
    path.parent.mkdir(parents=True, exist_ok=True)
    out[0].save(path, save_all=True, append_images=out[1:], duration=round(1000 / fps), loop=0, disposal=2)
    return path


def strip(sheets: list[Image.Image], pad: int = 6) -> Image.Image:
    w = max(s.width for s in sheets)
    h = sum(s.height for s in sheets) + pad * (len(sheets) - 1)
    out = Image.new("RGBA", (w, h), BG)
    y = 0
    for s in sheets:
        out.alpha_composite(s.convert("RGBA"), (0, y))
        y += s.height + pad
    return out
