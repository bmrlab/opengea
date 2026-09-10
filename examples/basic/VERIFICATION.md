# Verification record

Last verified: 2026-09-10 (Asia/Shanghai). Published SDK/Contract **0.1.260910-alpha.2** run successfully on GEA Preview **version 7**, including Basic's search approval continuation. Earlier evidence is retained below.

## Published alpha.2 hosted verification, 2026-09-10

- Installed public npm Agent SDK and Contract **0.1.260910-alpha.2** without local package overrides. Native Node import of the Agent Worker passed, confirming the published directory-import fix. All **18 behavioral tests**, Agent/web type checks, the Next.js production build, Agent validation and packaging passed. Validation/packaging used merged CLI source; the published **0.1.260909-alpha.0** CLI still predates the WASM loader. No consumer Rust build ran.
- Rebuilt and pushed the immutable Agent archive to the existing **Basic Example** Project / **opengea-basic** Worker. Hosted validation accepted the snapshot, which omits `engine`; `agentCore()` remains selected in the Worker bundle. Preview **version 7** is active, with model **deepseek-v4-pro**. No shared Web/Runtime deployment or Production promotion was performed for this retry.
- Snapshot hash: `sha256:5427c5ec7a42faa1018da51b7fba8004705e7c4e7d7e9ee95092da70429331f9`. Archive hash: `sha256:d33e6590bad9e4348f78515c122d5f1a0ee471c536fc2ae3143c25f0c07e2789`. Preview Agent version ID: `01a08b70-cb70-75a4-9fb6-0cc5456d7d56`. The archive embeds the runtime and excludes environment files.
- The public `StudioAgentClient` completed three real HTTP/SSE Runs: a search paused at `approval-requested` without Tool output, approval resumed that same assistant message and returned three real TypeScript stories with discussion links, and a follow-up reused the first result without another Tool call. All responses were HTTP **200**, stream version **v1**, with one Chat ID, distinct Run IDs and no stream errors. Each Run's model-call usage reconciled with its totals: **890 + 1,279 + 1,373 = 3,542 tokens**, across three unique completed model calls.
- A real browser entered Basic at `http://localhost:3002/`, using its production Next.js build and the real Preview endpoint. The default search displayed an approval card, approval produced structured results and a final answer, and the input became usable again. Refresh conversation restored one completed conversation without duplicate messages. The temporary scoped Preview API key was revoked and the temporary server stopped, with local environment files preserved. This verifies Browser → Basic Next.js → Project API → Rust Core; it is not an external Next.js deployment.
- A separate Studio Playground/ORPC check reached an approval request, but `chats.respondToToolApprovals` left continuation Run `01a08b74-bb7b-7739-a15e-7293355a08cb` queued with no active stream. That route enqueues background execution; Basic's public `/run` continuation succeeded. The queue's operational cause is not established, and Playground approval completion is **not** claimed by this record.

The following alpha.1 and alpha.0 entries describe earlier failed attempts, superseded by the public alpha.2 results above.

## Published alpha.1 retry, 2026-09-10

- Installed public Agent SDK and Contract **0.1.260910-alpha.1** after npm metadata and tarball availability propagated. Basic passed all **18 behavioral tests**, Agent/web type checks and the Next.js production build.
- Agent validation and packaging both failed: published `dist/agent-channel-author-runtime.js` imports `./channels.js`, while the package contains `channels/index.js`. Native Node import of the installed Agent Worker independently reproduced `ERR_MODULE_NOT_FOUND`. The common Worker imports this module even when Basic declares no Channels; this failure occurs before any deployment or WASM execution.
- A follow-up SDK build fix resolves directory imports to their emitted `index.js`, retaining file precedence and explicit extensions. Its native ESM regression test first reproduced the failure, then passed. Locally built **alpha.2 candidate tarballs**, installed into a separate copy of the real Basic Agent, passed native Worker import, Agent type checking, validation and packaging. This is candidate validation, not a published-package or hosted-run success.
- The candidate snapshot omits `engine`, selects `deepseek-v4-pro`, and has hash `sha256:5427c5ec7a42faa1018da51b7fba8004705e7c4e7d7e9ee95092da70429331f9`. The archive includes `runtime/worker.mjs` and excludes environment files. Its archive hash is `sha256:77221a162a0414d87ab127ad555090f4a962b7d318b500a70697344957ef2c70`.
- The attempted alpha.1 dependency update was reverted; this example and the user's regular local checkout retain **0.1.260910-alpha.0**. No candidate SDK was published or deployed. GEA Preview remains active on **version 5**. Upgrade, rebuild and repeat hosted search/approval verification after a fixed SDK is published.

## Published Core adoption, 2026-09-10

- Agent SDK and Contract now use published **0.1.260910-alpha.0**. The Agent explicitly selects `engine: agentCore()` and retains `model: "auto"`, its capability requirements and default search approval. This changes Basic's selected engine, not the SDK framework default.
- Public dependency installation, all **18 behavioral tests**, Agent/web type checks and the Next.js production build passed. Agent validation and packaging passed using the merged GEA CLI source, because the published 0.1.260909-alpha.0 CLI predates Core's WASM loader. No consumer Rust build ran.
- The immutable archive includes `engine: "agent-core"`, resolves the capability request to `deepseek-v4-pro`, and embeds the SDK's WASM in `runtime/worker.mjs`. Agent snapshot hash: `sha256:4b16e71e5d9e5ab993a7c8be8dce57dae80b65877329c9b999af8383ca60fa83`. The archive excludes environment files and the web application.
- A real push to Project **Basic Example** (`basic-example`), Worker **opengea-basic**, failed with `VALIDATION_ERROR Agent snapshot is invalid: definition/agents/tech-news.json`. The old published Contract reproduces rejection of the `engine` key; the new Contract accepts the identical snapshot. The owning hosted path is the Web/ORPC deployment validator, before Worker execution.
- Inspection after the failed push confirmed Preview is still active on **version 5**, using its previous Agent version. No Core hosted run, Preview replacement or Production promotion is claimed. A Web deployment containing the Core contract is required before retrying.

The following records describe earlier increments and retain their original engine, SDK and deployment scope.

## Approval and lifecycle controls, 2026-09-10

- Public SDK/Contract/CLI **0.1.260908-alpha.0** remain pinned; the public example retains capability-based model selection and the default AI SDK engine. Search now requires approval by default, including when the variable is absent. Only explicit `REQUIRE_SEARCH_APPROVAL=false` disables it. `pnpm agent:eval` supplies that override only to its Benchmark child process; development and hosted defaults remain interactive.
- Public install, **18 behavioral tests**, type checking, the Next.js production build, Agent validation and packaging passed. The archive excludes environment files and the Next.js tree. Tests cover trusted approval configuration, anonymous approval continuation, history/cancellation ownership, foreign-Chat Run rejection, Origin checks, malformed JSON, scoped credentials, local capability rejection and upstream failures.
- A real browser using the published CLI and default AI SDK engine paused at the search approval card. Approving it produced three real TypeScript results and an answer citing their discussion links. The composer became usable again after completion. No unpublished SDK/Core dependency was added to this example.
- Separately, an isolated copy of this Agent using a locally packed Rust Core SDK and real Creative Reasoning passed single approval, a parallel TypeScript/SQLite batch with one approval and one denial, a follow-up without another Tool, and an all-denied Rust search. Traces recorded only the two approved TypeScript searches. Seven model calls had seven unique ledger IDs; every Run's input/output/total usage reconciled, totaling **10,310 tokens**. The isolated override is acceptance evidence, not a published Core release or a default-engine switch.
- Hosted lifecycle controls were exercised through the real browser and Next.js server against a **controlled local HTTPS service**, not a deployed GEA Agent. Disconnect kept execution active; history refresh restored one copy of the response; cancellation acknowledged intent before a later refresh showed the terminal status; reloading the URL restored the authorized history. A delayed history response overwriting New Chat was reproduced and fixed by aborting the obsolete request.
- A replay integration gap was reproduced: feeding a full buffered Run stream into `useChat` already seeded with partial assistant history repeats text. Basic therefore offers server-history refresh and explicit cancellation, without automatic SSE replay. Approval continuations need an explicit history/replay merge contract before that feature is added.
- No live hosted cancellation/reconnection, Preview update, production promotion or external Next.js deployment was performed in this increment. Earlier Preview results below are historical, not verification of these new controls. Benchmark execution was not repeated in this increment; its unattended path is kept by disabling approval.

## SDK update, 2026-09-08

- SDK and Contract were upgraded to published npm **0.1.260908-alpha.0** and verified with the published CLI of the same version, including its bundled Runtime. Node 24.16.0 and pnpm 10.30.3 remain unchanged.
- Public dependency installation, type checking, all 8 existing tests, the Next.js production build, Agent validation and packaging passed.
- Local browser search rendered real Tool results and discussion links; a Chinese follow-up retained the conversation and reused earlier results. The two-case real-model Benchmark passed with average score **1.0**, **2/2 completed Judges** and **zero Judge errors**.
- Preview calls through both the existing Next.js UI and the published backend SDK returned real search results. Two SDK turns preserved the Chat ID, created separate Run IDs, returned the v1 stream marker and contained no stream errors. New Chat cleared the visible conversation.
- The broader-question browser check exposed article claims inferred from titles. Agent instructions now explicitly restrict descriptions to returned metadata and require possible relevance to be labeled as such. The final Preview check returned title/metadata citations with possible relevance distinguished from article contents. A Chinese follow-up reused the first result without another Tool call. The updated instructions passed the two-case Benchmark again (score 1.0, zero errors).
- Final Preview is Worker version **5**, built from the updated Agent source. The final two-turn SDK check returned HTTP 200/v1 without stream errors; both Runs reported `finished` and the authorized history read returned 200. Temporary test keys were revoked and local configuration restored.

The following sections record the earlier 2026-09-07 acceptance. They are historical evidence, not a claim that every earlier check was repeated for this update.

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

## Uploaded Benchmark and Eval

The published CLI uploaded the two-Case Benchmark and its TypeScript Judge with `gea benchmark push`, then the completed local Eval with `gea eval push`. GEA stored both artifacts and associated the Eval with the exact published Preview Agent version. The Studio results matrix showed both Cases at **100%**, with **2/2 completed Judges, average score 1.0 and zero Judge errors**. Case details displayed the Judge reason, Agent answer and message trajectory, including the real `searchStories` input and returned stories. Uploading reused the completed local result without rerunning the model. The uploaded artifacts were checked to exclude the configured model credential.

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
- Local Stop receiving response only closes the browser stream. Hosted mode additionally provides signed-ownership history refresh and explicit cancellation. Full SSE replay and local/hosted lifecycle parity remain outside this example.
- Real model and public search API calls require network access and incur model usage. Availability and search results can change.

## Manual Rust Core preview (2026-09-10)

GEA's optional `scripts/dev-basic-agent-core.mjs --basic <this-directory>` was
verified with a separate local Agent and copied Next.js app at localhost:3003.
Its generated definition selected `agent-core` and `creative-reasoning-1.5`.
The real browser paused for search approval, executed the approved TypeScript
search, and rendered three results with cited links. The preview exited cleanly,
while the existing localhost:3002 demo kept running.

The launcher consumes the checkout's prebuilt WASM and Runtime, uses the local
SDK only for the copied Agent, and retains the public SDK for the web app. It
changes no Basic engine defaults or package pins and is not part of `pnpm dev`.
SSE replay merging is implemented/tested in the GEA source SDK/host candidate;
this example retains history refresh until that SDK/server update is available.
No additional hosted lifecycle or publication claim is made.
