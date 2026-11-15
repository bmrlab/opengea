import type { AgentDurableObjectNamespace } from "@gea-ai/agent-sdk";
declare module "@gea-ai/agent-sdk" {
  interface AgentDurableObjectBindings {
    RESEARCH: AgentDurableObjectNamespace;
  }
}
