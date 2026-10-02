import { defineAgent } from "@gea-ai/agent-sdk";
import agent from "./agent";
import instructions from "./AGENTS.md";
import musedam from "./connectors/musedam";

export default defineAgent({
  ...agent,
  instructions,
  connectors: { musedam },
});
