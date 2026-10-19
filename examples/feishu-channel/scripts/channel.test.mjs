import assert from "node:assert/strict";
import { test } from "node:test";
import { feishuAgentExtension } from "@gea-ai/agent-extension-feishu";
import registration from "../extensions/feishu.ts";

// Synthetic Channel capabilities and HTTP transport; no live WebSocket or Runtime.
const channel = feishuAgentExtension({ transport: "http" }).channels[0];

test("example registers the WebSocket Channel with shared topics and no business API", () => {
  assert.equal(registration.extension.channels.length, 1);
  const bot = registration.extension.channels[0];
  assert.ok(bot.receiver);
  assert.deepEqual(bot.routes, []);
  assert.equal(bot.sharedSessions, true);
  assert.deepEqual(registration.overrides, { connectors: { api: false }, skills: { "lark-cli": false } });
  assert.deepEqual(bot.env.FEISHU_APP_SECRET, channel.env.FEISHU_APP_SECRET);
});

function event({ group = false, sender = "ou_alice", id = "message-1", root, type = "text", content, mentions } = {}) {
  return {
    header: { event_type: "im.message.receive_v1", event_id: `event-${id}`, tenant_key: "tenant-test", app_id: "app-test", token: "token-test" },
    event: {
      sender: { sender_id: { open_id: sender }, sender_type: "user", tenant_key: "tenant-test" },
      message: {
        message_id: id, chat_id: "chat-test", chat_type: group ? "group" : "p2p", message_type: type,
        content: JSON.stringify(content ?? { text: group ? "@_user_1 hello" : "hello" }),
        mentions: mentions ?? (group ? [{ key: "@_user_1", id: { open_id: "bot-test" } }] : []),
        ...(root ? { root_id: root, thread_id: "thread-test" } : {}),
      },
    },
  };
}

function fixture(allowed = "*") {
  const sends = [], feedback = [], requests = [];
  const ctx = {
    env: { FEISHU_APP_ID: "app-test", FEISHU_APP_SECRET: "secret-test", FEISHU_VERIFICATION_TOKEN: "token-test", FEISHU_ALLOWED_SENDERS: allowed },
    environment: "local", signal: new AbortController().signal,
    async fetch(url, options) {
      requests.push({ url, options });
      if (url === "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal")
        return Response.json({ code: 0, tenant_access_token: "access-test" });
      assert.equal(url, "https://open.feishu.cn/open-apis/bot/v3/info");
      assert.equal(options.headers.authorization, "Bearer access-test");
      return Response.json({ code: 0, bot: { open_id: "bot-test" } });
    },
    from(address, identity, options) {
      return {
        async send(message, input) { sends.push({ address, identity, options, message, input }); return {}; },
        async enqueueOutput(kind, output, input) { feedback.push({ address, identity, options, kind, output, input }); return {}; },
      };
    },
  };
  return { ctx, sends, feedback, requests, async accept(body) {
    return channel.routes[0].handler(new Request("https://fixture.invalid/", { method: "POST", body: JSON.stringify(body) }), ctx);
  } };
}

function textOf(call) {
  return typeof call.message === "string" ? call.message : call.message.parts.map((part) => part.text).join("");
}

test("private messages keep sender-scoped identity and operation IDs", async () => {
  const f = fixture();
  for (const sender of ["ou_alice", "ou_bob", "ou_alice"]) assert.equal((await f.accept(event({ sender }))).status, 200);
  assert.equal(f.sends.length, 3);
  assert.equal(f.sends[0].options, undefined);
  assert.match(f.sends[0].identity.principal.principalId, /^feishu:/);
  assert.notEqual(f.sends[0].identity.principal.principalId, f.sends[1].identity.principal.principalId);
  assert.equal(f.sends[0].identity.principal.principalId, f.sends[2].identity.principal.principalId);
  assert.equal(f.sends[0].input.operationId, "event-message-1");
  assert.equal(f.requests.length, 0);
});

test("bot-mentioned group topic is shared while each caller retains its identity", async () => {
  const f = fixture();
  for (const args of [{ group: true }, { group: true, sender: "ou_bob", id: "message-2", root: "message-1" }, { group: true, id: "another-topic" }])
    assert.equal((await f.accept(event(args))).status, 200);
  assert.equal(f.sends.length, 3);
  assert.deepEqual(f.sends[0].options, { scope: "shared" });
  assert.equal(f.sends[0].address, f.sends[1].address);
  assert.notEqual(f.sends[0].address, f.sends[2].address);
  assert.notEqual(f.sends[0].identity.principal.principalId, f.sends[1].identity.principal.principalId);
  assert.deepEqual(f.sends[1].input.actor, { tenantKey: "tenant-test", openId: "ou_bob" });
  assert.equal(f.sends[1].input.data.replyInThread, true);
  assert.match(textOf(f.sends[1]), /ou_bob/);
  assert.doesNotMatch(textOf(f.sends[1]), /@_user_1/);
});

test("ordinary, other-bot and empty mention-only group messages do not run", async () => {
  const f = fixture();
  for (const args of [
    { group: true, mentions: [] },
    { group: true, mentions: [{ key: "@_user_1", id: { open_id: "another-bot" } }] },
    { group: true, content: { text: "@_user_1 " } },
  ]) assert.equal((await f.accept(event(args))).status, 200);
  assert.equal(f.sends.length, 0);
  assert.equal(f.feedback.length, 0);
});

test("rich text preserves title, paragraphs, links and code", async () => {
  const f = fixture();
  const content = { title: "Title", content: [[{ tag: "text", text: "Hello " }, { tag: "a", text: "docs", href: "https://example.invalid/docs" }], [{ tag: "code_block", text: "const value = 1;" }]] };
  assert.equal((await f.accept(event({ type: "post", content }))).status, 200);
  assert.equal(f.sends.length, 1);
  assert.equal(f.sends[0].message, "Title\nHello [docs](https://example.invalid/docs)\nconst value = 1;");
  const groupContent = { content: [[{ tag: "at", user_id: "bot-test" }, { tag: "text", text: " Group post" }]] };
  assert.equal((await f.accept(event({ group: true, type: "post", content: groupContent }))).status, 200);
  assert.equal(f.sends.length, 2);
  assert.deepEqual(f.sends[1].options, { scope: "shared" });
  assert.match(textOf(f.sends[1]), /Group post/);
  assert.doesNotMatch(textOf(f.sends[1]), /@_user_1/);
});

test("unsupported media produces durable feedback without partial Agent input", async () => {
  const f = fixture();
  for (const args of [
    { type: "image", content: { image_key: "synthetic-image" } },
    { type: "post", content: { content: [[{ tag: "text", text: "Do not submit only this" }, { tag: "img", image_key: "synthetic-image" }]] } },
  ]) assert.equal((await f.accept(event(args))).status, 200);
  assert.equal(f.sends.length, 0);
  assert.equal(f.feedback.length, 2);
  assert.equal(f.feedback[0].kind, "feedback");
  assert.match(f.feedback[0].output.text, /未提交给 Agent/);
  assert.ok(f.feedback[0].input.operationId);
});

test("invalid verification token, app or tenant never reaches admission", async () => {
  for (const [field, value, status] of [["token", "wrong", 401], ["app_id", "wrong", 403], ["tenant_key", "wrong", 403]]) {
    const f = fixture();
    const body = event({ group: true });
    body.header[field] = value;
    assert.equal((await f.accept(body)).status, status);
    assert.equal(f.sends.length + f.feedback.length + f.requests.length, 0);
  }
});

test("allowlist fails closed and binds tenant plus sender for private and group input", async () => {
  for (const group of [false, true]) {
    for (const allowed of ["[]", "", undefined, JSON.stringify([{ tenantKey: "other-tenant", openId: "ou_alice" }])]) {
      const f = fixture();
      f.ctx.env.FEISHU_ALLOWED_SENDERS = allowed;
      assert.equal((await f.accept(event({ group }))).status, 403);
      assert.equal(f.sends.length + f.feedback.length + f.requests.length, 0);
    }
    const f = fixture(JSON.stringify([{ tenantKey: "tenant-test", openId: "ou_alice" }]));
    assert.equal((await f.accept(event({ group }))).status, 200);
    assert.equal(f.sends.length, 1);
    assert.equal((await f.accept(event({ group, sender: "ou_bob" }))).status, 403);
    assert.equal(f.sends.length, 1);
  }
});

test("tenant and application identities cannot collide", async () => {
  const f = fixture();
  await f.accept(event());
  const tenantEvent = event();
  tenantEvent.header.tenant_key = tenantEvent.event.sender.tenant_key = "other-tenant";
  await f.accept(tenantEvent);
  const appEvent = event();
  f.ctx.env.FEISHU_APP_ID = appEvent.header.app_id = "other-app";
  await f.accept(appEvent);
  assert.equal(new Set(f.sends.map((call) => call.identity.principal.principalId)).size, 3);
  assert.notEqual(f.sends[0].address, f.sends[1].address);
});
