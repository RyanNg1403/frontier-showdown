"""
Write the image-generation prompts for a character from its spec.

    python3 tools/sprites/prompts.py <id>            # writes assets/fighters/<id>/source/prompts.json
    python3 tools/sprites/prompts.py <id> --print    # also prints them

Each entry names the output file the build expects, the reference images to attach (always the
character's model sheet first) and the aspect ratio. Feed them to any image model that accepts
reference images (the sources in this repo were made with Cursor's image generation tool).
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FIGHTERS = ROOT / "assets" / "fighters"

STYLE = (
    "detailed 16-bit pixel art in the style of 1990s arcade fighting games (Mortal Kombat, Street Fighter III), "
    "realistic adult proportions about 7 heads tall, crisp 1-pixel dark outline, 3-4 tone cel shading lit from "
    "the top left, hand-placed pixels, limited palette"
)
BACKDROP = "Flat solid magenta background (#FF00FF), no floor, no shadow, no text, no numbers, no borders."


def model_prompt(spec: dict) -> str:
    return (
        f"Pixel art fighting game character model sheet, {STYLE}. The character: {spec['look']}. "
        "Show 4 full-body poses side by side, all in three-quarter side view facing RIGHT, same scale, feet on one "
        "common baseline: 1) fighting stance with fists raised, knees slightly bent, 2) standing neutral, "
        "3) mid walk stride, 4) side punch extended. " + BACKDROP
    )


def parts_prompts(spec: dict) -> list[dict]:
    look = spec["look"]
    body = (
        f"Pixel art CUTOUT ANIMATION PARTS SHEET for a 2D skeletal rig of the character in the reference image "
        f"({look}; same {STYLE}; same scale; three-quarter side view facing RIGHT). Every body part drawn SEPARATELY "
        "with clear magenta space between parts, nothing touching, each part complete with rounded joint ends: top "
        "row left to right: 1) HEAD with neck and hair, facing right, 2) TORSO only from collar to hem at the hips, "
        "NO arms, NO head, 3) UPPER ARM in its sleeve hanging straight down, 4) FOREARM in its sleeve with cuff and a "
        "closed fist, hanging straight down. Bottom row: 5) one full trouser leg, vertical, 6) another trouser leg, "
        "7) a third trouser leg, 8) hips and trousers. All limbs vertical and straight. " + BACKDROP
    )
    legs = (
        f"Pixel art cutout-rig LEG AND SHOE PARTS for the character in the reference image ({look}; same {STYLE} "
        "and palette). Six separate pieces in one row, evenly spaced with wide magenta gaps, nothing touching: "
        "1) trouser leg from hip to ankle, vertical, 2) the same trouser leg again, 3) the character's SHOE in exact "
        "side profile pointing RIGHT, sole flat, 4) the same shoe again, 5) trouser leg, 6) trouser leg. " + BACKDROP
    )
    return [
        {"file": "source/parts-body.jpg", "refs": ["source/model.jpg"], "prompt": body},
        {"file": "source/parts-legs.jpg", "refs": ["source/model.jpg", "source/parts-body.jpg"], "prompt": legs},
    ]


def sheet_prompt(spec: dict, sheet: dict) -> str:
    rows = sheet["rows"]
    accent = spec.get("accent", {}).get("name", "energy")
    parts = [
        f"Pixel art fighting game sprite sheet: exactly the same character, outfit, proportions and scale as the "
        f"reference model sheet ({spec['look']}), drawn in {STYLE}. Three-quarter side view, the character always "
        f"faces RIGHT. {len(rows)} rows; each row is one animation read left to right, frames evenly spaced with "
        "clear gaps so no frames touch, identical character size in every frame, feet on a common baseline in "
        "each row (airborne poses drawn above it)."
    ]
    for r, row in enumerate(rows, 1):
        poses = " ".join(f"{i}) {p}." for i, p in enumerate(row["poses"], 1))
        parts.append(f"ROW {r}, {row['label']} ({len(row['poses'])} frames): {poses}")
    if any("glow" in p or "energy" in p for row in rows for p in row["poses"]):
        parts.append(f"Draw the {accent} only in the frames that mention it; no other effects, no motion lines.")
    else:
        parts.append("Plain physical moves: absolutely no glow, no energy, no aura, no sparks, no motion lines.")
    if sheet.get("note"):
        parts.append(sheet["note"])
    parts.append(BACKDROP)
    return " ".join(parts)


def build(char_id: str) -> list[dict]:
    spec = json.loads((FIGHTERS / char_id / "spec.json").read_text())
    entries = [{"file": "source/model.jpg", "refs": [], "prompt": model_prompt(spec), "aspect": "16:9"}]
    entries += [dict(e, aspect="16:9") for e in parts_prompts(spec)]
    for name, sheet in spec["sheets"].items():
        entries.append({"file": sheet["file"], "refs": ["source/model.jpg"], "prompt": sheet_prompt(spec, sheet),
                        "aspect": "16:9", "sheet": name})
    return entries


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("id")
    parser.add_argument("--print", action="store_true")
    args = parser.parse_args()
    entries = build(args.id)
    out = FIGHTERS / args.id / "source" / "prompts.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(entries, indent=2, ensure_ascii=False) + "\n")
    if args.print:
        for e in entries:
            print(f"== {e['file']}  refs={e['refs']}\n{e['prompt']}\n")
    print(out)


if __name__ == "__main__":
    main()
