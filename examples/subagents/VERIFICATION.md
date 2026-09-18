# Verification record

## Hosted recheck after Web restart, 2026-09-20

- Unchanged Preview v15 / public SDK alpha.3 passed the full strict verifier
  after the operator restarted Web v0.55.5. Report:
  `.gea/verification/be4553d1-792d-40ac-b958-f4380caa1411/report.json`.
  Parent Session: `dc8bf36a-22ed-4594-b585-c7931ba050eb`.
- Parallel private/nested/reviewer/self-copy execution, automatic continuation,
  explicit `runWait`, same-child recall, fresh-child isolation and sibling
  `sessionSend` delivery all passed. All four parent streams match saved history,
  and later batches create distinct assistant messages. Parent Runs:
  `01a0bf29-0203-75da-ab4b-0556976a77ef`,
  `01a0bf29-e527-77ea-8183-c7357e727d88`,
  `01a0bf2a-6ba1-7759-995a-59d2abd935b7`,
  `01a0bf2b-b608-7301-8805-f5380be91af3`.
- This establishes standard hosted SSE/history acceptance for this version.
  The separate waiting-user steering/reconnect test remains locally verified
  only. Some Web `Session dispatch rejected` warnings still log empty errors;
  their cause is unresolved, despite the passing matrix. No capacity refusal
  appeared in the inspected Runtime logs. The temporary Key was revoked; no
  Production promotion and no changes to the strict verifier.

## SDK 0.1.260920-alpha.3, 2026-09-20

- Public SDK alpha.3: frozen install, types and eight protocol tests passed.
- Final Preview v15 was pushed with the alpha.1 macOS artifact, deployment `01a0bebd-2af7-73fb-98de-1c6806605c9d`. Its content hash matches v14 below; no Production promotion.
- The alpha.1 macOS CI artifact passed validation/pack and the complete strict local matrix: `.gea/verification/4618c6e4-758b-4058-9075-0d17b11a03af/report.json`, parent Session `bdf2c8e6-4ee3-4a2a-8119-16c400039284`. Parallel private/nested/reviewer/self-copy execution, implicit and explicit waits, child recall, fresh-child isolation, peer delivery and all four SSE/history message checks passed. The native API listener closed on shutdown.
- The previously failing waiting-user SSE boundary now passes with that native CLI artifact: Session `1c218a03-ba24-4310-a6b3-b5d9d151684f`, Run `7a9ca006-a9b6-4d3b-883b-3be85520e535`. Original and reconnected streams each contain exactly one assistant start/finish and no errors; assistants `a2cb1dcb-50a0-4a1f-b8ca-91f2e071ea99` and `7ca6cb34-b750-470a-80ad-4418b168d4b4` are distinct, and the old text marker is absent from the new message. Report: `/tmp/opengea-alpha3-steering-report.json`. This local result does not establish the hosted boundary.
- Preview v14 is ready: deployment `01a0beb0-05d9-7389-9914-2f7565dc495c`, content `sha256:37cdf9a05fdbb2afcde9034cf231380189e452b3cc697ebf030a9dc5c4890860`. This push used published CLI alpha.0 while alpha.1 was building.
- Hosted report `.gea/verification/417154d5-5029-4e09-8fe8-0492b68e256d/report.json` failed with a response timeout. Run `01a0beb0-925d-7467-90e7-74a5c0ea1f31`, Trace `01b5b693bbc9b1f3ef9c8f6a59c11c41` records a rejected child invocation (500), not an explicit capacity cause. Do not mark the previous hosted SSE/history regression fixed. The temporary Key was revoked; no Production promotion.

## SDK 0.1.260920-alpha.2, 2026-09-20

- Frozen installation, types, eight protocol checks and validation/pack passed. Corrected the nested researcher's remaining `run_wait` instruction to `runWait`.
- Complete local real-model matrix passed: nested private calculator, top-level reviewer, self copy, implicit joining, explicit `runWait`, child recall, fresh-session isolation and sibling `sessionSend`. Report: `.gea/verification/6518d30e-543e-488f-8273-09d8278c4890/report.json`. All four saved parent responses also passed the new SSE/history assertions when checked against their captured streams; later user batches had different assistant IDs.
- The verifier now accepts a summary in a separate text part of the original waiting assistant, without relaxing the nested-result schema. It requires one start/finish, identical streamed/saved text, completed `runWait` outputs and a fresh assistant ID for a later user batch. New behavioral tests were observed failing before implementation.
- **Hosted streaming acceptance fails on Web/Worker/Runtime v0.55.3.** Report `.gea/verification/a9daf3a9-4e93-4559-82b6-f58e4041a3e5/report.json`: Session `93ba7e3e-580d-4393-ae3c-3f0ec80776fb`, Run `01a0bd76-33ce-766c-95ba-226d6d88dabb`, assistant `01a0bd76-5059-758d-a0c8-bad5daa1687b`. SSE emitted only `WAITING`, then `finish(stop)` with `sessionStatus: waiting` and `[DONE]` at 06:18:02 UTC. The Run finished at 06:20:26 UTC and history held `WAITING` plus the complete strict summary under the same assistant ID. The final result was absent from the original stream. The new assertion correctly fails; passing persisted results is not passing live delivery.
- **Waiting-user boundary also fails in the published CLI HTTP stream.** A separate live probe sent `POST /sessions/{id}/messages` with `mode: steering` after `runWait` appeared. Session `761260fc-8e1a-47d8-976a-2ff801952137`, Run `6a9f55bb-8f25-4df8-9306-981e2c3b97a5`: history correctly marks the old wait `output-error` / "Wait interrupted by a new user message." and separates assistants `a525d708-d0c8-425b-bbfa-3379ec0b8a79` and `40fd4927-f19f-4ebc-810c-1ec077e089b3`. But the original HTTP SSE contains both `start` events with an intervening `finish(other)`; the one-message assertion fails. Evidence: `/tmp/opengea-alpha2-steering-report.json`. This is different from a later batch after a completed Run. The current native API `crates/api/src/local.rs` tails all Run events without a message boundary; a CLI follow-up is needed before claiming this path fixed. Reconnection after completion correctly returns 204.
- An earlier hosted attempt (`01a0bd71-677e-712d-89c0-092640a457b5`, Trace `61119b1220c186cc7902f9eabfd366a9`) aborted its parent invocation while children continued. Keep this separate from the reproducible premature stream completion above. Temporary Keys were revoked.
- Existing Preview Worker v13 is ready: deployment `01a0bd75-2c7d-719b-a821-25ad16120ad2`, content `sha256:f798c17ae8d1e8ac9097fe150c8607cbf7a5671bfa8cb93f6f2e7b4539be362e`. No Production promotion.

## Web v0.55.1 hosted recheck, 2026-09-20

- Retested Preview v10 against the updated production Web. Report `a769508d-6a4a-4034-8ce6-534d79dd17f2` failed before the first batch completed: `terminated (SocketError: other side closed)`. The temporary Key was revoked.
- Runtime remains v0.55.0. Older pinned deployments still produce protocol rejection/alarm errors in current logs; this alone does not establish the cause of this socket failure. Hosted acceptance remains incomplete.

## SDK 0.1.260920-alpha.0, 2026-09-20

- Published SDK installation, types, six unit tests and validation/pack passed. CLI release `0.1.260920-alpha.0` is now published and verified identical to the tested macOS CI artifacts.
- Fixed stale verifier/tool instructions: model-facing `runWait` and `sessionSend` replaced old `run_wait` / `chat_send` checks, and the send input uses `sessionId`. Clarified the current batch's waiting mode and required `result` field. Completion, identity, isolation, exact child data and message-delivery assertions remain strict.
- Local real-model matrix `2af302bf-de6c-425e-8922-85a559307fed` passed all cases: parallel private/nested/reviewer/self-copy execution, implicit and explicit waits with a stable parent Run ID, retained child history, fresh-session isolation, sibling Session delivery and its finished new Run.
- Final source was pushed to Preview v10, deployment `01a0bc66-8601-73c4-81b4-dbea43867bb2`.
- Earlier v8 hosted verification failed on Session polling HTTP 500, request `1a465430-15f8-47bc-8f28-aad6b2f72deb`, Session `1d68f7a0-1d74-46e0-acd9-8885125103fe`, Run `01a0bab9-1306-700b-8048-fce4853149b7`. Its Trace separately recorded an internal Worker Host network error. Later completion does not make that verifier pass.
- v9 hosted retry `1bdd3166-820d-49b0-a676-dd908977fe06` also failed: two child streams ended with `UND_ERR_SOCKET` at 01:02:42 UTC; children then reported expired execution lease / aborted response persistence. Runtime logged memory admission pressure at the same time. Parent Run `01a0bc55-da15-70cb-a7e7-e59161da339d`, Trace `675e2beb4395853bd5c09343b0349bdb`. A shared cause is under investigation; hosted acceptance is not complete.
- Temporary hosted Keys were revoked. No Production promotion.

## Session/Run SDK upgrade, 2026-09-18

- Public SDK `0.1.260918-alpha.0`; frozen installation, types, six verifier tests, source-CLI validation and packaging passed. The CLI remains unreleased; `GEA_CLI_BIN` selected the compatible source entry with Node 24.16.0 and the native Runtime. No SDK/CLI version was bumped or released by this update.
- Replaced obsolete Task/child-handle assumptions with Agents API Session/Run requests. The verifier now checks stable parent Run IDs through implicit join and explicit `run_wait`, actual child Run registration/parent links, Session reads, exact receipts, retained history and fresh-session isolation. It also exercises `chat_send` to a sibling Session.
- Local real-model verification `32424655-d47f-4645-b678-66e1be29b107` passed parallel private/nested/reviewer/self-copy execution, implicit joining, explicit waits, same-session recall with new Run IDs and fresh-session isolation. The relay sender successfully invoked `chat_send`, but the recipient did not start its new Run: the strict overall result remains **failed**, not passed. Report remains in ignored `.gea/verification/32424655-d47f-4645-b678-66e1be29b107/report.json`.
- This exposed a GEA host bug: a completed child's retained transport reused the old Run's parent callback for later Session messages. The matching [CLI/server fix](https://github.com/bmrlab/gea/pull/489) limits that callback to the original Run; local standalone dispatch also honors custom Worker URLs. After the fix, all 27 native Run integration tests passed, including same-service and cross-service remote wait/cancel/timeout/continuation and follow-up to a completed child; all 11 hosted Session Host tests and the full GEA type check passed. Those tests use real native Runtime/storage with a controlled model edge, not a hosted real-model pass.
- Preview v7 was rebuilt with public SDK `0.1.260918-alpha.0`: deployment `01a0b518-3602-7599-a654-17fb1284ee28`, Worker `01a08ef0-7e45-77c4-8402-0d329e7abba2`. No Production promotion. The hosted verifier first hit API read-rate limits, then failed with TLS `CERT_HAS_EXPIRED` from `https://musegea.com`. Read-only 429 polling now honors the server delay; writes are never retried. Both temporary keys created for the attempts were revoked.
- After TLS recovery on 2026-09-19 (Asia/Shanghai), local real-model verification `534ad7c5-6084-4870-91db-2f0a7b0daba7` passed the complete matrix with the source CLI fix: parallel/nested/self-copy, implicit and explicit waits, continued-child recall, fresh-session isolation, and sibling message delivery followed by a finished new Run.
- Hosted retry `bad0d8ff-190e-42a1-972e-859aa9be7aa9` passed parallel, continued and fresh child checks but remains **failed**: the sender attempted `chat_send` twice and both tool results were errors; its final response reported host HTTP 403. This is no longer a TLS blocker. The temporary key was revoked. Hosted messaging authorization and deployment of the host fix still require validation; do not describe this upgrade as fully hosted-verified. Earlier records below concern older SDK/host versions.

## SDK alpha.2 and published CLI acceptance, 2026-09-17

- Public SDK `0.1.260917-alpha.2` and CLI `0.1.260917-alpha.0`; frozen installation, type-check, all five verifier tests, validation and packaging passed.
- Local native Runtime acceptance passed all three batches: parallel private/nested/reviewer/self-copy execution, automatic parent continuation, same-child recall and fresh-child isolation. Report: `.gea/verification/e6f6304b-e0f4-4307-bd12-5788fc2922e2/report.json`.
- Rebuilt production-cluster Preview version 6. The hosted verifier reached the parent summary after the parallel batch, but failed its existing strict schema: `results[0].result.calculator` omitted `chatId` and `runId`. The hosted continuation and fresh-child batches therefore did not run. Do not describe the hosted suite as passed or attribute the missing fields to transport without further evidence.
- Failed report and parent messages remain under `.gea/verification/cb1fbf47-4707-4c6a-9538-e94efcd4446d`; parent Chat `01a0afc9-5e88-739b-a2b8-339cd45fb03e`. The temporary Preview API key was revoked. No scoring/schema rules or prompts were loosened, and no Production promotion was performed.

## Agent Core adoption, 2026-09-17

- Public Agent SDK `0.1.260917-alpha.0`; coordinator, private researcher, nested calculator and reviewer now explicitly use `agentCore()`.
- Frozen installation, TypeScript and all five verifier tests passed. Public CLI `0.1.260916-alpha.0` validated and packed the complete application.
- The unchanged strict real-model verifier passed against the matching Catalog v2 source CLI/Runtime (GEA `261f19618`, Runtime behavior from #479). Verification ID: `998fc2dc-b8b1-466c-a7ee-f324cac1765f`. All three batches passed: three concurrent children plus the nested calculator, automatic parent continuation, continued-child recall and fresh-child isolation.
- All four definitions use Core; TypeScript tools, identity checks, task receipts and history-isolation assertions are unchanged. The SDK framework default remains AI SDK. This records local acceptance, without updating earlier Preview or Production deployments.

Historical baseline: 2026-09-15 (Asia/Shanghai). See the current release scope and remaining checks below.

## SDK 0.52 upgrade verification, 2026-09-15

- Public npm Agent SDK `0.1.260915-alpha.0`; frozen dependency installation passed.
- Type checking and all five verifier tests passed. Hosted and local real-model delegation were not repeated.
- Agent validation and packaging passed with the locally built CLI from GEA `170cf55f` plus the local Agents API fixes described in [the acceptance record](../agents-api/VERIFICATION.md). No workspace-linked SDK dependencies were used.
- This records local checks. It does not update earlier Preview/Production deployment evidence or claim the new CLI has been published.

## SDK 0.51 upgrade verification, 2026-09-14

- Public npm Agent SDK `0.1.260914-alpha.1`, Node 24.16.0 and pnpm 12.1.0. Frozen installation, TypeScript, all five verifier tests, Agent validation and packaging passed. The verifier uses the public client `token` option. CLI validation uses the local build from GEA `413f2bd83`; the next CLI publication is paused.
- The complete local verifier passed after the final coordinator instruction change: `f7f067cf-7bc0-4e99-9f20-75779537474d`. This covers three concurrent tasks, a nested private calculator, automatic parent continuation, continued-child recall and fresh-child isolation.
- On Web v0.51.0, children completed but parent resumption repeatedly failed with `Message id conflicts with existing message ownership`. GEA PR #441 fixes the persisted Run metadata and hidden wake message. After the operator deployed Web v0.51.1, parent continuation worked. A developer-authenticated hosted run completed all three jobs and the nested calculator: Chat `01a09e65-8099-7678-848e-d2ec1332886f`.
- The Project-key run `52e7676f-e992-497c-8563-6cd48f6ff18c` also executed all children successfully, but its coordinator omitted `calculator` from the final summary. Trace `08e6112ab17f8946ee8c265f98dfe9a1` confirms that the researcher returned the complete object and the parent's model received it. The coordinator instructions now explicitly retain every nested result field. The strict verifier assertion remains unchanged.
- Current Preview is version 5, deployment `01a09e74-3c61-73a7-8bf0-3a8f64414d93`, including that instruction fix. The hosted verifier attempt `eec6a25f-c942-4ceb-b6b3-8d684c71485c` failed at its initial request with HTTP 500. The matching Runtime log at 13:47:18 CST reports `Worker Durable Object resident capacity is exhausted`.
- Earlier failures at 13:21–13:24 had the same capacity error; the observed `Descendant cancellation failed (500)` was a downstream symptom. Runtime logs also show separate S3 authority-read connection failures at 13:28 and 13:40. Logs confirm Runtime image v0.51.0 and later successful evictions. The live settings were subsequently verified: two Pods, each with a 1 GiB container limit, 700 MiB pressure threshold and 64 resident-object limit. The historical failure log does not identify which limit fired.
- After the operator authorized direct cluster adjustment, each Runtime Pod received a 1 GiB memory request, 2 GiB limit and 1536 MiB pressure threshold. Both Pods were replaced sequentially using the existing OnDelete strategy, retaining the v0.51.0 image and all other settings. The complete Project-key hosted verifier then passed on unchanged Preview v5: `500d330b-19ea-4e2b-a063-ce0d119dd3a5`, parent Chat `01a09e96-122b-7062-90fe-5654897da11d`. All three batches passed: parallel children and nested calculator (29 × 17 = 493), automatic parent continuation, same-handle recall and fresh-handle isolation. Assertions were unchanged.
- During the post-rollout example tests, the larger Pod reached a sampled working set of about 819 MiB, exceeding the old threshold; neither Pod recorded an OOM or new capacity rejection. This establishes acceptance of this test workload, not a concurrency capacity guarantee. A separate S3 ownership-read connection failure recurred at 14:35 CST and remains unresolved. No Agent Production promotion or new CLI release is claimed. Earlier checks below describe their recorded versions only.

The sections below retain the earlier v0.50-era checks, including the successful PR #418 recheck.

## Toolchain and local result

- Node.js 24.16.0, pnpm 12.1.0; public npm SDK `0.1.260911-alpha.0`.
- Compatible local CLI source and native Worker Runtime were used. The public
  CLI `0.1.260910-alpha.1` does not yet contain the subagent changes.
- Frozen dependency installation, type checking, five verifier tests, Agent
  validation and packaging pass. The generated Worker slug registry includes
  only `coordinator` and `reviewer`.
- Model: `creative-reasoning-1.5`, accessed through an authenticated GEA login.

`pnpm verify:local` passed with verification ID
`758eeeb3-e59e-44b6-ab79-b5af7e53fd07`, parent chat
`a7f18fc1-07e2-42df-b4ff-157dcec85e18`:

| Scenario                                    | Observed result                                                                            |
| ------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Private researcher → its private calculator | Both completed; 27 × 21 = 567; distinct child chats                                        |
| Explicit top-level reviewer reference       | Completed; 27 + 21 = 48; retained a random marker                                          |
| Self copy                                   | Completed; 27 − 21 = 6; independent child chat                                             |
| Automatic parent continuation               | Parent ended its first turn, then summarized completed tasks without another user request  |
| Continue reviewer with agentId              | Same child handle/chat, new taskId, recalled marker and value without receiving them again |
| Fresh reviewer without agentId              | New handle/chat, unknown prior marker and value both null                                  |

An earlier local attempt overlapped development reloads and failed on
continuation with `Agent is not in the source Worker deployment.` The complete
run above was repeated after reloads settled, with unchanged sources. Live code
replacement is outside this example's checks.

## Initial hosted Preview result: blocked

The example initially deployed as Preview version 1 in the dedicated
`opengea-subagents` Studio Project. API discovery exposes two public entries,
`coordinator` and `reviewer`; the private definitions remain internal.

- Project: `01a08ef0-608e-760f-876f-256b6bc1a266`
- Worker: `01a08ef0-7e45-77c4-8402-0d329e7abba2`
- Deployment: `01a08ef0-7e6b-7774-9022-b1ccb4270512`
- Snapshot: `sha256:dbe0ac135d6286930444857193cf5d898b1d2168671fb054afb49d0e86ff42d2`
- Verification: `c3a4c311-e769-47d0-92a6-cc9d3fac4ed0`
- Parent chat: `01a08ef2-c4dd-745d-8110-0b6bd2a314a2`
- First run: `01a08ef2-c550-70bb-b60d-4e9b960a344a`
- Automatic continuation: `01a08ef2-f4a4-764c-90ab-40a4627cdefe`
- Initial trace: `8632a7960984e918c61321574044e03b`
- Continuation trace: `1819fb2759fc157755eb99d04031411a`

Reproduce by pushing the example, creating a Preview key for the coordinator
with `runs:write`, `chats:write` and `chats:read`, and running `pnpm verify`.
The root request returns HTTP 200, invokes `execution_info`, starts three
tasks and returns actual `working` receipts. All three task updates then report:

```text
Unhandled exception: Child Agent invocation failed (500).
```

The parent automatically resumes and reports these failures. This verifies
receipt creation, notification delivery and parent wakeup. Child execution,
nested completion and history isolation remain unverified in hosted Preview.
The HTTP error body is not included in the task error, so these traces do not
establish the underlying server exception; server logs are needed to locate it.

The original verifier mistook the prose-prefixed failed summary for a missing
summary and timed out. The updated parser accepts fenced JSON after prose,
preserves null failed results and surfaces the HTTP 500 immediately. Replaying
the saved response and a behavioral regression test verify this correction.

The temporary Preview keys were revoked after verification. No Production
promotion or CLI release was performed. Raw reports and traces remain under
ignored `.gea/`; credentials and model trace bodies are not committed.

## Preview v2 recheck

On 2026-09-11 at 05:47 UTC the same Agent snapshot was redeployed to the same
Studio Project as Preview v2, deployment
`01a08f01-e5cb-710f-a208-fc5279d2027d` (status `ready`).

Both authenticated entry paths reproduce the child HTTP 500:

- Project key, `pnpm verify`: verification
  `95193450-6caa-48bf-a648-78dae39db078`, chat
  `01a08f02-a0ed-76a9-a2e2-c176596a54f2`. All three child tasks failed.
  First trace `b17268bb26374a67530f3321574980f6`; automatic parent continuation
  trace `0acbe8fa5a16aa14cde712b8658318ec`.
- Authenticated developer, `studioAgents.startRun` with `environment: preview`:
  one reviewer task to calculate 19 + 23 failed identically. Chat
  `01a08f04-2e97-7639-8fdf-b6cb4e8ac898`, initial run
  `01a08f04-2f26-706b-b526-ebf52e2f2f60`, traces
  `620d34b5f5ab4e6a3617f025770a9a50` and
  `2142bc989be68aa30683aced1bfde589`. Persisted history contains the actual
  working receipt, failed task update and automatically resumed parent summary.

At that point, this ruled out a failure restricted to Project key callers without
identifying the underlying server exception. The browser required sign-in; the developer
check used the authenticated Studio API, not browser UI automation. The recheck
key was revoked after testing.

## Hosted recheck after the Web host fix: passed

Production Web logs identified `new Request(call, ...)` in the child callback
adapter: Nitro/srvx supplies a lazy Request wrapper, and Node Undici throws
`Cannot read private member #state from an object whose class did not declare it`.
[GEA PR #418](https://github.com/bmrlab/gea/pull/418) fixes construction from the
URL, method, headers and streaming body while preserving cancellation.

After the reported Web rollout, the public-SDK `pnpm verify` matrix passed at
07:06–07:07 UTC. No SDK upgrade, repack or Agent push was performed for this
recheck. Studio inspection confirms the same Preview v2 deployment
`01a08f01-e5cb-710f-a208-fc5279d2027d` and Agent version
`01a08f01-eddd-7496-a5b7-6f2b9d04731d` remain active.

- Verification: `224a024a-319d-490c-80c9-6aa97d66c208`
- Parent chat: `01a08f49-a624-7628-9f55-5dcf6ff86a59`
- Parallel batch initial trace: `574d684246a12037cc77b6a5a9582744`
- Continuation initial trace: `5303af076a94f91e82dc7ac488c4ec84`
- Fresh-child initial trace: `3ce236ee2b83ac6a775c8c8cf699bbbd`

| Scenario                              | Observed result                                                                               |
| ------------------------------------- | --------------------------------------------------------------------------------------------- |
| Private researcher → calculator       | Both completed; 26 × 12 = 312, with distinct child chats                                      |
| Explicit top-level reviewer reference | Completed; 26 + 12 = 38, with the supplied random marker                                      |
| Self copy                             | Completed; 26 − 12 = 14, in another child chat                                                |
| Parent continuation                   | Working receipts followed by persisted completed notifications and automatic parent summaries |
| Continue reviewer with agentId        | Same handle/chat, new taskId, recalled 38 and the marker without receiving them again         |
| Fresh reviewer without agentId        | New handle/chat; prior value and marker both null                                             |

The existing reviewer handle was `7fd0be71-d636-46bc-81c5-ba191edd4312`;
continuation created task `cbbdcafe-11f4-455b-a92e-19b3b89ac0d8`. The fresh
reviewer handle was `14058bb2-32e6-451e-b418-9ed36292c49d`. The continuation
answer repeated its earlier `runId`; this verifier checks the new task and
retained child chat/history, not whether the model refreshes its reported run ID.

The authenticated developer Studio API also passed a separate reviewer call
for 23 + 29 = 52. Its working receipt, completed notification, automatic parent
summary and cleared active stream were verified:

- Chat: `01a08f4a-eaca-74f8-a80d-77277736f8d8`
- Initial run: `01a08f4a-eb18-76aa-b838-8c525a75350f`
- Parent continuation: `01a08f4b-33b8-70db-a9bb-23fe1eb124a7`
- Traces: `0aa17449b6780f559340cfb58f8c1e19`, `e8549d2b36a48f9ca860ea5f3f55744d`

The temporary Project key was revoked at 07:08 UTC and removed from `.env`.
This verifies the within-Worker example on the hosted Preview deployment;
cross-Worker calls, hosted cancellation, crash recovery, URL upgrades and browser
UI are outside this recheck. Production promotion was not performed.
