# Verification record

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
