# OAuth app · a complete MuseDAM Worker

See [SDK upgrade verification](../VERIFICATION-261025.md) for current local checks and hosted acceptance limits.

A **single GEA Worker** containing a TanStack Start application and its MuseDAM
Agent. It includes GEA user OAuth, per-user MuseDAM connection setup, a full-screen
AI Elements chat, Markdown, attachments, saved conversations, stream recovery,
cancellation and generated Artifact downloads.

After a confirmed stream completion, chat input is available immediately. Conversation
navigation and generated files refresh in the background without rereading or replacing
the streamed answer. Starting another turn or switching conversations cancels stale
refreshes. An interrupted stream remains an error and can be recovered with Restore
conversation; a terminal replay returning 204 still reloads its saved state.

SQLite Durable Objects store encrypted app sessions. **No `DATABASE_URL`, external
database or second Agent deployment is needed.**

```text
Browser ── app cookie ── one Worker
                         ├─ TanStack Start pages + backend
                         ├─ SQLite OAuth sessions
                         └─ MuseDAMChat Agent + Connector

App backend ── user OAuth ── GEA Agents API ── this Worker's Agent
                                                   └─ user's MuseDAM connection
```

In hosted mode, the backend calls the public Agents API with the signed-in user's token.
GEA authorizes the application, tenant and user before invoking the bundled Agent.
Colocation does not bypass authorization. GEA manages tenant installation copies
of the published bundle; developers build and deploy one source Worker. Tokens
and Connector credentials never reach browser JavaScript.

## Prerequisites

- Node **24.16.0**, pnpm **10.30.3**, and the SDK/CLI composition update described below.
- A GEA deployment supporting Worker cookies, managed environment variables,
  SQLite Durable Objects, stable Worker namespaces and the public Agents API.
- The updated CLI includes `@gea-ai/cli/vite`, Agent application build support
  and the native development Runtime.
  Keep the declared environment variables and stable Worker namespaces.
- A Studio Project with OAuth enabled.
- A MuseDAM OAuth client registered for GEA's Connector callback.

The example pins published SDK `0.1.261025-alpha.2` and CLI `0.2.261026-alpha.2`. `defineAgent`
owns the Agent's instructions and Connector, and `defineWorker` registers that
ordinary definition together with the web Fetch handler. No package wrapper is
needed. This CLI release ships only macOS arm64; Windows and Linux native Runtime
are not verified for this composition.

`pnpm build` runs `gea agent build`: Vite compiles the web application, then the
CLI bundles its registered Agents and runtime dependencies into `dist/worker`. Native GEA Worker Runtime executes
application routes, Agent code and SQLite in development and tests. There is no
Miniflare, Wrangler or Cloudflare Vite plugin dependency. `@cloudflare/workers-types`
is compile-time typing; `cloudflare:workers` is a Runtime-provided compatibility
module. See [verification](VERIFICATION.md) for the checked boundaries.

The former Vercel target is retired. This directory disables automatic Git
deployments with Vercel's
[`git.deploymentEnabled`](https://vercel.com/docs/project-configuration/git-configuration)
setting; it does not delete any existing Vercel deployment.

## Project layout

```text
agents/musedam-chat/       Agent instructions, definition and MuseDAM Connector
src/                      TanStack Start routes and chat UI
server/                   OAuth, public Agents API proxy and SQLite objects
worker.ts                 Explicit Agent registration + web Fetch + SQLite exports
gea.worker.json           Build command/output, environment and SQLite bindings
dist/server/              Intermediate Vite module
dist/worker/              Complete runnable Worker + manifest
dist/client/              Static assets included in the same Worker
```

`worker.ts` uses SDK `defineWorker` to register `musedam-chat` and the TanStack
Start Fetch handler. The CLI reads that registration and packages it with the
assets. Only trusted Agents API dispatch can execute `/gea/agents/*`; other
requests reach the web application. Authentication is owned by the Agents API.

`gea.worker.json` declares the build command and output. The source Worker imports
source modules, never `dist`. `geaWorker()` from `@gea-ai/cli/vite` owns Vite build
settings and the native Runtime dev connection. No declaration shim or separate
Agent project input file is needed.

## 1. Install and build

```sh
cd examples/oauth-app
pnpm install
pnpm build
pnpm type-check
pnpm worker:validate
pnpm worker:pack
```

Agent validation, packing and deployment run the configured web build automatically. Neither build nor type-check
requires real OAuth credentials. One root lockfile covers both the app and Agent.

## 2. Deploy one Worker to Preview

Sign in with GEA CLI and select the intended organization and Workspace. Create
the Studio Project first, then run from this directory:

```sh
pnpm worker:deploy --json '{"cwd":".","project":"my-project","slug":"oauth-musedam-app"}'
```

This creates one Worker containing the `musedam-chat` Agent and the web app.
Use the stable browser URL returned by Studio as `APP_ORIGIN`. Keep the same
Worker on subsequent deployments so its SQLite namespaces remain stable.

The operator configures a separate HTTPS application origin (for example
`https://apps.example.net`) with wildcard DNS/TLS and `WORKER_APP_BASE_URL`.
It must be distinct from GEA's `APP_BASE_URL` and tenant domains. This is a
platform setting, not an application variable. Register the exact Worker callback
host, not a wildcard. The testing hostname is intentionally not included here.

## 3. Configure GEA OAuth and the Agent

1. In Studio → Applications create an **independent application**, enable external
   OAuth, and register `<APP_ORIGIN>/auth/callback`. Select `openid`, `profile`,
   `offline_access` and `agents:invoke`.
2. Link this Worker's MuseDAMChat Agent to that application and publish its
   Preview release. The app discovers the authorized Agent via
   `GET /api/v1/agents`; no hard-coded Agent ID is required.
3. In the consuming organization, authorize the application and scopes for
   Preview under **Agent installations → Application authorizations**. The
   signing-in user needs active membership and access to the installation.
4. Set these **Worker environment variables** for Preview:

| Variable               | Value                                          |
| ---------------------- | ---------------------------------------------- |
| `APP_ORIGIN`           | Exact HTTPS app origin, without trailing slash |
| `OAUTH_ISSUER_URL`     | GEA origin, e.g. `https://musegea.com`         |
| `OAUTH_CLIENT_ID`      | The independent application's OAuth client ID  |
| `OAUTH_CLIENT_SECRET`  | Its client secret; mark secret                 |
| `TOKEN_ENCRYPTION_KEY` | Random 32-byte base64 key; mark secret         |
| `AGENT_ENVIRONMENT`    | `preview` or `production`                      |

Generate the encryption key locally:

```sh
node -e 'console.log(require("node:crypto").randomBytes(32).toString("base64"))'
```

Configure `MUSEDAM_MCP_CLIENT_ID` for the **Agent** in the same environment.
Use the MuseDAM client registered for your deployment (the example value is
`muse-mcp`). Register this callback with MuseDAM:

```text
<GEA app base URL>/api/agent-connectors/oauth/callback
```

GEA user sign-in and MuseDAM Connector authorization are separate flows. The
latter stores the current user's Connector credentials in GEA. Playground or
publisher connections do not replace the consuming user's connection. Tenant
installation overrides take precedence over publisher defaults.

For Production, promote the tested Worker/Agent version and separately configure
its origin, OAuth registration, variables and tenant authorization. Publishing
the website alone does not grant access to its Agent.

## 4. Use the app

- **Continue with GEA** signs in and selects an eligible organization.
- The page checks the current user's MuseDAM connection through the Agents API.
  **Send** stays disabled until connected; lookup errors remain errors.
- **Connect MuseDAM** opens authorization without creating a Session or Run.
  Return afterward; the page rechecks on visibility change, or use **Check connection**.
- Attach files, optionally add text and send. File-only messages work. Uploads
  prepare an empty Session and use GEA-managed file IDs with exact multipart bytes.
- History, restore/reconnect, explicit stop and Artifact downloads use the same
  user's OAuth authorization. Uncertain Run POSTs are never automatically retried.

Chat fills the viewport with an independent conversation scroll area and anchored
composer. AI Elements supplies Markdown, tool/reasoning details, attachment
previews, copy controls and prompt input. Desktop navigation collapses; mobile
uses a drawer. Enter sends and Shift+Enter inserts a newline.

Each message allows **10 files, up to 4 MiB each**. Files live in GEA, not app
SQLite. Removing a draft reference does not delete the uploaded file. Unsent
drafts are not restored on reload. Larger uploads via upload grants, interactive
tool approvals and inline document viewers are outside this example.

## Local development and tests

Local Agent execution uses the same browser OAuth login and per-user backend
bearer as hosted execution. It uses the published CLI `0.2.261026-alpha.2`;
the older `0.2.261019-alpha.1` targeted a reserved legacy API port and failed
discovery. Current Vite/native consumer checks are recorded in VERIFICATION.md.
Do not repair OAuth with a Project Key: that selects service authority rather
than the signed-in user.

`pnpm dev` starts Vite on `http://127.0.0.1:4000` and the native local Agent Runtime.
Configure the server-only OAuth values in `.dev.vars.example`, with the exact
`APP_ORIGIN/auth/callback` registered for your existing OAuth client. Set
`GEA_LOCAL_OAUTH_CLIENT_ID` to the same client ID and `GEA_LOCAL_OAUTH_BASE_URL`
to the same issuer as `OAUTH_ISSUER_URL`; these configure the CLI-owned App Server's
existing live production verifier. No additional grant or service key is implied.

```sh
cp .dev.vars.example .dev.vars
# Fill server OAuth configuration and matching local verifier issuer/client.
pnpm dev
```

The backend receives the actual `LOCAL_AGENTS_API_URL` from the repaired CLI.
Do not hard-code its transient loopback port. OAuth client secrets, encryption
keys and user access/refresh tokens stay in server bindings and encrypted SQLite;
never use `VITE_*` variables or return them in browser JSON. Anonymous requests,
expired/revoked tokens and verification failures do not fall back to `local-user`
or a Project Key. Sign out and revoke works in local mode too.

Local Sessions and resources retain the verified issuer/client/user ownership.
Agent execution has the verified namespaced user principal, but uses local
organization/workspace identities. Production organization/application/installation
are checked by the issuer but are not carried into the local runtime projection;
this is developer-local execution, not full hosted tenant authorization parity.
**Remaining local MuseDAM blocker:** the example currently requests
`openid profile offline_access agents:invoke`, while the local API separately
requires `connections:read`/`connections:write`. The connection gate therefore
fails closed with the current grants. Completing local MuseDAM chat needs an
explicit scope/authorization contract decision; this change neither expands the
requested grants nor substitutes service authority. Hosted OAuth behavior is
unchanged. MuseDAM connection credentials remain local and separate from hosted
connections. Local execution also does not mean an offline
model: normal dev uses the configured CLI provider; tests use synthetic providers.

The pinned CLI is verified without overrides on macOS arm64. To test a different matching installation, set:

```sh
export GEA_CLI_BINARY=/path/to/gea-darwin-arm64
export GEA_WORKER_RUNTIME_BINARY=/path/to/gea-worker-runtime
export WORKER_RUNTIME_SYSTEM_WORKER_ROOT=/path/to/system-workers
pnpm dev
```

Without overrides, tools locate the native binaries bundled with `@gea-ai/cli`.
The pinned release supplies both application development and the Runtime for tests.
Other platforms need matching explicit binaries.

Vite fronts the application, and the CLI runs a plain Vite production build before
each source reload. Successful builds replace the Worker and trigger a full-page
reload; React component state is not retained. Failed builds keep the previous
Worker. SQLite state survives reloads and restarts. Runtime state is under `.gea`;
credential stores and local config are excluded from git. Vite and the local API
bind loopback. For another port, use `pnpm dev --port <port>` and update `APP_ORIGIN`.

To exercise hosted OAuth from the same local app, set `AGENT_ENVIRONMENT=preview`
(or `production`) and fill in the OAuth settings and encryption key in `.dev.vars`.
Use a separate localhost OAuth client with the exact app callback. In this mode,
web chat calls the **hosted** Agents API; the co-running local Agent is available
through the CLI's printed local API URL. Hosted deployments default to production
OAuth mode and cannot use local API mode on a public app origin.

```sh
pnpm test        # build + native Runtime SQLite/HTTP and message rendering tests
pnpm type-check
```

Tests always run on GEA Worker Runtime, using the published CLI's bundled Runtime
by default. HTTP fixtures simulate external APIs; real-service authorization and
chat acceptance are recorded separately. Runtime overrides above also apply to
tests. `GEA_TEST_WORKER_DIR` selects an extracted combined Agent artifact.

## SDK upgrades and existing conversations

The Rust cloud Agents API requires the Worker transport introduced in SDK
`0.1.260916-alpha.1` for stream reconnection and Worker-observed cancellation.
After upgrading the dependency, rebuild and redeploy the Agent Worker and publish
the matching Preview release. Updating only the API service does not update SDK
code already bundled in a Worker. Validate with a new Run: older Runs lack the
per-Run event boundaries needed by the new replay transport.

## Session and deployment guarantees

`LoginFlow` holds one-time, browser-bound S256 PKCE state. `OAuthSession` stores
AES-GCM-encrypted tokens with serialized refresh/logout; ambiguous refreshes are
not retried, and failed revocation leaves logout retryable while API access stops.
`ConversationRuns` remembers the last Run per Session for recovery. GEA owns
conversation history and authorizes all reads.

All three use stable `namespace: "worker"` bindings. Object identities also include
origin, OAuth issuer/client and Agent environment, isolating Preview and Production.
Keep Worker/class/binding names and encryption keys stable across redeployments.
Changing these identities requires users to sign in again. PostgreSQL sessions
from the old Next.js example are not migrated.

App cookies are host-only, HttpOnly and SameSite=Lax, with Secure on HTTPS. The
`GEA_` environment prefix is reserved. Local `.dev.vars` and secrets are excluded from deployment output. Managed configuration
is passed through internal RPC per operation because DO events do not receive
request-scoped secrets. No public endpoint exposes these internal objects.

[Agents API guide](https://musegea.com/developers/agent-api) ·
[OpenAPI](https://musegea.com/api/v1/openapi.json) ·
[OAuth discovery](https://musegea.com/api/auth/.well-known/openid-configuration)
