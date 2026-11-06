# `src/audio`: Frontier Showdown audio

```js
import { createAudio } from "./audio/index.js";

const audio = createAudio();          // preloads SFX and voice, then music; unlocks on first gesture
const detach = audio.attach(game, { atlases }); // map game.events to sounds (atlases optional, for footsteps)
audio.music("menu");                  // "menu" | "select" | "fight" | "victory" | null, crossfades
audio.ui("confirm");                  // "move" | "confirm" | "back" | "lock"
audio.play("hit.heavy", { x: 640, pitch: -1, volume: 0.8 });
```

Preview every sound at `/assets/audio/preview.html`. The page needs a server that serves `src/` as well as `assets/`.

## API

| Call | Notes |
| --- | --- |
| `play(id, opts)` | Returns `{ stop(fade), ended, duration }`, or `null` while the sound is still loading. `opts`: `volume` (linear), `gainDb`, `pitch` (semitones), `rate`, `pan` (-1..1) or `x` (px, 1280 wide), `delay` (s), `variant`, `variation` (0 turns off the randomness), `loop`, `bus`. |
| `music(id, { fade, restart, volume })` | Exponential crossfade between tracks. `menu`, `select` and `fight` stream through a media element and are never decoded into memory; `victory` is a short decoded one-shot. |
| `announce(id, { delay, gap, interrupt })` | Announcer queue: lines never overlap, and the music ducks under them. Clip ids (`announcer.ko`) play the clip, or its recorded Kenney line (`CLIP_FALLBACK` in `catalog.js`) when the clip fails to load. Ids without a recorded line are skipped with a warning. |
| `loadVoices(fighters)`, `loadGroup("fight", { fighters })` | Voice clips (`assets/audio/voices/`, listed in `manifest.json`) load per pack: the announcer pack on the way to character select, each fighter's pack on the stage screen and with the match. Naming fighters frees every other fighter's decoded pack (about 3 MB each). Nothing voiced loads at start-up. |
| `speak(id, { queue, channel, delay })` | Plays a fighter clip such as `sam.special.prompt_burst`; one line at a time per channel (default: the speaker). `queue` waits in the announcer queue. `hush()` stops every fighter line. |
| `announceWinner(lab, { side })` | Takes a lab name, id or `{ lab }`, for example `"Google DeepMind"` or `"openai"`. Players can be given as `player1` and `player2` ("Player one/two... Winner!"). Every roster lab plays the recorded "Winner!". An unknown lab plays the winning `side`'s player line when `side` (0 or 1) is given, otherwise "Winner!". |
| `setVolume(bus, 0..1)`, `setMuted(bus, bool)`, `getVolume`, `isMuted`, `volumes()` | Buses are `master`, `music`, `sfx` and `voice`. Values persist to `localStorage` (`frontier.audio.*`), and the gain applied is the value squared. |
| `setSlowMotion(on, { rate, ramp, sting })` | Pitches active and new SFX down, low-passes SFX and music, slows the music, and plays the slow-mo stings. |
| `setPaused(on)` | Muffles the music under a pause menu. |
| `unlock()`, `ready`, `load(ids)`, `stopAll()`, `stopMusic()`, `dispose()` | |

Sound ids and per-sound defaults (bus, variants, pitch and volume spread, voice limit) are listed in `catalog.js`.

Every SFX, music and `voice/` announcer file is a real recording (CC0, CC BY or CC BY-SA); the `voices/` clips are AI-generated character voices (see `assets/ATTRIBUTIONS.md`). `node src/audio/build/recordings.mjs [sfx|voice|music]` downloads the sources and rebuilds `assets/audio/`. It needs ffmpeg, unzip, and 7z or `pip install py7zr`. When the game's audio module is running, the UI's menu and HUD cues (`src/ui/index.js`) play these recordings too, instead of the oscillator fallback in `src/ui/core/audio.js`.

## Event mapping (`events.js`)

| Event | Payload fields read | Sound |
| --- | --- | --- |
| `hit` | `weight`/`strength`/`move.{weight,id,damage}`, `counter`, `throw`, `blocked`, `x` | `hit.light`, `hit.heavy` (medium hits are pitched up), `hit.counter` or `throw.slam` |
| `block` | `guardBreak`, `x` | `hit.block` |
| `ko` | `side`, `double`, `roundOver`, `slowmo` (s), `x` | Round-ending KO: `ko.impact`, `body.fall`, slow motion, then "K.O.!" or "Double K.O.!" clip (once per round). A 2v2 point fighter falling mid-round (followed by `lastStanding` for that side, or `roundOver: false`): `hit.heavy` and `body.fall` only. |
| `roundStart` | `round`, `final`, `maxRounds`, `fightDelay`, `announceFight` | "Round one/two!" or "Final round!" clip (round 3 of a longer match keeps the recorded line), then "Fight!", and switches the music to `fight`. Round 1 cuts any versus lines still playing. |
| `roundEnd` | `reason` (`time` or `draw`), `perfect`, `matchOver`, `matchWinner`/`winner`, `winnerFighter` | "Time up!", "Draw!", "Perfect!". A round won short of the match: the winner's taunt over the victory pose. Match over: "You win!"/"You lose!" (one human side) or "Player one/two!", then the winner's own win clip and the `victory` music; the lab's recorded "Winner!" only if that clip can't load. |
| `tag` | `side`, `in`, `forced`, `x` | `tag.in`, plus `stinger.tag` when the partner of a fallen point fighter is forced in, and the incoming fighter's tag-in clip |
| `special`, `super` | `fighter`, `moveId`, `x` | `stinger.special` / `stinger.super` plus the fighter's clip for that move id |
| `matchStart` | `sides[].team`, `sides[].control` | Tracks point fighters and which sides are human |

Menu screens (`screenVoice`, wired by the engine to the UI's `screen` event): character select opens with "Choose your fighter!"; the versus screen plays each side's point fighter's versus line as the portraits slide in.

Optional events, handled if the engine emits them: `fight` (announces "Fight!" now, replacing the timer), `finishThem`, `matchEnd`, `attack`/`whiff` (whoosh by weight), `throw`/`grab`, `throwBreak`, `jump`, `land`, `dash`, `knockdown`, `step` (`run` flag or `anim`), `animEvent` (`{ type, anim, x }` forwarded from atlas frame events), `slowmo` (`{ active, rate }`; when present, the engine drives slow motion and KO no longer does), `pause` and `resume`.

To resolve the winner's lab, pass `labOf(winner, event)` in `attach` options if the payload carries no `winnerLab`. Numeric sides are treated as 0-based (0 is Player 1) unless `oneBasedSides` is set.

## Footsteps

Steps fire on atlas frames whose events have a type matching `step`, `foot` or `contact`. Both `animations.<name>.events: [{frame, type}]` and `frames[i].events: [{type}]` are accepted. Walk and run cycles without events fall back to frames `0` and `n/2`. Either the engine forwards frame events as `animEvent`, or the audio module polls `game.state.fighters[]` (`anim`, `frame`, `character`, `x`) when `attach(game, { atlases })` gets atlases. Polling switches off as soon as an `animEvent` arrives.
