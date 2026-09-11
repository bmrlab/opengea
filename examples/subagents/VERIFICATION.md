# Verification record

Last verified: 2026-09-11. This record distinguishes local execution from the
hosted Preview test. It is not a claim that every deployed subagent path works.

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

## Hosted Preview result: blocked

The example successfully deployed as Preview version 1 in the dedicated
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
