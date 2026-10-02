# JEVil — Rift Hunt

A fast top-down boss fight across six afterlife arenas. Each map is four times the former arena's floor area, divided into connected districts with its own cover layout, hazards, gates, and routes. Break three rift anchors to strip Jev's ward, then defeat the demon. The 75-second clock triggers a faster rift surge; waiting it out never wins the fight.

## Run locally

Use Node.js 20 or newer. Put `JEV_API_KEY` in a local `.env` file, or point `JEV_ENV_FILE` at an existing environment file. The server reads only `JEV_API_KEY` or `TYPESAFE_API_KEY` from that file.

    cp .env.example .env
    # Add your TypeSafe key to .env
    npm start

If your key is already in the sibling jev-cli project:

    JEV_ENV_FILE=../jev-cli/.env npm start

Open http://127.0.0.1:4173. The API key stays on the server. If Jev's API is unavailable, the fight continues with a local tactical fallback.

## Controls

- Move: W A S D or arrow keys
- Aim and fire: pointer or Z
- Dash: Space
- Soul burst: X
- Mirror echo decoy: Q
- Rift hook: E
- Lantern guard and parry: C
- Touch screens: movement stick and ability buttons

## Modes and Jev decisions

Choose **You vs Jev** or **Jev vs Jev** before a run. In the second mode Jev controls both fighters, each with a separate objective and action choice. The ghost locks one rift anchor until it breaks, then selects another; it cannot pursue Jev while his ward remains. Safe, clear shots stay aimed at that anchor while movement skills and evasions run. Jev becomes the ghost's target only after all anchors break. The decision eye in the upper corner shows or hides the cards. Human mode shows Jev's card; AI-vs-AI shows Jev's card and the ghost's card.

System One returns typed Choices over one named game-state snapshot. Jev chooses an immediate action each request, refreshes the ghost's movement style every 2.5 seconds, and chooses a new strategic plan at expiry or after a meaningful interruption. AI-vs-AI mode also gets an independent ghost action; routine calls ask only for actions that need choosing now. The cards show selected actions and their leading Choice probabilities, not generated reasoning text.

The model receives a 64-by-40 ASCII arena with compact actor, anchor, hazard, and projectile state. Exact actor and threat coordinates complement the grid; cover is represented in the topology. Repeated histories are capped, and the ghost's locked objective is sent only in AI-vs-AI mode. The game engine owns navigation, telegraphs, cooldowns, collisions, damage, and progression.

Jev can pounce, phase step, lay rift mines, fire aimed power blasts, launch a three-shot soul salvo, summon wraithlings, call meteor strikes, and sidestep incoming fire. The ghost can dash, turn briefly invisible, split into mirror clones, use a close soul burst, hook across open space, and parry with lantern guard.

## Arenas

- **The Last Crossing** — four linked customs-office districts with loops around a guarded central cross.
- **Cinderworks** — broken forge spines, furnace islands, and timed steam vents.
- **Drowned Archive** — offset shelves, water currents, long lanes, and narrow reading-room gates.
- **Verdant Glasshouse** — hedge loops, reflecting pools, trellis cuts, and spore pockets.
- **Meridian Vault** — rotated radial ribs, reliquaries, looped chambers, and arc fields.
- **The Fractured Span** — island bridges, long flanks, diagonal routes, and volatile rift surges.

## Art and music

The game uses six distinct generated floor paintings, two transparent 4-by-3 combat sprite sheets, and local biome-specific music composed with the Web Audio API. All art and audio are bundled locally.
