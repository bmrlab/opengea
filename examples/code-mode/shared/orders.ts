import { defineMcpConnector, defineTool, noAuth } from "@gea-ai/agent-sdk";
import { agentCore } from "@gea-ai/agent-sdk/agent-core";
import { z } from "zod";

import { ordersMcpUrl } from "./mcp-url";

export const ordersConnector = defineMcpConnector({
  key: "synthetic-orders",
  name: "Synthetic orders",
  description: "Read-only paginated synthetic order records and lookup errors.",
  serverUrl: ordersMcpUrl,
  auth: noAuth(),
  connection: { principalType: "agent" },
}).require({
  namespace: {
    description: "Synthetic order pages, order lookup and order reporting data",
    instructions:
      "List the pages, then fetch every page exactly once. Structured responses keep the MCP envelope: read structuredContent for rows; check isError before using results.",
  },
});

export const discountPolicy = defineTool({
  name: "getDiscountPolicy",
  description:
    "Get region discount rates in basis points (10000 = 100%). For each paid order compute netCents = Math.floor(units * unitPriceCents * (10000 - regionBasisPoints) / 10000). Cancelled orders are excluded.",
  input: z.object({}).strict(),
  execute: async () => ({ north: 1000, south: 500 }),
});

export const ordersConfig = {
  model: "creative-reasoning-1.5",
  engine: agentCore(),
  maxOutputTokens: 8192,
  computer: { enabled: false },
  connectors: { orders: ordersConnector },
  instructions:
    "You analyze synthetic orders. Retrieve all pages and the custom discount policy. Count only paid orders. Use integer cents and floor the discount for each order before summing. Return only the requested compact JSON summary. Never invent rows, ignore errors, or automatically retry failed operations. The page output schema describes structuredContent; retain and check the full MCP result envelope. These are read-only synthetic examples.",
} as const;
