import assert from "node:assert/strict";
import { test } from "node:test";
import { extractChannelReply } from "@gea-ai/agent-sdk/agent-channel-api";
import agent from "../agent.ts";
import { authorizationReplyText } from "../lib/auth-replies.ts";

const channel = agent.extensions[0].extension.channels[0];
const syntheticTicket = "offline-only-opaque-value";
const url = `https://musegea.com/api/agent-connectors/oauth/start?ticket=${syntheticTicket}`;
const success = "授权卡已发送，请点击「前往授权」，完成后回到此私聊发消息继续。";
const failure = "授权卡未发送，请稍后再发一条消息重试。";
const unknown = "授权卡发送结果尚未确认，请先检查此私聊中的授权卡；如已收到，完成授权后再发消息继续。";

// Run the registered projection and published outbound adapter with only in-memory
// receipts and HTTP responses. No real provider, Connector or model is called.
function fixture({ rejectCards = false } = {}) {
  const pending = [], payloads = [], bodies = [];
  let sequence = 0, current;
  const ctx = {
    state: channel.stateSchema.parse(structuredClone(channel.state)),
    input: { data: { messageId: "incoming" } },
    outbox: { enqueue(key, payload) {
      const ref = { operationId: "operation", eventId: current.id, key: `${key}-${++sequence}` };
      pending.push({ ref, payload });
      payloads.push(payload);
      return ref;
    } },
  };
  const capabilities = {
    env: { FEISHU_APP_ID: "offline-app", FEISHU_APP_SECRET: "offline-placeholder" },
    signal: new AbortController().signal,
    credentials: { async exchange() { return { value: "offline-placeholder" }; } },
    async fetch(_url, options) {
      const body = options.body ? JSON.parse(options.body) : {};
      bodies.push(body);
      return Response.json({
        code: rejectCards && (body.card || body.content || body.type) ? 999 : 0,
        data: { message_id: "reply", card_id: "card", reaction_id: "reaction" },
      });
    },
  };
  async function emit(type, data = {}) {
    current = { id: `event-${++sequence}`, operationId: "operation", type, data };
    await channel.events[type]?.(current, ctx);
    // Persist/reload between events, as the real Channel projection does.
    ctx.state = channel.stateSchema.parse(JSON.parse(JSON.stringify(ctx.state)));
  }
  async function drain() {
    for (let turns = 0; pending.length; turns++) {
      assert.ok(turns < 40, "offline delivery must reach a terminal state");
      const { ref, payload } = pending.shift();
      const result = await channel.outbound({ id: ref.key, payload }, capabilities);
      await emit(result.status === "sent" ? "delivery.sent" : "delivery.failed", {
        eventId: ref.eventId, key: ref.key, ref, result,
      });
    }
  }
  return { emit, drain, payloads, bodies };
}

function assertNoAuthorization(value) {
  const rendered = JSON.stringify(value);
  assert.equal(rendered.includes(syntheticTicket), false);
  assert.equal(rendered.includes(url), false);
  assert.doesNotMatch(rendered, /oauth\/start|ticket[=:]/i);
  // Even fragments from the synthetic opaque value must never be projected.
  assert.equal(rendered.includes("offline-only"), false);
  assert.equal(rendered.includes("opaque-value"), false);
}

for (const status of ["authorization_required", "authorization_available"]) {
  for (const [name, copy] of [["success", success], ["failure", failure], ["UNKNOWN", unknown]]) {
    for (const rejectCards of [false, true]) {
      test(`${status}: ${name} has no authorization text in ${rejectCards ? "text fallback" : "card"} output`, async () => {
        const f = fixture({ rejectCards });
        await f.emit("input.accepted");
        await f.emit("run.started");
        await f.drain();
        await f.emit("tool-input-start", { toolCallId: "host", toolName: "feishu__call" });
        await f.emit("tool-output-available", { toolCallId: "host", output: { status, url } });
        await f.drain();
        await f.emit("tool-input-available", {
          toolCallId: "send", toolName: "feishu__call",
          input: { argv: ["im", "+messages-send", "--content", JSON.stringify({ url })] },
        });
        await f.emit("tool-input-delta", { toolCallId: "send", inputTextDelta: url });
        await f.emit("tool-output-error", { toolCallId: "send", errorText: url });
        for (const delta of [copy, "\n", url.slice(0, -10), url.slice(-10)]) {
          await f.emit("text-delta", { id: "text", delta });
          await f.drain();
          assertNoAuthorization(f.payloads);
          assertNoAuthorization(f.bodies);
        }
        const reply = extractChannelReply({ id: "reply", parts: [
          { type: "tool-feishu__call", state: "output-available", output: { status, url } },
          { type: "text", text: `${copy}\n片段：${syntheticTicket.slice(0, 12)}` },
        ] }, "reply");
        assert.equal(reply.text.includes(url), true, "exercise the installed SDK append");
        await f.emit("run.succeeded", { reply });
        await f.drain();
        assertNoAuthorization(f.payloads);
        assertNoAuthorization(f.bodies);
        const replies = f.payloads.filter((payload) => ["card-final", "card-update", "text-reply"].includes(payload.kind));
        assert.ok(replies.length > 0);
        assert.ok(replies.every((payload) => payload.text === copy));
        assert.equal(replies.at(-1).kind, rejectCards ? "text-reply" : "card-final");
      });
    }
  }
}

test("unrecognized or rewritten authorization prose gets neutral fixed copy", () => {
  for (const text of [
    `发送失败，改用[前往授权](${url})`,
    `授权卡已发送，${url}`,
    `片段 ${syntheticTicket} ticket=${syntheticTicket}`,
    `https://musegea.com/api/agent-connectors/oauth/start?modified=yes`,
  ]) {
    const safe = authorizationReplyText(text);
    assertNoAuthorization(safe);
    assert.doesNotMatch(safe, /已发送|发送失败|未发送/);
    assert.match(safe, /如未收到/);
  }
});

test("fixed authorization replies discard any trailing fragments even without a full URL", () => {
  for (const copy of [success, failure, unknown]) {
    assert.equal(authorizationReplyText(`${copy}\n${syntheticTicket.slice(0, 12)}`), copy);
  }
});

test("failed Run never projects tool diagnostics or incomplete streamed fragments", async () => {
  const f = fixture();
  await f.emit("run.started");
  await f.drain();
  await f.emit("tool-input-available", { toolCallId: "send", toolName: "feishu__call", input: { url } });
  await f.emit("tool-output-available", { toolCallId: "send", output: { stderr: url } });
  await f.emit("text-delta", { id: "text", delta: syntheticTicket });
  await f.emit("run.failed", { errorText: url });
  await f.drain();
  assertNoAuthorization(f.payloads);
  assertNoAuthorization(f.bodies);
  assert.ok(f.payloads.some((payload) => payload.text?.includes("本次处理失败")));
});

test("ordinary completed text and links survive without tool preview text", async () => {
  const text = "pong\n[文档](https://example.invalid/docs)";
  const f = fixture();
  await f.emit("run.started");
  await f.emit("text-delta", { id: "text", delta: text });
  await f.emit("run.succeeded", { reply: { text } });
  await f.drain();
  assert.ok(f.payloads.some((payload) => payload.kind === "card-final" && payload.text === text));
});
