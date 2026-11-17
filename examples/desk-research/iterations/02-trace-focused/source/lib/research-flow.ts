import type { AgentCorePolicyContext, AgentCoreStepSettings } from "@gea-ai/agent-sdk/agent-core";

// Research has two distinct steps: discover a page, then read its evidence.
// A new search must be followed by a source read before saving or answering.
export function researchStep({ steps }: Pick<AgentCorePolicyContext, "steps">): AgentCoreStepSettings | undefined {
  let needsRead = false;
  for (const step of steps) {
    for (const call of step.toolCalls) {
      if (call.name === "search_sources") needsRead = true;
      if (call.name === "read_source") needsRead = false;
    }
  }
  if (needsRead)
    return { toolChoice: { type: "tool", toolName: "read_source" } };
}
