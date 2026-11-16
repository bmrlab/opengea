import { DurableObject } from "cloudflare:workers";
import {
  researchInput,
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
      !["/record", "/sources"].includes(url.pathname) ||
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
      await Promise.all(
        parsed.data.urls.map(async (source) =>
          this.ctx.storage.put(await capturedSourceKey(id, source), true),
        ),
      );
      return Response.json({ captured: parsed.data.urls.length });
    }
    const key = `research:${id}`;
    if (request.method === "PUT") {
      const parsed = researchInput.safeParse(await request.json());
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
      if (uncaptured.length)
        return Response.json(
          { error: "Uncaptured source URLs", urls: uncaptured },
          { status: 400 },
        );
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
