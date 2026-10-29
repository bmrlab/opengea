import type { FeishuChannelOptions } from "@gea-ai/agent-extension-feishu/channel";

// The Host supplies verified sender data and scoped SSO candidates. It also owns
// uniqueness, membership, permissions and the final admission decision.
export const matchFeishuAccount: NonNullable<
  FeishuChannelOptions["platformUserMatcher"]
> = (sender, candidate) => sender.openId === candidate.account.accountId;
