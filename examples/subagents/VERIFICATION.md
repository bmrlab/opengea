# Verification record

Last verified: 2026-09-11. Local and hosted Preview checks now pass after the
Web host fix in GEA PR #418. Earlier failures are retained below for diagnosis;
the final section records the successful recheck and its scope.

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

| Scenario | Observed result |
| --- | --- |
| Private researcher → calculator | Both completed; 26 × 12 = 312, with distinct child chats |
| Explicit top-level reviewer reference | Completed; 26 + 12 = 38, with the supplied random marker |
| Self copy | Completed; 26 − 12 = 14, in another child chat |
| Parent continuation | Working receipts followed by persisted completed notifications and automatic parent summaries |
| Continue reviewer with agentId | Same handle/chat, new taskId, recalled 38 and the marker without receiving them again |
| Fresh reviewer without agentId | New handle/chat; prior value and marker both null |

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
