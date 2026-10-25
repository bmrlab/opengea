import { feishuAgentExtension } from "@gea-ai/agent-extension-feishu";

// Chat replies only; business API access and its CLI Skill remain disabled.
export default {
  extension: feishuAgentExtension({ transport: "websocket" }),
  overrides: {
    connectors: { api: false },
    skills: { "lark-cli": false },
  },
};
