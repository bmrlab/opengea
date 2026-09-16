import { defineAgent, env } from "@gea-ai/agent-sdk";

export default defineAgent({
  name: "MuseDAMChat",
  slug: "musedam-chat",
  description: "Search your MuseDAM assets and discuss attached files.",
  model: "auto",
  modelRequirements: {
    agentic: 0.8,
    copywriting: 0.6,
    multimodal: 0.7,
    speed: 0.6,
  },
  computer: { enabled: false },
  artifacts: { tools: true },
  env: {
    MUSEDAM_MCP_CLIENT_ID: env.value({
      description: "Public OAuth client ID registered with MuseDAM.",
    }),
  },
});
