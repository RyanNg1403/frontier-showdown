# Frontier Showdown

POV: the office tour went hostile. Pick a runner, pick a chaser, crack three anchors, and settle it across six research-lab arenas. Winner reaches AGI first.

<p align="center">
  <img src="docs/screenshots/arena-combat.png" alt="Frontier Showdown combat in the OpenAI Glass Atrium" width="49%" />
  <img src="docs/screenshots/runner-skills.png" alt="A runner launching its matching lab mascot to shove the chaser" width="49%" />
</p>

## Run

Requires Node.js 20+.

```sh
cp .env.example .env
# Add JEV_API_KEY to .env, then:
npm start
```

Or set `JEV_ENV_FILE` to an existing key file. Open [localhost:4173](http://127.0.0.1:4173). No key? The local tactical fallback still plays.

## Play

Choose **Manual** or **Auto Mode**. Auto Mode lets System One call the plays for both fighters; Manual puts you in the driver’s seat. Stasis Cast pins you in place while it charges. Mascot Charge sends your lab mascot down a lane to shove the chaser back.

- Move: **WASD** or arrows · Aim/fire: **pointer** or **Z**
- Phase Dash: **Space** · Mirror Echo: **Q** · Rift Hook: **E**
- Lantern Guard: **C** · Soul Burst: **X** · Stasis Cast: **R** · Mascot Charge: **G**

Six arenas: **OpenAI Glass Atrium**, **OpenAI Compute Studio**, **Anthropic Reading Room**, **Anthropic Living Studio**, **Paris AI Action Hall**, and **AI Impact Expo Pavilion**. Pick a map to read its field notes first.
