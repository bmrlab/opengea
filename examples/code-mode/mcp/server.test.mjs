import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import worker from "./worker.ts";

test("real MCP transport: pagination, schemas, envelopes and errors", async () => {
  const server = createServer(async (req, res) => {
    const chunks = await Array.fromAsync(req);
    const response = await worker.fetch(
      new Request(`http://127.0.0.1${req.url}`, {
        method: req.method,
        headers: req.headers,
        ...(chunks.length ? { body: Buffer.concat(chunks) } : {}),
      }),
    );
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const client = new Client({ name: "code-mode-test", version: "1" });
  try {
    await client.connect(
      new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${server.address().port}/mcp`)),
    );
    const { tools } = await client.listTools();
    assert.ok(tools.find((t) => t.name === "read_order_page").outputSchema);
    assert.equal(tools.find((t) => t.name === "lookup_order").outputSchema, undefined);
    const pages = await client.callTool({ name: "list_order_pages", arguments: {} });
    assert.deepEqual(pages.structuredContent.pages, [1, 2, 3, 4]);
    const results = await Promise.all(
      pages.structuredContent.pages.map((page) =>
        client.callTool({ name: "read_order_page", arguments: { page } }),
      ),
    );
    const rows = results.flatMap((r) => r.structuredContent.orders);
    assert.equal(rows.length, 100);
    assert.equal(new Set(rows.map((r) => r.id)).size, 100);
    const paid = rows.filter((row) => row.status === "paid");
    assert.equal(paid.length, 75);
    assert.equal(
      paid.reduce((sum, row) => sum + row.units, 0),
      150,
    );
    assert.equal(
      paid.reduce((sum, row) => sum + row.units * row.unitPriceCents, 0),
      205375,
    );
    assert.equal(
      paid.reduce(
        (sum, row) =>
          sum +
          Math.floor(
            (row.units * row.unitPriceCents * (row.region === "north" ? 9000 : 9500)) / 10000,
          ),
        0,
      ),
      191638,
    );
    for (const result of results) {
      assert.equal(result.isError, false);
      assert.equal(result._meta.dataset, "synthetic-orders-v1");
      assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent);
    }
    const invalid = await client.callTool({ name: "read_order_page", arguments: { page: 0 } });
    assert.equal(invalid.isError, true);
    const missing = await client.callTool({ name: "lookup_order", arguments: { id: "missing" } });
    assert.equal(missing.isError, true);
    assert.match(missing.content[0].text, /ORDER_NOT_FOUND/);
    const found = await client.callTool({ name: "lookup_order", arguments: { id: "ORDER-001" } });
    assert.equal(found.structuredContent, undefined);
    assert.equal(JSON.parse(found.content[0].text).id, "ORDER-001");
  } finally {
    await client.close();
    server.close();
    server.closeAllConnections();
  }
});
