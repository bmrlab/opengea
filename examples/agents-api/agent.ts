import { defineAgent } from "@gea-ai/agent-sdk";
import { agentCore } from "@gea-ai/agent-sdk/agent-core";
import { defaultComputer } from "@gea-ai/agent-sdk/computer";

export default defineAgent({
  name: "prepared-workspace",
  slug: "prepared-workspace",
  description:
    "Read an uploaded file and a prepared Computer, then save a report.",
  model: "auto",
  modelRequirements: { agentic: 0.8 },
  engine: agentCore(),
  artifacts: { tools: true },
  computer: defaultComputer({
    filesystem: { scope: "chat", durability: "durable" },
  }),
});
