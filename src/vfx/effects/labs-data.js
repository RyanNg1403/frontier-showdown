// Lab palettes and motifs shared by projectiles, specials, supers and tags.
// colors: [core, light, main, dark]. Motifs are abstract parody shapes, not logos.
export const LABS = {
  openai: { name: "OpenAI", colors: ["#ffffff", "#7ff5d1", "#10a37f", "#0b3d33"], orb: "lab.openai", motif: "knot" },
  anthropic: { name: "Anthropic", colors: ["#fff4e6", "#f4b183", "#d97757", "#5c2a1a"], orb: "lab.anthropic", motif: "asterisk" },
  deepmind: { name: "Google DeepMind", colors: ["#ffffff", "#9db4ff", "#4b6bff", "#3a1f8f"], orb: "lab.deepmind", motif: "twinkle" },
  xai: { name: "xAI", colors: ["#ffffff", "#d0d0d8", "#7a7a88", "#16161c"], orb: "lab.xai", motif: "slash" },
  meta: { name: "Meta", colors: ["#ffffff", "#8fd3ff", "#0082fb", "#0a2a6b"], orb: "lab.meta", motif: "infinity" },
  nvidia: { name: "NVIDIA", colors: ["#f4ffe0", "#b6f23a", "#76b900", "#1f3a00"], orb: "lab.nvidia", motif: "circuit" },
  mistral: { name: "Mistral", colors: ["#fff3c2", "#ffb000", "#ff6a00", "#b83a00"], orb: "lab.mistral", motif: "gust" },
  deepseek: { name: "DeepSeek", colors: ["#e8f6ff", "#6ec6ff", "#2f6bff", "#0a1f5c"], orb: "lab.deepseek", motif: "whirl" },
};

export const LAB_IDS = Object.keys(LABS);

export const NEUTRAL = { name: "Neutral", colors: ["#ffffff", "#ffe9a8", "#ffb02e", "#5a2a00"], orb: "impact.flash", motif: "asterisk" };

export function labOf(id) {
  return LABS[id] || NEUTRAL;
}

export function labColors(opts = {}) {
  if (opts.colors) return opts.colors;
  if (opts.color) return ["#ffffff", opts.color, opts.color, "#111"];
  return labOf(opts.lab).colors;
}
