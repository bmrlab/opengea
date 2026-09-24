# Subagent concurrency and retained history

A coordinator with `maxConcurrentSubagents: 2` calls a private worker through
ordinary `agent` and `runWait` tools. Real models execute both Agents. The child
has a bounded `pause` tool, so two unfinished children occupy both slots while
the parent attempts a third. The verifier checks actual tool receipts, terminal
Run states and persisted messages; it never trusts the model's final summary.

The example pins public SDK `0.1.260924-alpha.1`. Use published CLI
`0.1.260924-alpha.0` on macOS arm64, the platform used for the current local
validation. SDK installation alone does not update the CLI. See
[VERIFICATION.md](VERIFICATION.md) for local checks and historical hosted results;
the full 140-child matrix has not yet passed end to end.

## Install

Use Node.js 24.16.0 and pnpm 12.1.0. Install the compatible CLI first:

```sh
npm install --global @gea-ai/cli@0.1.260924-alpha.0
```

```sh
cd examples/subagent-limits
pnpm install --frozen-lockfile
pnpm type-check
pnpm test
cp .env.example .env
pnpm agent:validate
pnpm agent:pack
```

`GEA_CLI_BIN` can select a particular compatible executable. Validation and
packing use public packages; no source CLI or node_modules patches are required.
The older CLI `0.1.260920-alpha.1` does not support `maxConcurrentSubagents`.

## Run the matrix

For local testing, start `pnpm dev` and run `pnpm verify:local` in another terminal.
The separate Worker/API ports are 8795/8796. This requires a CLI Runtime that
supports the new Session concurrency protocol and a GEA login for hosted models.

For hosted testing, create a dedicated Studio Project and push this example:

```sh
pnpm gea agent push --json '{"cwd":".","project":"my-project","slug":"opengea-subagent-limits"}'
```

Set `GEA_AGENT_ID` and a Project API key with `chats:read`, `chats:write`, and
`runs:write` for this example. Default verification targets Preview. To accept
Production, deploy this Agent version to Production in Studio and set
`GEA_ENVIRONMENT=production`; pushing alone does not promote it. Then run:

```sh
pnpm verify
```

The verifier creates one fresh parent Session and:

1. Starts two held children and requires the third admission to return
   `subagent_concurrency_limit`, `limit: 2`, `active: 2`, with the actual pending
   Run IDs. Both accepted children must finish.
2. Starts 140 more children in the **same parent Session**, explicitly waiting
   for each before starting the next. Reusable slots and Runs 129–140 must work.
3. Checks the real child pause outputs/identities and every child's terminal
   state. It reads all parent message pages and requires all 142 accepted
   receipts to remain accessible.

These are paid real-model calls, and the full matrix can take many minutes.
The verifier saves partial evidence under `.gea/verification/<id>/report.json`,
never retries a write, and retries only bounded read-only rate limits. After an
uncertain write, inspect the recorded Session/Run before starting another test.
Revoke temporary keys afterwards.

The limit is per parent Session, not per Agent or entire tree. New SDK/new
Sessions use concurrency; old deployed bundles and initialized Sessions keep
the original cumulative cap without migration. Keep the separate
[subagents example](../subagents/README.md) unchanged for old-bundle regression.

This matrix does not yet cover cancellation cleanup, remote admission,
crash recovery, or Studio's separate child-history pagination UI. Reading public
message history is not proof those paths passed.
