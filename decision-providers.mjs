function buildJevRequest(specification) {
  const { npc_context: _npcContext, ...state } = specification.state;
  const questions = Object.fromEntries(
    Object.entries(specification.questions).map(([name, question]) => [
      name,
      {
        type: question.type,
        instructions: question.instructions,
        criteria: question.choices,
      },
    ]),
  );

  return {
    state,
    model: "jev-latest",
    questions,
  };
}

function formatOpenAIInstructions(instructions) {
  if (typeof instructions === "string") return instructions;
  const goal = instructions?.goal || "Choose the best action for the supplied game state.";
  const attackContext = instructions?.attack_context
    ? "Current combat evidence: " + JSON.stringify(instructions.attack_context)
    : "";
  return [goal, attackContext].filter(Boolean).join("\n");
}

function buildOpenAIRequest(specification) {
  const questions = Object.entries(specification.questions).map(([name, question]) => ({
    type: question.type,
    name,
    instructions: specification.input_mode === "vision_only" && typeof question.instructions !== "string"
      ? question.instructions.goal
      : formatOpenAIInstructions(question.instructions),
    choices: Object.entries(question.choices).map(([value, description]) => ({
      value,
      description: String(description),
    })),
  }));

  const text = specification.input_mode === "vision_only"
    ? "Watch this full-arena image of a top-down duel. RUNNER and CHASER labels identify the fighters. The runner must break the three glowing rift anchors, then defeat the chaser; the chaser must hunt the runner. Infer cover, hazards, telegraphed attacks, and safe routes from the image. Choose actions using visible evidence. Ability availability is enforced by the game."
    : JSON.stringify({ state: specification.state, game_mode: specification.game_mode });
  return {
    model: "gpt-6-luna",
    input: specification.vision
      ? [{ role: "user", content: [
          { type: "input_text", text },
          { type: "input_image", image_url: specification.vision.image_url },
        ] }]
      : text,
    questions,
  };
}

function normalizeJevResponse(response) {
  return {
    answers: response?.answers && typeof response.answers === "object" ? response.answers : {},
  };
}

function normalizeOpenAIAnswer(answer) {
  const probabilities = Array.isArray(answer?.probabilities)
    ? Object.fromEntries(answer.probabilities.flatMap((entry) => {
        if (entry?.value === undefined) return [];
        const probability = Number(entry.probability);
        return [[
          String(entry.value),
          Number.isFinite(probability) ? probability : null,
        ]];
      }))
    : {};
  return { ...answer, probabilities };
}

function normalizeOpenAIResponse(response) {
  const answers = Array.isArray(response?.answers) ? response.answers : [];
  return {
    answers: Object.fromEntries(answers.flatMap((answer) => (
      typeof answer?.name === "string"
        ? [[answer.name, normalizeOpenAIAnswer(answer)]]
        : []
    ))),
  };
}

export const decisionProviders = {
  jev: {
    apiUrl: "https://api.typesafe.ai/v1/systemone",
    keyNames: ["JEV_API_KEY", "TYPESAFE_API_KEY"],
    buildRequest: buildJevRequest,
    normalizeResponse: normalizeJevResponse,
  },
  openai: {
    apiUrl: "https://api.openai.com/v1/decisions",
    keyNames: ["OPENAI_API_KEY"],
    buildRequest: buildOpenAIRequest,
    normalizeResponse: normalizeOpenAIResponse,
  },
};

const decisionProviderAliases = {
  decisions: "openai",
  "openai-decisions": "openai",
  typesafe: "jev",
};

export function resolveDecisionProvider(value) {
  const configured = (value || "openai").trim().toLowerCase();
  return decisionProviderAliases[configured] || configured;
}
