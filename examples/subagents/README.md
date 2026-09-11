# Independent subagents

A small arithmetic team that demonstrates how Agent definitions and task calls
fit together. It uses real models and the published Agent SDK; the verification
script can use the local native Runtime or the public hosted Agent HTTP API.

The local real-model checks pass. Hosted Preview currently reproduces a child
invocation HTTP 500; see [the verification record](VERIFICATION.md) for evidence
and the checks that remain blocked.

```text
coordinator                     public entrypoint; may create a self copy
├─ researcher                   automatically discovered private definition
│  └─ calculator                researcher's own private subagent
└─ reviewer                     explicit reference to a second public entrypoint
```

`subagents/researcher/agent.ts` defines a private Agent. It owns its prompt,
model, tools and child directory. `subagents/reviewer.ts` instead declares
`defineAgentReference({ slug: "reviewer", ... })` for `agents/reviewer/agent.ts`.
Both are called with `agent({ target, message })`. The coordinator's explicit
`agentTool()` additionally allows `agent({ message })` to create a self copy.
Each new child has an independent Session and receives only the task message.

The `execution_info` Tool returns the actual Agent, chat and run IDs. The example
uses these and the actual working receipts to check execution isolation.
Private Agents do not become extra public routes or Studio Agent entries.

## Install and validate

Use Node.js 24.16.0 and pnpm 12.1.0:

```sh
cd examples/subagents
pnpm install --frozen-lockfile
pnpm type-check
pnpm test
cp .env.example .env
```

The SDK is pinned to public version `0.1.260911-alpha.0`. Building and running
the example requires the matching **subagent-capable CLI and Worker Runtime**.
The currently published CLI `0.1.260910-alpha.1` predates that support. Until
its successor is published, set `GEA_CLI_BIN` to a compatible local executable;
the optional Runtime override paths are shown in `.env.example`. SDK dependencies
remain public npm packages, with no private workspace links.

```sh
pnpm agent:validate
pnpm agent:pack
```

Both validation and packaging check that the explicitly referenced top-level
Agent exists. Starting local development also generates `.gea/bindings.d.ts`,
which infers valid same-Worker Agent slugs. Run type checking again after that
file is generated.

## Local development

```sh
pnpm gea login
pnpm gea workspace use --json '{"orgSlug":"your-org","workspaceSlug":"default"}'
pnpm dev
```

`agent-dev.json` selects hosted model access through that login; no local model
key is needed. It starts the local native Runtime on port 8793. Change the port
if occupied. The coordinator is `/gea/agents/coordinator/run`; the reviewer is
`/gea/agents/reviewer/run`. The private definitions have no public endpoints.

In a second terminal, run the same acceptance scenarios locally:

```sh
pnpm verify:local
```

The runner posts to the local Agent and reads its Session history. Override
`GEA_LOCAL_AGENT_URL` if you changed the port. Wait for startup/reload to finish
and keep the sources unchanged during verification: calls are pinned to a
deployment. Keep `.gea` to retain local Session state. Stop development with
Ctrl+C. Hosted verification below additionally tests the deployed task host and
automatic parent wakeup through authenticated public history reads.

## Hosted Preview verification

Create a dedicated Studio Project, then push this example:

```sh
pnpm gea agent push --json '{"cwd":".","project":"my-project","slug":"opengea-subagents"}'
```

Copy the coordinator's Preview Agent base URL (without `/run`) into
`GEA_AGENT_URL` in `.env`. Create a Preview Project key with `runs:write`,
`chats:write` (for fresh chats) and `chats:read`, then set `GEA_PROJECT_API_KEY`.
Credentials stay in the Node verification process, and `.env` is excluded from
the Agent archive and Git.

```sh
pnpm verify
```

The runner uses fresh parent chats, random arithmetic operands and markers:

1. Starts a private researcher, a referenced reviewer and a self copy in the
   initial parent turn. The researcher delegates once more to its calculator.
2. Waits for the parent's automatic continuation through authenticated history
   reads. It checks actual receipts, all results, distinct child chat IDs and
   the nested calculator's separate identity. A working receipt is not success.
3. Continues the reviewer using the original agentId. It verifies retained
   marker/value, unchanged child chat identity and a new taskId.
4. Creates another reviewer without agentId. It must have a new handle/chat and
   return null for the first reviewer's private history.

Parent-only markers are checked against the actual outgoing Tool inputs. The
runner never sends the arithmetic answer key to the model. It performs no
automatic request retries and retains partial evidence on failure under
`.gea/verification/<run-id>/report.json`. It makes paid model calls. CI only runs
credential-free type checks and tests of the verifier's failure detection.

## Try it in Playground

Select the coordinator and ask:

> Start three jobs: researcher computes 17 × 19, reviewer computes 23 + 29,
> and a self copy computes 7 × 8. Label them private, review and copy; use batch
> demo. Pass LEAF at the beginning of each child message. End your first turn
> after receiving their working receipts, then summarize their final results.

The first response is `WAITING`; later runs in the same parent chat deliver the
summary. A child can finish while the parent is active, but its result enters a
new parent turn after the current turn ends. This is not in-flight steering.

Each definition chooses its own `maxOutputTokens`. The coordinator and researcher
use 8192; leaf definitions use 4096. A self copy uses the coordinator's settings.
Change these budgets when experimenting with reasoning models.

This example focuses on calls within one Worker. Cross-Worker remote references,
cancellation, approvals, crash recovery and URL deployment upgrades are outside
its acceptance checks. It does not promote Preview to Production.
