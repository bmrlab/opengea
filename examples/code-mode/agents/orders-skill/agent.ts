import { defineAgent } from "@gea-ai/agent-sdk";
import { discountPolicy, ordersConfig } from "../../shared/orders";

export default defineAgent({
  ...ordersConfig,
  name: "orders-skill",
  slug: "orders-skill",
  description:
    "Run a reusable Skill script to aggregate remote MCP orders without generating code or exposing raw rows.",
  programmaticToolCalling: {
    toolsNamespace: { description: "Custom order discount policy" },
  },
  tools: [discountPolicy],
  instructions:
    ordersConfig.instructions +
    " For order reports, load the orders-report Skill instructions, then execute its bundled script using executeJavaScript with a skill reference and separate input. Do not read the JavaScript source, copy it into code, or generate a replacement script. Use the script result for your final JSON answer.",
});
