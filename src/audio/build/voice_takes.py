#!/usr/bin/env python3
"""Render announcer takes with Piper and keep the take that a speech recognizer
transcribes as the intended line.

Short exclamations make VITS voices babble or mispronounce, and every synthesis is
random, so each line is rendered several ways (pronunciation variants, speaking
rates, retries). The first sentence is cut at its first pause, transcribed with
faster-whisper, and scored against the expected words. Winning raw takes are written
to --out as <file>.wav plus takes.json; `generate.mjs voice` then processes them.

    pip install piper-tts faster-whisper
    python3 src/audio/build/voice_takes.py --model en_US-john-medium.onnx --out /tmp/voice-takes
"""
import argparse
import difflib
import json
import re
import subprocess
import wave
from pathlib import Path

import numpy as np
from faster_whisper import WhisperModel
from piper import PiperVoice, SynthesisConfig

HERE = Path(__file__).resolve().parent
NUMBERS = {"1": "one", "2": "two", "3": "three", "1st": "first"}
SAME = {"k-o": "ko", "k.o": "ko", "kayo": "ko", "x-a-i": "xai", "x-ai": "xai", "ahmee": "ami", "ah-mee": "ami", "a.m.i": "ami",
        # AMI is said "ah-mee" (/ˈɑːmiː/), which Whisper writes as "Army"; "Amy" (/ˈeɪmi/) is wrong and stays unmatched.
        "army": "ami"}


def lines_from_catalog():
    out = subprocess.run(["node", str(HERE / "generate.mjs"), "--list-voice"], capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


def words(text):
    text = text.lower().replace("k.o.", "ko").replace("k. o.", "ko").replace("a.i.", "ai")
    tokens = re.findall(r"[a-z0-9]+(?:[-.][a-z0-9]+)*", text)
    tokens = [SAME.get(t, NUMBERS.get(t, t)).replace("-", "").replace(".", "") for t in tokens]
    joined = " ".join(tokens)
    for a, b in (("k o", "ko"), ("x a i", "xai"), ("open a i", "openai"), ("open ai", "openai"), ("x ai", "xai"),
                 ("deep seek", "deepseek"), ("deep mind", "deepmind"), ("n vidia", "nvidia"), ("en vidia", "nvidia"),
                 ("super intelligence", "superintelligence"), ("superintelligence", "superintelligence"), ("a m i", "ami")):
        joined = re.sub(rf"\b{a}\b", b, joined)
    return joined.split()


def first_sentence(x, sr, gap=0.09, min_speech=0.15):
    hop = int(sr * 0.01)
    if len(x) < hop * 3:
        return x
    frames = len(x) // hop
    e = np.sqrt(np.mean(x[: frames * hop].reshape(frames, hop) ** 2, axis=1))
    voiced = e > max(e.max() * 0.03, 1e-4)
    if not voiced.any():
        return x[:0]
    start = int(np.argmax(voiced))
    run = 0
    for i in range(start, frames):
        if voiced[i]:
            run = 0
            continue
        run += 1
        if run * 0.01 >= gap and (i - run - start) * 0.01 >= min_speech:
            return x[max(0, (start - 1) * hop):(i - run + 4) * hop]
    return x[max(0, (start - 1) * hop):]


def to16k(x, sr):
    n = int(len(x) * 16000 / sr)
    return np.interp(np.linspace(0, len(x) - 1, n), np.arange(len(x)), x).astype(np.float32)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", action="append", required=True, help="Piper .onnx voice; repeat to allow fallbacks")
    ap.add_argument("--out", required=True)
    ap.add_argument("--attempts", type=int, default=30)
    ap.add_argument("--only", nargs="*", help="catalog ids to render")
    args = ap.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    asr = WhisperModel("base.en", device="cpu", compute_type="int8")
    voices = [(Path(m).stem, PiperVoice.load(m)) for m in args.model]
    report = {}
    rng = np.random.default_rng(7)

    for line in lines_from_catalog():
        if args.only and line["id"] not in args.only:
            continue
        expect = words(line["text"])
        best = None
        for attempt in range(args.attempts):
            vname, voice = voices[min(len(voices) - 1, attempt // max(1, args.attempts // len(voices)))]
            say = line["say"][attempt % len(line["say"])]
            ls = float(rng.choice([0.95, 1.05, 1.15]))
            chunks = list(voice.synthesize(f"{say} The crowd roars.", SynthesisConfig(length_scale=ls, noise_scale=0.6, noise_w_scale=0.7)))
            sr = chunks[0].sample_rate
            take = first_sentence(chunks[0].audio_float_array.astype(np.float32), sr)
            if len(take) < sr * 0.15:
                continue
            segs, _ = asr.transcribe(to16k(take, sr), beam_size=5, language="en", word_timestamps=True)
            ws = [w for s in segs for w in s.words]
            heard = " ".join(w.word.strip() for w in ws)
            ratio = difflib.SequenceMatcher(None, " ".join(words(heard)), " ".join(expect)).ratio()
            conf = float(np.mean([w.probability for w in ws])) if ws else 0.0
            score = ratio * 2 + conf + (1 if words(heard) == expect else 0)
            if best is None or score > best["score"]:
                best = {"score": score, "heard": heard, "ratio": ratio, "conf": conf, "say": say, "voice": vname,
                        "lengthScale": ls, "sr": sr, "audio": take, "exact": words(heard) == expect}
            if best["exact"] and best["conf"] > 0.8:
                break
        path = out / f"{line['file'].split('/')[-1]}"
        with wave.open(str(path), "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(best["sr"])
            w.writeframes((np.clip(best["audio"], -1, 1) * 32767).astype(np.int16).tobytes())
        report[line["id"]] = {k: (round(v, 3) if isinstance(v, float) else v) for k, v in best.items() if k not in ("audio",)}
        report[line["id"]]["attempts"] = attempt + 1
        print(f"{line['id']:22s} {'OK ' if best['exact'] else '?? '} heard={best['heard']!r} conf={best['conf']:.2f} voice={best['voice']} say={best['say']!r} tries={attempt + 1}")
    (out / "takes.json").write_text(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
