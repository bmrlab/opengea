import { DurableObject } from "cloudflare:workers";
import {
  researchInput,
  referencedResearchInput,
  type CapturedReference,
  capturedSourceKey,
  reportUrls,
  type ResearchRecord,
} from "../lib/research.ts";
import { webUrl } from "../lib/evidence.ts";
import { z } from "zod";

export class ResearchStore extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/records") {
      const records = await this.ctx.storage.list<ResearchRecord>({
        prefix: "research:",
      });
      const items = [...records.values()]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 100);
      return Response.json({ items });
    }
    const id = url.searchParams.get("id");
    if (
      !["/record", "/referenced-record", "/sources"].includes(url.pathname) ||
      !id ||
      id.length > 200
    )
      return new Response("Not found", { status: 404 });
    if (url.pathname === "/sources") {
      if (request.method !== "POST")
        return new Response("Method not allowed", { status: 405 });
      const parsed = z
        .object({ urls: z.array(webUrl).max(5) })
        .safeParse(await request.json());
      if (!parsed.success)
        return Response.json({ error: "Invalid sources" }, { status: 400 });
      const sources: CapturedReference[] = [];
      for (const source of parsed.data.urls) {
        const key = await capturedSourceKey(id, source);
        const sourceId = `src_${key.slice(-64, -48)}`;
        const referenceKey = `source-ref:${id}:${sourceId}`;
        const existing =
          await this.ctx.storage.get<CapturedReference>(referenceKey);
        // Do not silently remap a short identity, even on a hash collision.
        if (existing && (await capturedSourceKey(id, existing.url)) !== key)
          return Response.json(
            { error: "Source identity collision" },
            { status: 409 },
          );
        const reference = existing ?? { sourceId, url: source };
        await this.ctx.storage.put(key, reference);
        await this.ctx.storage.put(referenceKey, reference);
        sources.push({ ...reference, url: source });
      }
      return Response.json({ captured: sources.length, sources });
    }
    const key = `research:${id}`;
    if (request.method === "PUT") {
      let input: unknown = await request.json();
      if (url.pathname === "/referenced-record") {
        const referenced = referencedResearchInput.safeParse(input);
        if (!referenced.success)
          return Response.json(
            { error: "Invalid referenced research" },
            { status: 400 },
          );
        if (reportUrls(referenced.data.report).length)
          return Response.json(
            { error: "Use [[sourceId]] citations, not typed URLs" },
            { status: 400 },
          );
        const resolved = new Map<string, CapturedReference>();
        for (const source of referenced.data.sources) {
          const captured = await this.ctx.storage.get<CapturedReference>(
            `source-ref:${id}:${source.sourceId}`,
          );
          if (!captured)
            return Response.json(
              {
                error: "Uncaptured source identity",
                sourceId: source.sourceId,
              },
              { status: 400 },
            );
          resolved.set(source.sourceId, captured);
        }
        const markers = [
          ...referenced.data.report.matchAll(/\[\[([^\]]+)\]\]/gu),
        ];
        if (markers.some((match) => !resolved.has(match[1])))
          return Response.json(
            {
              error: "Every citation must select a captured source in sources",
            },
            { status: 400 },
          );
        input = {
          ...referenced.data,
          report: referenced.data.report.replace(
            /\[\[([^\]]+)\]\]/gu,
            (_match, ref: string) => resolved.get(ref)!.url,
          ),
          sources: referenced.data.sources.map(({ sourceId, ...source }) => ({
            ...source,
            sourceId,
            url: resolved.get(sourceId)!.url,
          })),
        };
      }
      const parsed = researchInput.safeParse(input);
      if (!parsed.success)
        return Response.json({ error: "Invalid research" }, { status: 400 });
      const urls = [
        ...new Set([
          ...parsed.data.sources.map((source) => source.url),
          ...reportUrls(parsed.data.report),
        ]),
      ];
      const uncaptured: string[] = [];
      for (const source of urls) {
        const valid = webUrl.safeParse(source);
        if (
          !valid.success ||
          !(await this.ctx.storage.get(await capturedSourceKey(id, valid.data)))
        )
          uncaptured.push(source);
      }
      if (uncaptured.length) {
        const captured = await this.ctx.storage.list<{ url?: string } | true>({
          prefix: `source:${id}:`,
        });
        const origins = new Set(
          uncaptured.flatMap((value) => {
            try {
              return [new URL(value).origin];
            } catch {
              return [];
            }
          }),
        );
        const availableUrls = [...captured.values()]
          .flatMap((value) =>
            typeof value === "object" && value.url ? [value.url] : [],
          )
          .filter((value) => origins.has(new URL(value).origin))
          .slice(0, 10);
        return Response.json(
          { error: "Uncaptured source URLs", urls: uncaptured, availableUrls },
          { status: 400 },
        );
      }
      const record: ResearchRecord = {
        ...parsed.data,
        id,
        updatedAt: new Date().toISOString(),
      };
      await this.ctx.storage.put(key, record);
      return Response.json(record);
    }
    if (request.method !== "GET")
      return new Response("Method not allowed", { status: 405 });
    return Response.json(
      (await this.ctx.storage.get<ResearchRecord>(key)) ?? null,
    );
  }
}
