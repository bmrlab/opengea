# Verification record

Last verified: 2026-09-07 (Asia/Shanghai). These are executed checks, not a claim that a production Next.js application is deployed.

## Dependencies and local execution

- Installed public npm `@gea-ai/agent-sdk` and `@gea-ai/contract` **0.1.260906-alpha.0**, AI SDK **7.0.9**, React adapter **4.0.10**. No private workspace imports or vendored SDK.
- Node **24.16.0**, pnpm **10.30.3**, macOS ARM64. Type checking, **8 behavioral tests**, and Next.js **16.3.4** production build passed.
- Initial Agent validate, pack, live model/Tool multi-turn and Benchmark checks used a locally built CLI and Worker Runtime from GEA revision `5469516da`. No npm publication was triggered by this example.
- CLI **0.1.260906-alpha.0** became available during validation. Installed it in an isolated directory and verified `agent validate` and `agent dev` with its bundled Runtime. The README pins this release. Linux CLI is not published; Linux Next.js builds do not install or invoke the CLI.
- Older CLI **0.1.260904-alpha.0** failed `gea agent validate --json-file agent-project.json` with this SDK because its Worker bundler could not resolve Node builtins pulled in by OpenTelemetry (`events`, `async_hooks`, `util`, `os`). The newer binary resolves this compatibility gap.

## Behavioral evidence

- Browser → Next.js → local Agent: searched TypeScript, rendered three real Hacker News results, then answered a follow-up with the first returned title and **907 comments**. Values are observations, not fixtures or expected future search results.
- New Chat clears the transcript and transport identity. Stopping stream reception during a running search restores input and shows the explicit cancellation limitation. Stopping the Agent and submitting shows the error state without retrying. The UI handles the initial Tool input-streaming state before input exists.
- The two live Benchmark Cases (TypeScript and SQLite) completed with **2/2 Judges, average score 1.0, zero Judge errors**. The Judge requires a successful real Tool result and a citation of one of its returned discussion URLs. Initial local-binary Eval: `6011423f-447a-46a8-999e-206a28d76329`. Repeated on the final Agent source with published CLI 0.1.260906-alpha.0: `a18136bf-c1d5-4b56-b82f-32db859131e8`, again 2/2, average 1.0 and no Judge errors.
- Intentionally renamed Tool output `stories` to `items`: TypeScript failed at `apps/web/app/news-chat.tsx` and `packages/agent/benchmarks/judges/search.judge.ts`. Restored the source; checks passed. No generated binding was needed.
- Route tests cover first/subsequent turns, identity headers, delayed streaming, another visitor/forged-cookie denial, Agent-scoped ownership, Origin and injected-field rejection, failed-start ownership retention, configured hosted credentials/server metadata, generic network errors and no automatic retries.
- Agent archive inspection excludes the Next.js tree and all `.env` files; a byte-level check against the configured local model key found no credential in the archive. Browser code consumes Agent types only.

## Hosted gate

Agent push succeeded and selected Preview in a dedicated examples Project. The final Agent source was pushed with the published CLI as Worker version **2**, deployment `01a07773-92a4-76dc-a5f2-18998a263915`. Production has not been promoted.

**Hosted chat verification is currently blocked:** the production Studio API returns HTTP 500, `Studio API permission projection failed`, when creating either a Project-wide or Agent-specific preview key. The key row is created before the permission-projection error and its one-time token is not returned. Both inaccessible validation keys were revoked. This is a platform permission-projection failure, not a CLI or Next.js build failure. No fake key or authentication bypass is used.

After the platform resolves key creation, follow README section 4: create a preview key, configure the existing Next.js server, restart, and validate the same UI. Do not treat Agent upload success as a successful hosted model run.

## Reproducible build and remaining boundaries

A fresh clone of the public repository passed install, type checking, all 8 tests and a production build on macOS without any `.env`, `.gea` or private checkout. The [Linux CI run](https://github.com/bmrlab/opengea/actions/runs/34043868862) also passed those checks at commit `172dbf6`, without credentials, Agent dev or a CLI. The [workflow](https://github.com/bmrlab/opengea/actions/workflows/basic.yml) repeats this gate for subsequent changes.

A live hosted conversation, production Agent promotion and external Next.js deployment are not yet verified. Windows CLI execution was not run on this macOS machine. The example exposes stream reception stop, not acknowledged Agent cancellation, history or reconnect parity. Model and public API availability remain external dependencies.
