# SDK 0.1.260920-alpha.3 acceptance

Recorded 2026-09-20, continuing PR #13. Dependencies target public SDK/Contract
`0.1.260920-alpha.3` and CLI `0.1.260920-alpha.1`. The previous acceptance
records below remain historical; passing older checks is not new-release acceptance.

## Release and installation

CLI workflow [35508942351](https://github.com/bmrlab/gea/actions/runs/35508942351)
passed both native builds/smoke tests and npm publication. After npm's processing
delay, the launcher, macOS arm64 and Windows x64 packages all expose version and
`latest` `0.1.260920-alpha.1`. Every downloaded registry tarball matches its SHA512
metadata; launcher/macOS tarballs also exactly match the tested CI artifacts.
The early native-artifact checks below therefore used the same macOS bytes now
published on npm. Final dependency lockfiles include both native platform packages,
not just the package that became visible first. No local tarball/source dependency
was added to the examples.
All six final frozen installs pass. OAuth's 40-test suite and types also pass
with the default npm-installed CLI/Runtime, without the earlier native override.

## Local recheck

The alpha.1 macOS CLI CI artifact (workflow `35508942351`) has passed build/smoke
tests. All six examples pass type checks and validation/pack with public SDK
alpha.3. Basic/OAuth production builds, 74 ordinary tests and 27 extracted
combined-artifact OAuth tests pass. Basic's two real-model benchmarks score 1.0;
the complete Agents API file/Computer/reuse/history flow passes.

Subagents' complete standard matrix passes, including all four strict SSE/history
checks. The previously failing waiting-user boundary also passes locally: the
original stream and reconnect each have one assistant start/finish, distinct
message IDs and no old-text leakage. Exact IDs are in its verification record.
These local results do not establish hosted SSE correctness.

Memory's full real-model three-strategy experiment completed: raw/summary 15/15,
observational-memory **14/15** (`signed DPA` instead of `DPA`). Restart, isolation,
observation/reflection and usage checks pass, but strict recall acceptance exits
nonzero. The report retains its initial alpha.0 launcher metadata and explicit
alpha.1 native override; that executable matches the published alpha.1 bytes.
Final frozen installations use CLI alpha.1. Prior 13/15 and 14/15 records remain
historical rather than being replaced or generalized.

## Latest hosted recheck after Web restart

On 2026-09-20 at 14:10 UTC the operator restarted Web v0.55.5. Both Worker
Runtime Pods were already on v0.55.5. The unchanged Preview deployments then
passed these fresh checks, without relaxing the verifiers:

- **Basic v16:** approval, actual search execution, final cited answer and saved
  history passed. Session `01a0bf2d-3cd4-73ff-ab4e-e34c0992a18b`, Run
  `01a0bf2d-3d36-76fa-bec7-42b1ec82d75f`.
- **Agents API v4:** the complete Computer/files/three-Run/output-reuse/history
  flow passed in one invocation. Sessions `a889645b-bc6b-4b7c-ae82-c13a8438893c`
  and `c3a36595-2270-428c-af8c-d13ebe9f5e10`.
- **Subagents v15:** the full strict parallel/nested/self-copy, implicit/explicit
  waits, recall, isolation and sibling-delivery matrix passed, including all four
  SSE/history comparisons. Verification `be4553d1-792d-40ac-b958-f4380caa1411`,
  parent Session `dc8bf36a-22ed-4594-b585-c7931ba050eb`.

The first new Agents API Run initialized in 102 ms, including 7 ms for Redis
abort subscription. Before the restart, all three examples had timed out before
model execution; their Runs retained expired execution leases. Restart recovery
does not establish that Redis fault handling is fixed: the GEA decoupling and
diagnostic changes were still local and undeployed during this check.

No new Runtime capacity refusal appeared in the inspected test-window logs.
Some Web `Session dispatch rejected` warnings still contained empty error fields;
their cause is unresolved, although the strict Subagents matrix passed. The
separate hosted waiting-user steering/reconnect boundary was not retested.
OAuth, Feishu and the full hosted Memory experiment remain at their previously
recorded acceptance status. Temporary Project Keys were revoked. No Production
Agent promotion or capacity/configuration change was made by the verification.

## Earlier hosted attempts (before Web restart)

Basic v15, Agents API v3, Subagents v14 and Feishu v11 were rebuilt and pushed to
their existing Preview Workers with SDK alpha.3. These four pushes used published
CLI alpha.0 while the alpha.1 Windows build was pending; they are not evidence of
alpha.1 packaging. No Production promotion or real Feishu message was performed.

All six were subsequently pushed using the alpha.1 macOS artifact: Basic v16,
Agents API v4, Subagents v15, Feishu v12, OAuth v10 and Memory v8. The first four
content hashes are unchanged from the earlier attempts. OAuth's Preview
publication release references its exact new source deployment.

- Basic approval/search did not complete. Run `01a0beb0-8d3c-71e8-8f23-0fe568c140fa`,
  continuation Trace `013f8d1f35cf2abcc517ee1ead52ddbd` reports
  `Worker Durable Object resident capacity is exhausted`; the client saw a socket
  close. Search output exists in history, but no final answer.
- Agents API Computer prepare/write/read/exec and input uploads succeeded. The
  first Run POST returned HTTP 500 `Agent stream initialization failed.` Run
  `01a0beb0-cecf-719c-b3d9-dbadf4d42f4c`, Trace
  `e2aa701bae75bfc5dd17eeb20fde5ae7` reports the same resident-capacity error.
- Subagents' full strict verifier timed out. Run
  `01a0beb0-925d-7467-90e7-74a5c0ea1f31`, Trace
  `01b5b693bbc9b1f3ef9c8f6a59c11c41` contains a rejected child invocation (500).
  This trace does not establish that capacity explains the subagent failure.
  The previous SSE/history regression is not declared fixed.
- OAuth's login, connected state and conversation list recover after reload, but
  old-message restoration and a fresh read-only search fail. Session
  `e9e7a85d-cb50-46fb-b84e-ed728975d8b4` was created; its uncertain Run write was
  not repeated. No matching project-scoped trace was available to establish the
  cause. Historical alpha.2 hosted success is not alpha.3 acceptance.

All temporary Project Keys were revoked. These attempts are failed/incomplete
hosted acceptance, not a pass assembled from separate partial results. Production
capacity/configuration was not changed during verification.

---

# Historical SDK 0.1.260920-alpha.2 acceptance

Recorded 2026-09-20 (Asia/Shanghai), continuing PR #13. SDK, Contract and Chat UI
use public npm `0.1.260920-alpha.2`; CLI stays at published
`0.1.260920-alpha.0`. All six frozen installs, type checks and validation/package
builds passed. Basic and OAuth production builds passed; ordinary suites passed
74 tests, plus 27 combined-artifact OAuth checks. The system's older global CLI
was not suitable for WASM packaging; validation used the published pinned native CLI.

Production platform images were read back as Web/Worker/Worker Runtime v0.55.3.
All six existing test Workers were rebuilt to Preview, without Production promotion.

| Example              | Current local acceptance                                                                             | Current hosted Preview acceptance                                                                                                        |
| -------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Basic                | 18 tests; 2/2 real-model benchmarks scored 1.0                                                       | Real Studio approval, search, citations and saved history pass on the published SDK                                                      |
| Agents API           | Full Computer/file/Run/artifact/reuse/history verifier passes                                        | Main file/Computer flow passed; complete verification still not green across separate permission, throttle, stream and Computer failures |
| Subagents            | Eight tests and standard matrix pass; **waiting-user SSE boundary fails in published CLI**           | **Blocked: original stream finishes at WAITING; final result only appears in persisted history**                                         |
| OAuth app            | 40 tests and 27 combined-artifact native checks pass                                                 | Login, connection, history, fresh real MuseDAM search and refresh recovery pass                                                          |
| Observational memory | Six tests; raw/summary 15/15, observational-memory **13/15**; restart/isolation/observe/reflect pass | Preview ready; full hosted three-strategy experiment not rerun                                                                           |
| Feishu               | Types and package pass                                                                               | Preview ready; real message delivery not exercised                                                                                       |

The subagent failure is now a concrete regression assertion rather than a generic
socket symptom. Run `01a0bd76-33ce-766c-95ba-226d6d88dabb` completed with one
persisted assistant ID and a correct nested summary, but its SSE contained only
`WAITING` before `finish`/`[DONE]`. The original client never received the final
result. Do not mark hosted SSE continuation fixed based on local checks or history.
This requires follow-up in GEA's hosted stream path; this OpenGEA PR adds the
consumer regression check and does not claim to repair the platform path.

A separate waiting-user test also exposes a local CLI boundary gap: SDK history
correctly interrupts the old wait and creates a new assistant ID, but the native
HTTP SSE includes both assistants in the same response. The native API stream
adapter needs the message-boundary handling as well; publishing the SDK alone
cannot update that bundled CLI code. Exact IDs appear in the subagent record.

The caller fixes retain strict acceptance: read each resumed text part without
weakening summary schemas, check complete SSE against history, document
`connections:read`, and honor bounded GET 429 delays without retrying writes.
Temporary Project Keys were revoked. No real Feishu messages or Production
promotions were performed. Per-example verification records contain exact IDs,
versions and evidence; previous records below are historical.

---

# Historical SDK / CLI 0.1.260920-alpha.0 acceptance

Recorded 2026-09-20 (Asia/Shanghai). Local acceptance and hosted acceptance are
reported separately. No example was promoted to Production.

## Web v0.55.1 deployment recheck

Production Web now runs v0.55.1. Browser Trace row navigation and OAuth history
both pass. Hosted Computer prepare/read/write/exec and signed input downloads
pass after correcting the caller's download/environment handling. Attachment Run
admission still returns 403; the plain-text control Run completes. Subagent hosted
retry still fails with a socket close. These remaining failures are not treated
as successful hosted acceptance. Exact evidence is recorded in the example logs
below; earlier sections describe the pre-deployment checks.

## Release

SDK packages are published. CLI release workflow
[35457340650](https://github.com/bmrlab/gea/actions/runs/35457340650) passed both
native platform builds/smoke tests. Its first publish attempt failed during npm
maintenance; rerunning the failed job succeeded after maintenance ended.

Registry version and `latest` are verified as `0.1.260920-alpha.0` for the launcher,
macOS arm64 and Windows x64 packages. Public launcher/macOS tarball SHA512 matches
the tested CI artifacts. Local checks use the native macOS distribution and
published SDKs, except the explicitly identified patched Basic Preview below.

## Example results

| Example              | Local checks                                                                                                                                                   | Hosted Preview                                                                                                                                                                                     |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Basic                | Types/build, 18 tests, validation/pack and 2/2 real-model benchmarks passed                                                                                    | v13 uses a locally packed approval fix; real Studio approval, tool execution and history passed. Fix is not yet in public SDK                                                                      |
| Agents API           | Complete real-model prepare/file/Computer/output/history verifier passed                                                                                       | v1 ready. Missing permission schema repaired; Computer request-adapter 500 now reproduced and fixed in GEA #497, pending Web deployment                                                            |
| Subagents            | Six tests and full strict real-model matrix passed after updating tool names/input fields                                                                      | v10 ready; prior hosted retry failed with child socket errors and execution lease failure; memory-pressure logs correlated, cause still under investigation                                        |
| Feishu Channel       | Types and validation/pack passed                                                                                                                               | v9 ready; real Feishu delivery/reply not exercised                                                                                                                                                 |
| OAuth app            | Types/build, 40 tests, validation/pack; all 27 combined-artifact native integration tests passed                                                               | v8 ready; existing sign-in/MuseDAM connection survived, but an old immutable Session makes history recovery fail; GEA #498 fixes capability handling, pending Web deployment and hosted acceptance |
| Observational memory | Types, six tests, validation/pack. UUID verifier fixed. Three-strategy real execution completed; restart/isolation/observe/reflect passed; strict recall 14/15 | v6 ready; full hosted three-strategy replay unverified                                                                                                                                             |

Exact report, deployment, Session, Run and request IDs appear in each example's
`VERIFICATION.md`. Temporary hosted Keys, including failed-create rows, were
revoked. Historical verification records are preserved.

## Fixes and remaining work

- [GEA #496](https://github.com/bmrlab/gea/pull/496): Core approval continuation
  preserves its pending model projection across Session inbox continuation.
  Patched Basic Preview passed; publish a new SDK patch after merge, then update
  normal example dependencies and rebuild.
- [GEA #497](https://github.com/bmrlab/gea/pull/497): Computer commands no longer
  reconstruct the consumed srvx NodeRequest body. The actual adapter regression
  changes from 500 to 200. Rebuild/deploy Web after merge and rerun hosted checks.
- Production SpiceDB lacked file, Connection and Computer relations on
  `studio_project` / `studio_agent`. An additive schema update restored creation
  of the previously failing permissions. Existing unrelated definitions and
  relationships were preserved.
- [GEA #498](https://github.com/bmrlab/gea/pull/498): OAuth history recovery now
  checks the SDK logical Run capability before calling `run-state`. An old
  immutable Session returned 404 and broke the full list; 10 PostgreSQL/SDK
  integration cases and workspace types pass. Web deployment remains pending.
- Runtime memory admission pressure and socket/lease failures remain unresolved.
  Runtime Pod restarts and node fencing are recorded, but are not asserted to
  explain every failing request.
- Observational memory's strict atomic-document answer remains 14/15; the score
  is not converted to a pass. Feishu real messages and Production promotion were
  not part of this unattended validation.
