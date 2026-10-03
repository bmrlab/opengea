import { defineAgent, defineTool } from "@gea-ai/agent-sdk";
import { agentCore } from "@gea-ai/agent-sdk/agent-core";
import { z } from "zod";

const inventory = {
  north: [
    { sku: "pencil", units: 12, priceCents: 150 },
    { sku: "notebook", units: 7, priceCents: 400 },
  ],
  south: [
    { sku: "pencil", units: 8, priceCents: 150 },
    { sku: "notebook", units: 5, priceCents: 400 },
  ],
} as const;

export default defineAgent({
  name: "code-mode-warehouse",
  slug: "code-mode-warehouse",
  description: "Discover read-only tools and summarize synthetic warehouse data in JavaScript.",
  model: "creative-reasoning-1.5",
  engine: agentCore(),
  maxOutputTokens: 8192,
  computer: { enabled: false },
  codeMode: {
    defaultExposure: "discoverable",
    toolsNamespace: {
      description: "Synthetic warehouse inventory and valuation utilities",
      instructions: "List warehouses, then read their inventory. Prices are integer USD cents.",
    },
  },
  tools: [
    defineTool({
      name: "listWarehouses",
      description: "List available synthetic warehouses and their identifiers.",
      input: z.object({}).strict(),
      execute: async () => ({ warehouses: ["north", "south"] }),
    }),
    defineTool({
      name: "readInventory",
      description: "Read synthetic inventory units and unit prices in USD cents for one warehouse.",
      input: z.object({ warehouse: z.enum(["north", "south"]) }).strict(),
      execute: async ({ warehouse }) => ({ warehouse, items: inventory[warehouse] }),
    }),
    defineTool({
      name: "privateCanary",
      description: "A harmless hidden tool used to verify the exposure boundary.",
      exposure: "hidden",
      input: z.object({}).strict(),
      execute: async () => ({ marker: "HIDDEN_TOOL_EXECUTED" }),
    }),
  ],
});
