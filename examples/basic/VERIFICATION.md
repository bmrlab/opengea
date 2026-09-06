# Verification record

Last verified: 2026-09-07 (Asia/Shanghai). These checks establish the example's local development and Preview integration behavior.

## Dependencies and independent build

- Public npm `@gea-ai/agent-sdk` and `@gea-ai/contract` **0.1.260906-alpha.0**, AI SDK **7.0.9**, React adapter **4.0.10**. No private workspace imports or vendored SDK.
- Node **24.16.0**, pnpm **10.30.3**, macOS ARM64. Type checking, **8 behavioral tests**, and Next.js **16.3.4** production build passed.
- A fresh public clone passed install, type checking, all tests and production build without any `.env`, `.gea`, CLI or private checkout.
- The [Linux CI run](https://github.com/bmrlab/opengea/actions/runs/34045594050) passed install, type checking, all 8 tests and build at commit `65dca71`, without model credentials or a running Agent. The [workflow](https://github.com/bmrlab/opengea/actions/workflows/basic.yml) repeats these checks for subsequent changes.
- Initial Agent checks used a locally built CLI. The published CLI **0.1.260906-alpha.0**, including its bundled Runtime, then passed validate, pack, local chat and Benchmark checks. Use the README's pinned release; older CLI **0.1.260904-alpha.0** did not validate this SDK package successfully.

## Local Agent and Benchmark

The current Agent declares `model: "auto"` with `agentic: 0.8`, `copywriting: 0.6` and `speed: 0.6`. Validation and packaging passed, and the SDK-selected model was recorded in the built version.

- Browser → Next.js → local Agent searched TypeScript and rendered reasoning, three real Hacker News Tool results and an English answer. A Chinese follow-up correctly reused the first title and comment count without another search.
- Both live Benchmark Cases (TypeScript and SQLite) passed **2/2 Judges, average score 1.0, zero Judge errors**, using a real model and the public search API. The TypeScript Judge requires a successful Tool result and a citation of a returned discussion URL. It needs no second model. The same checks also passed before the Agent changed to capability-based selection.
- Capability requirements are not Benchmark scores. Search data changes; the Judge checks execution and citations rather than fixed story titles or counts.
- New Chat cleared the transcript and transport identity. Stop receiving response restored input and showed its cancellation limitation. Submitting while the local Agent was stopped showed an error without automatically retrying.

## Types, streaming and credential boundaries

- Intentionally renaming Tool output `stories` to `items` made TypeScript fail at the web renderer and Benchmark Judge. Restoring the source restored passing checks. No generated binding was needed.
- The UI handled Tool input streaming before input was available.
- Route tests cover first and subsequent turns, identity headers, delayed streaming, visitor isolation, forged cookies, Agent-scoped ownership, Origin and injected-field rejection, failed-start ownership retention, hosted credentials, network errors and no automatic retries.
- Agent archive checks excluded the Next.js tree, environment files and the configured model credential. Browser code consumes only Agent types.

## Preview integration

The same capability-based Agent was published to GEA Preview and called through locally running Next.js with a real Preview Project API key. The AI Elements UI displayed real search results. Independent two-turn SSE checks returned HTTP 200, stream version `v1`, preserved all three identity headers, kept one Chat identity and created distinct Runs. Events arrived before completion, with no stream errors. Both Runs completed and the authorized history read succeeded.

Temporary validation keys were revoked after testing and local configuration was restored. This proves the Preview integration through a local application; the example does not require a hosted Next.js site to run locally.

## Remaining boundaries

- Agent Production promotion and external Next.js deployment were not performed.
- Windows CLI execution was not tested on this macOS machine. Linux CLI packages are not currently published; Linux web builds do not need them.
- Stop receiving response closes the browser stream; it does not acknowledge Agent cancellation. The example does not provide history or reconnect parity between local and hosted execution.
- Real model and public search API calls require network access and incur model usage. Availability and search results can change.
