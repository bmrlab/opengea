import { defineAgent } from "@gea-ai/agent-sdk";
import agent from "./agent";
import instructions from "./AGENTS.md";
import musedam from "./connectors/musedam";
import readNamespaceProbe from "./read-namespace-probe";

export default defineAgent({
  ...agent,
  instructions,
  connectors: { musedam },
  tools: [readNamespaceProbe],
});
