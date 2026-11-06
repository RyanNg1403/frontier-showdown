# Frontier Showdown

A 1v1 and 2v2 tag-team fighting game in the style of Mortal Kombat, starring sixteen fictionalised AI-lab founders and researchers. Specials, supers, throws, finishers, assists and tag-ins, fought across twelve arenas modelled on real AI venues and events. It runs in the browser on desktop and phones.

**Play it:** [ryanng1403.github.io/frontier-showdown](https://ryanng1403.github.io/frontier-showdown/)

<p align="center">
  <img src="docs/media/gameplay.gif" alt="A 2v2 tag-team match in progress (CPU vs CPU)" width="560" />
</p>

<p align="center">
  <img src="docs/media/select-2v2.jpg" alt="2v2 character select with both teams locked in" width="49%" />
  <img src="docs/media/fight-super.jpg" alt="A super move banner during a 1v1 fight" width="49%" />
</p>
<p align="center">
  <img src="docs/media/fight-2v2.jpg" alt="A 2v2 fight: Geoffrey calls Noam in for an assist" width="49%" />
  <img src="docs/media/results.jpg" alt="Match results with stats and the Rematch button" width="49%" />
</p>
<p align="center">
  <img src="docs/media/mobile-fight.jpg" alt="The phone layout with on-screen stick and buttons" width="60%" />
</p>

All screenshots come from real matches played through the release build (see [docs/release-verification.md](docs/release-verification.md)).

## Modes

- **1v1 Duel**: one fighter each, best of three rounds against the clock.
- **2v2 Tag Team**: pick a pair. Tag out to recover red health, call your partner in for a one-move assist, and beat both opponents to take the round. When a point fighter falls, the partner is forced in for Last One Standing.
- **Matchups** for either format: **Versus CPU**, **Local Versus** (two players on one keyboard or two gamepads) and **CPU vs CPU** (spectate).

Settings cover control remapping (keyboard and gamepad), touch layout, audio levels, CPU difficulty, round timer, match length, and reduced motion and flashes. A match that is closed or refreshed between rounds can be resumed on the next visit.

## Controls

| Action | Player 1 | Player 2 (numpad / laptop) | Gamepad |
| --- | --- | --- | --- |
| Move, jump, crouch | `W` `A` `S` `D` | Arrow keys | D-pad or left stick |
| Light punch / heavy punch | `U` / `I` | `4` / `5` (`,` / `.`) | X / Y |
| Light kick / heavy kick | `J` / `K` | `1` / `2` (`M` / `/`) | A / B |
| Block (hold; add down for lows) | `L` | `6` (Right Shift) | RB or RT |
| Tag (2v2) | `O` | `8` (`;`) | LB |
| Assist (2v2) | `P` | `9` (`'`) | LT |
| Pause | `Esc` | | Start |

- **Throw**: light punch + light kick up close. Press the same buttons as you are grabbed to tech it.
- **Specials** use fighting-game motions written for a fighter facing right, such as `QCF+P` (down, down-forward, forward, punch). Each fighter's moves are shown on the select screen and in the pause menu's move list.
- **Super**: `QCF,QCF+HP` with a full three-bar meter.
- **2v2**: tap Tag for assist A, back + Tag for assist B, and hold Tag to hand off to your partner.
- **Finisher**: when "Final Commit!" appears after the deciding round, enter the winner's finisher motion up close.
- **Phones and tablets**: a floating stick and on-screen buttons (punches, kicks, Block, Throw, Tag). The optional SP button performs specials (SP, forward + SP, back + SP) and the super (down + SP) without motions. It can be added to the home screen and played fullscreen in landscape.

## Roster

| Fighter | Lab | Title | Style |
| --- | --- | --- | --- |
| Sam Altman | OpenAI | The Iterative Deployer | All-rounder |
| Dario Amodei | Anthropic | The Responsible Scaler | Defensive zoner |
| Mark Zuckerberg | Meta | Send Me Location | Grappler |
| Elon Musk | SpaceX / xAI | The Technoking | Rushdown |
| Demis Hassabis | Google DeepMind | The Grandmaster | Setup and traps |
| Jensen Huang | NVIDIA | The Leather Jacket | Big-body grappler |
| Ilya Sutskever | Safe Superintelligence | The Visionary | Zoner and teleporter |
| Arthur Mensch | Mistral AI | Le Mistral | Speed rushdown |
| Andrej Karpathy | Anthropic | The Vibe Coder | Technical all-rounder |
| Yann LeCun | AMI Labs | The Contrarian | Zoner and anti-air |
| Liang Wenfeng | DeepSeek | The Quiet Whale | Glass cannon |
| Mustafa Suleyman | Microsoft AI | The Containment Specialist | Space control |
| Geoffrey Hinton | University of Toronto | Godfather of AI | Counter fighter |
| Noam Shazeer | OpenAI | The T in GPT | Stance switch |
| Chris Olah | Anthropic | The Interpreter | Traps and debuffs |
| Fei-Fei Li | World Labs | Godmother of AI | Setup zoner |

Every fighter has three specials, a super, a stylised non-violent finisher and two 2v2 assists. Arenas include the Grand Palais (AI Action Summit), Bharat Mandapam (AI Impact Summit), OpenAI Mission Bay, Anthropic's 500 Howard, DeepMind King's Cross, NVIDIA Voyager, xAI's Colossus in Memphis, Microsoft Fairwater and DeepSeek in Hangzhou.

This is a parody. Every fighter is a fictionalised tribute, and no lab endorses the game.

## Develop

Requires Node.js 22 or later.

```sh
npm install
npm start        # dev server at http://127.0.0.1:4173 (serves the source directly)
npm test         # unit tests for combat, rules, characters, UI integration and audio
```

## Build and deploy

```sh
npm run build    # writes dist/: WebP art, Opus + MP3 audio, manifest.json and a service worker
npm run preview  # serves dist/ at http://localhost:5173/frontier-showdown/ like GitHub Pages
```

`npm run build` needs `ffmpeg` on the PATH (or `FFMPEG=/path/to/ffmpeg`) for audio and the `sharp` dev dependency for images. Without them it copies the originals.

Every push to `main` runs `.github/workflows/pages.yml` (tests, build, deploy to GitHub Pages). All URLs are relative, so the site works under any subpath. The service worker precaches the app shell for each build and caches fighter, stage and audio files on first use. Return visits load from cache, and the game also starts offline. Progress (last mode, stage and picks, per-fighter stats, match history and the resume point) is kept in IndexedDB, and settings in localStorage.

Tools:

- `node tools/qa/play-verify.mjs --url <site>` plays full matches through the real UI in Chrome: keyboard and touch, 1v1 and 2v2, refresh and resume, and an offline reload. Install the driver first with `npm i --no-save puppeteer-core`.
- `node tools/perf/measure.mjs --url <site>` measures memory, transfer size and frame pacing.
- `tools/sprites3d/` is the sprite pipeline.
