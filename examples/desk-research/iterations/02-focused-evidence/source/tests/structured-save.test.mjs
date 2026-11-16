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

for (const field of [
  ["title"],
  ["scope"],
  ["observations", 0, "subject"],
  ["observations", 0, "constraint"],
  ["hypotheses", 0, "question"],
  ["hypotheses", 0, "test"],
  ["hypotheses", 0, "measure"],
  ["hypotheses", 0, "abandonIf"],
  ["gaps", 0],
]) {
  test(`typed citations in ${field.join(".")} are rejected without creating or replacing a record`, async () => {
    const records = new Map();
    let writes = 0;
    const store = new ResearchStore({
      storage: {
        async get(key) {
          return structuredClone(records.get(key));
        },
        async put(key, value) {
          writes++;
          records.set(key, structuredClone(value));
        },
        async list({ prefix }) {
          return new Map([...records].filter(([key]) => key.startsWith(prefix)));
        },
      },
    });
    const url = "https://example.org/wiki/Breakfast_(food)";
    const capture = await store.fetch(
      new Request("https://research.internal/sources?id=a", {
        method: "POST",
        body: JSON.stringify({
          sources: [{ url, title: "早餐", text: "早餐可以直接食用。" }],
        }),
      }),
    );
    assert.equal(capture.status, 200);
    const source = (await capture.json()).sources[0];
    const brief = {
      title: "研究",
      scope: "办公室早餐",
      status: "complete",
      observations: [{
        sourceId: source.sourceId,
        subject: "原文中的早餐",
        quoteId: source.passageEntries[0].passageId,
        constraint: "无需加热",
        fit: "match",
        constraintEvidenceId: source.passageEntries[0].passageId,
      }],
      hypotheses: [{
        question: "该方案能否满足办公室需求？",
        basedOn: [1],
        test: "请办公室使用者试用",
        measure: "记录使用体验",
        abandonIf: "使用者不愿继续使用",
      }],
      gaps: ["实际需求尚未核对"],
    };
    const save = (input) => store.fetch(
      new Request("https://research.internal/brief-record?id=a", {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    );
    const read = async () => (await store.fetch(
      new Request("https://research.internal/record?id=a"),
    )).json();
    for (const existing of [false, true]) {
      if (existing) assert.equal((await save(brief)).status, 200);
      const before = await read();
      assert.equal(before !== null, existing);
      for (const citation of [
        "基于另一调查 https://fabricated.example/report 的方案",
        "参见 [调查](https://fabricated.example/Report_(2026))",
        "参见 <HTTPS://fabricated.example/report>",
        // Even captured URLs must be selected by identity, never retyped.
        url,
      ]) {
        const invalid = structuredClone(brief);
        const parent = field.slice(0, -1).reduce((value, key) => value[key], invalid);
        parent[field.at(-1)] = citation;
        const writesBefore = writes;
        const response = await save(invalid);
        assert.equal(response.status, 400, `${field.join(".")}: ${citation}`);
        assert.equal((await response.json()).error,
          "Use sourceId/quoteId and basedOn citations, not typed URLs in brief text");
        assert.equal(writes, writesBefore);
        assert.deepEqual(await read(), before);
      }
    }
  });
}

for (const [label, url, text, title, constraintText] of [
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
    "a link inside a separate captured constraint passage",
    "https://example.org/constraint",
    "原文描述早餐。",
    "早餐",
    "可以直接食用；其他说明见 https://example.org/guide 。",
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
    let constraintEvidenceId = null;
    if (constraintText) {
      const capturedConstraint = await store.fetch(
        new Request("https://research.internal/sources?id=a", {
          method: "POST",
          body: JSON.stringify({ sources: [{ url, text: constraintText }] }),
        }),
      );
      assert.equal(capturedConstraint.status, 200);
      constraintEvidenceId = (await capturedConstraint.json()).sources[0]
        .passageEntries[0].passageId;
    }
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
          fit: constraintText ? "match" : "unknown",
          constraintEvidenceId,
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
    if (constraintText) assert.ok(record.report.includes(constraintText));
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
