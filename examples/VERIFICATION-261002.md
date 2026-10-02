# SDK 0.1.261002-alpha.0 verification — 2026-10-02

All seven examples install the published npm SDK (and matching Contract where
explicitly declared). Validation used macOS arm64, Node 24.16.0, each example's
pinned pnpm, and published CLI/native Runtime 0.1.260926-alpha.0. No private SDK
source links or unpublished CLI binaries were used. CLI 0.1.261002-alpha.0 has
not been published as part of this update; the older Windows launcher fallback
has not been tested.

## Repeatable checks

| Example | Frozen install | Type check | Tests | Agent validate / pack |
| --- | --- | --- | --- | --- |
| basic | pass | pass | 19 pass | pass |
| oauth-app | pass | pass | 52 pass, zero skipped | pass |
| agents-api | pass | pass | 2 pass | pass |
| subagents | pass | pass | 8 pass | pass |
| subagent-limits | pass | pass | 3 pass | pass |
| observational-memory | pass | pass | 10 pass | pass |
| feishu-channel | pass | pass | no test script | pass |

Basic also passes its Next.js production build. OAuth's `pnpm test` builds the
complete registered Worker with `gea agent build` and executes the integration
suite against the native Runtime and real SQLite, using HTTP fixtures for OAuth,
Agents API and MuseDAM boundaries. The previously optional combined Worker test
now runs by default, checking application serving and rejection of direct public
Worker execution. This is not a hosted OAuth or real MuseDAM acceptance test.

The public API migration retains signed browser ownership, server-selected Agent
identity/environment, approval continuation, and explicit cancellation ownership
checks. The memory client tests cover history pagination, Session reuse, failing
Session reads and non-retry of rejected Run writes.

## Real model and native Runtime checks

- **Basic:** Started the built Next.js server and native local Agent on isolated
  ports. The application proxy discovered the Agent through `/api/v1`, created a
  Session and received a real search approval request. Submitting the approved
  assistant message with the signed cookies resumed the same Run, produced two
  real Hacker News results, finished with `stop`, and persisted the tool output.
  Session: `eb9cae5a-d05a-4d06-b4e2-a7541dac52ca`;
  Run: `5ff34443-5f35-43be-80de-117cd9ed0e72`.
  This exercised HTTP transport and persistence, not browser clicking/rendering.
- **Agents API:** Full `scripts/verify.mjs` passed Session preparation, Computer
  read/write/exec, file upload, real Agent runs, managed output reuse and paginated
  history. Session: `5ab6fcea-5806-4551-b383-b672bffc1b4e`.
  An initial harness incorrectly supplied the memory example's restricted model
  catalog; auto-selection resolved `deepseek-v4-pro`, which that catalog omitted.
  Re-running with the CLI's default local catalog passed without source changes.
- **Subagents:** Full strict local verifier passed parallel private/nested/public/
  self-copy execution, implicit and explicit waiting, child Session continuation,
  fresh-child isolation, sibling `sessionSend`, and stream/history agreement.
  Report ID: `f568a3a3-94ca-4038-8c68-5ba7af771130`.

- **Subagent limits:** A bounded local smoke based on the existing verifier
  passed two admitted children plus one rejected concurrent start, then ten
  sequential children in the same parent Session, checking terminal states,
  exactly-once tool outputs, non-overlap and retained receipts. Report ID:
  `3e7a3488-0ad8-4c48-8c3e-06d81431040b`. This used a temporary 10-child copy;
  the committed default remains 140 and was not fully rerun.

- **Observational memory:** Completed all three real-model strategies, each with
  12 training turns, restart, recall and isolation probes. Raw and summary scored
  15/15; observational memory scored **14/15** (`blocker`: expected `DPA`, actual
  `signed DPA`). Its strict acceptance **failed** and exited 1. Restart/history
  equality, isolation, observe, reflect, complete usage and input reduction all
  passed. Final main-model input was 25,987 / 5,557 / 1,729 tokens respectively
  (93.3% reduction for observational memory versus raw in this one scenario).
  This repeats the historical exact-answer mismatch; scoring and prompts were
  not relaxed to make the upgrade pass. The API/SDK execution path completed,
  but this result is not a clean memory-quality acceptance.
  Report ID: `2026-10-02T01-28-12.331Z-3cfc1a2b`.

## Scope

No hosted Agent projects were rebuilt or promoted, no new CLI was published, and
no Feishu bot messages were sent. Hosted user OAuth/subagent authorization,
real MuseDAM connections, browser interactions, and Windows remain separate UAT.
The default 140-child long-run capacity verifier is retained unchanged; bounded
capacity checks must not be described as a repeat of that full stress test.
