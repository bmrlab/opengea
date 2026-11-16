import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "@gea-ai/agent-sdk")
      return {
        url: "data:text/javascript,export const defineTool = x => x; export const defineToolSet = x => x;",
        shortCircuit: true,
      };
    if (specifier === "../lib/research")
      return next("../lib/research.ts", context);
    return next(specifier, context);
  },
});
const { default: tools } = await import("../tools/research-record.ts");
const save = tools.find((tool) => tool.name === "save_research");

test("save validation returns actionable feedback and never claims success", async () => {
  const url = "https://example.org/typo";
  const context = (response) => ({
    identity: { chat: { id: "chat-a" } },
    durableObjects: {
      RESEARCH: { getByName: () => ({ fetch: async () => response }) },
    },
  });
  const rejected = await save.execute(
    {},
    context(
      Response.json(
        {
          error: "Uncaptured source URLs",
          urls: [url],
          availableUrls: ["https://example.org/captured"],
        },
        { status: 400 },
      ),
    ),
  );
  assert.equal(rejected.saved, false);
  assert.deepEqual(rejected.urls, [url]);
  assert.deepEqual(rejected.availableUrls, ["https://example.org/captured"]);
  assert.match(rejected.instruction, /尚未保存/);
  const record = { id: "chat-a", title: "已纠正" };
  assert.deepEqual(
    await save.execute({}, context(Response.json(record))),
    record,
  );
  await assert.rejects(
    save.execute({}, context(new Response("private details", { status: 500 }))),
    { message: "Research save failed." },
  );
});
