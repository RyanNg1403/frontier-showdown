# Asset attributions

## Sam Altman sprite likeness reference

- Photograph: [Sam Altman speaking at TED (cropped)](https://commons.wikimedia.org/wiki/File:Sam_Altman_speaking_at_TED_(cropped).jpg)
- Photographer: Steve Jurvetson
- License: [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/)
- Use: visual identity reference for generated Sam pixel-art sprites. No photograph pixels are included in the game assets.

## Audio: `assets/audio/**`

All music, sound effects and announcer lines are recordings by the people below, used under
CC0, CC BY or CC BY-SA. None of them is synthesized. `node src/audio/build/recordings.mjs`
downloads the sources and rebuilds every file: trims, layers, speed changes, EQ, compression
and loudness normalization. The recipe for each file is in that script.

### Music: `music/*.mp3`

By Kevin MacLeod ([incompetech.com](https://incompetech.com)), licensed under
[Creative Commons: By Attribution 4.0](https://creativecommons.org/licenses/by/4.0/).

| File | Track | Source | Changes |
| --- | --- | --- | --- |
| `music/menu.mp3` | "Five Armies" | [Five Armies.mp3](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Five%20Armies.mp3) | silence trimmed, loudness normalized |
| `music/select.mp3` | "Rynos Theme" | [Rynos Theme.mp3](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Rynos%20Theme.mp3) | first 96 s, fade-out, loudness normalized |
| `music/fight.mp3` | "Cyborg Ninja" | [Cyborg Ninja.mp3](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Cyborg%20Ninja.mp3) | silence trimmed, loudness normalized |
| `music/victory.mp3` | "Fanfare for Space" | [Fanfare for Space.mp3](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Fanfare%20for%20Space.mp3) | first 11 s, fade-out, loudness normalized |

### Character and announcer voices: `voices/*.ogg`

The 143 clips listed in `voices/manifest.json` (14 announcer lines, and each fighter's versus,
taunt, special, super, win and tag-in lines) are AI-generated with OpenAI
`gpt-4o-mini-tts-2025-12-15`, using fictional stock character voices. No real person's voice was
sampled or cloned. The game plays them in place of the recorded announcer below, which stays as
the fallback when a clip can't load (and for "Round three" and "Finish it!").

### Announcer: `voice/*.wav`

| Files | Recording | Author | License |
| --- | --- | --- | --- |
| `round-1`, `round-2`, `round-3`, `round-final`, `fight`, `time`, `draw` ("It's a tie"), `perfect` ("Flawless victory"), `winner`, and `player_1`/`player_2` + `winner` in `wins-player1`, `wins-player2` | [Voiceover Pack: Fighter](https://opengameart.org/content/voiceover-pack-fighter-40-taunts) (recorded by a professional voice actor) | Kenney ([kenney.nl](https://kenney.nl)) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `ko`, and the "K.O." half of `double-ko` | "K.O." from the [Dragon video game announcer](https://opengameart.org/content/dragon-announcer-audio-pack) | VoiceBosch | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| the "Double" half of `double-ko` | "Double kill" from the [Warlord video game announcer](https://opengameart.org/content/warlord-video-game-announcer) | VoiceBosch | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| `finish-them` ("Finish it!") | "GF FINISH IT" from [Game Voice](https://opengameart.org/content/game-voice) | Tim Rockk | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |

`ko.wav` and `double-ko.wav` are adaptations of CC BY-SA 4.0 works and are themselves
licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Every
"<lab> wins" call plays the recorded "Winner!" line.

### Sound effects: `sfx/**`

Freesound recordings are all [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
The build downloads Freesound's high-quality MP3 previews.

| Recording | Author | License | Used in |
| --- | --- | --- | --- |
| [37 hits/punches](https://opengameart.org/content/37-hitspunches) (Ljudbank) | Independent.nu | CC0 1.0 | `hit/light-*`, `hit/heavy-*`, `hit/counter-*`, `throw/slam-1`, `ko/impact`, `ui/lock` |
| [10 impact/shield blocks](https://opengameart.org/content/10-impactshield-blocks) | StarNinjas | CC0 1.0 | `hit/block-*` |
| [Punch in the face](https://freesound.org/people/Huminaatio/sounds/390462/) | Huminaatio | CC0 1.0 | `hit/counter-1`, `ko/impact` |
| [Huge Slap in the Face](https://freesound.org/people/njjjjjjjjjjjjjjjjjjjjjjjj/sounds/564230/) | njjjjjjjjjjjjjjjjjjjjjjjj | CC0 1.0 | `hit/counter-1` |
| [Realistic Punch](https://freesound.org/people/JewTwinz/sounds/244513/) | JewTwinz | CC0 1.0 | `hit/counter-2` |
| [Slap Hit](https://freesound.org/people/qubodup/sounds/222507/) | qubodup | CC0 1.0 | `hit/counter-2`, `throw/break` |
| [Blocking Arm With Hand](https://freesound.org/people/mmasonghi/sounds/321810/) | mmasonghi | CC0 1.0 | `hit/block-*` |
| [SWOSH-01 44.1kHz](https://freesound.org/people/qubodup/sounds/59988/) | qubodup | CC0 1.0 | `whoosh/light-1`, `move/dash-1`, `tag/tag-in` |
| [Basic Melee Swing / Miss / Whoosh](https://freesound.org/people/SypherZent/sounds/420668/) | SypherZent | CC0 1.0 | `whoosh/light-2` |
| [Whoosh](https://freesound.org/people/qubodup/sounds/60013/) | qubodup | CC0 1.0 | `whoosh/medium-1`, `whoosh/heavy-1`, `move/dash-2`, `throw/break` |
| [Woosh (stick swung in the air)](https://freesound.org/people/Dalesome/sounds/352719/) | Dalesome | CC0 1.0 | `whoosh/medium-2`, `whoosh/heavy-2` |
| [Hiking Boot Footsteps on Stone](https://freesound.org/people/Fission9/sounds/521590/) | Fission9 | CC0 1.0 | `move/step-walk-*` |
| [Footsteps Running Away Fading 1](https://freesound.org/people/Rudmer_Rotteveel/sounds/316923/) | Rudmer_Rotteveel | CC0 1.0 | `move/step-run-1..3` |
| [concrete footstep 1](https://freesound.org/people/Yoyodaman234/sounds/166509/) | Yoyodaman234 | CC0 1.0 | `move/step-run-4` |
| [DeLisa Foley scrape 01](https://freesound.org/people/pushkin/sounds/149302/) | pushkin | CC0 1.0 | `move/dash-*` |
| [Jumping Human](https://freesound.org/people/elynch0901/sounds/464488/) | elynch0901 | CC0 1.0 | `move/jump-1` |
| [Human Jumping](https://freesound.org/people/Jummit/sounds/512677/) | Jummit | CC0 1.0 | `move/jump-2` |
| [jump_land.wav](https://freesound.org/people/nhill2003/sounds/572459/) | nhill2003 | CC0 1.0 | `move/land-1` |
| [land a jump.wav](https://freesound.org/people/zepurple/sounds/540272/) | zepurple | CC0 1.0 | `move/land-2` |
| [Body fall.wav](https://freesound.org/people/DylanTheFish/sounds/417994/) | DylanTheFish | CC0 1.0 | `move/body-fall-1`, `hit/heavy-1`, `hit/heavy-3` |
| [Body fall_01.wav](https://freesound.org/people/deleted_user_2104797/sounds/346695/) | deleted_user_2104797 | CC0 1.0 | `move/body-fall-2`, `hit/heavy-2` |
| [BODY FALL - V HVY - DIRT](https://freesound.org/people/leonelmail/sounds/504626/) | leonelmail | CC0 1.0 | `throw/slam-1` |
| [Thud / Falling on wooden floor](https://freesound.org/people/Breviceps/sounds/447922/) | Breviceps | CC0 1.0 | `throw/slam-2` |
| [BodyFall.wav](https://freesound.org/people/000600/sounds/187136/) | 000600 | CC0 1.0 | `throw/slam-2` |
| [Cloth Grab](https://freesound.org/people/alegemaate/sounds/667271/) | alegemaate | CC0 1.0 | `throw/grab-1` |
| [GrabItemCloth.wav](https://freesound.org/people/CJspellsfish/sounds/609569/) | CJspellsfish | CC0 1.0 | `throw/grab-2` |
| [unsheath_sword.wav](https://freesound.org/people/Qat/sounds/107589/) | Qat | CC0 1.0 | `stinger/special`, `stinger/super`, `ui/lock` |
| [Very Big Whoosh](https://freesound.org/people/Paul368/sounds/237980/) | Paul368 | CC0 1.0 | `stinger/special` |
| [hit of orchestral cymbals and bass drum](https://freesound.org/people/Selector/sounds/385011/) | Selector | CC0 1.0 | `stinger/super`, `stinger/tag`, `ko/slowmo-in` (reversed) |
| [thunder](https://freesound.org/people/netaj/sounds/193170/) | netaj | CC0 1.0 | `ko/impact` |
| [Whoosh](https://freesound.org/people/zevcuk/sounds/364638/) | zevcuk | CC0 1.0 | `ko/slowmo-out` |
| [High Five_01.mp3](https://freesound.org/people/121053699/sounds/467997/) | 121053699 | CC0 1.0 | `tag/tag-in` |
| [typewriter.wav](https://freesound.org/people/BMacZero/sounds/160678/) | BMacZero | CC0 1.0 | `ui/move` |
| [Switch Flip #1](https://freesound.org/people/IanStarGem/sounds/278205/) | IanStarGem | CC0 1.0 | `ui/confirm` |
| [MECH-KEYBOARD-01.wav](https://freesound.org/people/newagesoup/sounds/348239/) | newagesoup | CC0 1.0 | `ui/confirm` |
| [click](https://freesound.org/people/OtisJames/sounds/215772/) | OtisJames | CC0 1.0 | `ui/back` |

### Formats

SFX and voice masters are 44.1 kHz mono 16-bit WAV; music masters are stereo MP3.
`npm run build` transcodes all of them to Ogg Opus with an MP3 fallback for GitHub Pages.
