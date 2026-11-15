import { DurableObject } from "cloudflare:workers";
import { researchInput, type ResearchRecord } from "../lib/research.ts";

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
    if (url.pathname !== "/record" || !id || id.length > 200)
      return new Response("Not found", { status: 404 });
    const key = `research:${id}`;
    if (request.method === "PUT") {
      const parsed = researchInput.safeParse(await request.json());
      if (!parsed.success)
        return Response.json({ error: "Invalid research" }, { status: 400 });
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
