import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";

const orderSchema = z.object({
  id: z.string(),
  region: z.enum(["north", "south"]),
  status: z.enum(["paid", "cancelled"]),
  units: z.number().int(),
  unitPriceCents: z.number().int(),
  note: z.string(),
});
const orders = Array.from({ length: 100 }, (_, offset) => {
  const i = offset + 1;
  return {
    id: `ORDER-${String(i).padStart(3, "0")}`,
    region: i % 2 === 0 ? ("north" as const) : ("south" as const),
    status: i % 4 === 0 ? ("cancelled" as const) : ("paid" as const),
    units: 1 + (i % 3),
    unitPriceCents: 1000 + (i % 7) * 125,
    note: `Synthetic order ${i}; test dataset only, no customer data. Keep monetary calculations in integer cents.`,
  };
});
const annotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

export default {
  async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === "/healthz") return Response.json({ status: "ok", dataset: "synthetic-orders-v1" });
    if (path !== "/mcp") return new Response("Not found", { status: 404 });
    // This demo has only bounded request/response tools, with no SSE subscriptions.
    if (request.method !== "POST")
      return new Response(null, { status: 405, headers: { Allow: "POST" } });
    const server = new McpServer({ name: "opengea-synthetic-orders", version: "1.0.0" });
    server.registerTool(
      "list_order_pages",
      {
        description:
          "List all four pages of synthetic orders. Read every page once to compute a complete report.",
        inputSchema: z.object({}).strict(),
        outputSchema: z.object({
          dataset: z.string(),
          pages: z.array(z.number().int()),
          totalOrders: z.number().int(),
        }),
        annotations,
      },
      async () => {
        const data = { dataset: "synthetic-orders-v1", pages: [1, 2, 3, 4], totalOrders: 100 };
        return {
          content: [{ type: "text", text: JSON.stringify(data) }],
          structuredContent: data,
          isError: false,
        };
      },
    );
    server.registerTool(
      "read_order_page",
      {
        description:
          "Read one of the four pages of synthetic order records (25 rows). All monetary values are integer USD cents. The output schema describes structuredContent, not the MCP envelope.",
        inputSchema: z.object({ page: z.number().int().min(1).max(4) }).strict(),
        outputSchema: z.object({ page: z.number().int(), orders: z.array(orderSchema) }),
        annotations,
      },
      async ({ page }) => {
        const data = { page, orders: orders.slice((page - 1) * 25, page * 25) };
        return {
          content: [{ type: "text", text: JSON.stringify(data) }],
          structuredContent: data,
          isError: false,
          _meta: { dataset: "synthetic-orders-v1" },
        };
      },
    );
    server.registerTool(
      "lookup_order",
      {
        description:
          "Look up one synthetic order by ID, e.g. ORDER-001. Returns text-only JSON with no output schema; a missing ID returns an MCP isError envelope with ORDER_NOT_FOUND. Used for protocol boundary checks, not bulk reporting.",
        inputSchema: z.object({ id: z.string().min(1).max(64) }).strict(),
        annotations,
      },
      async ({ id }) => {
        const order = orders.find((row) => row.id === id);
        return order
          ? { content: [{ type: "text", text: JSON.stringify(order) }], isError: false }
          : {
              content: [{ type: "text", text: "ORDER_NOT_FOUND: synthetic order does not exist" }],
              isError: true,
            };
      },
    );
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
      maxRequestBodySize: 16 * 1024,
    });
    try {
      await server.connect(transport);
      const response = await transport.handleRequest(request);
      // Materialize the bounded JSON reply before closing request-owned resources.
      return new Response(response.body ? await response.arrayBuffer() : null, {
        status: response.status,
        headers: response.headers,
      });
    } finally {
      await server.close();
    }
  },
};
