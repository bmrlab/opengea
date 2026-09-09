import type { AgentDurableObjectNamespace } from "@gea-ai/agent-sdk";
import type { ObservationMemory } from "./context/memory";
declare module "@gea-ai/agent-sdk" {
  interface AgentDurableObjectBindings {
    OBSERVATIONS: AgentDurableObjectNamespace<ObservationMemory>;
  }
}
