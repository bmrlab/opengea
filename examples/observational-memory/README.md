# Context management with observational memory

An Agent that maintains observations in a chat-scoped Durable Object, plus a real-model comparison against uncompressed history and the SDK's default summarizer. It demonstrates the public `prepareStep`, `onStepEnd`, `onEnd`, `model`, `recordUsage`, `updateMessages` and `waitUntil` APIs.

Compare three context configurations: disabled compression (`context: false`), the configurable SDK default (`defaultContext`), and a custom observation/reflection strategy with chat-scoped memory.

See [the recorded local verification](VALIDATION.md) for the original 15-field recall, token, latency, restart and prompt-cache results.

## Setup

Use Node 24.16.0 and pnpm 12.1.0. The example pins published packages: Agent SDK `0.1.260909-alpha.0` and CLI `0.1.260909-alpha.0`. The SDK brings the matching Contract version. No local GEA checkout or SDK tarballs are required.

```sh
pnpm install --frozen-lockfile
cp .env.example .env
```

Set `CREATIVE_REASONING_API_KEY` in `.env`. `GEA_ENV_FILE` optionally points to an existing credentials file. The installed CLI supplies its native Runtime and system workers. Running the Agent requires macOS Apple Silicon or Windows x64, the platforms supported by this CLI release; type checking and the Node tests also work on Linux.

`models.ts` selects independent public model IDs for the main Agent and memory calls: `creative-reasoning-1.5` and `crr-q-flash-20260826`. Edit that file to change the immutable model selection for both local and hosted execution. The same model must be available to the local API key and the hosted model catalog. `.env` values `MAIN_MODEL` and `MEMORY_MODEL` optionally override the local gateway targets for experiments; they do not change a Studio deployment. `auto` is an SDK routing policy, not a gateway target. Model-call records retain model identity and actual provider usage.

```sh
pnpm type-check
pnpm test
pnpm agent:validate
pnpm agent:pack
pnpm dev
```

The default URL is `http://127.0.0.1:8791/gea/agents/run`. Send `{ "chatId": "my-project", "message": "..." }` as a JSON POST and consume the AI SDK SSE stream. Reuse `chatId` to continue. Native DO data lives in `.gea/agent-dev-state` and survives process restarts. The local proxy supplies a trusted development identity. Hosted HTTP authentication remains protected by default.

The two controls are `/gea/agents/raw/run` and `/gea/agents/summary/run`. All three use identical assistant instructions and the same main model. They have separate AgentSession namespaces.

## Verify with real models

```sh
pnpm verify
pnpm verify --order observational-memory,summary,raw
```

The runner starts an isolated loopback port, submits the same 12 synthetic project updates to each strategy, restarts the native Runtime before each strategy's first recall query, and checks 15 facts. Exact field values are scored separately from JSON versus Markdown-wrapped JSON formatting. The corpus includes early identifiers, corrected dates/budgets/retention, rejected proposals, unknown facts and distracting quoted logs. It also probes a fresh chat for leakage. The answer key remains in the runner; it is never included in model instructions or messages.

Results are written incrementally beneath `.gea/verification/<run-id>/`; `summary.md` contains the comparison and `report.json` retains each model call, usage, response and stored projection. Writing inside `.gea` keeps the dev watcher's source reloads out of the experiment. Every run uses fresh chat IDs; no existing chat state is deleted. Provider failures end the run and retain partial evidence; the runner does not replay an unknown model-call outcome.

The gate requires all observation recall facts, an input reduction of at least 40% on the recall call, identical context after restart, fresh-chat isolation, actual observe/reflection calls and complete provider usage. A gate failure is an experiment result, not a reason to hide the failing report. Quality and token usage are reported for all three strategies.

Prompt caching is measured separately for the main and auxiliary calls: cache-read, cache-write, uncached tokens and cache-read share of total input. Missing provider counters remain unknown. The native Anthropic model adapter inserts cache markers. Inspect the per-turn counters around each observation commit; shorter prompts can reduce total input while invalidating reusable prefix tokens. Latency is not used as evidence of a cache hit.

The summary control uses an **8,000-token trigger and 3 retained groups**, lowered from the SDK defaults to exercise compaction with a short corpus. The observations strategy uses 8 messages and a 1,600-character reflection trigger. These are demonstration settings, not a universal tuning recommendation. This synthetic local test does not establish general memory quality, hosted authorization, billing or failover. Provider caches can be shared across identical prefixes and may expire; run multiple trials and rotate strategy order before drawing performance conclusions.

## Publish to Studio Preview

Create a Studio Project and select the intended workspace with `gea login` and `gea workspace use`. From this example directory:

```sh
pnpm exec gea agent push --json '{"cwd":".","project":"my-project","slug":"opengea-context"}'
```

Replace `my-project` with your Studio Project slug. Push registers all three Agents in one Worker application and updates Preview. In Studio, select `observational-memory`, `raw`, or `summary` and start a Preview Playground chat. Continue in the same chat to exercise memory updates. Local `.env` files and API keys are not uploaded; hosted model calls use the platform gateway. Promote the validated Preview version explicitly when you want Production.

## Memory contract

`context/memory.ts` owns only observations, a revision and the exact covered message-prefix hash. It compares revisions and commits memory atomically. The strategy first commits observations, then replaces the matching prefix in the AgentSession projection. The current user turn and matching tool results remain raw. A changed prefix cannot be deleted by a stale candidate. A crash between memory commit and projection update can reapply the committed result after reopening.

`prepareStep` activates committed memory or performs the first update. `onStepEnd` may precompute memory in registered invocation-scoped work; `onEnd` applies the completed candidate. The SDK drains that work and its usage before the Run finishes. Each observe/reflection call uses its own model, cancellation signal and usage record. This is not a durable background LLM scheduler.

Dependencies and the lockfile are local to this example. Model credentials, native state and generated verification reports are ignored by Git. CI installs only public dependencies and runs type checking and Node tests without model credentials; `pnpm verify` makes paid API calls and is run explicitly.
