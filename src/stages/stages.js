import { STAGE_GEOMETRY, STAGE_LAYERS } from "./layers.generated.js";

const { worldW, groundY, floorTop, viewW } = STAGE_GEOMETRY;

// Every stage is inspired by a real AI-world venue or event (as of Nov 2026).
// `realWorld` carries the venue, event and date; `sources` back each claim and are
// mirrored in assets/stages/SOURCES.md. `labs` lists the roster labs the venue is
// tied to (roster lab ids: openai, anthropic, meta, xai, google-deepmind, nvidia,
// ssi, mistral, ami-labs, deepseek, microsoft-ai, world-labs).
//
// Ambient coordinates: `layer` effects use that layer's native pixel space
// (what you see in assets/stages/<id>/<layer>.png); `world` effects use
// logical world pixels (x in [0, worldW], y in [0, 720]).
const DEFINITIONS = [
  {
    id: "grand-palais-ai-action-summit",
    name: "Grand Palais: AI Action Summit",
    labs: ["mistral", "world-labs"],
    realWorld: {
      kind: "summit",
      event: "AI Action Summit",
      venue: "Grand Palais",
      city: "Paris, France",
      date: "2025-02-10/2025-02-11",
      dateLabel: "10–11 February 2025",
    },
    location: "Grand Palais nave, Paris · 10–11 Feb 2025",
    fieldNotes:
      "The AI Action Summit at the Grand Palais, Paris, 10–11 February 2025. Fei-Fei Li opened it under the glass vault and Macron told everyone to download Le Chat. The closing plenary gets settled the old way.",
    sources: [
      { label: "Élysée: AI Action Summit programme, Grand Palais, 10–11 Feb 2025", url: "https://www.elysee.fr/en/sommet-pour-l-action-sur-l-ia/programme" },
      { label: "TechCrunch: Fei-Fei Li gives the opening speech at the Grand Palais (10 Feb 2025)", url: "https://techcrunch.com/2025/02/10/ai-pioneer-fei-fei-li-says-governments-should-embrace-a-pragmatic-attitude-instead-of-an-ideological-one-on-ai/" },
      { label: "TechCrunch: Mistral gets down to business at the summit (10 Feb 2025)", url: "https://techcrunch.com/2025/02/10/mistral-gets-down-to-business/" },
    ],
    palette: {
      note: "Limestone cream and oxidized bronze under a navy night vault, with plum banners and carpet and pale-blue screen light. Gold is the accent; plum and navy share the shadows.",
      key: "#e9d9b0",
      shadow: "#070a14",
    },
    ambient: [
      { type: "glow", layer: "far", amp: 0.35, speed: 0.5, flicker: 0.01 },
      { type: "glow", layer: "mid", amp: 0.5, speed: 0.8 },
      { type: "glow", layer: "near", amp: 0.7, speed: 1.4, flicker: 0.05 },
      { type: "crowd", layer: "near", slice: 10, rate: 2.2 },
      { type: "flashes", layer: "near", rate: 1.6, yMin: 224, yMax: 246 },
      { type: "motes", count: 22, region: { y0: 60, y1: 420 }, color: "#d8d0ff", parallax: 0.3, drift: "float" },
    ],
  },
  {
    id: "bharat-mandapam-ai-impact-summit",
    name: "Bharat Mandapam: AI Impact Summit",
    labs: ["openai", "anthropic", "google-deepmind", "meta", "nvidia", "mistral", "ami-labs"],
    realWorld: {
      kind: "summit",
      event: "India AI Impact Summit 2026",
      venue: "Bharat Mandapam",
      city: "New Delhi, India",
      date: "2026-02-16/2026-02-20",
      dateLabel: "16–20 February 2026",
    },
    location: "Bharat Mandapam Expo Arena, New Delhi · 16–20 Feb 2026",
    fieldNotes:
      "The India AI Impact Summit at Bharat Mandapam, New Delhi, 16–20 February 2026. Altman, Amodei, Hassabis, LeCun and Mensch shared the opening ceremony on 19 February under the conch-shell roof, at the first global AI summit hosted in the Global South. The Expo halls get the undercard.",
    sources: [
      { label: "PIB (Government of India): summit 16–20 Feb 2026 at Bharat Mandapam", url: "https://www.pib.gov.in/PressNoteDetails.aspx?ModuleId=3&NoteId=157023&id=157023&lang=1&reg=1" },
      { label: "Indian Express: dates, venue and Expo Arena", url: "https://indianexpress.com/article/technology/artificial-intelligence/ai-impact-summit-2026-dates-venue-how-to-attend-10533465/" },
      { label: "Times of India: CEOs at the 19 Feb 2026 opening ceremony", url: "https://timesofindia.indiatimes.com/technology/tech-news/what-google-ceo-sundar-pichai-openais-sam-altman-and-other-tech-ceos-said-at-india-ai-impact-summit-2026/articleshow/128553819.cms" },
    ],
    palette: {
      note: "Saffron and marigold light against deep indigo architecture, with teal accents from the LED walls and warm white in the hanging lights. Indigo owns the shadows; saffron owns the highlights.",
      key: "#ffb648",
      shadow: "#030713",
    },
    ambient: [
      { type: "glow", layer: "far", amp: 0.55, speed: 0.8, flicker: 0.02 },
      { type: "glow", layer: "mid", amp: 0.6, speed: 1.0, flicker: 0.03 },
      { type: "glow", layer: "near", amp: 0.7, speed: 1.5, flicker: 0.05 },
      { type: "crowd", layer: "near", slice: 10, rate: 2.6 },
      { type: "flashes", layer: "near", rate: 1.2, yMin: 226, yMax: 248 },
      { type: "motes", count: 30, region: { y0: 40, y1: 500 }, color: "#ffcf7a", parallax: 0.35, drift: "float" },
    ],
  },
  {
    id: "musk-v-openai-oakland",
    name: "Oakland Federal Court: Musk v. OpenAI",
    labs: ["openai", "xai", "ssi", "microsoft-ai"],
    realWorld: {
      kind: "court",
      event: "Musk v. Altman / OpenAI jury trial",
      venue: "Ronald V. Dellums Federal Building (U.S. District Court, N.D. Cal.)",
      city: "Oakland, California",
      date: "2026-04/2026-05-18",
      dateLabel: "late April – 18 May 2026",
    },
    location: "Federal courtroom, Oakland · verdict 18 May 2026",
    fieldNotes:
      "Musk v. OpenAI at the Ronald V. Dellums Federal Building, Oakland, which ended with a verdict on 18 May 2026. Musk, Altman, Sutskever and Nadella all took the stand, and the jury needed under two hours. This rematch is not advisory.",
    sources: [
      { label: "Reuters: OpenAI defeats Musk's lawsuit (18 May 2026)", url: "https://www.reuters.com/legal/government/elon-musk-loses-lawsuit-against-openai-2026-05-18/" },
      { label: "AP: court rejects Musk's claims after a three-week trial", url: "https://apnews.com/article/musk-openai-trial-verdict-0b9b0bfaffe96f2c930341f52dfe4f8c" },
      { label: "KQED: testimony at the Ronald V. Dellums Federal Building", url: "https://www.kqed.org/news/12083224/former-openai-exec-calls-decision-to-remove-sam-altman-a-hail-mary-during-musk-trial" },
      { label: "WIRED: Ilya Sutskever testifies", url: "https://www.wired.com/story/ilya-sutskever-testifies-musk-v-altman-trial/" },
    ],
    palette: {
      note: "Deep walnut panelling and cream plaster under cold fluorescent tubes, with navy carpet and the red, white and gold of the flags as the only saturated notes. Shadows are warm brown; highlights are clinical white.",
      key: "#f2ead8",
      shadow: "#0b0705",
    },
    ambient: [
      { type: "glow", layer: "far", amp: 0.4, speed: 0.4, flicker: 0.03 },
      { type: "glow", layer: "mid", amp: 0.4, speed: 0.6 },
      { type: "scan", layer: "far", rect: [5, 138, 108, 70], color: "#9fc4ff", period: 2.8 },
      { type: "crowd", layer: "near", slice: 12, rate: 1.1 },
      { type: "motes", count: 30, region: { y0: 40, y1: 520 }, color: "#f4ead2", parallax: 0.4, drift: "float" },
    ],
  },
  {
    id: "openai-mission-bay",
    name: "OpenAI HQ: Mission Bay",
    labs: ["openai"],
    realWorld: {
      kind: "lab-hq",
      event: "OpenAI headquarters",
      venue: "1455 & 1515 Third Street, Mission Bay",
      city: "San Francisco, California",
      date: "2023-10/2025-03",
      dateLabel: "leased Oct 2023, opened Mar 2025",
    },
    location: "1455 Third St, Mission Bay, San Francisco · after hours",
    fieldNotes:
      "OpenAI's headquarters at 1455 Third Street, Mission Bay, San Francisco: leased in October 2023 and formally opened in March 2025. Two former Uber towers joined by a sky bridge, rain on the glass, and nobody left to hold the door.",
    sources: [
      { label: "SF Standard: OpenAI leases 1455 and 1515 Third St (27 Oct 2023)", url: "https://sfstandard.com/2023/10/27/openai-uber-headquarters-mission-bay/" },
      { label: "The Real Deal: Mission Bay HQ grand opening in March 2025", url: "https://therealdeal.com/san-francisco/2025/06/16/openai-searches-for-offices-amid-glean-lease/" },
    ],
    palette: {
      note: "Pale limestone and warm oak lit by brushed-gold pendants, cut with deep night teal from the glass. Keep fighters' rim light warm; shadows fall to teal-black.",
      key: "#e8c27a",
      shadow: "#0b1414",
    },
    ambient: [
      { type: "glow", layer: "far", amp: 0.45, speed: 0.7 },
      { type: "glow", layer: "mid", amp: 0.5, speed: 1.1, flicker: 0.02 },
      { type: "rain", region: { y0: 0, y1: 470 }, count: 90, color: "#9fd3d0", alpha: 0.22, parallax: 0.15 },
      { type: "shafts", layer: "far", xs: [120, 330, 540], top: 40, color: "#f2cf88", alpha: 0.07 },
      { type: "motes", count: 26, region: { y0: 260, y1: 600 }, color: "#f6dca0", parallax: 0.6, drift: "float" },
    ],
  },
  {
    id: "anthropic-500-howard",
    name: "Anthropic HQ: 500 Howard",
    labs: ["anthropic"],
    realWorld: {
      kind: "lab-hq",
      event: "Anthropic headquarters",
      venue: "500 Howard Street (Foundry Square IV), SoMa",
      city: "San Francisco, California",
      date: "2023/2026-04",
      dateLabel: "since late 2023; direct lease Apr 2026",
    },
    location: "500 Howard St, SoMa, San Francisco · the hour before close",
    fieldNotes:
      "Anthropic's headquarters at 500 Howard Street, San Francisco: home since late 2023 and locked in with a direct lease in April 2026. This is the reading-room floor on 'AI Alley', reimagined in oak and ivy. The lamps flicker on every heavy.",
    sources: [
      { label: "CoStar: Anthropic converts 500 Howard St sublease to a direct lease (7 Apr 2026)", url: "https://www.costar.com/article/390354131/how-anthropic-is-growing-its-office-empire-in-downtown-san-francisco" },
      { label: "Bisnow: Anthropic cements 240K SF lease on Howard Street", url: "https://www.bisnow.com/news/san-francisco/office/anthropic-cements-240k-sf-lease-howard-street-133989" },
    ],
    palette: {
      note: "Honey oak and terracotta warmed by amber lamplight, with moss-green living walls and a violet-to-ember dusk sky in the windows. Shadows are deep umber; the only cool hue is the window sky.",
      key: "#f0a64a",
      shadow: "#0f0804",
    },
    ambient: [
      { type: "glow", layer: "far", amp: 0.5, speed: 0.6, flicker: 0.015 },
      { type: "glow", layer: "mid", amp: 0.55, speed: 0.9, flicker: 0.02 },
      { type: "glow", layer: "near", amp: 0.5, speed: 0.8 },
      { type: "shafts", layer: "far", xs: [140, 330, 515], top: 50, color: "#e9a35a", alpha: 0.08 },
      { type: "motes", count: 48, region: { y0: 120, y1: 600 }, color: "#f3c98a", parallax: 0.55, drift: "float" },
    ],
  },
  {
    id: "deepmind-kings-cross",
    name: "Google DeepMind: King's Cross",
    labs: ["google-deepmind"],
    realWorld: {
      kind: "lab-hq",
      event: "Google DeepMind headquarters",
      venue: "S2 Building, Handyside Street, King's Cross",
      city: "London, UK",
      date: "2020",
      dateLabel: "occupied from 2020",
    },
    location: "S2, Handyside St, King's Cross, London · 2 a.m.",
    fieldNotes:
      "Google DeepMind's headquarters in the S2 building on Handyside Street, King's Cross, London, which DeepMind has occupied since 2020. Rain over London, a wall-sized Go board replaying AlphaGo, and a protein fold turning in its case.",
    sources: [
      { label: "King's Cross: S2 Handyside, fully let to Google", url: "https://www.kingscross.co.uk/s2-handyside" },
      { label: "Bisnow: Google allocates S2 to DeepMind, occupancy in 2020", url: "https://www.bisnow.com/news/london/technology/the-180k-sf-tech-office-move-that-the-whole-of-london-property-missed-98006" },
    ],
    palette: {
      note: "Midnight navy and cool grey under electric-blue screen light, with violet accents on the hologram and a few warm-white windows across the city. Blue does the key light; violet is the rim.",
      key: "#7aa8ff",
      shadow: "#01030c",
    },
    ambient: [
      { type: "glow", layer: "far", amp: 0.55, speed: 0.9, flicker: 0.03 },
      { type: "glow", layer: "mid", amp: 0.6, speed: 1.1, flicker: 0.03 },
      { type: "glow", layer: "near", amp: 0.6, speed: 1.2, flicker: 0.04 },
      { type: "rain", region: { y0: 40, y1: 440 }, count: 80, color: "#8fa6d8", alpha: 0.2, parallax: 0.15, layerClip: { layer: "far", x0: 0, x1: 383 } },
      { type: "scan", layer: "far", rect: [447, 37, 208, 141], color: "#7fb2ff", period: 3.2 },
      { type: "scan", layer: "far", rect: [393, 168, 87, 107], color: "#b48cff", period: 2.1 },
      { type: "motes", count: 18, region: { y0: 200, y1: 560 }, color: "#8fb6ff", parallax: 0.7, drift: "float" },
    ],
  },
  {
    id: "meta-hacker-square",
    name: "Meta HQ: Hacker Square",
    labs: ["meta"],
    realWorld: {
      kind: "lab-hq",
      event: "Meta headquarters",
      venue: "Hacker Square, 1 Hacker Way",
      city: "Menlo Park, California",
      date: "2011-12",
      dateLabel: "campus since Dec 2011",
    },
    location: "Hacker Square, 1 Hacker Way, Menlo Park · dusk",
    fieldNotes:
      "Hacker Square at Meta's 1 Hacker Way campus in Menlo Park, home since December 2011. The courtyard has HACK in the paving, nine grey crosswalk stripes and a main street of cafés. Festoon lights come on at dusk and the hackathon turns physical.",
    sources: [
      { label: "CNBC: Hacker Square and its 'HACK' paving", url: "https://www.cnbc.com/2019/07/18/facebook-illegal-crosswalk-showed-early-hack-ethic.html" },
      { label: "City of Menlo Park: Meta Campus, 1 Hacker Way", url: "https://www.menlopark.gov/Government/Departments/Community-Development/Projects/Completed-projects/Meta-Campus" },
      { label: "Youseum: campus laid out like a small town since 2011", url: "https://youseum.org/?key=7&num=SiliconValley" },
    ],
    palette: {
      note: "Dusk violet sky over brick red, mustard and teal storefronts, with warm cream festoon bulbs and window light. Violet carries the shadows; the bulbs are the only near-white.",
      key: "#ffd27a",
      shadow: "#0a0614",
    },
    ambient: [
      { type: "glow", layer: "far", amp: 0.6, speed: 1.0, flicker: 0.02 },
      { type: "glow", layer: "mid", amp: 0.55, speed: 1.2, flicker: 0.02 },
      { type: "glow", layer: "near", amp: 0.5, speed: 1.0 },
      { type: "motes", count: 16, region: { y0: 0, y1: 560 }, color: "#c9925a", parallax: 0.9, drift: "fall" },
      { type: "fireflies", count: 14, region: { y0: 200, y1: 520 }, color: "#ffe2a0", parallax: 0.5 },
    ],
  },
  {
    id: "nvidia-voyager",
    name: "NVIDIA HQ: Voyager",
    labs: ["nvidia"],
    realWorld: {
      kind: "lab-hq",
      event: "NVIDIA headquarters",
      venue: "Voyager building",
      city: "Santa Clara, California",
      date: "2022-02",
      dateLabel: "opened Feb 2022",
    },
    location: "Voyager, Santa Clara · after the GTC 2026 keynote",
    fieldNotes:
      "NVIDIA's Voyager building in Santa Clara, opened in February 2022, at night after the GTC 2026 keynote on 16 March. Triangle skylights glow green over 'the mountain' of living walls. Whoever owns the compute owns the round.",
    sources: [
      { label: "Metropolis: Voyager's triangular roof and skylights", url: "https://metropolismag.com/projects/nvidia-new-tech-campus/" },
      { label: "Insight Lighting: Voyager opened February 2022", url: "https://insightlighting.com/projects/nvidia-headquarters-voyager/" },
      { label: "NVIDIA: GTC 2026 keynote, SAP Center, 16 Mar 2026", url: "https://investor.nvidia.com/events-and-presentations/events-and-presentations/event-details/2026/GTC-2026-Keynote-2026-HhZOL0SIV4/default.aspx" },
    ],
    palette: {
      note: "Near-black steel and charcoal under acid lime-green skylights, with deep forest green from the planted terraces and a little cool white. Green is the only light source that matters.",
      key: "#9dff3c",
      shadow: "#020503",
    },
    ambient: [
      { type: "glow", layer: "far", amp: 0.6, speed: 0.7, flicker: 0.01 },
      { type: "glow", layer: "mid", amp: 0.65, speed: 1.1, flicker: 0.02 },
      { type: "glow", layer: "near", amp: 0.6, speed: 1.4 },
      { type: "haze", y: 450, h: 100, color: "#2f6b1f", alpha: 0.3, parallax: 0.3, speed: 5 },
      { type: "motes", count: 30, region: { y0: 120, y1: 560 }, color: "#a8ff5a", parallax: 0.6, drift: "rise" },
    ],
  },
  {
    id: "xai-colossus-memphis",
    name: "Colossus: Memphis",
    labs: ["xai"],
    realWorld: {
      kind: "datacenter",
      event: "Colossus and Colossus 2 supercomputers (SpaceXAI, formerly xAI)",
      venue: "Former Electrolux factory, Boxtown",
      city: "Memphis, Tennessee",
      date: "2024/2026-01",
      dateLabel: "Colossus 2024; Colossus 2 online Jan 2026",
    },
    location: "Colossus, former Electrolux plant, Memphis · night shift",
    fieldNotes:
      "Colossus, inside a former Electrolux factory in Memphis. It went live in 2024 and Colossus 2 came online in January 2026, on the way to about 1.2 million GPUs. The turbines roar outside and the racks glow ice-white inside.",
    sources: [
      { label: "DCD: Colossus in the former Electrolux factory; Colossus 2 online in January", url: "https://www.datacenterdynamics.com/en/news/spacexai-launching-two-additional-data-center-campuses-in-mississippi-to-further-expand-colossus-2/" },
      { label: "Epoch AI: Colossus 2 data centre profile", url: "https://epoch.ai/data/ai-data-centers/directory/colossus-2" },
    ],
    palette: {
      note: "Graphite and corrugated steel under icy white-blue rack LEDs, with warning amber and a faint sodium-orange sky through the loading bays. Cold light inside, warm light outside.",
      key: "#cfe6ff",
      shadow: "#020306",
    },
    ambient: [
      { type: "glow", layer: "far", amp: 0.75, speed: 1.6, flicker: 0.06, blink: true },
      { type: "glow", layer: "mid", amp: 0.75, speed: 2.0, flicker: 0.08, blink: true },
      { type: "glow", layer: "near", amp: 0.6, speed: 1.3, flicker: 0.04 },
      { type: "haze", y: 440, h: 110, color: "#3a4a5e", alpha: 0.32, parallax: 0.25, speed: 4 },
      { type: "steam", world: true, emitters: [{ x: 360, y: 566 }, { x: 1240, y: 566 }], color: "#c9d8ea", alpha: 0.22, rise: 180, period: 4.2 },
    ],
  },
  {
    id: "microsoft-fairwater",
    name: "Microsoft Fairwater: Wisconsin",
    labs: ["microsoft-ai"],
    realWorld: {
      kind: "datacenter",
      event: "Fairwater AI datacenter",
      venue: "Fairwater, Mount Pleasant campus",
      city: "Mount Pleasant, Wisconsin",
      date: "2026-06-23",
      dateLabel: "fully operational 23 June 2026",
    },
    location: "Fairwater, Mount Pleasant, Wisconsin · cold aisle",
    fieldNotes:
      "Microsoft's Fairwater AI datacenter in Mount Pleasant, Wisconsin, fully operational since 23 June 2026. Microsoft calls it the world's most powerful supercomputer. Cold air rises through the floor and red beacons sweep at thermal limits.",
    sources: [
      { label: "Microsoft Source: first Mount Pleasant facility complete (23 Jun 2026)", url: "https://news.microsoft.com/source/2026/06/23/microsoft-completes-construction-on-first-datacenter-facility-in-mount-pleasant-wisconsin/" },
      { label: "DCD: Fairwater campus now operational", url: "https://www.datacenterdynamics.com/en/news/microsofts-first-data-center-at-mount-pleasant-wisconsin-campus-now-operational/" },
    ],
    palette: {
      note: "Near-black rack steel in a cold teal haze, pricked by green and cyan status LEDs, with yellow cable ladders and rare red warning beacons. Keep the midtones blue-green; red is for alarms only.",
      key: "#5fe0d0",
      shadow: "#020409",
    },
    ambient: [
      { type: "glow", layer: "far", amp: 0.8, speed: 1.8, flicker: 0.08, blink: true },
      { type: "glow", layer: "mid", amp: 0.8, speed: 2.2, flicker: 0.1, blink: true },
      { type: "glow", layer: "near", amp: 0.6, speed: 1.4, flicker: 0.05 },
      { type: "beacon", layer: "far", points: [[131, 30], [534, 87], [148, 140]], color: "#ff3b30", rate: 1.3 },
      { type: "haze", y: 430, h: 120, color: "#1f6f73", alpha: 0.35, parallax: 0.25, speed: 4 },
      { type: "steam", world: true, emitters: [{ x: 420, y: 560 }, { x: 1180, y: 560 }, { x: 1720, y: 560 }], color: "#9fe3e8", alpha: 0.26, rise: 170, period: 4.4 },
    ],
  },
  {
    id: "deepseek-hangzhou",
    name: "DeepSeek HQ: Hangzhou",
    labs: ["deepseek"],
    realWorld: {
      kind: "lab-hq",
      event: "DeepSeek headquarters",
      venue: "Huijin International Building, 169 Huancheng North Road, Gongshu District",
      city: "Hangzhou, China",
      date: "2025-01-14",
      dateLabel: "registered HQ, visited by press 14 Jan 2025",
    },
    location: "Huijin International Building, Hangzhou · late drizzle",
    fieldNotes:
      "DeepSeek's headquarters in the Huijin International Building, Hangzhou, where reporters were turned away at the lifts on 14 January 2025. Drizzle on the glass and blue code on every screen. It is a quiet room for a lab that makes the whole market loud.",
    sources: [
      { label: "21st Century Business Herald: on-site visit to Huijin International Building (14 Jan 2025)", url: "https://www.21jingji.com/article/20250114/herald/5f428a5a55d92b0a9da4a493d5fc7ae5.html" },
      { label: "CB Insights: DeepSeek headquarters address", url: "https://www.cbinsights.com/company/deepseek" },
    ],
    palette: {
      note: "Deep ink blue and cool grey with cyan screen light, jade green from the willows and bamboo, and a single warm lantern accent. Blue for everything; amber only for the lanterns.",
      key: "#7fd8ff",
      shadow: "#01040c",
    },
    ambient: [
      { type: "glow", layer: "far", amp: 0.5, speed: 0.8, flicker: 0.02 },
      { type: "glow", layer: "mid", amp: 0.55, speed: 1.0, flicker: 0.02 },
      { type: "glow", layer: "near", amp: 0.55, speed: 1.2, flicker: 0.03 },
      { type: "rain", region: { y0: 88, y1: 520 }, count: 90, color: "#8fb4e0", alpha: 0.2, parallax: 0.15, layerClip: { layer: "far", x0: 138, x1: 531 } },
      { type: "scan", layer: "far", rect: [20, 187, 74, 48], color: "#7fd8ff", period: 2.4 },
      { type: "scan", layer: "far", rect: [546, 188, 79, 44], color: "#7fd8ff", period: 3.1 },
      { type: "motes", count: 16, region: { y0: 200, y1: 560 }, color: "#9fd6ff", parallax: 0.7, drift: "float" },
    ],
  },
  {
    id: "ami-labs-paris",
    name: "AMI Labs HQ: Paris Rooftops",
    labs: ["ami-labs", "mistral"],
    realWorld: {
      kind: "lab-hq",
      event: "AMI Labs headquarters (Advanced Machine Intelligence)",
      venue: "10 Rue de Penthièvre, 8th arrondissement",
      city: "Paris, France",
      date: "2026-03-10",
      dateLabel: "founded Dec 2025; $1.03B seed 10 Mar 2026",
    },
    location: "Rooftops above Rue de Penthièvre, Paris 8e · sunset",
    fieldNotes:
      "The rooftops above AMI Labs' headquarters at 10 Rue de Penthièvre, Paris. Yann LeCun's world-model lab was founded in December 2025 and raised a $1.03B seed on 10 March 2026. This is the Paris that hosted VivaTech 2026, where Mistral launched Mistral Compute.",
    sources: [
      { label: "Wikipedia: Advanced Machine Intelligence Labs (founded Dec 2025, $1.03B seed)", url: "https://en.wikipedia.org/wiki/Advanced_Machine_Intelligence_Labs" },
      { label: "MIT Technology Review: LeCun on Paris-headquartered AMI Labs (22 Jan 2026)", url: "https://www.technologyreview.com/2026/01/22/1131661/yann-lecuns-new-venture-ami-labs/" },
      { label: "aventure: AMI Labs HQ at 10 Rue de Penthièvre, 75008 Paris", url: "https://aventure.vc/companies/ami-labs-paris-fr" },
      { label: "Tech Times: VivaTech 2026, Mistral Compute and LeCun's AMI debut (20 Jun 2026)", url: "https://www.techtimes.com/articles/318752/20260620/vivatech-2026-closes-decade-public-festival-europe-ai-buildout-moves-construction-phase.htm" },
    ],
    palette: {
      note: "Burnt orange, amber and crimson sunset over blue-grey zinc roofs, with deep plum shadows and warm yellow windows. The sky does the key light; every silhouette gets an orange rim.",
      key: "#ff9a3c",
      shadow: "#120610",
    },
    ambient: [
      { type: "glow", layer: "far", amp: 0.5, speed: 0.7, flicker: 0.02 },
      { type: "glow", layer: "mid", amp: 0.55, speed: 0.9 },
      { type: "glow", layer: "near", amp: 0.5, speed: 1.0 },
      { type: "shafts", layer: "far", xs: [60, 300, 520], top: 20, color: "#ffb15c", alpha: 0.07 },
      { type: "motes", count: 24, region: { y0: 80, y1: 560 }, color: "#ffcf8a", parallax: 0.6, drift: "float" },
    ],
  },
];

export const STAGES = DEFINITIONS.map((def) => {
  const layers = STAGE_LAYERS[def.id];
  return Object.freeze({
    ...def,
    palette: { ...def.palette, swatches: layers.swatches },
    bounds: { left: 0, right: worldW, wallMargin: 56 },
    camera: { minX: 0, maxX: worldW - viewW, startX: (worldW - viewW) / 2 },
    groundY,
    floorTop,
    spawn: { p1: worldW / 2 - 200, p2: worldW / 2 + 200 },
    layers: layers.layers,
    px: layers.px,
  });
});

export const STAGE_IDS = STAGES.map((stage) => stage.id);

export function getStageMeta(id) {
  const stage = STAGES.find((entry) => entry.id === id);
  if (!stage) throw new Error(`Unknown stage "${id}". Known stages: ${STAGE_IDS.join(", ")}`);
  return stage;
}

export { STAGE_GEOMETRY };
