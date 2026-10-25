import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { extractChannelReply } from "@gea-ai/agent-sdk/agent-channel-api";

const skillRoot = new URL("../skills/feishu-authorization/", import.meta.url);
const template = JSON.parse(await readFile(new URL("auth-card.json", skillRoot), "utf8"));

function walk(value) {
  if (value === null || typeof value !== "object") return [];
  return [value, ...Object.values(value).flatMap(walk)];
}

test("fixed authorization template has one URL button and no callbacks", () => {
  assert.equal(template.schema, "2.0");
  assert.deepEqual(template.config, { update_multi: true });
  assert.deepEqual(template.header, { title: { tag: "plain_text", content: "连接飞书账号" }, template: "blue" });
  assert.equal(template.body.elements.length, 3);
  assert.deepEqual(template.body.elements.map((element) => element.tag), ["markdown", "button", "markdown"]);
  const nodes = walk(template);
  assert.equal(nodes.filter((node) => node.tag === "button").length, 1);
  assert.deepEqual(template.body.elements[1], {
    tag: "button", text: { tag: "plain_text", content: "前往授权" }, type: "primary_filled", width: "fill",
    behaviors: [{ type: "open_url", default_url: "https://example.invalid/api/agent-connectors/oauth/start?ticket=REDACTED", pc_url: "", ios_url: "", android_url: "" }],
  });
  for (const node of nodes) {
    for (const key of ["callback", "value", "form_action_type", "multi_url", "url"])
      assert.equal(Object.hasOwn(node, key), false);
    if (node.type && !node.tag) assert.equal(node.type, "open_url");
  }
});

test("replacing only default_url and JSON-stringifying preserves the opaque URL exactly", () => {
  // Synthetic URLs only. This checks the template/serialization contract, not model compliance.
  for (const originalUrl of [
    "https://musegea.com/api/agent-connectors/oauth/start?ticket=synthetic%2f%2F%3D%2525+A&x=%22%5C&x=2",
    "https://musegea.com/api/agent-connectors/oauth/start?ticket=synthetic_-.~=&next=a%26b%3Dc",
  ]) {
    const card = structuredClone(template);
    card.body.elements[1].behaviors[0].default_url = originalUrl;
    const stdin = JSON.stringify(card);
    const wireContent = JSON.parse(stdin);
    assert.equal(wireContent.body.elements[1].behaviors[0].default_url, originalUrl);
    wireContent.body.elements[1].behaviors[0].default_url = template.body.elements[1].behaviors[0].default_url;
    assert.deepEqual(wireContent, template);
    assert.equal(stdin.split(originalUrl).length - 1, 1);
  }
});

test("bundled owner policy uses exact HTTPS origins and the Host OAuth start path", async () => {
  const policy = JSON.parse(await readFile(new URL("url-policy.json", skillRoot), "utf8"));
  assert.deepEqual(policy.allowedOrigins, ["https://musegea.com"]);
  for (const origin of policy.allowedOrigins) {
    const parsed = new URL(origin);
    assert.equal(parsed.protocol, "https:");
    assert.equal(parsed.origin, origin);
    assert.equal(parsed.username + parsed.password + parsed.search + parsed.hash, "");
  }
  assert.equal(policy.oauthStartPath, "/api/agent-connectors/oauth/start");
});

test("installed SDK still appends the original Host URL after a one-sentence card notice", () => {
  const url = "https://musegea.com/api/agent-connectors/oauth/start?ticket=SYNTHETIC";
  const text = "请点击授权卡中的「前往授权」，完成后回到此私聊发消息继续。";
  const result = extractChannelReply({ id: "reply", parts: [
    { type: "tool-feishu__call", state: "output-available", output: { status: "authorization_required", url } },
    { type: "text", text },
  ] }, "reply");
  assert.equal(result.text, `${text}\n\n${url}`);
});
