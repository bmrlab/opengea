# Memory notebook Agent

A small Agent using the published `@gea-ai/agent-sdk/memory` API to save, read,
search, correct and remove durable facts across Sessions. Unlike
[observational-memory](../observational-memory/), this example uses the SDK fact
store and its registered tools; it does not implement a context strategy or
make auxiliary model calls.

## Setup

Use Node 24.16.0 and pnpm 12.8.1 on macOS Apple Silicon (the pinned CLI
publishes a Darwin arm64 executable).
Dependencies are public npm packages: SDK `0.1.261024-alpha.2` and CLI
`0.2.261024-alpha.0`. Each example owns its lockfile; no private repository or
workspace dependency is required.

```sh
pnpm install --frozen-lockfile
pnpm type-check
pnpm agent:validate
pnpm agent:pack
```

For interactive local use, authenticate the CLI with `pnpm exec gea login`, then
run `pnpm dev`. This uses the authenticated hosted model source and may incur
model usage. Keep credentials in the CLI credential store. The default local
ports are 8799 and 8800; if occupied, change both in `agent-dev.json` before
starting. Use the Agents API address printed by the CLI to select
`memory-notebook` and create Sessions. No cloud push is needed for local use.

## Try the memory tools

1. Ask: “Remember that project Aurora's release checklist owner is Lin.”
   The Agent calls `notebook__save_memory({ text })`.
2. Ask: “List the project facts you saved.” The Agent calls
   `notebook__read_memory({})`; entries include permanent indexes and a document
   version.
3. Start a **new Session for the same Agent** and ask: “Search your notebook for
   Aurora.” The Agent calls `notebook__search_memory({ query: "Aurora" })`.
   This demonstrates cross-Session storage rather than relying on chat history.
4. Ask to change the owner to Mei. The Agent reads, then calls
   `notebook__update_memory({ index, text, expectedVersion })` with the returned
   index/version. A stale version requires another read, not a blind retry.
5. Ask to forget the Aurora fact. The Agent calls
   `notebook__remove_memory({ index })`. Search from another Session should no
   longer find it.

Restart local development with the same project and native state, then repeat
step 3 before deleting the entry. Retain the CLI's local application/Runtime state as well as the same project
identity to retain memory. Use a separate local App Server state directory for
an isolated notebook; copying source alone is not a storage-reset procedure.
Deployment/storage identity changes or a separate Worker installation do not
carry over this notebook. These prompts are a manual model-dependent walkthrough,
not a deterministic automated acceptance test.

## Scope and limits

`scope: "agent"` intentionally shares the notebook between callers of this Agent
inside the same organization and Worker installation. It is suitable for shared,
non-sensitive project facts. For private preferences, change to `scope: "user"`
and invoke with a trusted authenticated user principal; a service principal does
not qualify. Changing scope selects different storage rather than migrating facts.
Do not expose arbitrary tenant/user identity as a model input.

`AgentMemory` must be exported from the entry module as well as declared by
`defineMemory`. The SDK supplies the tools and Durable Object binding; native
SQLite is managed by the existing Runtime. No extra storage service is needed.
Tool inputs do not accept a tenant or user key. Memory text is untrusted data.
Search ranks keywords and Chinese fragments in this notebook; it does not use
embeddings or infer synonyms. Memory tool traffic is hidden from chat projection,
but an Agent's natural-language answer can still mention remembered facts.

`recall: false` keeps reads/search explicit and avoids automatic recall budgets.
The example uses one slot and only published base memory. Entries are limited to
2,048 UTF-8 bytes, 256 entries per notebook and 65,536 bytes per document;
capacity rejection leaves prior facts intact. There is no automatic capture,
background job or eviction.

## Release status and verification

GEA enhancements [#837](https://github.com/bmrlab/gea/pull/837) (attempt diagnostics),
[#838](https://github.com/bmrlab/gea/pull/838) (native CI) and
[#839](https://github.com/bmrlab/gea/pull/839) (multi-slot recall budget) are merged.
SDK `0.1.261024-alpha.2` includes them and is published on npm. This example pins
that release to validate the current published SDK. Its single-slot, tool-only
behavior does not exercise the multi-slot recall allowance. CLI remains at the
published macOS `0.2.261024-alpha.0`; these SDK changes require no new CLI binary.

Local validation results and untested boundaries are recorded in
[VERIFICATION.md](VERIFICATION.md). The example is ready for review; no deployment
or cloud push is part of this change. Interactive model-dependent cross-Session
and restart verification remains a manual walkthrough.
