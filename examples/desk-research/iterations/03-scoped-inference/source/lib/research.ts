import { z } from "zod";
import type {
  AgentToolContext,
  AgentDurableObjectNamespace,
} from "@gea-ai/agent-sdk";
import { webUrl } from "./evidence.ts";
import type { SourcePassage } from "./source-passages.ts";

export const sourceTitleInput = z.string().min(1).max(2000);

export const researchInput = z.object({
  title: z.string().trim().min(1).max(200),
  scope: z.string().trim().min(1).max(4000),
  status: z.enum(["researching", "complete"]),
  report: z.string().max(30000),
  sources: z
    .array(
      z.object({
        title: sourceTitleInput,
        url: webUrl,
        sourceId: z
          .string()
          .regex(/^src_[a-f0-9]{16}$/u)
          .optional(),
        excerpt: z.string().max(6000),
        quoteId: z
          .string()
          .regex(/^p_[a-f0-9]{16}$/u)
          .optional(),
        constraintEvidenceId: z
          .string()
          .regex(/^p_[a-f0-9]{16}$/u)
          .nullable()
          .optional(),
      }),
    )
    .max(30),
});
// Model-facing saves select captured identities; the stored/public record keeps
// canonical URLs for the workbench and existing consumers.
export const sourceIdInput = z.string().regex(/^src_[a-f0-9]{16}$/u);
export const referencedResearchInput = researchInput.extend({
  report: z
    .string()
    .max(30000)
    .describe(
      "Markdown with [[sourceId]] citations, e.g. [[src_0123456789abcdef]]. Do not type URLs.",
    ),
  sources: z
    .array(
      z.object({
        sourceId: sourceIdInput,
        title: sourceTitleInput,
        excerpt: z.string().max(6000),
        quoteId: z
          .string()
          .regex(/^p_[a-f0-9]{16}$/u)
          .optional(),
        constraintEvidenceId: z
          .string()
          .regex(/^p_[a-f0-9]{16}$/u)
          .nullable()
          .optional(),
      }),
    )
    .max(30),
});
export type CapturedReference = {
  sourceId: string;
  url: string;
  title?: string;
  publishedAt?: string | null;
  passageEntries?: SourcePassage[];
};

export type ResearchInput = z.infer<typeof researchInput>;
export type ResearchRecord = ResearchInput & { id: string; updatedAt: string };
export const RESEARCH_OBJECT = "quick-start";

// The read-only v1 stage has no store. Workbench stages record provider URLs,
// never URLs proposed by the model, before returning the search result.
export async function captureSourceUrls<
  T extends {
    url: string;
    title?: string;
    text?: string;
    publishedAt?: string | null;
  },
>(
  sources: T[],
  context: {
    durableObjects: Readonly<{ RESEARCH?: AgentDurableObjectNamespace }>;
    identity: Pick<AgentToolContext<{}>["identity"], "chat">;
  },
) {
  const namespace = context.durableObjects.RESEARCH;
  if (!namespace) return sources;
  const response = await namespace
    .getByName(RESEARCH_OBJECT)
    .fetch(
      `https://research.internal/sources?id=${encodeURIComponent(context.identity.chat.id)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sources: sources.map(({ url, title, text, publishedAt }) => ({
            url,
            title,
            text,
            publishedAt,
          })),
        }),
      },
    );
  if (!response.ok) throw new Error("Could not record captured sources.");
  const captured = (await response.json()) as { sources: CapturedReference[] };
  return sources.map((source) => {
    const reference = captured.sources.find((item) => item.url === source.url);
    if (!reference) throw new Error("Missing captured source identity.");
    const { text, ...metadata } = source;
    return {
      ...metadata,
      textLength: text?.length ?? 0,
      sourceId: reference.sourceId,
      passages: reference.passageEntries ?? [],
    };
  });
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
