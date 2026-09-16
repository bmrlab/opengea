# OAuth app · a complete MuseDAM Worker

A **single GEA Worker** containing a TanStack Start application and its MuseDAM
Agent. It includes GEA user OAuth, per-user MuseDAM connection setup, a full-screen
AI Elements chat, Markdown, attachments, saved conversations, stream recovery,
cancellation and generated Artifact downloads.

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

The backend still calls the public Agents API with the signed-in user's token.
GEA authorizes the application, tenant and user before invoking the bundled Agent.
Colocation does not bypass authorization. GEA manages tenant installation copies
of the published bundle; developers build and deploy one source Worker. Tokens
and Connector credentials never reach browser JavaScript.

## Prerequisites

- Node **24.16.0**, pnpm **10.30.3**, published `@gea-ai/agent-sdk@0.1.260916-alpha.0`.
- A GEA deployment supporting Worker cookies, managed environment variables,
  SQLite Durable Objects, stable Worker namespaces and the public Agents API.
- A CLI with Agent application `gea.worker.json` support. Published
  `@gea-ai/cli@0.1.260915-alpha.0` does not support this complete example. Until a
  compatible CLI is released, use a current-source CLI build that includes this
  support. Do not remove environment or namespace declarations to make an older
  CLI accept the project. SDK installation and local web tests use public packages.
- A Studio Project and an independent GEA application with external OAuth.
- A MuseDAM OAuth client registered for GEA's Connector callback.

The Cloudflare Vite adapter provides local development and a standard Fetch
handler build. Deployment targets GEA; no Cloudflare account or D1 database is
needed. See [verification](VERIFICATION.md) for exactly what has been checked.

## Project layout

```text
agents/musedam-chat/       Agent instructions, definition and MuseDAM Connector
src/                      TanStack Start routes and chat UI
server/                   OAuth, public Agents API proxy and SQLite objects
worker.ts                 Application handler + SQLite class exports
gea.worker.json           Application environment and stable SQLite bindings
agent-project.json        One project root for Agent validation/packing/deployment
dist/server/              Built TanStack Start handler
dist/client/              Static assets included in the same Worker
```

The CLI discovers the Agent, wraps `worker.ts` with authenticated `/gea/agents/*`
routes, and packages the application and assets together. `gea.worker.json`
configures the application part of that deployment. `wrangler.jsonc` configures
only the local web development runtime.

## 1. Install and build

```sh
cd examples/oauth-app
pnpm install
pnpm build
pnpm type-check
pnpm worker:validate
pnpm worker:pack
```

Build the web handler before invoking Agent packaging. Neither build nor type-check
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

```sh
cp .dev.vars.example .dev.vars
# Fill in a separate localhost OAuth client and a generated encryption key.
pnpm dev
```

Open `http://localhost:4000`. For a different port, run `pnpm dev --port <port>`
and update the app origin and registered callback together. GEA's redirect-sector
rule requires separate clients for localhost and the hosted app. Local web
development calls the selected hosted Agent through the Agents API; it does not
replace that authorization flow with an anonymous local Agent endpoint.

```sh
pnpm test        # build + real SQLite/HTTP and message rendering tests
pnpm type-check
```

The HTTP tests simulate only remote GEA/provider responses. To use native GEA
Runtime instead of Miniflare, set `GEA_WORKER_RUNTIME_BIN` and
`WORKER_RUNTIME_SYSTEM_WORKER_ROOT` to the matching installed Runtime paths and
run `pnpm test:gea`. No private repository import is required by the example.

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
`GEA_` environment prefix is reserved. Local `.dev.vars`, secrets and generated
Wrangler configuration are excluded from deployment output. Managed configuration
is passed through internal RPC per operation because DO events do not receive
request-scoped secrets. No public endpoint exposes these internal objects.

[Agents API guide](https://musegea.com/developers/agent-api) ·
[OpenAPI](https://musegea.com/api/v1/openapi.json) ·
[OAuth discovery](https://musegea.com/api/auth/.well-known/openid-configuration)
