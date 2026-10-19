# Published package upgrade verification — 2026-10-19

All eight examples now use published SDK `0.1.261019-alpha.0` and CLI
`0.2.261019-alpha.1`. Feishu additionally uses the matching published extension;
its group/shared-topic and rich-text behavior was explicitly authorized in the
follow-up migration. This remains a draft validation record: OAuth's default
Vite local discovery is **FAIL**, and live acceptance is not implied.

## Published versions and reproducibility

Versions and `dist` metadata were read directly from `https://registry.npmjs.org`;
installed manifests and lockfile integrity values were checked against that data.
No local GEA source, patched node_modules, cross-repository imports, global
package upgrades, releases or deployments were used.

| Package | Selected version | Compatibility evidence |
| --- | --- | --- |
| `@gea-ai/agent-sdk` | `0.1.261019-alpha.0` | Exact Contract dependency below; optional `esbuild` peer `^0.28.0` |
| `@gea-ai/contract` | `0.1.261019-alpha.0` | Actual resolved dependency in all eight upgraded examples |
| `@gea-ai/cli` | `0.2.261019-alpha.1` | Installed launcher and `gea --version`; macOS-only package |
| `@gea-ai/cli-darwin-arm64` | `0.2.261019-alpha.1` | Exact optional launcher dependency; bundled native Runtime used |
| `@gea-ai/agent-extension-feishu` | `0.1.261019-alpha.0` | Exact SDK peer `0.1.261019-alpha.0`; adopted with shared group topics and rich text |

Host: macOS arm64, Node **24.16.0**. Basic/OAuth use their pinned pnpm **10.30.3**;
the other six examples use pinned pnpm **12.1.0**. The bundled CLI's Eval result
separately reports runtime `nodeVersion: v24.3.0`; this is not the host Node pin.
The new CLI publishes only the macOS arm64 native dependency. Windows/Linux native
execution is **NOT RUN** and not claimed supported by this release.

All eight examples own a lockfile and installation. Basic has two package
consumers under its own workspace (Agent and Next.js). The repository has no root
package installation. The three existing project CLI dependencies were updated and Feishu now pins its CLI locally;
other examples retain their documented separately installed CLI arrangement.
Unrelated direct dependency versions were preserved. Lockfile removals include
SDK-extracted Feishu dependencies and the obsolete Windows CLI fallback.

## Per-example matrix

`PASS` applies only to the operation described. A synthetic model response is not
real model quality, live provider authorization or hosted acceptance.

| Example | Frozen install | Types | Build / package | Tests | Key local smoke |
| --- | --- | --- | --- | --- | --- |
| agents-api | PASS | PASS | PASS validate/pack | PASS 2 | PASS real CLI/Runtime with synthetic model: Computer, uploads, tool execution, exact outputs/reuse and history |
| basic | PASS | PASS | PASS Next production build + validate/pack | PASS 20 | PASS real CLI/Runtime two turns; synthetic Eval completes both Cases/Judges with expected score 0 |
| code-mode | PASS | PASS | PASS MCP build + validate/pack | PASS 1 MCP + 1 package | PASS real CLI/Runtime two turns for all four public Agents; no tool-execution claim |
| feishu-channel | PASS | PASS | PASS published CLI validate/pack | PASS 9 | PASS synthetic handler admission/security and real CLI/Runtime two turns + current_sender; live Feishu NOT RUN |
| oauth-app | PASS | PASS | PASS combined Worker build + validate/pack | PASS 52 | PASS real native Runtime/SQLite with HTTP fixtures; **FAIL default Vite local discovery (502)** |
| observational-memory | PASS | PASS | PASS validate/pack | PASS 11 | PASS real CLI/Runtime two turns for all three Agents; actual launcher discovery/stop/restart PASS |
| subagent-limits | PASS | PASS | PASS validate/pack | PASS 4 | PASS synthetic native two accepted children, one concurrency rejection, exact parent/child identities and completed wait |
| subagents | PASS | PASS | PASS validate/pack | PASS 9 | PASS synthetic native researcher/calculator, reviewer and self-copy boundaries, completed waits, distinct Session IDs |

Total **109 tests passed**, no skips in the recorded suites: 100 from the initial
reviewed snapshot plus 9 focused Feishu tests in the follow-up. The other examples
were unchanged and their full suites were not repeated for the Feishu-only update. OAuth tests build
before testing/type-checking to generate its TanStack route tree. Standalone Agent
examples have no separate application build command; validate/pack compiles their
actual published SDK consumers. Feishu has no separate application build script.

The unmodified Agents API verifier also passed against the real CLI/App Server,
native Runtime and SQLite using a synthetic model HTTP service. It prepared and
read/wrote/executed Computer state, uploaded exact input bytes, ran the real
`savePreparedReport` tool, checked exact outputs, reused an output in another
Session and read paginated history. Its console says "real Agent runs"; that means
real Agent code executed, **not a real model response** in this test.

The subagent smoke checks persisted child history and public Run state, including
exact `parent_run_id`, terminal `finished`, no pending wait IDs, actual tool
execution identities, and absence of the parent-only marker in child histories.
It uses deterministic Anthropic HTTP tool-call fixtures, not real arithmetic
reasoning. It does not replace either example's paid full verifier.

A separate synthetic admission fixture bundles the published SDK and runs on the
published **native Runtime with real SQLite**. A Run-bound Session rejects missing
`executionTarget` with **409 `run_target_required`**, rejects the wrong Agent with
**409 `target_identity_conflict`**, and accepts/preserves the exact target and Run
ID when supplied. Public callers still send only public Session/Run inputs;
trusted CLI ingress owns this internal target. Real CLI two-turn and child checks
exercise positive propagation rather than adding internal fields to public calls.

## Consumer changes

- Basic and OAuth keep the local Project API key on the backend. Hosted OAuth
  still uses the current user's access token; origin checks, ownership,
  tenant/application/environment boundaries and stable SQLite namespaces remain.
- Subagent verifiers now forward the configured Project key in local mode as well
  as hosted mode. HTTP fixture tests cover discovery, Session/Run writes, no
  credential in output, and no retry of a rejected Run.
- Observational-memory reads the CLI-owned API URL and key-file path, authenticates
  discovery, and propagates the key to Session/Run/history calls. Its fresh-chat
  isolation call now supplies the missing mode argument. The actual launcher was
  started/stopped twice with synthetic credentials and no model calls: discovery
  returned 200 with the key, 401 without it, and retained the three Agent IDs.
- READMEs identify CLI 0.2's printed listener/key instead of assuming the retired
  `apiPort` controls the owned App Server. Tokens and generated artifacts stay out
  of Git. Feishu instructions now distinguish shared group topics from private
  history; other business Agent instructions and tools are unchanged.

## Upstream blockers and limits

1. **OAuth Vite plugin, CLI `0.2.261019-alpha.1`: FAIL.** With an isolated config,
   synthetic unused model key and `pnpm dev --port <free-loopback-port>`, `/`
   returned HTML 200 but `/api/session` returned 502. The published `vite.mjs`
   reserves an `apiPort`, injects that origin and overwrites any caller override;
   CLI 0.2 instead prints a different App Server listener and requires a Project
   key. The plugin never injects that key. Minimum upstream repair: obtain the
   actual owned listener and key, pass both to backend bindings, then rerun the
   actual Vite entry point. The new backend token support and passing native
   HTTP-fixture suite do **not** repair or pass this integration. No plugin fork
   or local-source substitution was made.
2. **Feishu follow-up migration adopted.** The previous private-text-only scope
   gate was explicitly removed. Nine behavior tests first failed against the old
   preset (group/rich-text/feedback absent), then passed against the public new
   extension with synthetic HTTP and Channel capability spies. They cover shared
   topic addresses, distinct sender principals/actors, private/group rich text,
   unsupported-media durable-feedback requests, ignored unmentioned input, token,
   app, tenant and allowlist rejection. These are not native Channel persistence
   or live WebSocket/delivery tests. A separate real published CLI/App Server/
   Runtime/SQLite smoke completes two turns, invokes current_sender and reads
   history; its Project API key authenticates a local service principal, not a
   Feishu user. No bot credentials were supplied.
   The packed Channel key is now `feishu-bot`, sharedSessions is true, and the
   required Runtime capability includes `channel-shared-session-v1`; the Connector
   and CLI Skill remain disabled. Hosted replacement/history continuity is
   **NOT RUN**, so do not assume the old `feishu` installation/history migrates.
   The published npm extension version is `0.1.261019-alpha.0`, but its embedded
   extension metadata still reports `0.1.261014-alpha.0`; this upstream metadata
   discrepancy is recorded, not locally patched or treated as package identity.
3. Some native CLI smoke logs contain trace-export 404/flush failures. Public Run
   and persisted history assertions passed independently; **complete trace export
   is not accepted** by these checks. No platform trace repair was attempted.

| Real/live acceptance | Status and reason |
| --- | --- |
| agents-api full real-model file/Computer flow | NOT RUN with real model: credentials/paid calls are outside this run |
| Basic real Hacker News Benchmark, approvals and browser UX | NOT RUN: synthetic Eval deliberately makes no search and scores 0; no real model/browser acceptance |
| Code-mode real PTC/Skill and remote MCP comparison | NOT RUN: needs model calls and configured live comparison; local MCP/pack tests do not prove it |
| Feishu delivery, cards, sender isolation | NOT RUN: no test-bot credentials or messaging authorization |
| OAuth live user consent, MuseDAM, hosted two-user isolation | NOT RUN: no live account/credentials; only synthetic HTTP against native Runtime/SQLite |
| Memory recall quality, compaction/cache and full restart recall | NOT RUN: paid corpus verifier was not invoked; launcher restart is narrower |
| Limits 140 sequential children / 142 receipts | NOT RUN: full paid matrix was not invoked; two-child native protocol smoke is narrower |
| Subagents full arithmetic, recall and sibling-send matrix | NOT RUN: synthetic fixtures do not establish model behavior or hosted authority |
| CI, Preview, Production, release/deployment | NOT RUN in this local record; no merge, release, deployment or customer changes |

## Exact commands and evidence

Working directory for each ordinary command is `examples/<example>`. Use the
package manager version above. Every example ran `pnpm install --frozen-lockfile`
and `pnpm type-check`. Every example ran `pnpm test`. All except OAuth
ran `pnpm agent:validate` and `pnpm agent:pack`; OAuth ran `pnpm worker:validate`
and `pnpm worker:pack`. Additional commands:

- Basic: `pnpm build`, then `pnpm test` after strengthening the discovery assertion.
- Code mode: `pnpm mcp:build`, `pnpm test:package`.
- OAuth: `pnpm test` includes `gea agent build` before `vitest run`.

Durable local evidence root:
`/Users/zhuo/orca/reports/opengea-examples-20261019` (not a public CI artifact).
`final-checks-results.json` records each exact executable/argv, cwd, exit code,
duration and log path; `checks.py` serializes the checks using isolated CLI config.
`*-final.log` records their output. `final-inventory.json` enumerates all ten
package manifests, scripts, engines and direct dependencies; `installed-resolution.json`
records installed SDK/Contract/CLI manifests and lock hashes. `*-registry-reverified.json`
and `*-legacy-registry.json` retain official registry versions/peers/dist metadata.

Additional reproducible harness commands, from this evidence root unless noted:

```sh
node cli-protocol.mjs agents-api basic code-mode observational-memory subagent-limits subagents
node cli-boundaries.mjs subagent-limits subagents
node target-contract.mjs
node eval-smoke.mjs
node memory-launcher-probe.mjs
node oauth-vite-probe.mjs
node agents-workflow.mjs
# Follow-up Feishu migration, using its pinned local CLI:
node feishu-migration-native.mjs
# From examples/feishu-channel:
pnpm test
pnpm gea --version
```

Results: `*-cli-protocol.json`, `*-cli-boundaries.json`, `target-contract.json`,
`basic-synthetic-eval.json`, `basic-synthetic-eval-result.json`,
`memory-launcher-probe.json`, `oauth-vite-probe.json`,
`agents-api-synthetic-workflow-final.json`, and `feishu-scope-probe.json`.
Raw `synthetic-provider-*.json` records are artificial model traffic, not customer
inputs. Earlier failed harness attempts remain separate evidence; successful
checks do not retroactively pass those attempts.

## Feishu follow-up evidence

The earlier `matrix.md`, `review-final.md`, registry resolution and 100-test logs
remain the initial snapshot at `a23fbb4c2021a61279ce54e77089f88b21e15988`.
The follow-up does not relabel those logs as reruns of its new head.
`feishu-migration-registry.json` records freshly read official manifests, exports,
peer dependencies and dist integrity. `feishu-migration-resolution.json` records
actual installed manifests, lock SHA-256, CLI version and native binary hashes.
`feishu-migration-checks.json` records exact cwd/argv/exit and the six focused
install/types/test/version/validate/pack logs. `feishu-migration-red.log` and
`feishu-migration-red.test.mjs` preserve the old-package behavioral failure.
`feishu-channel-migration-cli-protocol.json` and its log record the passing native
smoke; `feishu-migration-native.mjs` is its harness. An initial harness assumed the
obsolete `local-user` identity; retained `*-initial.*` artifacts show the real
Project-key service identity, which the corrected harness asserts explicitly.
`feishu-migration-package.json` records package capability/secret/mount checks.
Live WebSocket ingress, card output, durable shared-topic persistence across
actual Feishu senders, hosted environment isolation and migration continuity are
NOT RUN: no live credentials/configuration/messages were authorized.
