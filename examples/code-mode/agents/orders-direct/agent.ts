import { defineAgent, executeJavaScript } from "@gea-ai/agent-sdk";
import { discountPolicy, ordersConfig } from "../../shared/orders";

export default defineAgent({
  ...ordersConfig,
  name: "orders-direct",
  slug: "orders-direct",
  description:
    "The same remote MCP order task using ordinary model-visible tools.",
  programmaticToolCalling: false,
  connectors: {
    orders: { ...ordersConfig.connectors.orders, allowedCallers: ["direct"] },
  },
  tools: [
    { ...discountPolicy, allowedCallers: ["direct"] },
    executeJavaScript(),
  ],
  instructions:
    ordersConfig.instructions +
    " Use the ordinary model-visible tools to fetch order pages and the policy. You may use executeJavaScript for pure computation with data you already received; it cannot call tools. Independent tool calls may be parallelized.",
});
