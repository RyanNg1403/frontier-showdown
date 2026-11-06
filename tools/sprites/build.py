"""
Build a fighter atlas from its spec and generated sources.

    python3 tools/sprites/build.py <id> [--preview DIR] [--only anim1,anim2]

Reads  assets/fighters/<id>/spec.json and assets/fighters/<id>/source/**
Writes assets/fighters/<id>/atlas.png, atlas.json, palette.png
       <preview>/<id>/  contact sheets, onion skins, GIFs, qa.json   (default build/fighters)

Animation types in spec["animations"]:
  frames   - cells "<sheet>:<row>:<col>" from generated sheets; each sheet gets one scale (from the
             head width of its stance frames), frames are snapped to the ground and registered on
             the planted feet (or the torso with "align": "torso").
  breathe  - idle loop made from one frame by shifting the upper body 0-2 px.
  repaint  - walk/run from per-frame repaints in source/<gait>/NN.jpg, foot-locked to the rig.
  external - locomotion frames from another pipeline: {"dir": "...", "fps": 12, "strideSpeed": 140,
             "contact": [0, 5], "normalize": false}. PNG files in name order; finished 256x256 cells
             are used as-is, anything else is normalised like a repaint. strideSpeed is measured if
             not given.
  reverse  - another animation played backwards (shares cells), e.g. walk_back.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image

import locomotion
import measure
import preview
import rig
import spritekit as sk

ROOT = Path(__file__).resolve().parents[2]
CELL = 256
ANCHOR = (128, 244)
COLUMNS = 16


class Builder:
    def __init__(self, char_id: str, preview_dir: Path):
        self.id = char_id
        self.dir = ROOT / "assets" / "fighters" / char_id
        self.spec = json.loads((self.dir / "spec.json").read_text())
        self.height = self.spec["height"]
        self.preview_dir = preview_dir / char_id
        self._sheets: dict[str, list[list[np.ndarray]]] = {}
        self._sheet_scale: dict[str, float] = {}
        self.qa: dict = {}
        self._model_figures()
        self._palettes()

    # ------------------------------------------------------------------ reference + palette
    def _model_figures(self) -> None:
        sheet = sk.remove_background(sk.load_rgba(self.dir / "source" / "model.jpg"))
        self.model = [sk.crop_exact(sheet, b) for b in sk.split_counts(sheet, [4])[0]]
        neutral = self.model[1]
        self.model_scale = self.height / neutral.shape[0]
        self.head_px = locomotion.head_width(neutral) * self.model_scale
        stance = self.model[0]
        self.stance_head_ratio = None

    def _palettes(self) -> None:
        small = [sk.binarize(sk.resize_rgba(f, self.model_scale, Image.BOX)) for f in self.model]
        shaded = []
        for f in small:
            g = f.copy()
            g[..., :3] = (g[..., :3].astype(np.float32) * 0.62).astype(np.uint8)
            shaded.append(g)
        self.palette = sk.build_palette(small + shaded, self.spec.get("palette", {}).get("colors", 48))
        acc = [c for c in self.spec.get("accent", {}).get("colors", [])]
        accent = np.array([[int(c[i:i + 2], 16) for i in (1, 3, 5)] for c in acc], np.uint8).reshape(-1, 3)
        self.palette_glow = np.concatenate([self.palette, accent]) if len(accent) else self.palette
        sk.save_palette(self.palette_glow, self.dir / "palette.png")

    # ------------------------------------------------------------------ sheets
    def sheet(self, name: str) -> list[list[np.ndarray]]:
        if name not in self._sheets:
            spec = self.spec["sheets"][name]
            img = sk.remove_background(sk.load_rgba(self.dir / spec["file"]))
            counts = [len(r["poses"]) for r in spec["rows"]]
            rows = sk.split_counts(img, counts)
            self._sheets[name] = [[sk.crop_exact(img, b) for b in row] for row in rows]
            for r, (row, n) in enumerate(zip(self._sheets[name], counts)):
                if len(row) != n:
                    print(f"  ! {name} row {r}: found {len(row)} of {n} frames")
        return self._sheets[name]

    def frame(self, ref: str) -> np.ndarray:
        name, r, c = ref.split(":")
        return self.sheet(name)[int(r)][int(c)]

    def scale_for(self, name: str) -> float:
        """One scale per sheet: head width of its upright stance frames vs the model head."""
        if name not in self._sheet_scale:
            entry = self.spec.get("scale_refs", {}).get(name)
            sheet = self.sheet(name)
            upright = True
            if isinstance(entry, dict):
                refs, upright = entry["refs"], entry.get("upright", True)
            else:
                refs = entry or [f"{name}:{r}:0" for r in range(len(sheet))]
            cand = []
            for ref in refs:
                f = self.frame(ref)
                hw = locomotion.head_width(f, self.height / self.model_scale * 1.0)
                if hw > 0:
                    cand.append(self.head_px / hw)
            by_head = float(np.median(cand)) if cand else None
            if upright:
                # stance frames stand ~0.95 of the standing height: guards against a bad head read
                heights = [self.frame(ref).shape[0] for ref in refs]
                by_height = float(np.median([self.height * 0.95 / h for h in heights]))
                s = by_head if by_head and abs(by_head / by_height - 1) < 0.12 else by_height
            else:
                s = by_head
            self._sheet_scale[name] = s
        return self._sheet_scale[name]

    # ------------------------------------------------------------------ normalisation
    def normalise(self, img: np.ndarray, scale: float, glow: bool) -> np.ndarray:
        small = sk.binarize(sk.resize_rgba(img, scale, Image.BOX))
        pal = self.palette_glow if glow else self.palette
        small = sk.outline(sk.apply_palette(small, pal), pal)
        return small

    @staticmethod
    def _feet_center(cell_img: np.ndarray) -> float:
        a = cell_img[ANCHOR[1] - 5: ANCHOR[1] + 1, :, 3] >= sk.ALPHA_CUT
        xs = np.where(a.any(0))[0]
        if len(xs) == 0:
            a = cell_img[..., 3] >= sk.ALPHA_CUT
            xs = np.where(a.any(0))[0]
        return float(xs.min() + xs.max()) / 2

    @staticmethod
    def _torso_x(cell_img: np.ndarray) -> float:
        a = cell_img[..., 3] >= sk.ALPHA_CUT
        rows = np.where(a.any(1))[0]
        top, bot = rows.min(), rows.max()
        band = a[top + int((bot - top) * 0.12): top + int((bot - top) * 0.5)]
        xs = np.where(band)[1]
        return float(xs.mean()) if len(xs) else CELL / 2

    def place(self, small: np.ndarray) -> np.ndarray:
        """Bottom on the ground line, horizontally centred (refined by register())."""
        return sk.place_in_cell(small, CELL, (ANCHOR[0], ANCHOR[1] + 1), (small.shape[1] / 2, small.shape[0]))

    @staticmethod
    def _shift_x(img: np.ndarray, dx: int) -> np.ndarray:
        return locomotion._shift(img, int(dx), 0)

    def _register_step(self, ref: np.ndarray, prev: np.ndarray, f: np.ndarray, align: str) -> np.ndarray:
        if align == "torso":
            dx = round(self._torso_x(prev) - self._torso_x(f))
        else:
            a = ref[ANCHOR[1] - 30: ANCHOR[1] + 1, :, 3] >= sk.ALPHA_CUT
            b = f[ANCHOR[1] - 30: ANCHOR[1] + 1, :, 3] >= sk.ALPHA_CUT
            best, best_s = None, -1
            if b.sum() > 20 and a.sum() > 20:
                for d in range(-60, 61):
                    s = (np.roll(b, d, axis=1) & a).sum()
                    if s > best_s:
                        best, best_s = d, s
            overlap = best_s / max(1, min(a.sum(), b.sum()))
            dx = best if best is not None and overlap >= 0.25 else round(self._torso_x(prev) - self._torso_x(f))
        return self._shift_x(f, dx)

    def register(self, frames: list[np.ndarray], align: str, anchor_frame: int = 0) -> list[np.ndarray]:
        """
        The anchor frame (a stance, usually the first or last) gets its feet midpoint on the anchor;
        the others are registered outward from it on the planted feet (or the torso).
        """
        k = anchor_frame % len(frames)
        out: list[np.ndarray | None] = [None] * len(frames)
        out[k] = self._shift_x(frames[k], round(ANCHOR[0] - self._feet_center(frames[k])))
        for i in range(k + 1, len(frames)):
            out[i] = self._register_step(out[k], out[i - 1], frames[i], align)
        for i in range(k - 1, -1, -1):
            out[i] = self._register_step(out[k], out[i + 1], frames[i], align)
        return out

    # ------------------------------------------------------------------ animation types
    def anim_frames(self, name: str, a: dict) -> list[np.ndarray]:
        glow = a.get("glow", False)
        cells = []
        for ref in a["frames"]:
            sheet = ref.split(":")[0]
            cells.append(self.place(self.normalise(self.frame(ref), self.scale_for(sheet), glow)))
        return self.register(cells, a.get("align", "feet"), a.get("anchor_frame", 0))

    def anim_breathe(self, name: str, a: dict) -> list[np.ndarray]:
        base = self.anim_frames(name, {"frames": [a["from"]]})[0]
        bb = sk.bbox(base)
        waist = bb[1] + int((bb[3] - bb[1]) * 0.5)
        offsets = a.get("offsets", [0, 0, 1, 1, 2, 2, 1, 1])[: a.get("frames", 8)]
        out = []
        for k in offsets:
            f = base.copy()
            if k:
                upper = base[:waist - k].copy()
                f[:waist] = 0
                f[k:waist] = upper
            out.append(f)
        return out

    def anim_repaint(self, name: str, a: dict) -> tuple[list[np.ndarray], dict]:
        gait = a["gait"]
        files = sorted((self.dir / "source" / gait).glob("*.jpg"))
        painted = []
        for p in files:
            img = sk.remove_background(sk.load_rgba(p))
            painted.append(sk.crop_exact(img, sk.bbox(sk.drop_specks(img, keep_frac=0.2))))
        frames, info = locomotion.assemble(painted, self.spec, gait, CELL, ANCHOR, self.palette, self.head_px)
        g = locomotion.gait_for(self.spec, gait)
        contact = [i for i, p in enumerate(rig.cycle(g)) if p["contact"] and rig.describe(g)[i].startswith("contact")]
        return frames, {"fps": g.fps, "strideSpeed": info["rigStrideSpeed"], "contact": contact, "info": info}

    def anim_external(self, name: str, a: dict) -> tuple[list[np.ndarray], dict]:
        d = (self.dir / a["dir"]) if not Path(a["dir"]).is_absolute() else Path(a["dir"])
        files = sorted(d.glob("*.png"))
        frames = []
        for p in files:
            img = sk.load_rgba(p)
            if img.shape[:2] == (CELL, CELL) and not a.get("normalize", False):
                frames.append(sk.binarize(img))
            else:
                img = sk.remove_background(img) if img[..., 3].min() == 255 else img
                crop = sk.crop_exact(img, sk.bbox(img))
                scale = self.height * a.get("height_frac", 0.95) / crop.shape[0]
                frames.append(self.place(self.normalise(crop, scale, False)))
        fps = a.get("fps", 12)
        speed = a.get("strideSpeed") or measure.stride_speed(frames, fps, ANCHOR[1])["strideSpeed"]
        return frames, {"fps": fps, "strideSpeed": speed, "contact": a.get("contact", [])}

    # ------------------------------------------------------------------ build
    def build(self, only: list[str] | None = None) -> None:
        anims = self.spec["animations"]
        built: dict[str, dict] = {}
        for name, a in anims.items():
            if a["type"] == "reverse" or (only and name not in only):
                continue
            meta: dict = {"fps": a.get("fps", 12), "loop": a.get("loop", True)}
            if a["type"] == "frames":
                frames = self.anim_frames(name, a)
            elif a["type"] == "breathe":
                frames = self.anim_breathe(name, a)
            elif a["type"] in ("repaint", "external"):
                src = (self.dir / "source" / a["gait"]) if a["type"] == "repaint" else (self.dir / a["dir"])
                if not any(src.glob("*.jpg" if a["type"] == "repaint" else "*.png")):
                    print(f"  ! {name}: no frames in {src.relative_to(ROOT)}, skipped")
                    continue
                frames, extra = (self.anim_repaint if a["type"] == "repaint" else self.anim_external)(name, a)
                meta.update(fps=extra["fps"], loop=True, strideSpeed=round(float(extra["strideSpeed"]), 1))
                meta["events"] = [{"frame": i, "type": "footstep"} for i in extra["contact"]]
                self.qa[name] = measure.report(frames, extra["fps"], ANCHOR[1])
                self.qa[name]["strideSpeed"] = meta["strideSpeed"]
            else:
                raise ValueError(f"unknown animation type {a['type']}")
            events = list(meta.get("events", []))
            if "hit" in a:
                events.append({"frame": a["hit"], "type": "hit"})
            events += a.get("events", [])
            if events:
                meta["events"] = sorted(events, key=lambda e: e["frame"])
            built[name] = {"frames": frames, "meta": meta}
            print(f"  {name}: {len(frames)} frames")
        for name, a in anims.items():
            if a["type"] == "reverse" and a["of"] in built:
                src = built[a["of"]]
                n = len(src["frames"])
                meta = dict(src["meta"])
                if "events" in meta:
                    meta["events"] = sorted(({**e, "frame": n - 1 - e["frame"]} for e in meta["events"]),
                                            key=lambda e: e["frame"])
                built[name] = {"frames": src["frames"][::-1], "meta": meta, "reverse_of": a["of"]}
        if only:
            self.previews(built)
        else:
            self.write(built)

    def write(self, built: dict) -> None:
        cells: list[np.ndarray] = []
        index: dict[str, int] = {}

        def add(cell: np.ndarray) -> int:
            key = hashlib.sha1(cell.tobytes()).hexdigest()
            if key not in index:
                index[key] = len(cells)
                cells.append(cell)
            return index[key]

        animations = {}
        for name in self.spec["animations"]:
            if name not in built:
                continue
            b = built[name]
            ids = [add(f) for f in b["frames"]]
            rects = [{"x": (i % COLUMNS) * CELL, "y": (i // COLUMNS) * CELL, "w": CELL, "h": CELL} for i in ids]
            animations[name] = {**b["meta"], "frames": rects}
        cols = min(COLUMNS, len(cells))
        rows = (len(cells) + COLUMNS - 1) // COLUMNS
        atlas = Image.new("RGBA", (cols * CELL, rows * CELL), (0, 0, 0, 0))
        for i, c in enumerate(cells):
            atlas.alpha_composite(sk.to_image(c), ((i % COLUMNS) * CELL, (i // COLUMNS) * CELL))
        atlas.save(self.dir / "atlas.png", optimize=True)
        meta = {
            "id": self.id,
            "cell": {"w": CELL, "h": CELL},
            "anchor": {"x": ANCHOR[0], "y": ANCHOR[1]},
            "height": self.height,
            "palette": "palette.png",
            "animations": animations,
        }
        (self.dir / "atlas.json").write_text(json.dumps(meta, indent=1) + "\n")
        print(f"atlas: {len(cells)} unique cells, {atlas.width}x{atlas.height}")
        self.previews(built)

    def previews(self, built: dict) -> None:
        out = self.preview_dir
        out.mkdir(parents=True, exist_ok=True)
        sheets = []
        for name, b in built.items():
            if b.get("reverse_of"):
                continue
            frames = b["frames"]
            meta = b["meta"]
            title = f"{self.id} {name}: {len(frames)}f @{meta['fps']}fps"
            if "strideSpeed" in meta:
                title += f" strideSpeed {meta['strideSpeed']}px/s"
            cs = preview.contact_sheet(frames, ANCHOR, cols=max(len(frames), 1), title=title)
            sheets.append(cs)
            preview.gif(frames, meta["fps"], out / f"{name}.gif", ANCHOR, scale=2,
                        stride_speed=meta.get("strideSpeed", 0), loops=3 if meta.get("loop") else 1)
            if "strideSpeed" in meta:
                preview.onion_skin(frames, ANCHOR).save(out / f"{name}-onion.png")
        w = max(s.width for s in sheets)
        scale = 0.5
        thumbs = [s.resize((int(s.width * scale), int(s.height * scale)), Image.NEAREST) for s in sheets]
        preview.strip(thumbs).save(out / "contact-sheet.png")
        (out / "qa.json").write_text(json.dumps(self.qa, indent=1) + "\n")
        print(f"previews: {out}")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("id")
    p.add_argument("--preview", type=Path, default=ROOT / "build" / "fighters")
    p.add_argument("--only")
    a = p.parse_args()
    Builder(a.id, a.preview).build(a.only.split(",") if a.only else None)


if __name__ == "__main__":
    main()
