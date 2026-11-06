// Lab presentation: accent colour and the sigil file in assets/ui/sigils. Unknown labs fall back to
// the neutral "independent" sigil so new roster entries still render.
const LABS = {
  openai: { name: "OpenAI", color: "#10a37f", sigil: "openai" },
  anthropic: { name: "Anthropic", color: "#d97757", sigil: "anthropic" },
  "google-deepmind": { name: "Google DeepMind", color: "#4c8bf5", sigil: "google-deepmind" },
  xai: { name: "xAI", color: "#c9ced6", sigil: "xai" },
  meta: { name: "Meta", color: "#3d7bff", sigil: "meta" },
  "microsoft-ai": { name: "Microsoft AI", color: "#14b8a6", sigil: "microsoft" },
  "mistral-ai": { name: "Mistral AI", color: "#ff7a1a", sigil: "mistral" },
  ssi: { name: "Safe Superintelligence", color: "#e6d7a3", sigil: "ssi" },
  "thinking-machines": { name: "Thinking Machines", color: "#a98bff", sigil: "thinking-machines" },
  nvidia: { name: "NVIDIA", color: "#84cc16", sigil: "nvidia" },
  cohere: { name: "Cohere", color: "#ff7f6e", sigil: "cohere" },
  deepseek: { name: "DeepSeek", color: "#5b7bff", sigil: "deepseek" },
  "world-labs": { name: "World Labs", color: "#34c38f", sigil: "world-labs" },
  "eureka-labs": { name: "Eureka Labs", color: "#f5a524", sigil: "eureka-labs" },
  "ami-labs": { name: "AMI Labs", color: "#e0457b", sigil: "thinking-machines" },
  uoft: { name: "University of Toronto", color: "#c0c8d8", sigil: "eureka-labs" },
  independent: { name: "Independent", color: "#9aa4b2", sigil: "independent" },
};

const ALIASES = {
  deepmind: "google-deepmind",
  google: "google-deepmind",
  microsoft: "microsoft-ai",
  mistral: "mistral-ai",
  "safe-superintelligence": "ssi",
  "x-ai": "xai",
  "meta-ai": "meta",
  "meta-superintelligence-labs": "meta",
  "spacex-xai": "xai",
  "university-of-toronto": "uoft",
  "university-of-toronto-emeritus": "uoft",
  "advanced-machine-intelligence-labs": "ami-labs",
};

export function labKey(lab) {
  const slug = String(lab || "independent").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return LABS[slug] ? slug : ALIASES[slug] || slug;
}

/** A fighter's own accent colour when the character data has one, else their lab's. */
export function fighterAccent(fighter) {
  return fighter?.color || fighter?.accent || labInfo(fighter?.lab).color;
}

/** First name for tight spots (grid tiles, team banners): "Fei-Fei Li" -> "Fei-Fei". */
export function shortName(fighter) {
  if (!fighter) return "";
  return fighter.shortName || String(fighter.name || fighter.id).split(/\s+/)[0];
}

export function labInfo(lab) {
  const key = labKey(lab);
  const known = LABS[key];
  if (known) return { key, ...known };
  return { key, name: lab ? String(lab) : LABS.independent.name, color: LABS.independent.color, sigil: "independent" };
}
