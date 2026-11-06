# Release verification

Final release check of Frontier Showdown, run on 6 November 2026 between 14:59 and 16:17 (UTC+7).

- **Static build:** `npm run build` output (`dist/`) served by a plain static file server under `/frontier-showdown/` at `http://127.0.0.1:5173/frontier-showdown/`, the same layout as GitHub Pages.
- **Live site:** [ryanng1403.github.io/frontier-showdown](https://ryanng1403.github.io/frontier-showdown/) (the build currently deployed from `main`).
- **Driver:** `tools/qa/play-verify.mjs`, Puppeteer with Google Chrome 1280×720 (desktop) and an emulated 844×390 phone (touch events, 3× pixel density). It plays every screen through the real UI: mouse clicks and keyboard on desktop, taps and the on-screen stick and buttons on mobile. It never calls game internals to make progress, and reads state only to check results. During every match it records console errors, page errors, failed requests, audio and image errors, and any fighter that stays in one non-neutral state for more than 5 s of game time.

The full logs, one JSON file per run, are in the project store under `media/release/results/`. Screenshots referenced below are in `media/release/` in the same store (`/cursor/stores/bc-104b886f-f07d-4daa-86b7-4f55ef10bb9f/media/release/`).

## Checklist

| # | Check | Result |
| --- | --- | --- |
| 1 | `npm test`: 354 tests | **Pass**: 354 passed, 0 failed |
| 2 | `npm run build`: WebP art, Opus and MP3 audio, service worker | **Pass** |
| 3 | 2v2 mid-round KO gets a scaled heavy hit, and the KO ring only appears when the round ends (new test in `tests/tag.test.mjs`) | **Pass** |
| 4 | Legacy runner game retired: files, scripts and art removed, and `server.mjs` serves only the new game | **Pass** |
| 5 | Full flow: title, mode, select, stage, versus, fight, results, rematch, then pause to select | **Pass** in all 14 local matches |
| 6 | Four 1v1 and four 2v2 matches covering all 16 fighters as Player 1 | **Pass**: eight 1v1 and four 2v2 matches; every fighter played as P1 |
| 7 | Specials, supers, throws and blocks for every Player 1 fighter | **Pass**: each P1 fighter landed all three specials (all four for Elon) and the super; every match had throws and blocks |
| 8 | 2v2 tags, assist A, assist B, the Assist button and hold-to-hand-off | **Pass** in all four 2v2 matches and the mobile 2v2 |
| 9 | Rematch resets to round 1, 0–0, full health; pause, then character select closes the match | **Pass** in every match |
| 10 | Mobile touch: one 1v1 and one 2v2 with stick, buttons, Simple specials (SP), Throw, Block and Tag | **Pass**: both matches, with every special and super through the SP button |
| 11 | Refresh mid-match: resume prompt, settings and picks persist | **Pass** |
| 12 | Offline reload: the service worker serves the game | **Pass**: locally and on the live site |
| 13 | Live GitHub Pages smoke test: 1v1, 2v2 and mobile | **Pass**: 0 console errors, 0 failed requests |
| 14 | No console errors, page errors, failed requests or stuck fighters in any match | **Pass** on the final build (see the defects below) |
| 15 | Authorship: every commit on `main` and this branch authored and committed by Nguyễn Thuận Phát, with no `Co-authored-by` trailers | **Pass**: all 129 commits on `main` and every commit on this branch |

## Matches

Player 1 is driven by the script, using the keyboard on desktop and touch on mobile, against the Normal CPU. Matches 1v1-a to 1v1-h and 2v2-a ran on the first build of this branch. The rest ran again after the fixes below, and mobile 2v2 and offline ran on the final build. The CPU won every match; the scripted player cycles through its move list rather than playing to win.

| Match | Player 1 | CPU | Stage | Result |
| --- | --- | --- | --- | --- |
| 1v1-a | Sam | Dario | Grand Palais | Pass |
| 1v1-b | Mark | Elon | Bharat Mandapam | Pass |
| 1v1-c | Demis | Jensen | Oakland Federal Court | Pass, CPU finisher |
| 1v1-d | Ilya | Arthur | OpenAI Mission Bay | Pass, CPU finisher |
| 1v1-e | Elon | Andrej | Anthropic 500 Howard | Pass |
| 1v1-f | Dario | Sam | DeepMind King's Cross | Pass |
| 1v1-g | Arthur | Ilya | Meta Hacker Square | Pass, CPU finisher |
| 1v1-h | Jensen | Demis | NVIDIA Voyager | Pass, CPU finisher |
| 2v2-a | Andrej & Yann | Liang & Mustafa | Colossus Memphis | Pass: 5 tags, 9 assists |
| 2v2-b | Liang & Mustafa | Geoffrey & Noam | Microsoft Fairwater | Pass: 5 tags, 6 assists |
| 2v2-c | Geoffrey & Noam | Chris & Fei-Fei | DeepSeek Hangzhou | Pass: 5 tags, 4 assists |
| 2v2-d | Chris & Fei-Fei | Andrej & Yann | AMI Labs Paris | Pass: 4 tags, 5 assists |
| mobile-1v1 | Noam (touch) | Fei-Fei | Oakland Federal Court | Pass |
| mobile-2v2 | Yann & Chris (touch) | Sam & Mark | DeepMind King's Cross | Pass: 5 tags, 4 assists; the game ran at 60 fps |
| live-1v1 | Sam | Elon | Grand Palais (live site) | Pass |
| live-2v2 | Dario & Jensen | Demis & Fei-Fei | OpenAI Mission Bay (live site) | Pass: 4 tags, 4 assists |
| live-mobile | Mark (touch) | Ilya | Meta Hacker Square (live site) | Pass |

## Refresh and resume

A 2v2 (Sam & Jensen vs Elon & Noam, Anthropic 500 Howard) was played into round 2 at 0–1, then the page was reloaded.

- Before the match, the round timer was changed from 99 s to 60 s with the Settings arrow, and music from 35 % to 40 % with the slider. Both values were still set after the reload, and the resumed round started at 59 s.
- After the reload, the prompt read "Resume your match? Tag Team · Round 2 · 0–1. Sam & Jensen vs Elon & Noam." with **Resume** focused. Resuming restored round 2, the 0–1 score, both teams and the stage.
- After leaving to character select and reloading again, the menus opened in 2v2 with the last picks restored (`lastPicks` held both teams), and the select cursor started on Sam.

## Offline

Once the service worker controlled the page, its caches held the app shell (202 files) and the assets used so far. With the network disabled, a reload booted to the title screen and a CPU vs CPU match played (fight phase reached, hits landed). The same check passed on the live site.

## Defects found and fixed

| Defect | Fix |
| --- | --- |
| On a fresh load with a saved match, the title screen's delayed focus took DOM focus away from the resume dialog. Keyboard and gamepad input still went to the dialog, but screen readers and Tab started on "Press Start". | The title screen no longer takes focus while a dialog is open, and gets it back when the dialog closes. Confirm dialogs now focus their default button when they open (`src/ui/screens/title.js`, `src/ui/overlays/confirm.js`). |
| Touch play logged "Ignored attempt to cancel a touchstart event with cancelable=false" (4 times in one 2v2) when a second finger landed during a gesture. | The touch layer calls `preventDefault()` only when the event is cancelable (`src/ui/touch/touch-controls.js`). |
| A 2v2 point fighter knocked out mid-round got the full-screen KO ring meant for the round-ending KO. | A scaled heavy hit marks a mid-round fall; the ring is reserved for the KO that ends the round (`src/combat/match.js`, with a test). |

Driver issues fixed during the run (not game defects): stage thumbnails 9 to 12 sit outside the visible strip and are now scrolled into view before clicking; the touch driver no longer sends a touch-end without a touch; mobile runs enable Simple specials in Settings > Touch before playing; settings are changed through the real controls. One earlier mobile run flagged a CPU fighter in a single attack state for over 5 seconds of wall-clock time. The stuck check now counts game frames, excluding hit-stop and super freezes. The final mobile 2v2, which ran at 60 fps, flagged nothing, and no match on the final build reported a stuck fighter.

## Evidence

Screenshots (store `media/release/`):

| Flow | Files |
| --- | --- |
| Title, select, stage, versus | `01-title.jpg`, `02-select-2v2-empty.jpg`, `03-select-2v2-locked.jpg`, `04-stage-select.jpg`, `05-versus-2v2.jpg` |
| 1v1 fight | `06-fight-1v1-special.jpg`, `07-fight-1v1-super.jpg`, `08-fight-1v1-throw.jpg`, `09-fight-1v1-block.jpg`, `12-fight-1v1-finish.jpg` |
| 2v2 fight | `10-fight-2v2-tag.jpg`, `11-fight-2v2-assist.jpg`, `28-gameplay-2v2.gif` |
| Results | `13-results-1v1.jpg`, `14-results-2v2.jpg` |
| Mobile | `15-mobile-settings-simple-specials.jpg`, `16-mobile-1v1-special.jpg`, `17-mobile-1v1-super.jpg`, `18-mobile-2v2-tag.jpg` |
| Refresh and resume | `19-refresh-settings-changed.jpg`, `20-refresh-resume-prompt.jpg`, `21-refresh-resumed-round2.jpg`, `22-refresh-select-remembers-picks.jpg` |
| Offline | `23-offline-title.jpg`, `24-offline-fight.jpg` |
| Live site | `25-live-title.jpg`, `26-live-2v2-tag.jpg`, `27-live-mobile-super.jpg` |

The README images in `docs/media/` come from the same runs.

To rerun:

```sh
npm i --no-save puppeteer-core
npm run build && npm run preview          # serves dist/ at http://localhost:5173/frontier-showdown/
node tools/qa/play-verify.mjs --url http://localhost:5173/frontier-showdown/ --out /tmp/qa
node tools/qa/play-verify.mjs --url https://ryanng1403.github.io/frontier-showdown/ --suite smoke --out /tmp/qa-live
```
