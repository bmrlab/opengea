import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { ordersMcpUrl } from "../shared/mcp-url.ts";

const client = new Client({ name: "opengea-code-mode-probe", version: "1.0.0" });
try {
  await client.connect(new StreamableHTTPClientTransport(new URL(ordersMcpUrl)));
  const catalog = await client.listTools();
  const manifest = await client.callTool({ name: "list_order_pages", arguments: {} });
  assert.deepEqual(manifest.structuredContent.pages, [1, 2, 3, 4]);
  const page = await client.callTool({ name: "read_order_page", arguments: { page: 1 } });
  assert.equal(page.isError, false);
  assert.equal(page._meta.dataset, "synthetic-orders-v1");
  assert.equal(page.structuredContent.orders.length, 25);
  assert.deepEqual(JSON.parse(page.content[0].text), page.structuredContent);
  assert.ok(catalog.tools.find((t) => t.name === "read_order_page").outputSchema);
  assert.equal(catalog.tools.find((t) => t.name === "lookup_order").outputSchema, undefined);
  const missing = await client.callTool({ name: "lookup_order", arguments: { id: "missing" } });
  assert.equal(missing.isError, true);
  assert.match(missing.content[0].text, /ORDER_NOT_FOUND/);
  const found = await client.callTool({ name: "lookup_order", arguments: { id: "ORDER-001" } });
  assert.equal(found.structuredContent, undefined);
  assert.equal(JSON.parse(found.content[0].text).id, "ORDER-001");
  await mkdir(".gea", { recursive: true });
  await writeFile(
    ".gea/remote-mcp-probe.json",
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        url: ordersMcpUrl,
        catalog,
        manifest,
        page,
        missing,
        found,
      },
      null,
      2,
    ),
  );
  console.log(
    "Passed: remote official MCP client, schemas, full envelope, text-only result and isError.",
  );
} finally {
  await client.close();
}
