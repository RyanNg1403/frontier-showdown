"""
Save milestone images as <dir>/progress-NN-<what>.<ext> with NN auto-incremented, never overwriting.

    python3 tools/sprites/progress.py <image> <what> [--dir DIR]

Images that are not PNG/GIF (e.g. generator JPEGs) are converted to PNG.
"""

from __future__ import annotations

import argparse
import os
import re
import shutil
from pathlib import Path

from PIL import Image

DEFAULT_DIR = Path(
    os.environ.get(
        "SPRITE_PROGRESS_DIR",
        "/cursor/stores/bc-104b886f-f07d-4daa-86b7-4f55ef10bb9f/media/fighters",
    )
)
PATTERN = re.compile(r"^progress-(\d+)-")


def next_index(directory: Path) -> int:
    used = [int(m.group(1)) for p in directory.glob("progress-*") if (m := PATTERN.match(p.name))]
    return max(used, default=0) + 1


def save_progress(src: Path, what: str, directory: Path = DEFAULT_DIR) -> Path:
    directory.mkdir(parents=True, exist_ok=True)
    slug = re.sub(r"[^a-z0-9]+", "-", what.lower()).strip("-")
    ext = src.suffix.lower() if src.suffix.lower() in (".png", ".gif") else ".png"
    while True:
        dest = directory / f"progress-{next_index(directory):02d}-{slug}{ext}"
        try:
            fd = os.open(dest, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        except FileExistsError:
            continue
        os.close(fd)
        break
    if ext == src.suffix.lower():
        shutil.copyfile(src, dest)
    else:
        Image.open(src).convert("RGBA").save(dest)
    if not dest.exists() or dest.stat().st_size == 0:
        raise RuntimeError(f"failed to write {dest}")
    return dest


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("image", type=Path)
    parser.add_argument("what")
    parser.add_argument("--dir", type=Path, default=DEFAULT_DIR)
    args = parser.parse_args()
    print(save_progress(args.image, args.what, args.dir))


if __name__ == "__main__":
    main()
