import { env } from "@gea-ai/agent-sdk";
import { feishuChannel } from "@gea-ai/agent-sdk/channels/feishu";

export default feishuChannel({
  transport: "websocket",
  env: {
    FEISHU_APP_ID: env.value(),
    FEISHU_APP_SECRET: env.secret(),
    FEISHU_ALLOWED_SENDERS: env.value(),
  },
  configure(ctx) {
    return {
      appId: ctx.env.FEISHU_APP_ID,
      appSecret: ctx.env.FEISHU_APP_SECRET,
      allowedSenders: ctx.env.FEISHU_ALLOWED_SENDERS,
    };
  },
});
