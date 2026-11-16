import { z } from "zod";
import type {
  AgentToolContext,
  AgentDurableObjectNamespace,
} from "@gea-ai/agent-sdk";
import { webUrl } from "./evidence.ts";

export const researchInput = z.object({
  title: z.string().trim().min(1).max(200),
  scope: z.string().trim().min(1).max(4000),
  status: z.enum(["researching", "complete"]),
  report: z.string().max(30000),
  sources: z
    .array(
      z.object({
        title: z.string().min(1).max(500),
        url: webUrl,
        excerpt: z.string().max(6000),
      }),
    )
    .max(30),
});
export type ResearchInput = z.infer<typeof researchInput>;
export type ResearchRecord = ResearchInput & { id: string; updatedAt: string };
export const RESEARCH_OBJECT = "quick-start";

// The read-only v1 stage has no store. Workbench stages record provider URLs,
// never URLs proposed by the model, before returning the search result.
export async function captureSourceUrls(
  sources: Array<{ url: string }>,
  context: {
    durableObjects: Readonly<{ RESEARCH?: AgentDurableObjectNamespace }>;
    identity: Pick<AgentToolContext<{}>["identity"], "chat">;
  },
) {
  const namespace = context.durableObjects.RESEARCH;
  if (!namespace) return;
  const response = await namespace
    .getByName(RESEARCH_OBJECT)
    .fetch(
      `https://research.internal/sources?id=${encodeURIComponent(context.identity.chat.id)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ urls: sources.map((s) => s.url) }),
      },
    );
  if (!response.ok) throw new Error("Could not record captured sources.");
}

export function reportUrls(report: string): string[] {
  return [
    ...new Set(
      [
        ...report.matchAll(
          /https?:\/\/[^\s<>"'()[\]，。；！？、：（）【】《》“”‘’]+/gu,
        ),
      ].map((m) => m[0].replace(/[.,;!]+$/u, "")),
    ),
  ];
}

export async function capturedSourceKey(id: string, url: string) {
  const parsed = new URL(url);
  parsed.hash = "";
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(parsed.href),
  );
  return `source:${id}:${Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("")}`;
}
