# Code mode: discover tools, then compose them in JavaScript

A small synthetic warehouse Agent using public SDK and macOS CLI
**0.1.261003-alpha.0**. The model calls `executeJavaScript`; inside the script it
finds custom tools, reads their schemas, calls them and computes a summary.
There is no separate `codeMode` or `executeCode` top-level tool.

All inventory is bundled synthetic data. The tools perform no network calls or
business writes. Model calls still use the configured hosted model provider.

## Install

Use Node **24.16.0**, pnpm **12.1.0** and macOS ARM64 for this CLI release:

```sh
pnpm install --frozen-lockfile
pnpm type-check
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

## What the Agent declares

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
there is no automatic approval, retry or replay. This example uses read-only
custom tools and does not exercise MCP, approvals or external writes.

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

The verifier uses your CLI login and workspace. It starts two real hosted model
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

See [VERIFICATION.md](VERIFICATION.md) for the actual production results and gaps.
