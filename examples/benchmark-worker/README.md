# Knowledge search Benchmark Worker

A copyable, deterministic search regression benchmark. Both retrieval and scoring run inside a GEA Worker; its `BenchmarkStore` Durable Object persists the snapshot, executions and judgments. No model, API key, network search, or external dataset is needed locally.

This uses the **experimental Worker path** introduced by gea #1109, verified against `acfe1dc5`. It complements the Agent / bench / judge example in [basic](../basic/), which remains the default GEA Eval flow.

**Current limitations:** the public `@gea-ai/agent-sdk@0.1.261102-alpha.2` package does not export `benchmark-app` even though that version's source tree does. Use the source installation below. The minimum known compatible implementation is gea `acfe1dc5` (platform release line v0.67.0, migration 0110); a minimum compatible **published SDK version is not yet established**. The committed public dependency and lockfile are a baseline, not a claim of Worker support. Upgrade them together when the first package with `benchmark-app` is released. No private repository dependency or workspace link is committed.

GEA currently has **no custom Benchmark page or visualization registration API**. This example exports a custom HTML report from Worker-produced JSON. It does not claim that GEA Studio renders that report or that `visualization` is a recognized platform property. In-platform custom visualization remains blocked upstream.

## What is evaluated

`benchmark.json` contains 12 synthetic English knowledge-base queries and 10 short documents per query. The fixture is deliberately self-contained and small enough for the current 32-Case limit. It includes password recovery, billing, exports, permissions, rate limits and ambiguous queries. All content is synthetic, with manually chosen binary relevance labels; there is no private or scraped data.

| Boundary               | Shape                                                                       |
| ---------------------- | --------------------------------------------------------------------------- |
| Case input             | `query`, `documents: [{ id, title, text }]`                                 |
| Reference (Judge only) | `relevantIds: string[]`                                                     |
| Bench parameters       | `algorithm: "overlap"                                                       | "bm25"`(default bm25),`k: 1..10` (default 3) |
| Bench value            | query, algorithm, k, ranked document IDs and numeric scores                 |
| Per-Case Judge value   | ranking, status, Recall@k, reciprocal rank within k, nDCG@k                 |
| Summary Judge value    | selected/failed counts, macro Recall@k, MRR@k, nDCG@k, report schema marker |

`bench.ts` never imports the fixture or sees reference labels. `retrieval.ts` lowercases and splits on ASCII alphanumerics, then implements distinct-query-token overlap or BM25 (`k1=1.2`, `b=0.75`). Title and text are concatenated once. Zero-score documents are excluded; ties sort by document ID. There is no stemming, synonym expansion, embedding, or training. Replace this function to evaluate your own Worker-compatible implementation.

`judge.ts` uses only saved evidence plus references. Recall divides retrieved relevant documents by all relevant labels. Reciprocal rank is zero if no relevant item occurs within k. nDCG uses binary gains and `1/log2(rank+1)` discounts, normalized by an ideal ranking up to k. Execution failures score zero and remain in the macro denominator, preventing survivor bias. Invalid evidence/reference structure fails Judge explicitly. Rejudging a subset produces a new task without recomputing retrieval.

In the verified fixture, overlap scores 1.0 on all three metrics; BM25 gives Recall@3 0.972222, MRR@3 1.0 and nDCG@3 0.980447. This is a useful regression signal, **not** evidence that one algorithm is generally better. For a useful production benchmark, add domain-specific queries, independently reviewed labels and harder distractors before tuning.

## Files

- `benchmark.json`: inputs and labels, snapshotted into the DO on initialization.
- `bench.ts`, `retrieval.ts`, `judge.ts`: Worker computation and structured scoring.
- `gea.worker.json`: generic Worker deployment config with stable DO and IDENTITY bindings.
- `scripts/source-tool.mjs`: invokes the real source builder / native local host.
- `scripts/verify-local.mjs`: loopback-only execution, pagination, idempotency and rejudge checks.
- `scripts/report.mjs`: escaped, self-contained HTML table and metric bars; no remote assets.
- `tests/`: hand-computed metric checks, retrieval behavior, error accounting, HTML escaping.

## Run with source-built SDK and CLI

Requires Node **24.16.0**, Corepack, Bun, Cargo, and Rust **1.94.1** with `wasm32-unknown-unknown`. The native build also needs the platform C/C++ toolchain and the prerequisites documented in gea's `crates/worker-runtime/README.md`. Commands below assume macOS arm64, like the verified run; use the matching CLI target on other supported platforms.

Make an isolated source build, preserving your gea checkout. Set the three absolute paths first. The example path must point at this directory. The scratch directory must be new and outside any committed example.

```sh
export GEA_CHECKOUT=/absolute/path/to/gea-src
export EXAMPLE=/absolute/path/to/opengea/examples/benchmark-worker
export SCRATCH=/absolute/path/to/new-benchmark-scratch
mkdir -p "$SCRATCH/gea" "$SCRATCH/packs" "$SCRATCH/example"
git -C "$GEA_CHECKOUT" archive acfe1dc5 | tar -x -C "$SCRATCH/gea"
export GEA_SOURCE="$SCRATCH/gea"
corepack pnpm@12.8.1 --dir "$GEA_SOURCE" install --frozen-lockfile
corepack pnpm@12.8.1 --dir "$GEA_SOURCE/packages/agent-sdk" build
corepack pnpm@12.8.1 --dir "$GEA_SOURCE/packages/agent-sdk" pack --ignore-scripts --pack-destination "$SCRATCH/packs"
corepack pnpm@12.8.1 --dir "$GEA_SOURCE/packages/contract" pack --ignore-scripts --pack-destination "$SCRATCH/packs"
corepack pnpm@12.8.1 --dir "$GEA_SOURCE/packages/gea-cli" build:darwin-arm64
export GEA_CLI="$GEA_SOURCE/packages/gea-cli/dist/gea-darwin-arm64"
"$GEA_CLI" --help
cargo build --locked --manifest-path "$GEA_SOURCE/crates/worker-runtime/Cargo.toml"
export GEA_RUNTIME="$GEA_SOURCE/crates/worker-runtime/target/debug/gea-worker-runtime"
export GEA_SYSTEM_WORKERS="$GEA_SOURCE/crates/worker-runtime/system-workers"
# Copy source only: never copy login configuration, generated states or node_modules.
tar -C "$EXAMPLE" --exclude=node_modules --exclude=.local --exclude=dist -cf - . | tar -x -C "$SCRATCH/example"
cd "$SCRATCH/example"
cat >> pnpm-workspace.yaml <<YAML
overrides:
  '@gea-ai/agent-sdk': 'file:$SCRATCH/packs/gea-ai-agent-sdk-0.1.261102-alpha.2.tgz'
  '@gea-ai/contract': 'file:$SCRATCH/packs/gea-ai-contract-0.1.261102-alpha.2.tgz'
YAML
corepack pnpm@12.8.1 install
corepack pnpm@12.8.1 type-check
corepack pnpm@12.8.1 test
corepack pnpm@12.8.1 build
corepack pnpm@12.8.1 dev
```

The local override and changed lockfile exist **only in the scratch copy**. pnpm 12 reads overrides from `pnpm-workspace.yaml`, not `package.json`. The source SDK build also builds Contract; pack both to avoid mixing new SDK types with old public contracts. The source Benchmark builder currently imports the SDK adapter from its own source tree; installed-consumer type checks separately validate the packed SDK.

`build` is offline: it creates a bundle/snapshot/upload plan in `dist/bundle`, plus `dist/worker` and `dist/registration.json` for generic CLI deployment. It intentionally requires a fresh `dist/bundle`; archive or remove your own generated bundle before rebuilding. `dev` prints a random loopback URL. It initializes the fixture snapshot in real native DO SQLite under `.local/state`, denies Worker global egress and uses no cloud login. Keep state private: it includes a local invocation token. Do not copy state into reports or Git.

In another terminal in the scratch example, use the printed address:

```sh
corepack pnpm@12.8.1 verify:local http://127.0.0.1:PORT
# Produces dist/results.json and dist/report.html.
# Open report.html in your browser, or regenerate it from retained JSON:
corepack pnpm@12.8.1 report dist/results.json dist/report.html
```

Stop your host with Ctrl+C; restart with the same state to retain tasks. To start a different snapshot, use a fresh scratch example/state directory. `GET /api/tasks` discovers saved tasks; `GET /api/tasks/ID/results?limit=2` reads the first page. **Omit cursor on the first request**, then pass the returned `nextCursor` until null: cursor 0 excludes ordinal zero. `POST /api/tasks/ID/cancel` accepts `{}`. The API is JSON-only; its root returns 404.

## Deployment (only when separately authorized)

Build the source CLI as above and its matching App Server/toolchain per [DEPLOY-PLAN.md](DEPLOY-PLAN.md). A standalone CLI binary is insufficient for `worker validate` / `worker deploy`. Validation on this machine reached the explicit “GEA App Server is unavailable” boundary; no hosted operation was attempted.

After local build and toolchain setup, the intended generic path is:

```sh
"$GEA_CLI" worker validate --json '{}'
# Phase 2 only: operator-provided workspace login, project and unique worker name.
"$GEA_CLI" worker deploy --json "{\"project\":\"$PROJECT_SLUG\",\"name\":\"$WORKER_NAME\"}"
# Then register returned workerId/deploymentId plus dist/registration.json via benchmarks.register.
```

Deploy does not automatically register a Benchmark. Registration validates snapshot identity and code hashes; startBench then creates an execution task against the retained snapshot, and startJudge creates a scoring task. These experimental tasks are not the legacy Studio Eval records. Do **not** use legacy `benchmark push` / `eval run` as substitutes. The precise phase-2 procedure, permissions, RPC payloads, acceptance and cleanup are in [DEPLOY-PLAN.md](DEPLOY-PLAN.md). No production deployment or UI acceptance has been performed.
