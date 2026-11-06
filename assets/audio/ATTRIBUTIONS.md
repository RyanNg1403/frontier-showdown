# Audio sources and licenses

Every file under `assets/audio/` was generated for Frontier Showdown. No third-party
recordings, sample packs or loops are included. Everything can be rebuilt with
`node src/audio/build/generate.mjs` (voice takes need the extra step described below).

## Sound effects: `sfx/**`

- Source: procedural synthesis in `src/audio/build/sfx.mjs` (oscillators, filtered noise,
  envelopes, saturation and an algorithmic reverb in `src/audio/build/dsp.mjs`).
- Author: written for this repository. License: same as the repository.
- Covers hits (light, heavy, counter, block), whooshes (light, medium, heavy), footsteps
  (walk, run), dash, jump, land, body fall, throws (grab, slam, break), special and super
  stingers, KO impact, slow-motion in and out, tag-in and the forced tag-in sting, and UI (move, confirm, back, lock-in).
- Format: 32 kHz mono 16-bit WAV. Variants use different random seeds; output is deterministic.

## Music: `music/select.wav`, `music/fight.wav`, `music/victory.wav`

- Source: procedural step sequencer and synthesizers in `src/audio/build/music.mjs`.
  All melodies, riffs and progressions are original.
- Author: written for this repository. License: same as the repository.
- Format: 32 kHz mono 16-bit WAV. The select and fight loops wrap note tails and reverb past the
  loop point, so they loop without a seam.

## Menu music: `../frontier-soundtrack.mp3` (reused, not copied)

- The menu track plays the existing `assets/frontier-soundtrack.mp3`, referenced in place.
  It was added to the repository by the project owner in commit `f577aac`. Its source and
  license are documented by the project owner, not by this file.

## Announcer: `voice/**`

- Text-to-speech: [Piper](https://github.com/OHF-Voice/piper1-gpl) (`piper-tts` 1.8.0,
  GPL-3.0-or-later). The license covers the software only. Audio it generates is not a
  derivative of the program.
- Voices (from [rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices)):
  - `en_US-john-medium` (most lines): trained by Bryce Beattie on public-domain
    [LibriVox](https://librivox.org) recordings, fine-tuned from his `kristin` voice, which was
    trained from scratch on public-domain LibriVox recordings. Dataset license: public domain.
  - `en_US-norman-medium` (a few lines, listed in `voice/takes.json`): trained from scratch by
    Bryce Beattie on public-domain LibriVox recordings. Dataset license: public domain.
  - Most other Piper English voices were deliberately avoided because they are fine-tuned from the
    `lessac` voice, whose Blizzard 2011 dataset license restricts use to non-commercial research.
- Take selection: `src/audio/build/voice_takes.py` renders several takes per line and transcribes
  each with [faster-whisper](https://github.com/SYSTRAN/faster-whisper) (MIT, `base.en` model,
  MIT weights). It keeps the take that best matches the intended words. `voice/takes.json`
  records the voice, spelling, speaking rate and transcript for every line.
- Post-processing: `src/audio/build/voice.mjs` pitches down, then applies EQ, saturation,
  compression, slapback delay and hall reverb.
- Format: 22.05 kHz mono 16-bit WAV.
- Unknown lab names, which have no pre-rendered "<lab> wins" line, fall back at runtime to the
  browser's `speechSynthesis` voice. No audio from it is stored.

## Rebuilding

```sh
node src/audio/build/generate.mjs sfx music
pip install piper-tts faster-whisper
# download en_US-john-medium.onnx (+ .onnx.json) and en_US-norman-medium.onnx from rhasspy/piper-voices
python3 src/audio/build/voice_takes.py --model en_US-john-medium.onnx --model en_US-norman-medium.onnx --out /tmp/voice-takes
VOICE_TAKES=/tmp/voice-takes node src/audio/build/generate.mjs voice
```

Piper synthesis is random, so a rebuild produces different, but still verified, announcer takes.
