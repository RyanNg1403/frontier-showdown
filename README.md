# Frontier Showdown

A fast top-down boss fight across six distinct research-lab-inspired arenas. Each map spans connected districts with its own cover layout, hazards, gates, and routes. Break three rift anchors to strip Jev's ward, then defeat your rival. The 75-second clock triggers a faster rift surge; waiting it out never wins the fight.

Choose Sam Altman or Dario Amodei independently for the runner and chaser. These are cosmetic skins: the game continues to use the same runner and chaser abilities, Jev decisions, and balance values in either role. Mirror Echo uses the matching Codex or Claude companion. Skin definitions keep optional stat and skill-override slots for future variants; those slots are currently unset and are not applied by the simulation.

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
- Phase Dash: Space
- Soul burst: X
- Mirror echo decoy: Q
- Rift hook: E
- Lantern guard and parry: C
- Touch screens: movement stick and ability buttons

## Modes and Jev decisions

Choose **Manual** or **Auto Mode** before a run. In Auto Mode Jev controls both fighters, each with a separate objective and action choice. The ghost locks one rift anchor until it breaks, then selects another; it cannot pursue Jev while his ward remains. Safe, clear shots stay aimed at that anchor while movement skills and evasions run. Jev becomes the ghost's target only after all anchors break. The decision eye in the upper corner shows or hides the cards. Manual shows Jev's card; Auto Mode shows Jev's card and the ghost's card.

System One returns typed Choices over one named game-state snapshot. Jev chooses an immediate action each request, refreshes the ghost's movement style every 2.5 seconds, and chooses a new strategic plan at expiry or after a meaningful interruption. AI-vs-AI mode also gets an independent ghost action; routine calls ask only for actions that need choosing now. The cards show selected actions and their leading Choice probabilities, not generated reasoning text.

The model receives a 64-by-40 ASCII arena with compact actor, anchor, hazard, and projectile state. Exact actor and threat coordinates complement the grid; cover is represented in the topology. Repeated histories are capped, and the ghost's locked objective is sent only in AI-vs-AI mode. The game engine owns navigation, telegraphs, cooldowns, collisions, damage, and progression.

Jev uses Rift Rend, aimed power blasts, a three-shot Soul Salvo, Rift Rush, rift mines, wraithlings, meteor strikes, and Shadow Dodge. After all three anchors break, Rift Aegis blocks two incoming hits during a short shield window. The ghost has five distinct skills: Phase Dash (burst movement with an afterimage), Rift Hook, Mirror Echo, Lantern Guard, and Soul Burst. Both fighters share each map's hazards and can be damaged or slowed by them.

## Arenas

- **The Last Crossing** — four linked customs-office districts with loops around a guarded central cross.
- **Cinderworks** — broken forge spines, furnace islands, timed steam vents, and warning-marked lava.
- **Drowned Archive** — offset shelves, water currents, quicksand, long lanes, and narrow reading-room gates.
- **Verdant Glasshouse** — hedge loops, reflecting pools, trellis cuts, and moving swarms.
- **Meridian Vault** — rotated radial ribs, reliquaries, looped chambers, and arc fields.
- **The Fractured Span** — island bridges, long flanks, diagonal routes, and volatile rift surges.

## Art direction and references

The generated map surfaces and arena materials take inspiration from OpenAI's crafted glass, library, and hospitality details, and Anthropic's pale wood, plants, library spaces, and terracotta accents. They are original interpretations, not copies of office floorplans. Research references:

- [Woods Bagot: OpenAI's new headquarters and its material direction](https://www.woodsbagot.com/global-studio/news/project/designing-for-ai-how-two-designers-are-bringing-the-human-touch-to-high-tech/)
- [SFGATE: Inside OpenAI's San Francisco headquarters, May 2026](https://www.sfgate.com/tech/article/openai-san-francisco-headquarters-22259754.php)
- [San Francisco Standard: Anthropic's office and workplace details, May 2026](https://sfstandard.com/2026/05/03/ai-sf-tourist-s-guide-our-new-robot-overlords-hometown/)
- [Anthropic leadership portraits](https://www.anthropic.com/company/leadership) · [OpenAI Forum event featuring Sam Altman](https://forum.openai.com/public/videos/event-replay-sam-altman-on-building-the-future-of-ai-2026-04-06)

The game bundles six generated floor paintings, two transparent 4-by-3 leader sprite sheets, two transparent 4-by-3 companion sheets, a 4-by-4 skill-icon sheet, a landing illustration, and local biome-specific music composed with the Web Audio API.
