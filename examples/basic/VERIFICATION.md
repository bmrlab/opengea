# Verification record

Last verified: 2026-09-07 (Asia/Shanghai). These are executed checks, not a claim that a production Next.js application is deployed.

## Dependencies and local execution

- Installed public npm `@gea-ai/agent-sdk` and `@gea-ai/contract` **0.1.260906-alpha.0**, AI SDK **7.0.9**, React adapter **4.0.10**. No private workspace imports or vendored SDK.
- Node **24.16.0**, pnpm **10.30.3**, macOS ARM64. Type checking, **8 behavioral tests**, and Next.js **16.3.4** production build passed.
- Initial Agent validate, pack, live model/Tool multi-turn and Benchmark checks used a locally built CLI and Worker Runtime from GEA revision `5469516da`. No npm publication was triggered by this example.
- CLI **0.1.260906-alpha.0** became available during validation. Installed it in an isolated directory and verified `agent validate` and `agent dev` with its bundled Runtime. The README pins this release. Linux CLI is not published; Linux Next.js builds do not install or invoke the CLI.
- Older CLI **0.1.260904-alpha.0** failed `gea agent validate --json-file agent-project.json` with this SDK because its Worker bundler could not resolve Node builtins pulled in by OpenTelemetry (`events`, `async_hooks`, `util`, `os`). The newer binary resolves this compatibility gap.

## Behavioral evidence

The initial checks below used the original concrete model declaration. The later capability-based change is verified separately in the next section.

- Browser → Next.js → local Agent: searched TypeScript, rendered three real Hacker News results, then answered a follow-up with the first returned title and **907 comments**. Values are observations, not fixtures or expected future search results.
- New Chat clears the transcript and transport identity. Stopping stream reception during a running search restores input and shows the explicit cancellation limitation. Stopping the Agent and submitting shows the error state without retrying. The UI handles the initial Tool input-streaming state before input exists.
- The two live Benchmark Cases (TypeScript and SQLite) completed with **2/2 Judges, average score 1.0, zero Judge errors**. The Judge requires a successful real Tool result and a citation of one of its returned discussion URLs. Initial local-binary Eval: `6011423f-447a-46a8-999e-206a28d76329`. Repeated with published CLI 0.1.260906-alpha.0: `a18136bf-c1d5-4b56-b82f-32db859131e8`, again 2/2, average 1.0 and no Judge errors.
- Intentionally renamed Tool output `stories` to `items`: TypeScript failed at `apps/web/app/news-chat.tsx` and `packages/agent/benchmarks/judges/search.judge.ts`. Restored the source; checks passed. No generated binding was needed.
- Route tests cover first/subsequent turns, identity headers, delayed streaming, another visitor/forged-cookie denial, Agent-scoped ownership, Origin and injected-field rejection, failed-start ownership retention, configured hosted credentials/server metadata, generic network errors and no automatic retries.
- Agent archive inspection excludes the Next.js tree and all `.env` files; a byte-level check against the configured local model key found no credential in the archive. Browser code consumes Agent types only.

## Capability-based model selection

On 2026-09-07, the Agent definition changed to `model: "auto"` with `agentic: 0.8`, `copywriting: 0.6` and `speed: 0.6`. Published SDK 0.1.260906-alpha.0 resolved these requirements to `deepseek-v4-pro`; the archive snapshot contains that concrete ID and no `modelRequirements`. This is an observed SDK resolution, not a model name the example author must configure or a guarantee about future SDK releases.

- Published CLI validate and pack passed. Snapshot: `sha256:7b486d18a5c36c1cd2118ad07c91ef00174b93b93f88e8c60b2620f8524120df`. Archive boundary and credential exclusion checks passed.
- Live Benchmark Eval `276a773c-7079-44f0-bb90-d18c2eee0c98` passed **2/2 Judges, average score 1.0, zero Judge errors**, using the resolved model and real Hacker News search. Capability thresholds are routing parameters; this Benchmark score measures the example's Tool/citation checks.
- Type checking and all **8 behavioral tests** passed. Local browser chat rendered reasoning, three actual Tool results and an English answer, then correctly answered a Chinese follow-up with the first title and **907 comments**.
- The same Agent source was pushed as Preview Worker version **3**, deployment `01a07789-cae1-7496-a874-818d030c7e1b`, application content hash `sha256:a2e9422c1ce1f2b14dcab2f109f6c697289118ab04bff2d46e542ecb5e121000`.
- The AI Elements UI rendered a real Preview search. Independent two-turn SSE through Next.js returned HTTP 200, stream `v1`, all three identity headers, stable Chat identity and distinct Runs, with no stream errors. First events arrived at 0.741s and 0.428s, before completion at 8.019s and 4.487s. Chat: `01a0778b-6d65-706f-8222-10ee98286af0`; Runs: `01a0778b-6da6-735d-adf2-8e04410e8bb7` and `01a0778b-8c63-761a-a02d-465ed23e3553`. Both Runs finished and the hosted history read returned HTTP 200. The temporary key was revoked and local configuration restored.

## Hosted gate: initial version

Agent push succeeded and selected Preview in a dedicated examples Project. The original concrete-model Agent was pushed with the published CLI as Worker version **2**, deployment `01a07773-92a4-76dc-a5f2-18998a263915`. Production has not been promoted.

**Hosted chat verification passed on 2026-09-07.** The initial API-key creation failure was caused by an outdated production SpiceDB schema: `api_key`, `studio_project` and `studio_agent` were missing. The operator-approved repair applied the deployed image's additive schema and replayed Studio grants without deleting relationships. Existing definitions were unchanged and the scoped ledger/projection check passed. A new Preview Project key then succeeded; no fake key or authentication bypass was used.

The same Next.js UI rendered three real search results from GEA Preview and answered a Chinese follow-up with the first title and **907 comments**. Independent two-turn SSE verification returned HTTP 200, stream version `v1`, all three identity headers, one stable Chat ID and distinct Run IDs. First events arrived at 1.111s and 0.920s, before streams completed at 10.548s and 4.096s; no stream errors occurred. Both Runs subsequently reported `finished`, and the hosted message-history API returned HTTP 200.

- Chat: `01a0777d-1b5e-754e-bbce-a25dd0642539`
- Runs: `01a0777d-1b87-7694-80ff-4411f4267d1c`, `01a0777d-44f4-777f-8cf3-23f8e4a98189`

The temporary Preview key was revoked after validation and the local Next.js configuration was restored. The two earlier inaccessible keys remain revoked. This validates the hosted Agent through a locally running Next.js application, not an externally deployed Next.js site.

## Reproducible build and remaining boundaries

A fresh clone of the public repository passed install, type checking, all 8 tests and a production build on macOS without any `.env`, `.gea` or private checkout. The [Linux CI run](https://github.com/bmrlab/opengea/actions/runs/34043868862) also passed those checks at commit `172dbf6`, without credentials, Agent dev or a CLI. The [workflow](https://github.com/bmrlab/opengea/actions/workflows/basic.yml) repeats this gate for subsequent changes.

Production Agent promotion and external Next.js deployment have not been performed. Windows CLI execution was not run on this macOS machine. The example exposes stream reception stop, not acknowledged Agent cancellation, history or reconnect parity. Model and public API availability remain external dependencies.
