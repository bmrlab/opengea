import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
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

for (const [label, url, text, title] of [
  [
    "parenthesized canonical URL",
    "https://example.org/wiki/Breakfast_(food)",
    "原文描述早餐。",
    "早餐",
  ],
  [
    "a link inside a captured quotation",
    "https://example.org/article",
    "原文提到 https://example.org/catalog ，并未把它作为独立证据。",
    "早餐",
  ],
  [
    "a captured 501-character title",
    "https://example.org/long-title",
    "原文描述早餐。",
    "题".repeat(501),
  ],
  [
    "the captured title upper boundary",
    "https://example.org/title-boundary",
    "原文描述早餐。",
    "题".repeat(2000),
  ],
]) {
  test(`structured saves retain ${label}`, async () => {
    const records = new Map();
    const store = new ResearchStore({
      storage: {
        async get(key) {
          return structuredClone(records.get(key));
        },
        async put(key, value) {
          records.set(key, structuredClone(value));
        },
        async list({ prefix }) {
          return new Map(
            [...records].filter(([key]) => key.startsWith(prefix)),
          );
        },
      },
    });
    const captured = await store.fetch(
      new Request("https://research.internal/sources?id=a", {
        method: "POST",
        body: JSON.stringify({ sources: [{ url, title, text }] }),
      }),
    );
    assert.equal(captured.status, 200);
    const source = (await captured.json()).sources[0];
    const brief = {
      title: "研究",
      scope: "早餐",
      status: "complete",
      observations: [
        {
          sourceId: source.sourceId,
          subject: "原文中的早餐",
          quoteId: source.passageEntries[0].passageId,
          constraint: "用户未指定使用条件",
          fit: "unknown",
          constraintEvidenceId: null,
        },
      ],
      hypotheses: [],
      gaps: [],
    };
    const save = (id) =>
      store.fetch(
        new Request(`https://research.internal/brief-record?id=${id}`, {
          method: "PUT",
          body: JSON.stringify(brief),
        }),
      );
    const saved = await save("a");
    assert.equal(saved.status, 200, await saved.clone().text());
    const record = await saved.json();
    assert.deepEqual(
      record.sources.map((source) => source.url),
      [url],
    );
    assert.equal(record.sources[0].title, title);
    assert.equal(record.sources[0].excerpt, text);
    assert.ok(record.report.includes(url));
    assert.ok(record.report.includes(text));
    assert.deepEqual(
      await (
        await store.fetch(new Request("https://research.internal/record?id=a"))
      ).json(),
      record,
    );
    assert.equal((await save("b")).status, 400);
    assert.equal(
      await (
        await store.fetch(new Request("https://research.internal/record?id=b"))
      ).json(),
      null,
    );
  });
}
