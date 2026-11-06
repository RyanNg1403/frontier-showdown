// Mock stage list for the preview. Thumbnails are downscaled copies of the stage worker's far layers;
// the real list and previews come from src/stages.
const thumb = (id) => new URL(`./stages/${id}.jpg`, import.meta.url).href;

export const MOCK_STAGES = [
  { id: "openai-glass-atrium", name: "Glass Atrium", lab: "OpenAI", preview: thumb("openai-glass-atrium"),
    description: "Rain on the glass, bonsai on the balcony, and a skyline that never sleeps." },
  { id: "openai-compute-studio", name: "Compute Studio", lab: "OpenAI", preview: thumb("openai-compute-studio"),
    description: "Whiteboards full of loss curves. Mind the cables." },
  { id: "anthropic-reading-room", name: "Reading Room", lab: "Anthropic", preview: thumb("anthropic-reading-room"),
    description: "Quiet stacks of constitutions and a very patient librarian." },
  { id: "anthropic-living-studio", name: "Living Studio", lab: "Anthropic", preview: thumb("anthropic-living-studio"),
    description: "Warm wood, soft couches, and no safe place to land." },
  { id: "paris-action-hall", name: "Paris Action Hall", lab: "Independent", preview: thumb("paris-action-hall"),
    description: "A summit hall of flags and gilded ceilings. Diplomacy has failed." },
  { id: "ai-impact-expo", name: "Impact Expo", lab: "Independent", preview: thumb("ai-impact-expo"),
    description: "Booths, banners and a crowd that came to see a demo go wrong." },
  { id: "gpu-datacenter", name: "GPU Datacenter", lab: "NVIDIA", preview: thumb("gpu-datacenter"),
    description: "Forty megawatts of heat and the hum of a million fans." },
];
