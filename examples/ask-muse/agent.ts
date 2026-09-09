import { defineAgent, env } from "@gea-ai/agent-sdk";

export default defineAgent({
  name: "ask-muse",
  slug: "ask-muse",
  description: "Answer questions by searching the user's MuseDAM assets.",
  model: "auto",
  modelRequirements: {
    agentic: 0.8,
    copywriting: 0.6,
    speed: 0.6,
  },
  computer: { enabled: false },
  env: {
    MUSEDAM_MCP_CLIENT_ID: env.value({
      description: "Public OAuth client ID registered with MuseDAM.",
    }),
  },
});
