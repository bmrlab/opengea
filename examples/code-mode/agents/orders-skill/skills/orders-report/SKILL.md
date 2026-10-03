---
name: orders-report
description: Summarize paid synthetic orders by region using live MCP pages and the custom discount policy.
---

Run the bundled script using `executeJavaScript`:

```json
{
  "skill": { "name": "orders-report", "path": "scripts/summarize.js" },
  "input": { "regions": ["north", "south"] }
}
```

`regions` may select north, south, or both; omitting it selects both. The script
returns `{regions, totals}` with `paidOrders`, `units`, `grossCents`, and
`netCents` for each selected region and the combined totals. Return that JSON.

The script reads every remote page once, gets the current custom discount policy,
excludes cancelled orders, and floors net cents per order before summing. Raw
records stay in the script. Do not load the JS source or regenerate it inline.
A failure may follow completed calls; report the error without retry or replay.
