# Verification record

## Current local validation, 2026-09-24

- This is a regression verifier, not a claim that the complete hosted matrix has
  passed. The 140 sequential children and 142 retained receipts remain pending
  a fresh full acceptance run. Historical failures below are dated evidence,
  not a diagnosis of the current platform.
- Updated to public Agent SDK/Contract `0.1.260924-alpha.1`. Frozen installation,
  TypeScript checking and all three protocol test groups pass on Node 24.16.0
  with pnpm 12.1.0.
- Public CLI `0.1.260924-alpha.0` validates and packs the example on macOS arm64,
  including `maxConcurrentSubagents: 2`. No source CLI, package patches or
  dependency overrides were used. Other CLI platforms were not tested.
- No new hosted calls, deployment, promotion or full real-model matrix was
  performed during this cleanup. CI runs only type checking and protocol tests;
  it does not spend model credits or require production credentials.


## Historical hosted acceptance, 2026-09-22

Public SDK/contract `0.1.260922-alpha.1` fixes the missing export. The new
Production example passed concurrency admission and repeated capacity reuse,
but the 140-child matrix stopped after 39 sequential children. The cumulative
128-child boundary and final 142-receipt assertion have **not** passed.

All hosted calls reached `https://musegea.com/api/v1`, organization `tezign`,
workspace `default`. The platform image/commit was not independently identified;
the user reported rollout. Historical failures below remain evidence, not current
SDK publication blockers.

### Published artifacts and build path

- Release workflow [35692803111](https://github.com/bmrlab/gea/actions/runs/35692803111)
  completed successfully for `npm/v0.1.260922-alpha.1` at merged commit
  `439d90440ea0fe803f3b901d8ace76c66aff1858` (PR #535).
- Contract, Agent SDK, App SDK, Chat UI, Computer E2B and Extensions SDK all have
  exact version and npm `latest` `0.1.260922-alpha.1`. All six downloaded tarball
  SHA512 integrities match registry metadata and pass the public-package verifier.
- An isolated Node ESM consumer imports the published
  `@gea-ai/contract/agent-session-overrides` and checks valid/invalid inputs.
- This example pins the public SDK without patches or dependency overrides.
  Frozen install, type checking and three protocol test groups pass.
- Public CLI `0.1.260920-alpha.1` still rejects `maxConcurrentSubagents`.
  This deployment used current source CLI packaging functions, followed by the
  canonical Worker deployment upload. Source validation/packing passed; this
  does **not** claim the published CLI works. No CLI release was triggered.

### Production test and failure evidence

- Project: `opengea-subagent-limits` (`01a0c7dc-af4f-77cd-a875-5c71375ef9ec`).
- Agent: `01a0c7dd-6b96-7318-a987-fedb841a5973`.
- Production v3: `01a0c7e1-03d0-72d9-b488-6e681c28ca2a`.
- Worker deployment: `01a0c7e0-eecd-737e-aa3f-39292ea4fe7a`.
- One parent Session: `df9ffe73-ba08-4575-87bd-46f6de2e5aab`.
- Strict report: `.gea/verification/8071ba12-2bd3-44b7-b67f-7e6045315d56/report.json`.
- Burst passed: exactly two accepted children finished; one admission returned
  `subagent_concurrency_limit`, `limit: 2`, `active: 2`, with the actual pending
  Run IDs. The rejected label may occupy any position in a simultaneous burst.
- Three batches of ten sequential children passed every assertion. During the
  fourth batch, children 31–39 were accepted. Follow-up read-only checks verified
  all nine finished, correct Run/Session/parent identities, one exact real pause
  output per child, and no overlap. Parent history retains all 41 accepted
  receipts (two burst plus 39 sequential).
- Fourth parent Run `01a0c7ef-ba60-7463-996e-797d211617e5` ended its SSE after
  the ninth `runWait` input with `[DONE]`, without a `finish` event or a Tool
  result for that wait. Child `f11489f3-7bc5-4abf-8e00-9b536b1d6ef1` finished at
  `2026-09-22T07:09:21.324Z`. The parent API reports `finished` at
  `2026-09-22T07:09:21.877Z`, while persisted assistant metadata still says
  `sessionStatus: waiting`, `finishReason: tool-calls`; the wait Tool part is
  `input-available`. Job 40 was never started.
- Trace `159d45d721be64ae179ccb3d6f00116d`, final parent span
  `a4ac09ff03eabacb`, also ends with `gea.session.status: waiting`. The full
  144-span inspection has no next page and no error-status spans. This identifies
  the observed continuation/state discrepancy, not its upstream root cause.
  No concurrency rejection occurred in the serial batches.
- No writes were retried or issued to continue the failed Run. The temporary
  Project API key was revoked after evidence collection.

Final observations, child verification, full Trace and key-revocation result are
ignored under `.gea/verification/2026-09-22-alpha1/`. The strict failure is retained;
39 successful children do not convert the incomplete batch or matrix into a pass.

### Root-cause diagnosis: wait/resume settlement race

Read-only production log correlation and deterministic local protocol tests
identify a race between claiming a child-result continuation and settling the
previous invocation. Production Web is `v0.55.13`; its `web/v0.55.13` tag points
to `36bd0320f06349fcb57ccc2cfa4fb210339d5142`, which contains the faulty Host branch.
This is not a 39-child quota or a concurrency rejection.

The failing Run's production timeline (UTC):

| Time         | Observation                                                                                                                                                       |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 07:09:21.324 | Child 39 finishes.                                                                                                                                                |
| 07:09:21.703 | Continuation `4ea5f229-56c1-4116-9a87-112a1f9b493e` has already been claimed; Host defers it with `chat_run_active` because the old invocation is not yet paused. |
| 07:09:21.793 | The old Worker invocation stream finishes. Its final Trace and response metadata report `waiting`.                                                                |
| 07:09:21.797 | The old Host reads logical Run state.                                                                                                                             |
| 07:09:21.877 | Session records a `finished` managed outcome.                                                                                                                     |
| 07:09:21.912 | The old Host receives HTTP 200 from `execution completion`; there was no `execution pause` request for this invocation.                                           |

`agent-session-inbox.ts` clears `state.wait` and installs a new execution during
`claim`, before that continuation begins. `getAgentSessionRunState` consequently
reports `running`. In `agent-cloud-runtime.ts`, `settleRun` overwrites the current
invocation's `suspended: true` with a test for only `waiting`/`draining`; the claimed
continuation makes this false. It therefore calls `completeTurn` for the old
attempt. `agent-session-execution.ts` rejects draining but permits completion of
this still-live attempt while the inbox owns an unfinished continuation. That
writes an immutable terminal outcome, closes the event range and removes the
active attempt. Later dispatches cannot resume a Run whose directory status is
already `finished`, so `chat_run_active` repeats instead of executing job 40.

Two local diagnostic regressions confirm the mechanism:

- Host settlement: the `waiting` control passes; changing only logical state to
  `running` after a claimed continuation causes the pause assertion to fail and
  the Host settles the Run.
- Real Session protocol: initialize/enter/start a parent, create a child, wait,
  finish the invocation, complete the child, claim continuation, then submit the
  old attempt's completion. Expected rejection is HTTP 409; current SDK returns
  HTTP 200 with a `finished` outcome. No model/provider behavior is needed.

The responsible Host assignment dates to September 18 (`3a469896d6`), before
PR #530. The long acceptance test exposed an existing lifecycle race. The earlier
`Duplicate model block: 0` remains a separate unresolved observation.

Repair should preserve invocation suspension until a logical terminal outcome
is confirmed, and prevent the SDK completion boundary from sealing a Run still
owned by pending execution/wait state. Validate both child-completion orderings,
terminal cancellation/error settlement and repeated waits; then rerun the full
hosted matrix. This requires no historical Session migration or quota fallback.
No production repair/deployment was performed during diagnosis.

The ignored evidence folder contains `gea-wait-race-timeline.json`,
`gea-wait-race-reproducer.patch`, `gea-race-host-test.log` and
`gea-race-sdk-test.log`. The patch can be applied to GEA `e61440d97` to rerun both
regressions with `vp test run ... -t DIAGNOSTIC`. Temporary diagnostic edits were
removed from the GEA worktree after capture. Subsequent authorization denial at
07:12:22 followed the previously recorded API-key revocation; it did not cause
the original 07:09:21 failure.

### Preliminary probes

Reports `7193eb56-fe06-4a67-b150-639cf387e413` and
`2baad1ea-d18e-4525-a071-7178c8927120` are retained as failed probes. The first
exposed ambiguity between a JSON-string message and a plain-text message; the
example now uses exact `HOLD label=<label> holdMs=<number>` messages. The second
exposed an incorrect verifier assumption that the third listed concurrent call
must lose admission. The verifier now accepts any losing position while still
requiring exactly two completions, one rejection and matching pending IDs; a
behavioral regression test covers all three positions. These corrections did
not change the SDK or relax the capacity/completion requirements.

The earlier `Duplicate model block: 0` failure below did not recur in this run;
that is not proof it is fixed. Beyond the interrupted 140-child/history matrix,
Studio child-history pagination, cancellation cleanup, remote admission, crash
recovery and old Sessions under new bundles remain unverified here.

## Historical checks before alpha.1 publication

Overall: **blocked / not accepted**. No new Agent version was deployed. Production
platform image/commit was not independently identified; the user reported rollout.
All hosted calls below reached `https://musegea.com/api/v1`, organization `tezign`,
workspace `default`. The unchanged old example is deployed only to **Preview**.

### Public-package blocker

- SDK and contract: `0.1.260922-alpha.0` from npm, without local modifications.
- Node `24.16.0`, pnpm `12.1.0`, published CLI `0.1.260920-alpha.1`.
- Install, TypeScript check and the verifier's two behavioral test groups pass.
- `agent validate` fails because the SDK's `agent-session.js` and
  `agent-worker.js` import `@gea-ai/contract/agent-session-overrides`, which the
  published contract does not export. The JS/d.ts files exist in its tarball;
  the missing entry is in the publication's export map.
- Reproduction from this directory:

  ```sh
  npm exec --yes --package=@gea-ai/cli@0.1.260920-alpha.1 -- \
    gea agent validate --json '{"cwd":"."}'
  ```

- Source `packages/contract/package.json` has the source export but omits it
  from `publishConfig.exports`. This omission also exists before PR #530.
  Repair the publication export, publish corrected packages, update this
  example's pin/lockfile, then rerun validation and hosted acceptance.
- The initial PATH CLI was `0.1.260908-alpha.0`; its additional WASM-loader error
  disappeared with the published September 20 CLI. It is not evidence of a
  current SDK WASM defect.

### Existing bundle and Session regression

Unchanged subagents Preview v15, SDK `0.1.260920-alpha.3`:

- Worker deployment `01a0bebd-2af7-73fb-98de-1c6806605c9d`.
- Agent version `01a0bebd-3a60-733f-9458-5aefa074d388`.
- Coordinator `01a08ef0-8e63-77dd-8d4b-4e07ffb4675b`.
- Parallel private/reviewer/self children, nested calculator, implicit joining,
  explicit waits, existing-child recall and fresh-child isolation passed.
- New test parent Session `6ee2aa8b-5b2d-4345-b97e-507c72f8ca38`.
- Full strict report (includes failure):
  `../subagents/.gea/verification/df5db1b1-5fcd-4e35-8735-0af766321626/report.json`.
- A Session originally created on September 20,
  `dc8bf36a-22ed-4594-b585-c7931ba050eb`, successfully continued after rollout.
  New parent Run `01a0c7a0-c03a-749e-8786-acf8832999cc` finished; real receipt,
  explicit wait, output 18, identity and SSE/persisted-history checks passed.
  No Agent rebuild or Session migration was performed.

The full strict verifier did **not** pass: sibling `sessionSend` delivered, its
recipient finished, and child Run `16054345-14b2-427f-a7a0-c7c7bd888373` finished,
but parent Run `01a0c79e-123f-76e9-9b4a-294b05b5a7eb` aborted at
`2026-09-22T05:37:26.778Z`. Trace `633ea0a9aeb69c80183dfc6f28202180` records
`AgentCoreError: Duplicate model block: 0` during final model output after the
completed wait. This identifies the observed failure, not its upstream root
cause or a causal connection to PR #530. Do not erase it with a passing retry.

Additional raw evidence is ignored under
`.gea/verification/2026-09-22-acceptance/`. Temporary API key was revoked and the
empty test Project was removed. Existing test Sessions and their evidence remain.

### Not yet verified

New production Session concurrency 2 / third rejection, terminal capacity reuse,
140 sequential children, retained 142 receipts and Studio child-history
pagination remain unexecuted due to the public-package blocker. Cancellation,
remote reservations, crash recovery and old Sessions opening under new bundles
also remain outside this hosted result. Unit tests are not production evidence.

### Export fix validation — 2026-09-22

The contract source now includes the missing `publishConfig.exports` entry.
A tarball built from the fixed source passes the public-package verifier and an
external Node ESM consumer can import the schema, accept valid Session overrides
and reject an invalid negative step limit. The same consumer fails with
`ERR_PACKAGE_PATH_NOT_EXPORTED` against the pre-fix tarball. Workspace-wide GEA
type checking also passes. These checks do not publish a registry release.

For exact-release validation, an isolated copy of the public contract
`0.1.260922-alpha.0` was repacked with only the missing export added and used with
the unmodified public SDK of the same version. The missing-import errors disappear,
but public CLI `0.1.260920-alpha.1` rejects `maxConcurrentSubagents` as an unknown
snapshot key. The current source CLI validator accepts the example. The example's
private worker now includes its required description, found during this check.
This scratch tarball override is not part of the example dependency files.
A corrected SDK/contract release and compatible CLI release are still required
before repeating public-install and hosted acceptance. No new production calls
were made during this fix.
