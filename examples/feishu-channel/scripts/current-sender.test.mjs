import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import currentSender from "../tools/current-sender.ts";

function context(overrides = {}) {
  return {
    auth: { current: { principalType: "user", principalId: "opaque-app-user", attributes: { feishuOpenId: "ou_alice" } } },
    environment: "preview",
    identity: { agent: { id: "agent" }, chat: { id: "gea-session" }, organization: { id: "org" }, project: null, run: { id: "run-private-1" }, user: null, workspace: null },
    ...overrides,
  };
}

const read = (ctx) => currentSender.execute({}, ctx);

test("private sender projection uses trusted attributes and preserves existing fields", async () => {
  const ctx = context();
  const result = await read(ctx);
  assert.deepEqual(result.principal, ctx.auth.current);
  assert.equal(result.environment, "preview");
  assert.equal(result.senderOpenId, "ou_alice");
  assert.equal(result.sharedConversation, false);
});

test("shared group scope is never projected as private", async () => {
  const ctx = context();
  ctx.identity.conversationScope = { installationId: "installation", channelKey: "feishu_bot", addressId: "group-topic" };
  const result = await read(ctx);
  assert.equal(result.senderOpenId, "ou_alice");
  assert.equal(result.sharedConversation, true);
});

test("missing or non-string open ID never falls back to principalId or input", async () => {
  for (const current of [null, { principalType: "service", principalId: "ou_wrong" },
    { principalType: "user", principalId: "ou_wrong" },
    ...[undefined, "", ["ou_wrong"]].map((feishuOpenId) => ({ principalType: "user", principalId: "ou_wrong", attributes: { feishuOpenId } })),
  ]) {
    const result = await currentSender.execute({ senderOpenId: "ou_untrusted" }, context({ auth: { current } }));
    assert.equal(result.senderOpenId, null);
  }
});

test("missing identity, run or chat and malformed scope fail closed", async () => {
  for (const identity of [undefined, {}, { ...context().identity, run: undefined }, { ...context().identity, chat: undefined }, { ...context().identity, conversationScope: null }]) {
    assert.equal((await read(context({ identity }))).sharedConversation, true);
  }
});

test("auth card key is stable per run, short, and independent of principal and URL", async () => {
  const ctx = context();
  const first = await read(ctx);
  const second = await read(ctx);
  const expected = "auth-" + createHash("sha256").update(ctx.identity.run.id).digest("hex").slice(0, 40);
  assert.equal(first.authCardKey, expected);
  assert.equal(second.authCardKey, expected);
  assert.ok(first.authCardKey.length <= 50);
  assert.match(first.authCardKey, /^auth-[a-f0-9]{40}$/);
  ctx.auth.current.attributes.feishuOpenId = "ou_bob";
  assert.equal((await read(ctx)).authCardKey, expected);
  ctx.identity.run.id = "another-run";
  assert.notEqual((await read(ctx)).authCardKey, expected);
  assert.equal((await read(context({ identity: undefined }))).authCardKey, null);
});

test("a new user-message run in the same session receives its own trusted card key", async () => {
  const previous = context();
  const next = structuredClone(previous);
  next.identity.run.id = "run-private-2";
  const before = await read(previous);
  const after = await read(next);
  assert.equal(previous.identity.chat.id, next.identity.chat.id);
  assert.equal(after.senderOpenId, before.senderOpenId);
  assert.equal(after.sharedConversation, false);
  assert.notEqual(after.authCardKey, before.authCardKey);
  // A correction keeps the same run identity; a reload must not invent a new key.
  assert.equal((await read(structuredClone(next))).authCardKey, after.authCardKey);
});
