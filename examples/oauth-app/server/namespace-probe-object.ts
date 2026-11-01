import { DurableObject } from "cloudflare:workers";
import type { DurableObjectState } from "@cloudflare/workers-types";
import type { ProbeRecord } from "../lib/namespace-probe";

// Separate from OAuth/session storage: this class contains only synthetic data.
export class NamespaceProbe extends DurableObject<unknown> {
  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env);
    ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS probe (id INTEGER PRIMARY KEY CHECK (id = 1), payload TEXT NOT NULL)",
    );
  }

  create(record: ProbeRecord) {
    // A repeated create must fail rather than overwrite the evidence.
    this.ctx.storage.sql.exec(
      "INSERT INTO probe VALUES (1, ?)",
      JSON.stringify(record),
    );
    return this.read();
  }

  read() {
    const row = this.ctx.storage.sql
      .exec<{ payload: string }>("SELECT payload FROM probe WHERE id = 1")
      .toArray()[0];
    return {
      className: "NamespaceProbe" as const,
      objectIdPrefix: this.ctx.id.toString().slice(0, 16),
      record: row ? (JSON.parse(row.payload) as ProbeRecord) : null,
    };
  }
}
