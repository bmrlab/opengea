# Code mode: discover tools, then compose them in JavaScript

Three Agents using public SDK and macOS CLI **0.1.261003-alpha.0**:

| Agent                 | Purpose                                                                                                                          |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `orders-code`         | Read four remote MCP order pages and apply a custom discount policy inside JavaScript; only a compact summary reaches the model. |
| `orders-direct`       | Perform the same task with ordinary model-visible MCP tools and a pure-computation JavaScript tool.                              |
| `code-mode-warehouse` | Small introductory example for discovery, hidden tools and input validation.                                                     |

Code mode uses the existing `executeJavaScript`; there is no separate `codeMode`
or `executeCode` top-level tool. The advantage demonstrated here is **keeping raw
records inside the script while composing several tool calls**. It does not mean
that every task takes fewer model turns.

All records are synthetic. The order Agents make real HTTPS requests to the
read-only MCP Worker in [mcp/worker.ts](mcp/worker.ts), implemented with the official
MCP SDK. There are no business writes. Model requests use your hosted GEA model.

## Install

Use Node **24.16.0**, pnpm **12.1.0** and macOS ARM64 for this CLI release:

```sh
pnpm install --frozen-lockfile
pnpm type-check
pnpm test
pnpm mcp:build
pnpm agent:validate
pnpm agent:pack
pnpm gea login --json '{"baseUrl":"https://musegea.com"}'
pnpm gea workspace use --json '{"orgSlug":"your-org","workspaceSlug":"default"}'
```

The CLI is a pinned project dependency; no global or private source build is
required. The launcher retains an older Windows binary; this example is not
verified on Windows. If another GEA installation uses an incompatible credential
format, select a separate `GEA_CONFIG_DIR` before login and keep it selected for
subsequent commands.

## Remote MCP plus custom tools

The two order Agents share [shared/orders.ts](shared/orders.ts): the same model,
MCP Connector, custom `getDiscountPolicy` tool and arithmetic requirements. The
code Agent enables discovery and keeps records inside scripts. The direct Agent
gets ordinary MCP tool declarations and the old pure-computation script tool.
Their mode-specific instructions explain those different interfaces; both receive
the same user task. Neither Agent can import the server's order data.

The MCP server has three read-only tools:

- `list_order_pages`: four page numbers and 100 total records, with an output schema.
- `read_order_page`: 25 records per page; returns `content`, `structuredContent`,
  `isError: false` and `_meta.dataset`. Its output schema describes structured
  data, **not** the whole MCP envelope.
- `lookup_order`: text-only JSON, without an output schema. A missing ID returns
  the original `isError: true` envelope with `ORDER_NOT_FOUND`.

The report excludes cancelled orders, applies the custom region policy, floors
net cents **per order**, then aggregates by region. Expected totals are 75 paid
orders, 150 units, 205375 gross cents and 191638 net cents.

[shared/mcp-url.ts](shared/mcp-url.ts) points to the deployed public synthetic
service for convenience. To own the whole example, deploy a separate MCP Worker
to your dedicated Studio Project, promote it, and replace that URL before
packaging the Agents:

```sh
pnpm gea worker deploy --json '{"cwd":"mcp","project":"my-code-mode","name":"opengea-code-mode-mcp"}'
pnpm gea worker release --json '{"workerId":"<MCP workerId>","deploymentId":"<MCP deploymentId>","environment":"production"}'
pnpm mcp:probe
```

Use the returned public Worker URL plus `/mcp`. `mcp:probe` uses an official MCP
client against that URL and verifies schemas, envelopes, missing-order errors and
text-only responses. The service intentionally has no authentication because it
serves only bundled synthetic records; it is not a template for exposing customer
data. It has no state or outbound connections and accepts only bounded MCP POSTs.

After deploying the Agent Worker using the instructions below, set
`GEA_CODE_AGENT_ID` and `GEA_DIRECT_AGENT_ID` from `worker inspect`, plus
`GEA_PROJECT` and `GEA_ENVIRONMENT`, then run:

```sh
pnpm compare
```

This starts one report Run per mode and one separate MCP boundary Run. It checks
exact results, four actual remote page calls, the custom policy call, nested spans
in code mode and absence of raw rows in script results. It also checks the actual
script's evidence for MCP envelope preservation, output schemas, text-only data,
a remote error and a subsequent successful read. Real model responses are never
replaced with fixtures. Resume saved Runs without reposting them:

```sh
GEA_COMPARE_DIR=.gea/comparison/<existing-directory> pnpm compare
```

The saved report records model request counts, trace-reported token usage, model
span duration, top-level tool calls, and actual tool-result JSON bytes entering
model input. Byte counts include schemas/discovery and the platform's normal
output-offload behavior; they are not tokenizer estimates or billed cost. Repeated
context bytes are recorded separately. A one-pair trial demonstrates behavior,
not a statistically stable benchmark. See [COMPARISON.md](COMPARISON.md).

## Introductory warehouse Agent

Read [agent.ts](agent.ts) and its bundled [instructions](AGENTS.md):

- `codeMode.defaultExposure: "discoverable"` keeps `listWarehouses` and
  `readInventory` inside the script tool catalog.
- `toolsNamespace` supplies the description and usage instructions for namespace
  `tools`; each tool retains its real Zod input schema.
- `privateCanary` is explicitly `hidden`. It is a harmless probe, excluded from
  discovery and unavailable even when the model guesses its name.
- No output schema is declared: discovery correctly describes the result as
  `unknown`, rather than inventing a return type.

The existing V8 Worker Loader runs scripts with request-scoped tool capabilities.
Computer is disabled. Removing `codeMode` restores ordinary tool exposure; if you
want the old pure-computation JavaScript tool, declare the SDK's
`executeJavaScript()` explicitly. `executePython` is unaffected by code mode.

## Try locally

```sh
pnpm dev
```

This runs the native Worker Runtime on port **8796** and the local Agents API on
**8797**, with real model requests through your GEA login. Both ports must be free.
Use the [Agents API](../agents-api/) caller pattern with
`http://127.0.0.1:8797/api/v1` and `environment: "local"`, or use the hosted flow
below. Stop the local server with Ctrl-C.

Example user request:

> Discover the warehouse tools, inspect their schemas, read the warehouses
> concurrently and calculate total units and total inventory value in USD cents.

A script the model could write after inspecting schemas:

```js
const matches = await searchTools("warehouse inventory", { namespace: "tools" });
const description = await describeTool("readInventory");
const namespace = await describeNamespace("tools");
console.log({ matches, description, namespace });
const { warehouses } = await tools.listWarehouses({});
const inventory = await Promise.all(
  warehouses.map((warehouse) => tools.readInventory({ warehouse })),
);
const items = inventory.flatMap((result) => result.items);
return {
  warehouses,
  totalUnits: items.reduce((sum, item) => sum + item.units, 0),
  totalValueCents: items.reduce((sum, item) => sum + item.units * item.priceCents, 0),
};
```

Expected totals: **32 units, 7800 cents**. This illustrative script is not a model
fixture: the verification runner supplies natural-language requests to a real
model and checks the resulting script outputs and hosted traces.

`ALL_TOOLS` lists callable names/signatures. `searchTools` uses BM25 (default 8,
maximum 20), with optional namespace filtering. Always `await` calls, and keep at
most four outstanding callbacks. A failed script does not roll back effects;
there is no automatic approval, retry or replay. The warehouse Agent uses only custom tools; the order Agents add remote MCP.
Neither scenario exercises approvals or external writes.

## Deploy and verify in Production

Create a dedicated Studio Project in the selected workspace. Replace the example
project slug below with its actual slug, then push:

```sh
pnpm gea agent push --json '{"cwd":".","project":"my-code-mode","slug":"opengea-code-mode"}'
pnpm gea worker inspect --json '{"workerId":"<workerId from push>"}'
```

Push updates Preview. Select the exact returned deployment for Production:

```sh
pnpm gea worker release --json '{"workerId":"<workerId>","deploymentId":"<deploymentId from push>","environment":"production"}'
```

Only use a dedicated example Worker: release affects every Agent in that Worker.
The target Runtime must support `worker-loader-callback-v1`; the tested deployment
uses `v0.55.35`. This repository does not upgrade your cluster.

Copy `.env.example` to `.env`, set `GEA_PROJECT` and the Agent UUID reported by
`worker inspect`, and run:

```sh
pnpm verify
```

`pnpm verify` checks the introductory warehouse Agent, selected by `GEA_AGENT_ID`.
It uses your CLI login and workspace. It starts two real hosted model
Runs in `production` (or explicitly `GEA_ENVIRONMENT=preview`):

1. Discovery, schema inspection, `Promise.all` inventory reads and exact totals.
2. Catalog and namespace inspection, hidden-name rejection, invalid-input
   rejection, and a successful read after those caught errors.

It checks actual `executeJavaScript` outputs, excludes direct custom-tool calls,
reads every trace page, verifies model spans and checks that inventory tool spans
are children of script spans. It saves Run/Chat/version/deployment IDs, scripts,
outputs, trace evidence and package versions under ignored `.gea/verification/`.
Model behavior varies; a failed assertion is a failed verification, not a reason
to substitute a scripted response or weaken the check. Traces may arrive later;
resume inspection using the printed directory rather than starting another Run:

```sh
GEA_VERIFY_DIR=.gea/verification/<existing-directory> pnpm verify
```

Accepted Runs are never reposted. A pending marker without a start response means
the outcome is uncertain: inspect Studio and recover the existing Run identifiers
before continuing. The verifier does not cancel Runs on timeout or delete evidence.
Sessions, traces and the demonstration deployment remain for inspection.

See [VERIFICATION.md](VERIFICATION.md) for the initial warehouse results and
[COMPARISON.md](COMPARISON.md) for the remote MCP comparison and remaining gaps.
