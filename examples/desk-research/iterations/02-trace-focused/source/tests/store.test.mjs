import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";

// Exercise record isolation and updates against the asynchronous storage contract.
// This in-memory store is a unit fixture, not proof of Runtime persistence.
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
  const records = new Map();
  const context = {
    storage: {
      async get(key) {
        return structuredClone(records.get(key));
      },
      async put(key, value) {
        records.set(key, structuredClone(value));
      },
      async list({ prefix }) {
        return new Map([...records].filter(([key]) => key.startsWith(prefix)));
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
  {
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
  }
});

test("saved citations must belong to sources captured in the same conversation", async () => {
  const values = new Map();
  const context = {
    storage: {
      async get(key) {
        return structuredClone(values.get(key));
      },
      async put(key, value) {
        values.set(key, structuredClone(value));
      },
      async list({ prefix }) {
        return new Map([...values].filter(([key]) => key.startsWith(prefix)));
      },
    },
  };
  let store = new ResearchStore(context);
  const source = "https://example.org/article/12324";
  const capture = (id, urls) =>
    store.fetch(
      new Request(`https://research.internal/sources?id=${id}`, {
        method: "POST",
        body: JSON.stringify({ urls }),
      }),
    );
  assert.equal((await capture("a", [source])).status, 200);
  store = new ResearchStore(context);
  const save = (id, url, report = `[研究](${url})`) =>
    store.fetch(
      new Request(`https://research.internal/record?id=${id}`, {
        method: "PUT",
        body: JSON.stringify({
          title: "研究",
          scope: "早餐",
          status: "complete",
          report,
          sources: [{ title: "原文", url, excerpt: "价格仍未知。" }],
        }),
      }),
    );
  assert.equal((await save("a", source)).status, 200);
  const typo = await save("a", "https://example.org/article/12624");
  assert.equal(typo.status, 400);
  const feedback = await typo.json();
  assert.equal(feedback.error, "Uncaptured source URLs");
  assert.deepEqual(feedback.availableUrls, [source]);
  assert.equal(
    (await save("a", source, "[引用](https://example.org/wrong)")).status,
    400,
  );
  const otherSession = await save("b", source);
  assert.equal(otherSession.status, 400);
  assert.deepEqual((await otherSession.json()).availableUrls, []);
  assert.equal(
    (await save("a", source, `[引用](${source}#section)`)).status,
    200,
  );
  const record = await (
    await store.fetch(new Request("https://research.internal/record?id=a"))
  ).json();
  assert.equal(record.sources[0].url, source);
  assert.equal((await capture("a", ["file:///private"])).status, 400);
});

test("source references render the exact captured URL without fuzzy replacement", async () => {
  const values = new Map();
  const store = new ResearchStore({
    storage: {
      async get(key) {
        return structuredClone(values.get(key));
      },
      async put(key, value) {
        values.set(key, structuredClone(value));
      },
      async list({ prefix }) {
        return new Map([...values].filter(([key]) => key.startsWith(prefix)));
      },
    },
  });
  const url =
    "https://dir.jd.com/guide/jd-geo-guide-ji-shi-ying-yang-zao-can-su-shi-dai-can-v1";
  const capture = await store.fetch(
    new Request("https://research.internal/sources?id=a", {
      method: "POST",
      body: JSON.stringify({ urls: [url] }),
    }),
  );
  const { sources } = await capture.json();
  assert.equal(sources.length, 1);
  const sourceId = sources[0].sourceId;
  assert.match(sourceId, /^src_[a-f0-9]{16}$/);
  const save = (id, ref = sourceId, report = `该指南的产品建议 [[${ref}]]`) =>
    store.fetch(
      new Request(`https://research.internal/referenced-record?id=${id}`, {
        method: "PUT",
        body: JSON.stringify({
          title: "研究",
          scope: "办公室",
          status: "complete",
          report,
          sources: [{ sourceId: ref, title: "指南", excerpt: "原文" }],
        }),
      }),
    );
  const saved = await save("a");
  assert.equal(saved.status, 200);
  const record = await saved.json();
  assert.equal(record.sources[0].url, url);
  assert.equal(record.report, `该指南的产品建议 ${url}`);
  assert.equal((await save("b")).status, 400);
  assert.equal((await save("a", "src_0000000000000000")).status, 400);
  assert.equal(
    (await save("a", sourceId, "错误 [[src_0000000000000000]]")).status,
    400,
  );
  assert.equal(
    (await save("a", sourceId, url.replace("su-shi", "san"))).status,
    400,
  );
  const unchanged = await (
    await store.fetch(new Request("https://research.internal/record?id=a"))
  ).json();
  assert.deepEqual(unchanged, record);
  assert.equal(
    await (
      await store.fetch(new Request("https://research.internal/record?id=b"))
    ).json(),
    null,
  );
});
