# Agents API: prepare, then run

An Agent and a plain Node.js HTTP caller using the same `/api/v1` flow locally and
in cloud Preview. The SDK defines the Agent; the caller uses `fetch` directly.

```text
Create Session → upload File + prepare Session Computer → create Run
    → poll Run → read output Artifact → reuse its ID → read message history
```

The `savePreparedReport` tool combines an uploaded text file with
`/workspace/setup.txt` and saves a managed output. Verification checks the saved
contents, reuses the output in another Session, and checks paginated history.
Preparing a Session does not call the model.

## Install and run locally

Use Node **24.16.0**, pnpm **12.1.0** and public Agent SDK
**0.1.260915-alpha.0** (pinned in the lockfile):

```bash
pnpm install --frozen-lockfile
cp .env.example .env
pnpm type-check
```

Set `CREATIVE_REASONING_API_KEY` in `.env`. Local execution calls an external
model provider; it does not imply offline inference.

Install public CLI **0.1.260915-alpha.0**, which includes the local Agents API
and its matching Worker Runtime for macOS ARM64 and Windows x64:

```bash
pnpm add -g @gea-ai/cli@0.1.260915-alpha.0
pnpm agent:validate
pnpm agent:pack
pnpm dev
```

For a local CLI build, the launcher also accepts `GEA_CLI_BIN=/absolute/path/to/gea`.
An unpackaged build can additionally set `GEA_WORKER_RUNTIME_BINARY` and
`WORKER_RUNTIME_SYSTEM_WORKER_ROOT` to its matching Runtime and system workers.
The published CLI needs none of these overrides. SDK dependencies always come from npm.

`agent-dev.json` selects Worker port **8794** and Agents API port **8795**. Choose
free ports if either is occupied, and update `GEA_AGENTS_API_URL` to match
`apiPort`. In a second terminal, from this directory:

```bash
pnpm verify
```

The script makes real model calls and creates two Sessions and three files. It
saves resource IDs in ignored `.gea/verification.json`. Resources remain
available for inspection. Restart `pnpm dev` from the same directory to retain
local IDs, history and files; deleting `.gea` resets development state.

Source hot reload retains a prepared Computer. Restarting the whole CLI process
expires that execution environment: create a new Session before preparing or
running its Computer again. History and managed files remain readable. Durable
filesystem storage does not promise to resume the same live execution environment.

## Use the same caller against Preview

Publish this Agent to the target project's Preview and grant your GEA application
access. Obtain a **user OAuth access token** through the flow in
[oauth-app](../oauth-app/). Set caller configuration in `.env`:

```dotenv
GEA_AGENTS_API_URL=https://musegea.com/api/v1
GEA_ENVIRONMENT=preview
GEA_ACCESS_TOKEN=your-user-oauth-access-token
GEA_AGENT_ID=the-agent-uuid-returned-by-the-cloud-agents-api
```

Run `pnpm verify` without starting a local Agent. Cloud mode adds the Bearer token
and selects `preview` when listing Agents and creating Sessions. Local mode uses
`environment: "local"` and needs no token. Production uses the same cloud URL
with `environment: "production"`. IDs and stored files belong to each service;
a local Session ID cannot address a cloud Session.

Supply a current access token for this script; refresh-token handling belongs
to the OAuth application example. Tokens stay on the calling server. A Project
API Key for a Worker's custom routes is a different credential and cannot replace
the user OAuth token here.

## HTTP contract illustrated

| Action                   | Request                                                                                                   |
| ------------------------ | --------------------------------------------------------------------------------------------------------- |
| Discover Agent IDs       | `GET /agents?environment=local` (or `preview`)                                                            |
| Create empty Session     | `POST /sessions` with `agent_id`, `environment`, optional `title`                                         |
| Prepare or edit Computer | `POST /sessions/{id}/computer` with `operation: "prepare"`, `"write-file"`, `"read-file"`, `"exec"`, etc. |
| Upload input             | `POST /files`, multipart field `file`                                                                     |
| Start execution          | `POST /sessions/{id}/runs` with `input`, `stream: false`                                                  |
| Inspect execution        | `GET /runs/{id}`                                                                                          |
| List outputs             | `GET /sessions/{id}/artifacts?run_id=...`                                                                 |
| Download bytes           | `GET /files/{id}/content` or `GET /artifacts/{id}/content`                                                |
| Read history             | `GET /sessions/{id}/messages?limit=1`, then follow `next_cursor`                                          |
| Inspect Connections      | `GET /agents/{id}/connections?environment=local` (or `preview`)                                           |

`file_id` and `artifact_id` identify the same managed file. Use `file_id` in new
message parts: `{ "type": "file", "file_id": "..." }`. Uploads do not require
Agent/Session IDs and do not automatically appear in Computer. `/files` lists
managed files; `/artifacts` and Session artifact lists contain generated outputs.

For streaming, set `stream: true`, consume the AI SDK UI-message SSE stream, and
retain `x-gea-agent-session-id` / `x-gea-agent-run-id`. Reconnect with
`GET /runs/{id}/stream`; closing a stream does not cancel execution. Explicitly
cancel with `POST /runs/{id}/cancel`. [oauth-app](../oauth-app/) implements
streaming chat, reconnection and cancellation.

This Agent declares no Connectors, so its Connections list is empty. See
[Ask Muse](../ask-muse/) for OAuth Connector declarations and the
[Connections reference](https://musegea.com/developers/agent-api-connections)
for authorization, revision-checked updates and disconnects. Credentials are
stored per service and are not copied when switching URLs.

[Local Agents API](https://musegea.com/developers/agent-api-local) ·
[Files](https://musegea.com/developers/agent-api-artifacts) ·
[Computer](https://musegea.com/developers/agent-api-computer) ·
[Verification](VERIFICATION.md)
