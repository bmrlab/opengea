import type {
  AgentMessageForTools,
  InferAgentUITools,
} from "@gea-ai/agent-sdk";
import type tools from "./tools/index";

// TypeScript and the CLI consume the same Tool Set. No generated registry is needed.
export type NewsMessage = AgentMessageForTools<
  InferAgentUITools<[typeof tools]>
>;
