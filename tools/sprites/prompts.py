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
    "semi-realistic digitized-actor pixel art like Mortal Kombat II (a real person photographed in costume and "
    "reduced to pixels), realistic adult proportions about 7.5 heads tall, photographic shading lit from the top "
    "left, realistic cloth folds, no cartoon features, no cel shading"
)
BACKDROP = "Flat solid magenta background (#FF00FF), no floor, no shadow, no text, no numbers, no borders."


def likeness_prompts(spec: dict) -> list[dict]:
    """Photo-driven likeness: the photo is the edit input, the face is never described in words."""
    bust = (
        "Edit the FIRST image (a photo) into semi-realistic digitized pixel art like a Mortal Kombat II character "
        "portrait. Keep the identity exactly: the same face shape, eyes, brows, nose, mouth, expression, glasses (if "
        "any), hairline and hair as in the photo. Do not beautify, do not restyle the hair, do not change age or "
        "proportions. Two head-and-shoulders views side by side at the same scale: left, front view as in the photo; "
        f"right, the same person turned to a three-quarter view facing right. Wearing: {spec['outfit']}. " + BACKDROP
    )
    model = (
        f"Full-body semi-realistic digitized pixel-art fighting game model sheet ({STYLE}) of the person in the "
        f"FIRST image, wearing {spec['outfit']}. Four poses side by side, three-quarter side view facing RIGHT, same "
        "scale, common baseline: 1) fighting stance, 2) standing neutral, 3) mid walk stride, 4) straight punch. "
        + BACKDROP
    )
    blend = (
        "Edit the FIRST image. The four heads were pasted onto the bodies; blend each head into its body so every "
        "figure becomes one seamless sprite: draw a natural neck into the collar, remove leftover old chin and neck "
        "pieces, match lighting and pixel style. DO NOT CHANGE THE FACES, GLASSES OR HAIR (they match the person in "
        "the SECOND image). Do not change the bodies, clothes, poses, scale, positions or layout. " + BACKDROP
    )
    return [
        {"file": "source/likeness.jpg", "refs": ["<reference photo from the roster doc>"], "prompt": bust,
         "aspect": "16:9", "step": "1. bust from the photo"},
        {"file": "source/model-draft.jpg", "refs": ["source/likeness.jpg"], "prompt": model, "aspect": "16:9",
         "step": "2. body sheet (its heads get replaced)"},
        {"file": "source/model.jpg", "refs": ["<likeness.py composite output>", "source/likeness.jpg"],
         "prompt": blend, "aspect": "16:9",
         "step": "3. python3 tools/sprites/likeness.py composite <id> source/model-draft.jpg composite.png, then blend"},
    ]


def sheet_prompt(spec: dict, sheet: dict) -> str:
    rows = sheet["rows"]
    accent = spec.get("accent", {}).get("name", "energy")
    parts = [
        f"Fighting game sprite sheet: exactly the same person, face, hair, outfit, proportions and scale as the "
        f"FIRST image (model sheet; the SECOND image is the likeness close-up), drawn in {STYLE}. Outfit: "
        f"{spec['outfit']}. Three-quarter side view, the character always "
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
    entries = likeness_prompts(spec)
    for name, sheet in spec["sheets"].items():
        entries.append({"file": sheet["file"], "refs": ["source/model.jpg", "source/likeness.jpg"],
                        "prompt": sheet_prompt(spec, sheet), "aspect": "16:9", "sheet": name})
    try:
        import locomotion
        for gait, anim in (("walk", "walk_fwd"), ("run", "run")):
            if spec["animations"].get(anim, {}).get("type") != "repaint":
                continue
            for i in range(spec["animations"][anim].get("frames", 10)):
                entries.append({"file": f"source/{gait}/{i:02d}.jpg",
                                "refs": [f"<guide: locomotion.write_guides(..., '{gait}') -> {gait}-{i:02d}.png>",
                                         "source/model.jpg"],
                                "prompt": locomotion.frame_prompt(spec, gait, i), "aspect": "1:1"})
    except Exception as exc:  # locomotion needs scipy/numpy; prompts still work without it
        entries.append({"note": f"locomotion prompts unavailable: {exc}"})
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
