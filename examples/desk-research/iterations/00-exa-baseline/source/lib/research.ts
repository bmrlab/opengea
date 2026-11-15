import { z } from "zod";
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
