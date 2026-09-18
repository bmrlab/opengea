# Independent subagents

An arithmetic team using public `@gea-ai/agent-sdk@0.1.260918-alpha.0` and
`agentCore()`. Each child has its own Session. Every invocation returns a
`{ sessionId, runId }` receipt; Agent IDs identify definitions, not conversations.

```text
coordinator                     public entrypoint; can create a self copy
├─ researcher                   private definition
│  └─ calculator                researcher's private child
└─ reviewer                     another public entrypoint in this Worker
```

The coordinator calls `agent({ target, message, sessionId? })`. Omit `target`
for a self copy, or supply the returned `sessionId` to continue a child with a
new Run and retained history. `run_wait({ runIds })` waits for particular Runs.
Ending the model turn while children are active also waits and resumes the
parent automatically. The logical parent Run ID stays the same through either
kind of wait. Completion is automatic; there is no Task API or progress tool.

The reviewer also declares `chatSend()`. Its model-facing `chat_send` tool
currently calls the Session identifier `chatId`; pass the peer's `sessionId`
there. A follow-up message to an idle Session starts a new independent Run.
Session access remains authorized; knowing an ID alone does not grant access.

## Install and validate

Use Node.js 24.16.0 and pnpm 12.1.0:

```sh
cd examples/subagents
pnpm install --frozen-lockfile
pnpm type-check
pnpm test
cp .env.example .env
```

This SDK requires the Session/Run-capable CLI and matching server/Runtime from
GEA v0.54. The CLI release is pending; select a compatible local CLI executable
with `GEA_CLI_BIN`. The previous published `0.1.260917-alpha.0` CLI still speaks
the retired Task protocol and is insufficient for this example.

```sh
pnpm agent:validate
pnpm agent:pack
pnpm gea login
pnpm gea workspace use --json '{"orgSlug":"your-org","workspaceSlug":"default"}'
pnpm dev
```

Development uses hosted models through your GEA login. The Worker uses port
8793; `agent-dev.json` pins the separate Agents API to port 8794. Change both
configuration and `GEA_LOCAL_AGENTS_API_URL` if that port is occupied.
Private definitions have no public Worker entrypoints.

In another terminal, run:

```sh
pnpm verify:local
```

The verifier uses ordinary HTTP `/api/v1` Sessions/Runs for both local and hosted
execution. Keep sources unchanged while it runs: existing Sessions retain their
exact deployment. `.gea` holds local state and ignored verification reports.

## Hosted Preview verification

Push to a dedicated Studio Project:

```sh
pnpm gea agent push --json '{"cwd":".","project":"my-project","slug":"opengea-subagents"}'
```

Set `GEA_AGENTS_API_URL` to the service's `/api/v1` root and `GEA_AGENT_ID` to the
coordinator's stable public ID (optional when its name is unique). Create a
Project API key granting both coordinator and reviewer `runs:write`,
`chats:write`, and `chats:read`, and set `GEA_PROJECT_API_KEY`. Keys are not
bound to an environment; the verifier explicitly selects Preview.
Credentials stay in the Node process. Revoke temporary keys after verification.

```sh
pnpm verify
```

The strict verifier uses fresh parent Sessions, random arithmetic and markers:

1. Starts researcher, reviewer and a self copy before waiting. The researcher
   calls its calculator. It verifies all results, independent Sessions and exact
   Run receipts, including the nested calculator's complete identity.
2. Reads Session state, history and each child Run through Agents API. The
   parent keeps one Run ID through implicit joining and explicit `run_wait`.
3. Continues the reviewer with the same Session and a new Run, retaining its
   private marker/value. A fresh reviewer must know neither.
4. Asks the reviewer to send a message to its sibling's Session. It checks the
   actual `chat_send` call, delivery to that Session and the new finished Run.

Parent-only markers must never appear in child inputs or history. Accepted
receipts are not completion. The verifier preserves partial evidence under
`.gea/verification/<id>/report.json` and never retries writes. Read-only 429
responses honor the server's retry delay. These are paid real-model calls.
CI checks types and the verifier's strict failure detection without credentials.

See [VERIFICATION.md](VERIFICATION.md) for exact versions, successes and remaining
failures. Historical pass records do not imply the current release has passed.
Remote references, cancellation, approval and crash recovery are outside this
example's real-model matrix. Nothing here promotes Preview to Production.
