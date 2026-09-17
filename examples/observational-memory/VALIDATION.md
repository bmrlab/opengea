# Context verification

## SDK alpha.2 and native summary binding, 2026-09-17

- Public SDK `0.1.260917-alpha.2` and CLI `0.1.260917-alpha.0`; frozen installation, type-check, six Node tests, Agent validation and packaging passed. The test Runtime fixture now includes the SDK's required `ai` capability; the custom strategy still exercises the compatible legacy `model()` path and manual usage accounting. Built-in summaries use the new native AI binding.
- Full real-model local run: `2026-09-17T14-18-35.952Z-02cd9f15`. Same scenario, model IDs, thresholds, prompts and strict scoring as before.

| Strategy             | Recall | Final main input | Total input | Total output | Seconds |
| -------------------- | ------ | ---------------- | ----------- | ------------ | ------- |
| raw                  | 15/15  | 26119            | 200229      | 275          | 47.2    |
| summary              | 15/15  | 6473             | 147835      | 34900        | 597.6   |
| observational-memory | 14/15  | 1987             | 101380      | 11503        | 180.4   |

The unchanged strict recall gate failed only for observations: `blocker` was
`"signed DPA"`, expected `"DPA"` (the question requests the document name without
status). Preserve this failed result; it is not a full-pass comparison. All
three modes restored their projections exactly after Runtime restart and passed
fresh-chat isolation. Three observe calls and one reflection completed; usage
was complete. Final observations input was 92.4% smaller than raw history in
this single synthetic run, not a general quality or cost claim.

The observations application was rebuilt as production-cluster Preview version 5. A separate hosted `summary` conversation completed six turns, including four native summary calls, and recalled its original unique marker. All main/auxiliary usage was present with unique call IDs. Chat: `01a0afcb-7bf3-779f-8232-cc678a440bac`; its temporary Preview key was revoked. No Production promotion was performed. Earlier validation below retains its
original version and scope.

## Agent Core adoption, 2026-09-17

- Public Agent SDK `0.1.260917-alpha.0`; all three definitions now explicitly use `agentCore()`. Frozen installation, TypeScript and all six Node tests passed. Public CLI `0.1.260916-alpha.0` validated and packed the application.
- Real Catalog v2 calls used the matching source CLI/Runtime (GEA `261f19618`, Runtime behavior from #479), with publicly installed SDK packages. The immutable model IDs, prompts, context strategies, thresholds and scoring assertions were unchanged.
- Main model: `creative-reasoning-1.5` through Messages; auxiliary model: `crr-q-flash-20260826` through Completions. This is one synthetic local trial, not a general performance or monetary-savings claim.

Run: `2026-09-17T06-00-48.126Z-b26752e3`.

| Strategy             | Recall | Final main input | Total input including auxiliary | Total output | Seconds |
| -------------------- | ------ | ---------------- | ------------------------------- | ------------ | ------- |
| raw                  | 15/15  | 26119            | 200229                          | 275          | 56.6    |
| summary              | 15/15  | 6614             | 146407                          | 31804        | 784.6   |
| observational-memory | 15/15  | 2193             | 100463                          | 8567         | 257.7   |

All three projections restored exactly after Runtime restart. Observational
memory executed three observation calls and one reflection call, retained all
15 facts and reduced final main input by 91.6% relative to raw history. Provider
usage was complete and model-call IDs were unique. Main loops used Core; auxiliary
context calls retained the existing AI SDK path.

The original full run completed every training and recall call, but stopped at
the final fresh-chat isolation probe: the upstream provider timed out waiting
for response headers after 120 seconds, followed by the runner's 180-second
timeout. Trace `d72ed222098c32394148ee099316ae99` records that failure.
A separate new-chat isolation probe then returned unknown project/owner as null,
passing the unchanged assertion. No original write was replayed and no source
behavior or scoring threshold was changed to get a pass. The original failed
`report.json` and the successful `isolation-recheck.json` remain together under
ignored `.gea/verification/<run-id>/`. All seven acceptance gates are satisfied
across the completed run and this independent recheck. As in prior reports,
isolation probes are excluded from the comparison's usage and latency totals.

No new hosted Preview, Production promotion, or default-engine switch is claimed.
Earlier acceptance records below retain their original scope and versions.

## SDK 0.52 upgrade verification, 2026-09-15

- Public npm Agent SDK `0.1.260915-alpha.0`; frozen dependency installation passed.
- Type checking and all six Node tests passed. The real-model memory comparison was not repeated.
- Agent validation and packaging passed with the locally built CLI from GEA `170cf55f` plus the local Agents API fixes described in [the acceptance record](../agents-api/VERIFICATION.md). No workspace-linked SDK dependencies were used.
- This records local checks. It does not update earlier Preview/Production deployment evidence or claim the new CLI has been published.

## SDK 0.51 upgrade, 2026-09-14

The example now installs public Agent SDK `0.1.260914-alpha.1` and published CLI `0.1.260914-alpha.1`. Frozen installation, TypeScript, all six Node tests, Agent validation and packaging passed. Final validation used the local CLI from GEA `413f2bd83`; the next CLI release is paused. Local execution can explicitly select `GEA_CLI_BIN` and `GEA_CLI_DISTRIBUTION_ROOT`, and new reports include the executable path.

The complete real-model comparison during this upgrade used SDK `0.1.260914-alpha.0`, the local CLI containing the explicit-model-catalog fix, and the native v0.51 Runtime. Run: `2026-09-14T04-33-20.967Z-2c6c6a90`. The alpha.1 change fixes approval continuation; the full comparison was not repeated for that unrelated change.

| Strategy             | Recall | Final main input | All main input | Auxiliary input | Total input | Total output | Seconds |
| -------------------- | ------ | ---------------- | -------------- | --------------- | ----------- | ------------ | ------- |
| raw                  | 15/15  | 26119            | 200229         | 0               | 200229      | 275          | 48.7    |
| summary              | 15/15  | 6282             | 97832          | 47822           | 145654      | 31730        | 603.8   |
| observational-memory | 15/15  | 1945             | 79367          | 18608           | 97975       | 10549        | 235.6   |

All acceptance gates passed: recall, smaller context, exact projection restoration after Runtime restart, fresh-chat isolation, actual observation/reflection execution and complete provider usage. Final main input decreased by 92.6% for observations versus raw history. Main model: `creative-reasoning-1.5`; auxiliary model: `crr-q-flash-20260826`. The catalog supplies zero accounting rates for this token-only local experiment; these are not provider prices or a monetary-savings claim. The earlier report's package CLI field describes the installed package, while this run used an explicit locally built executable.

The original CLI ignored `LLM_MODEL_CATALOG_JSON` in local Creative Reasoning mode, dropping the auxiliary model. GEA PR #440 preserves explicit catalogs. The example now supplies the catalog's required pricing entries and uses the updated context tracing test contract.

Preview version 4, deployment `01a09e5c-48c4-7009-86d5-c989f16643b6`, contains the final public alpha.1 SDK. All three hosted Agents returned `pong` with HTTP 200 and no SSE error after Web v0.51.1 was deployed. All three hosted entrypoints were also rechecked successfully after the production Runtime memory adjustment and sequential Pod replacement. Initial connection failures are not included as successes. The full restart/recall comparison is local evidence; hosted context-state failover and Production promotion were not tested.

## Original local comparison

Run: 2026-09-09T07-34-04.476Z-5c0a5cc2

Models: main=creative-reasoning-1.5; memory=crr-q-flash-20260826. Real API calls, local native Worker Runtime and durable DO storage.

| Strategy             | Recall | Final main input | All main input | Auxiliary input | Total input | Total output | Seconds |
| -------------------- | ------ | ---------------- | -------------- | --------------- | ----------- | ------------ | ------- |
| raw                  | 15/15  | 25388            | 190726         | 0               | 190726      | 324          | 56.2    |
| summary              | 15/15  | 7565             | 93176          | 31408           | 124584      | 19776        | 388.2   |
| observational-memory | 15/15  | 1167             | 70213          | 19222           | 89435       | 11231        | 242.5   |

Final main input reduction: 95.4%. All input columns are provider-reported tokens, not estimates. Total usage includes observation/reflection/summary calls; isolation probes are excluded equally. No USD comparison: provider pricing is not configured.

All three strategies recalled 15/15 fields after correcting the document-name answer key described below. All restored projections matched byte-for-byte after restart, and all fresh-chat probes returned unknown project/owner. Observations executed three observe calls and two reflection calls, with complete usage records.

Observations reduced total reported input (including auxiliary calls) by 53.1%, but took 4.3 times as long as raw history. It is effective context reduction in this fixture, not a demonstrated overall latency or cost win.

## Prompt caching

Main and auxiliary caching (all training and recall calls):

| Strategy                         | Cache read | Cache write | Uncached | Read share of input |
| -------------------------------- | ---------- | ----------- | -------- | ------------------- |
| raw / main                       | 169754     | 20946       | 26       | 89.0%               |
| raw / auxiliary                  | 0          | 0           | 0        | unreported          |
| summary / main                   | 57221      | 35929       | 26       | 61.4%               |
| summary / auxiliary              | 1024       | unreported  | 30384    | 3.3%                |
| observational-memory / main      | 40348      | 29839       | 26       | 57.5%               |
| observational-memory / auxiliary | 0          | unreported  | 19222    | 0.0%                |

At the first observation update (turn 5), main input dropped from 8,589 to 2,708 tokens and cache-read dropped from 6,519 to zero. Turn 6 reused 2,706 cache tokens. Turns 9 and 13 also had zero cache-read when observations changed. The default summary updates similarly missed the changed main prefix. Auxiliary output included 8,642 reasoning tokens for observations and 12,818 for default summary.

## Reproduction and scope

Run `pnpm verify` with the setup in [README.md](README.md). All model calls in this report used the real Creative Reasoning API and the native local Worker Runtime; these are not mock-model scores. At the time of this original comparison, the context changes had not been published to npm or deployed to Studio. The separate release verification below does not replace these historical scores.

- SDK and CLI source: GEA `3875934fe63d802d11094eeadb47cedb1b2691b6`, the context implementation merged through PR #394.
- Native Runtime source: GEA `fa355c55835300028a5ada0b0fe50b4f6d0bb7f0`.
- Main model: `creative-reasoning-1.5`; auxiliary model: `crr-q-flash-20260826`, selected through independent local catalog aliases.
- Default summary: 8,000-token trigger, 3 retained message groups, 2,000 max output tokens. The SDK stock trigger remains 64,000; this is a tuned control.
- Observations: observe after 8 messages; reflect at 1,600 characters; 2,000 max output tokens per call. Reflection is a condensation request, not a hard character cap.
- Each strategy receives the same 12 synthetic updates and question, with fresh chat IDs. Runtime restarts immediately before each first recall. A separate fresh chat probes isolation. Isolation calls and process startup/restart time are excluded equally from usage and latency totals.
- The original run wrote per-call responses, persisted projections, cache details and local tarball SHA256 values to ignored `.gea/verification/<run-id>/report.json`. This result summary was recovered from the original recorded output after an accidental local directory deletion; the complete raw report and native state were not recovered. The historical values below have not been replaced by a new model run.

## What this establishes

The custom context hooks can maintain chat-scoped DO memory with a separate model, record observe/reflection usage, replace the model projection, and continue after a native Runtime restart. Node tests cover atomic revision checks and recovering a committed memory candidate before projection persistence. This experiment does not exercise hosted deployment, cross-process model-call replay, long tool chains, or general memory quality.

The fixture intentionally mixes durable facts with explicitly disposable diagnostics. It checks exact identifiers, corrections, rejected proposals and unknown facts. This is a functional experiment on one synthetic conversation, not a representative memory-quality benchmark.

## Reading the cache and latency numbers

The native Anthropic adapter adds explicit prompt-cache markers. Stable raw history can reuse a large prefix. Replacing an observations or summary prefix invalidates that prefix; subsequent unchanged turns can reuse the new one. This recipe rewrites observations on an update, so it does not preserve an append-only observation prefix across updates.

Cache read share alone is not a cost metric. Compare absolute read/write/uncached tokens, auxiliary input, auxiliary output and latency. The auxiliary provider reports cache-read counters but not cache-write counters; missing values stay unknown. Token totals use each provider's tokenizer. There is no price configuration and no USD-savings claim.

Auxiliary usage includes reported reasoning tokens. The provider returned more total output tokens than the requested `maxOutputTokens` in some calls because of additional reasoning; this report uses actual usage rather than treating the requested output limit as a billing bound. Caches can be shared across identical prefixes and expire, so order and cache warmth affect this single trial. Use `pnpm verify --order observational-memory,summary,raw` for a separate rotated-order trial before generalizing performance.

## Trial history and scoring

Exploratory runs were kept separate from the formal comparison. One run used an invalid `auto` gateway target; another was interrupted after revealing that the 3,500-token summary trigger caused repeated compaction because the retained context already exceeded that threshold. Neither is used as the formal comparison. Reports are written under `.gea` so the CLI source watcher does not reload the Agent when progress is saved.

The recall prompt requests the shortest atomic field value and asks for the blocker document name without status. Its answer key must therefore use `DPA`, not `signed DPA`. The original report retained answers and prior scoring when correcting this oracle mismatch; no model response or usage was modified. The recovered summary preserves that correction and the recorded aggregate results. JSON code fences are recorded as a formatting deviation separately from fact accuracy. No semantic LLM judge or fuzzy matching is used.

## Local checks

Local tarball setup, TypeScript, six Node behavior tests, CLI `agent validate` and `agent pack` passed. The package archive contains only Agent sources, definitions and bundled runtime; local credentials, tarballs, traces and native state are excluded.

## Published SDK and Studio Preview verification

A separate small smoke test on 2026-09-09 used the published Agent SDK and Contract `0.1.260909-alpha.0`, together with the locally built CLI from GEA `3875934fe63d802d11094eeadb47cedb1b2691b6`. CLI publication was still running when the Preview was uploaded. All dependencies in the example resolve from npm; no local SDK source or tarball is needed.

The CLI validated and packed all three Agents, then uploaded them into the `Context Example` Studio Project in Preview. The Worker deployment was ready, the three Agent Preview versions were active, and no Production version was promoted. The immutable package snapshot was `sha256:663863ac0e73d8dd71bf7a1163120c4a5dc87c34b67a72239c5bf0c56108c945`.

- Observations received five short synthetic project updates in one hosted chat. Turn 5 executed one `observe` call with `crr-q-flash-20260826`; the main model remained `creative-reasoning-1.5`.
- Turn 6 recalled all 10 requested fields, including corrected budget/date, rejected region/retention proposals and an unknown discount. The answer was wrapped in a JSON code fence, recorded separately as a formatting deviation.
- A fresh observations chat returned `null` for both project and owner. Raw and summary each completed one independent Preview smoke call. These calls did not reach the default-summary or reflection thresholds.
- Studio persisted all 10 model-call records (9 main calls and 1 observe call), with unique call IDs, completed statuses and provider usage: 3,389 input and 845 output tokens. The observe call accounted for 366 input and 620 output tokens, including 508 reasoning tokens.
- Cache-read counters were zero throughout this short smoke test. Auxiliary cache-write remained unreported. This verifies accounting visibility; it does not reproduce the original long-prefix cache comparison.

These are real hosted calls through the Studio run path using the local CLI. The original 12-turn / 15-field comparison was not rerun. Hosted restart/failover and broad memory-quality claims remain outside this check.

After that hosted check, CLI `0.1.260909-alpha.0` finished publication. The example now pins that same public SDK/CLI version. The previous CLI `0.1.260908-alpha.0` rejects the new `context` snapshot field, so it is not compatible with this example.

With the released CLI, a clean copy installed with `--frozen-lockfile`, passed TypeScript and all six tests, and completed `agent validate` / `agent pack`. Two independent directories produced the same archive SHA256 (`e62accae76ffc7ed7d825a33d3456342d44319d6d3abd1047305598c0093bab9`). Native startup, stop and restart passed; stopping the example closed its listener. The runner starts the installed native CLI directly so terminating a Node launcher cannot leave the Runtime running.

The released CLI then uploaded Preview revision 2 and continued the original hosted chat on the new deployment. All seven queried facts remained correct, with one completed main-model record (658 input / 98 output tokens). This extra continuation is separate from the 10-call smoke totals above. Production remained unpromoted.
