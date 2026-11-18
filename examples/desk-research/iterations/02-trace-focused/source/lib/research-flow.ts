import type { AgentCorePolicyContext, AgentCoreStepSettings } from "@gea-ai/agent-sdk/agent-core";
import { z } from "zod";
import { webUrl } from "./evidence.ts";

const searchOutput = z.object({ sources: z.array(z.object({ url: webUrl })) });
// Without a research store read_source returns the text window; with one it returns captured passages.
const readOutput = z.object({ source: z.object({
  url: webUrl,
  text: z.string().optional(),
  passages: z.array(z.object({ text: z.string() })).optional(),
}) });

// Only completed results establish discovery or evidence. On a gap, allow a
// different search/read or a final explanation, without unlocking report saves.
export function researchStep({ steps, messages }: Pick<AgentCorePolicyContext, "steps" | "messages">): AgentCoreStepSettings | undefined {
  const results = new Map(messages.filter((message) => message.role === "tool")
    .flatMap((message) => message.content)
    .filter((part) => part.type === "tool_result")
    .map((part) => [part.call_id, part]));
  const discovered = new Set<string>();
  let state: "free" | "read" | "gap" = "free";
  for (const step of steps) {
    for (const call of step.toolCalls) {
      const result = results.get(call.id);
      if (!result) continue;
      if (call.name === "search_sources") {
        const output = searchOutput.safeParse(result.output);
        if (!result.is_error && !result.denied && output.success && output.data.sources.length) {
          for (const source of output.data.sources) discovered.add(source.url);
          state = "read";
        } else state = "gap";
      }
      if (call.name === "read_source") {
        const output = readOutput.safeParse(result.output);
        const source = output.success ? output.data.source : undefined;
        const input = z.object({ url: webUrl }).safeParse(call.input);
        const hasText = source?.text?.trim() || source?.passages?.some((part) => part.text.trim());
        state = !result.is_error && !result.denied && source && input.success &&
          source.url === input.data.url && discovered.has(source.url) && hasText
          ? "free" : "gap";
      }
    }
  }
  if (state === "read")
    return { toolChoice: { type: "tool", toolName: "read_source" } };
  if (state === "gap")
    return { activeTools: ["search_sources", "read_source"], toolChoice: "auto" };
}
