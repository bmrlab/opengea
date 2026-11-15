import { DurableObject } from "cloudflare:workers";
import { researchInput, type ResearchRecord } from "../lib/research.ts";

export class ResearchStore extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    this.ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS research (id TEXT PRIMARY KEY, document TEXT NOT NULL, updated_at TEXT NOT NULL)",
    );
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/records") {
      const rows = [
        ...this.ctx.storage.sql.exec<{ document: string }>(
          "SELECT document FROM research ORDER BY updated_at DESC LIMIT 100",
        ),
      ];
      return Response.json({
        items: rows.map((row) => JSON.parse(row.document) as ResearchRecord),
      });
    }
    const id = url.searchParams.get("id");
    if (url.pathname !== "/record" || !id || id.length > 200)
      return new Response("Not found", { status: 404 });
    if (request.method === "PUT") {
      const parsed = researchInput.safeParse(await request.json());
      if (!parsed.success)
        return Response.json({ error: "Invalid research" }, { status: 400 });
      const record: ResearchRecord = {
        ...parsed.data,
        id,
        updatedAt: new Date().toISOString(),
      };
      this.ctx.storage.sql.exec(
        "INSERT INTO research(id, document, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET document=excluded.document, updated_at=excluded.updated_at",
        id,
        JSON.stringify(record),
        record.updatedAt,
      );
      return Response.json(record);
    }
    if (request.method !== "GET")
      return new Response("Method not allowed", { status: 405 });
    const rows = [
      ...this.ctx.storage.sql.exec<{ document: string }>(
        "SELECT document FROM research WHERE id = ?",
        id,
      ),
    ];
    return Response.json(rows[0] ? JSON.parse(rows[0].document) : null);
  }
}
