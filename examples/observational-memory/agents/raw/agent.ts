import { defineAgent } from "@gea-ai/agent-sdk";
import { agentCore } from "@gea-ai/agent-sdk/agent-core";
import { MAIN_MODEL } from "../../models";
export default defineAgent({
  engine: agentCore(),
  name: "raw",
  slug: "raw",
  model: MAIN_MODEL,
  computer: { enabled: false },
  context: false,
});
