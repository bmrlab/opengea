import assert from "node:assert/strict";
import { test } from "node:test";
import agent from "../agent.ts";
import { matchFeishuAccount } from "../lib/platform-user-matcher.ts";

const sender = Object.freeze({ kind: "feishu", appId: "offline-app", tenantKey: "offline-tenant", openId: "ou_demo" });
const candidate = (accountId, ref = "0") => Object.freeze({ ref, account: Object.freeze({ accountId }) });

test("matches the exact verified open ID, without normalization or ref matching", () => {
  assert.equal(matchFeishuAccount(sender, candidate("ou_demo")), true);
  for (const accountId of ["other", "OU_DEMO", " ou_demo", "ou_demo ", ""]) {
    assert.equal(matchFeishuAccount(sender, candidate(accountId, sender.openId)), false);
  }
});

test("the mounted, presentation-wrapped Channel retains the SDK matcher descriptor", () => {
  const channel = agent.extensions[0].extension.channels[0];
  assert.equal(channel.platformUserMatcher, matchFeishuAccount);
  assert.deepEqual(channel.descriptor.platformUserMatcher, {
    execution: "sdk-function", protocolVersion: 2,
  });
});
