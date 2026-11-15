import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { registerHooks } from "node:module";

// Test the actual business SQL on SQLite. This shim supplies only the DO base;
// it does not stand in for a real Worker Runtime integration test.
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "cloudflare:workers")
      return {
        url: "data:text/javascript,export class DurableObject { constructor(ctx) { this.ctx = ctx; } }",
        shortCircuit: true,
      };
    return next(specifier, context);
  },
});
const { ResearchStore } = await import("../durable-objects/research-store.ts");

test("research survives object recreation and updates only the selected session", async () => {
  const database = new DatabaseSync(":memory:");
  const context = {
    storage: {
      sql: {
        exec(query, ...bindings) {
          const statement = database.prepare(query);
          if (query.startsWith("SELECT")) return statement.all(...bindings);
          statement.run(...bindings);
          return [];
        },
      },
    },
  };
  const write = (id, title) =>
    new Request(`https://research.internal/record?id=${id}`, {
      method: "PUT",
      body: JSON.stringify({
        title,
        scope: "早餐",
        status: "complete",
        report: "假设待验证",
        sources: [],
      }),
    });
  try {
    let store = new ResearchStore(context);
    assert.equal((await store.fetch(write("session-a", "A"))).status, 200);
    assert.equal((await store.fetch(write("session-b", "B"))).status, 200);
    store = new ResearchStore(context);
    await store.fetch(write("session-a", "A revised"));
    const a = await (
      await store.fetch(
        new Request("https://research.internal/record?id=session-a"),
      )
    ).json();
    const b = await (
      await store.fetch(
        new Request("https://research.internal/record?id=session-b"),
      )
    ).json();
    assert.equal(a.title, "A revised");
    assert.equal(b.title, "B");
    const list = await (
      await store.fetch(new Request("https://research.internal/records"))
    ).json();
    assert.equal(list.items.length, 2);
    assert.equal(
      (
        await store.fetch(
          new Request("https://research.internal/record?id=missing"),
        )
      ).status,
      200,
    );
    assert.equal(
      await (
        await store.fetch(
          new Request("https://research.internal/record?id=missing"),
        )
      ).json(),
      null,
    );
  } finally {
    database.close();
  }
});
