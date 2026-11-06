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
| `music(id, { fade, restart, volume })` | Exponential crossfade between tracks. `menu` streams `assets/frontier-soundtrack.mp3`; the others are sample-exact loops. |
| `announce(idOrText, { delay, gap, interrupt })` | Announcer queue: lines never overlap, and the music ducks under them. Unknown text falls back to `speechSynthesis`. |
| `announceWinner(lab, { side })` | Takes a lab name, id or `{ lab }`, for example `"Google DeepMind"` or `"openai"`. Players can be given as `player1` and `player2`. A lab without a recorded line plays the winning `side`'s "Player one/two wins" line when `side` (0 or 1) is given. |
| `setVolume(bus, 0..1)`, `setMuted(bus, bool)`, `getVolume`, `isMuted`, `volumes()` | Buses are `master`, `music`, `sfx` and `voice`. Values persist to `localStorage` (`frontier.audio.*`), and the gain applied is the value squared. |
| `setSlowMotion(on, { rate, ramp, sting })` | Pitches active and new SFX down, low-passes SFX and music, slows the music, and plays the slow-mo stings. |
| `setPaused(on)` | Muffles the music under a pause menu. |
| `unlock()`, `ready`, `load(ids)`, `stopAll()`, `stopMusic()`, `dispose()` | |

Sound ids and per-sound defaults (bus, variants, pitch and volume spread, voice limit) are listed in `catalog.js`.

## Event mapping (`events.js`)

| Event | Payload fields read | Sound |
| --- | --- | --- |
| `hit` | `weight`/`strength`/`move.{weight,id,damage}`, `counter`, `throw`, `blocked`, `x` | `hit.light`, `hit.heavy` (medium hits are pitched up), `hit.counter` or `throw.slam` |
| `block` | `guardBreak`, `x` | `hit.block` |
| `ko` | `double`, `slowmo` (s), `x` | `ko.impact`, `body.fall`, slow-motion, then "K.O." or "Double K.O." |
| `roundStart` | `round`, `final`, `maxRounds`, `fightDelay`, `announceFight` | "Round 1/2/3" or "Final round", then "Fight!", and switches the music to `fight` |
| `roundEnd` | `reason` (`time` or `draw`), `perfect`, `matchOver`, `matchWinner`/`winner`, `winnerLab` | "Time!", "Draw!", "Perfect!", then "<lab> wins!" and the `victory` music |
| `tag`, `special`, `super` | `x` | `tag.in`, `stinger.special`, `stinger.super` |

Optional events, handled if the engine emits them: `fight` (announces "Fight!" now, replacing the timer), `finishThem`, `matchEnd`, `attack`/`whiff` (whoosh by weight), `throw`/`grab`, `throwBreak`, `jump`, `land`, `dash`, `knockdown`, `step` (`run` flag or `anim`), `animEvent` (`{ type, anim, x }` forwarded from atlas frame events), `slowmo` (`{ active, rate }`; when present, the engine drives slow motion and KO no longer does), `pause` and `resume`.

To resolve the winner's lab, pass `labOf(winner, event)` in `attach` options if the payload carries no `winnerLab`. Numeric sides are treated as 0-based (0 is Player 1) unless `oneBasedSides` is set.

## Footsteps

Steps fire on atlas frames whose events have a type matching `step`, `foot` or `contact`. Both `animations.<name>.events: [{frame, type}]` and `frames[i].events: [{type}]` are accepted. Walk and run cycles without events fall back to frames `0` and `n/2`. Either the engine forwards frame events as `animEvent`, or the audio module polls `game.state.fighters[]` (`anim`, `frame`, `character`, `x`) when `attach(game, { atlases })` gets atlases. Polling switches off as soon as an `animEvent` arrives.
