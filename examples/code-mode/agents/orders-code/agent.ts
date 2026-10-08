import { defineAgent } from "@gea-ai/agent-sdk";
import { discountPolicy, ordersConfig } from "../../shared/orders";

export default defineAgent({
  ...ordersConfig,
  name: "orders-code",
  slug: "orders-code",
  description:
    "Aggregate remote MCP order pages inside code mode without returning raw rows to the model.",
  programmaticToolCalling: {
    toolsNamespace: { description: "Custom order discount policy" },
  },
  tools: [discountPolicy],
  instructions:
    ordersConfig.instructions +
    " Use executeJavaScript discovery to inspect schemas. Keep order rows inside the script; do not log or return raw pages. Fetch independent pages with at most four outstanding calls, compute the entire summary in the same script, and return only the summary. Inspect tool descriptions before making calls.",
});
