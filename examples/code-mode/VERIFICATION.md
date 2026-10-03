# Verification — 2026-10-03

Verified using the npm-published SDK and macOS ARM64 CLI
`0.1.261003-alpha.0`, Node `24.16.0`, pnpm `12.1.0`.
This example is based on OpenGEA `560c4cb`, with its own lockfile and no private
workspace dependencies.

## Executed checks

- Frozen-lockfile installation, TypeScript check, Agent validation and packaging:
  passed.
- Published CLI / native Runtime local startup and `GET /api/v1/agents`:
  passed; local development process stopped afterward. No local-model run is
  claimed by this startup check.
- Actual AWS China hosted **Production** execution: two Runs finished and passed
  the verifier. A later verifier invocation resumed the same Runs to inspect all
  trace pages; it did not create duplicate executions.
- Model alias in actual model spans: `creative-reasoning-1.5`;
  transport: `anthropic-messages`. This identifies the configured hosted model
  alias, not an independently verified upstream model revision.

The example has no MCP Connector or business writes. Production writes were
limited to creating its demonstration Project/Worker/Agent, selecting its
Production deployment, and storing its synthetic verification sessions/traces.
Existing application Workers were not modified.

## Immutable execution identity

| Field               | Value                                                                     |
| ------------------- | ------------------------------------------------------------------------- |
| Studio Project      | `opengea-code-mode`                                                       |
| Project ID          | `01a10007-059d-7278-8705-cff488be2910`                                    |
| Worker ID           | `01a10007-0ddb-7114-841d-fbdf259c53ff`                                    |
| Worker deployment   | `01a10007-0e25-7126-9177-75d94bac65b6`                                    |
| Agent ID            | `01a10007-1a9d-733f-a803-88f88a2857ab`                                    |
| Agent version       | `01a10007-1aaa-7341-8ce6-88e5bb6d6ffb` (version 1)                        |
| Snapshot hash       | `sha256:ff7ed05f0965c788f1f3fd591471e038f41a1ffb04a1a9c796ad5ee7ed04fb12` |
| Worker content hash | `sha256:f7835cddcb6d45737f9beef1e422e899a63bfaf2766abf1fa75f4c3770f65c77` |
| Lockfile SHA-256    | `62ef10247f475e58c1ffb2288ebef6bb919192828dd16b97fb909186f3460a8d`        |

The target is the AWS China cluster upgraded to Runtime `v0.55.35` immediately
before this verification. These two Runs prove the hosted callback path works;
they do not independently attest every cluster replica or registry image.

## Run results

| Case       | Run                                    | Chat                                   | Trace                              |
| ---------- | -------------------------------------- | -------------------------------------- | ---------------------------------- |
| Inventory  | `01a10007-c892-70cd-b915-caa4ff36b282` | `01a10007-c7c4-727b-8654-8db6c2ceed79` | `a1c162a2ff82660935f1dcd706023d98` |
| Boundaries | `01a10009-f559-737a-9de5-4be0c7a08e8e` | `01a10009-f51d-7128-95b1-567422efb53a` | `b0086d8a2d6deb73ba0f804e2314a568` |

Inventory used five model-authored `executeJavaScript` calls: search, schema
inspection, listing warehouses, `Promise.all` reads, and computation. The actual
script returned `totalUnits: 32`, `totalValueCents: 7800`. Trace spans show
`listWarehouses` and two `readInventory` calls nested beneath script spans. The
model chose multiple scripts; this is not a one-call efficiency benchmark.
The tiny in-memory reads finished within trace timestamp granularity: the
`Promise.all` pattern was observed, but sustained overlapping remote calls were
not tested.

Boundaries used one model-authored script. Its actual result included:

```json
{
  "catalogNames": ["listWarehouses", "readInventory"],
  "hiddenAbsent": true,
  "hiddenError": "tools.privateCanary is not a function",
  "invalidInputError": "Error: Nested tool call rejected (invalid_input): Type validation failed: ...",
  "north": {
    "warehouse": "north",
    "items": [
      { "sku": "pencil", "units": 12, "priceCents": 150 },
      { "sku": "notebook", "units": 7, "priceCents": 400 }
    ]
  }
}
```

The display above abbreviates the validation message. The saved raw
script output contains the enum validation details and full rows. The hidden
handler marker is absent and no hidden-tool execution span exists. A legal north
read after both caught errors returned 19 units. All script outputs were
available, without script errors or truncation. Custom tools were not emitted as
direct model calls.

Read-only evidence can be retrieved with the authorized workspace login:

```sh
pnpm gea chat export --json '{"chatId":"01a10007-c7c4-727b-8654-8db6c2ceed79"}'
pnpm gea trace inspect --json '{"project":"opengea-code-mode","traceId":"a1c162a2ff82660935f1dcd706023d98"}'
```

Follow `nextCursor` for all trace pages. Raw private evidence remains under the
ignored `.gea/verification/production-20261003/` directory in the verification
checkout. It is not part of this public repository.

## Limits

Not exercised here: remote MCP envelopes/output schemas, approval flows,
`codeMode` off/Python compatibility, timeout or concurrent cancellation,
unawaited calls, revocation during an in-flight external call, budget saturation,
or external side-effect failure semantics. Those require their own acceptance
checks; these two successful real-model Runs do not replace runtime conformance,
security review or production load qualification. No model response fixtures were
used. No automatic script retry or replay was introduced.
