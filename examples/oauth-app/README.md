# OAuth app · Sign in with GEA and chat

A standalone Next.js app that lets a user sign in to **GEA**, authorize access to
an organization, see a verified profile, and chat with an Agent belonging to the
application. Upload message attachments, browse generated Artifacts, download files,
and continue saved conversations after a reload or a new login. All GEA calls use backend HTTP `fetch`; there is no GEA SDK, Project
API key, tenant token, or caller-supplied principal. AI SDK only decodes the
relayed UI message stream in the browser.

For a smaller HTTP example covering Session preparation, file upload and Computer
before running the Agent, see [agents-api](../agents-api/). Its caller switches
between Local and Preview through URL, environment and OAuth-token configuration.
This OAuth app retains its hosted sign-in flow and PostgreSQL session store.

This is the replacement for `zhuojg/gea-oauth-example`. It is independent of the
other examples and needs no GEA CLI. `ask-muse` demonstrates the opposite OAuth
direction: an Agent connecting to an external service.

[Live deployment](https://gea-oauth-example.vercel.app/) ·
[Verification and current limitations](VERIFICATION.md). The demo registration
is internal to its owning tenant; deploying the public website does not grant
other organizations permission to use its Agent.

## Register in GEA

Use a **new independent application** in Studio → Applications. The older
Organization Admin → Third-party apps registration has different scopes and
requires an organization selector; its credentials cannot be substituted here.

1. Create an application in your developer organization. Set its launch URL to
   the app origin, e.g. `http://localhost:4000`.
2. Enable external OAuth and register the exact callback:
   `http://localhost:4000/auth/callback`. Select `openid`, `profile`,
   `offline_access`, and `agents:invoke`. Save the client ID and one-time client
   secret in `.env.local` on the **app backend**.
3. In the authorizing tenant, open **System Admin → Agent installations →
   Application authorizations**, choose **Authorize application**, and look up
   the Client ID. Approve those scopes and select the required environment.
   The user must have active tenant
   membership. GEA chooses among eligible organizations during sign-in; this
   example sends neither `organization_id` nor `installation_id`.
4. To enable chat, link an Agent to **this same application**, publish its
   environment release, and configure that application environment for the
   consuming organization. Adjust installation configuration only when needed
   (see below). The example discovers authorized entries with `GET /api/v1/agents`;
   no Worker URL or manually copied Agent ID is needed. Use an Agent without interactive tool
   approvals for this example. The [basic example](../basic/) shows Agent
   development and richer tool UI. An arbitrary Agent from a different application
   will be denied by GEA, even with a valid OAuth token.
5. For another organization, follow GEA's Preview test-tenant approval or reviewed
   store distribution and tenant setup. Do not enable broad distribution merely
   to test a local account. Internal applications work in their owning tenant.

Register a **separate application/client for each callback host**. GEA enforces
one redirect sector host per client; a localhost callback and a Vercel hostname
cannot share a client. For production use a stable HTTPS callback such as
`https://your-project.vercel.app/auth/callback`, not rotating preview URLs.

## Configure the tenant installation

On **GEA Web v0.51.2 or later**, installation configuration is optional when the
published Agent already has usable defaults. GEA reads each declared variable
from the tenant override, then the publisher's Agent and Project in the same
Preview or Production environment. Missing values are omitted so Agent code can
use its own default or validate a required value. Local `.env` files and Vercel
app variables do not become hosted Agent configuration.

A tenant administrator can open **System Admin → Agent installations → the
Agent → Configuration** to edit values. Tenant changes are marked as overridden;
**Restore default** removes the override. Secret values remain hidden. Inherited
values are read live, so publisher changes affect installations without overrides.

The linked [basic Agent](../basic/) needs no tenant configuration for text chat.
Search requires approval by default, even when `REQUIRE_SEARCH_APPROVAL` is absent.
This app does not implement interactive tool approval; use text-only prompts
that do not request tools when validating the conversation.

GEA Web v0.51.1 instead requires every declared variable on the installation and
can fail with `installation_environment_missing` before Agent code runs. Upgrade
the GEA host to use the default behavior above. Existing explicit tenant values
remain overrides after upgrading; restore their defaults when appropriate.

## Run locally

Use Node **24.16.0** (`.node-version`) and pnpm **10.30.3**.

```sh
cd examples/oauth-app
pnpm install
cp .env.example .env.local
# Fill in the registration values and generate a 32-byte base64 encryption key:
node -e 'console.log(require("node:crypto").randomBytes(32).toString("base64"))'
# Put the output in TOKEN_ENCRYPTION_KEY; do not commit it.
docker compose up -d --wait
pnpm db:migrate
pnpm dev
```

Open `http://localhost:4000` and choose **Continue with GEA**. If port 4000 or
5448 is occupied, use another free port and update the origin, redirect URI and
PostgreSQL URL consistently. An existing PostgreSQL database can replace Docker.
Use a dedicated application database, never GEA's database.

Set `GEA_ENVIRONMENT=production` (the default), or `preview` for an explicitly
authorized preview environment. GEA returns only the application's published
Agents available to the signed-in user. If none are available, the app shows an
empty Agent state. A complete chat demo requires an enabled tenant application
environment. `GEA_AGENT_URL` and `GEA_AGENT_NAME` are no longer used.

## HTTP contract

This example requires a GEA host exposing the `/api/v1` Agents API, including
Session preparation, Files and Session Artifacts (GEA PR #458). Check the public
[OpenAPI contract](https://musegea.com/api/v1/openapi.json) and
[Agents API guide](https://musegea.com/developers/agent-api). OAuth discovery is at
[`/api/auth/.well-known/openid-configuration`](https://musegea.com/api/auth/.well-known/openid-configuration).
The original 2026-07 app-sdk README and package-based developer guide do not
fully describe this newer application model. No GEA package is needed here.

| Operation            | Backend → GEA                                                                                                                                                                                       |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sign in              | Browser redirects to `GET /api/auth/oauth2/authorize`, with `response_type=code`, registered redirect URI, random `state`, and S256 PKCE. GEA owns `/oauth/tenant` and consent.                     |
| Code exchange        | `POST /api/auth/oauth2/token`, form-encoded `grant_type=authorization_code`, `code`, `code_verifier`, exact `redirect_uri`; `client_secret_basic`.                                                  |
| Restore credentials  | Same token endpoint with `grant_type=refresh_token`; persist the **new pair** before unlocking.                                                                                                     |
| Verified profile     | `GET /api/auth/oauth2/userinfo`, using the user's bearer token.                                                                                                                                     |
| Discover Agents      | `GET /api/v1/agents?environment=production`, following opaque `next_cursor`, including sparse pages.                                                                                                |
| Prepare conversation | `POST /api/v1/sessions` with `{agent_id, environment, title}` and no input. Returns the Session without starting a Run.                                                                             |
| Upload attachment    | `POST /api/v1/files`, multipart fields `file` and configured `environment`. Returns the managed file ID.                                                                                            |
| Conversation history | `GET /api/v1/sessions?environment=production&limit=20`; `GET /api/v1/sessions/<id>` verifies each selected conversation.                                                                            |
| Send message         | `POST /api/v1/sessions/<id>/runs` with `{input, stream:true}`. Text uses a string; attachments use a user message with text and `{type:"file", file_id}` parts. Run IDs arrive in response headers. |
| Generated files      | `GET /api/v1/sessions/<id>/artifacts?limit=20&cursor=<opaque cursor>`.                                                                                                                              |
| Download content     | `GET /api/v1/files/<id>/content`. The backend redirects the authorized signed URL or streams the response bytes.                                                                                    |
| Persisted messages   | `GET /api/v1/sessions/<id>/messages?limit=20&cursor=<opaque cursor>`. Pages contain messages in display order; prepend older pages.                                                                 |
| Run status           | `GET /api/v1/runs/<id>`.                                                                                                                                                                            |
| Reconnect            | `GET /api/v1/runs/<id>/stream`. Decode the `: gea-replay` baseline before UI-message SSE. Retry only attachment `503`, at most three times; `204` means read saved history.                         |
| Cancel run           | `POST /api/v1/runs/<id>/cancel` with `{}` JSON. Disconnecting alone does not cancel execution.                                                                                                      |
| Sign out             | `POST /api/auth/oauth2/revoke` with the current refresh token and `client_secret_basic`; GEA also invalidates its associated access tokens.                                                         |

Token responses contain `application`, `authorization`, and `organization`.
The app trusts organization information only from this server-to-server response,
and shows profile data only after the authenticated userinfo read succeeds.
No unverified ID token is used as identity. The pairwise `sub` comes from userinfo.

Independent applications use `agents:invoke`. They do **not** inherit the old
package app's `resources:read` or `agent_chats:write` ORPC surface. Here the real,
read-only API demonstration includes userinfo, authorized Agent discovery and conversation
history. Access to Agent data remains subject to GEA's user/application/tenant/
environment checks on every request.

## Uploads and Artifacts

1. Select an Agent, then choose **Attach files**. The app first prepares a Session
   if needed and uploads each file through its backend. Neither step runs the Agent.
2. Review attachments, add an optional message, then **Send**. The app submits their
   `file_id` values to the Session's Run. A file-only message is supported.
3. After the Run, **Artifacts** lists files generated in the current conversation.
   **Load more artifacts** follows the API cursor. Reloading or switching conversations
   reloads that Session's messages and outputs from GEA.
4. **Download** and history attachment links use the backend's OAuth-authorized
   content route. Access tokens never appear in a browser URL or reach the object store.

Files are independent managed resources; upload does not require an Agent or Session
ID in GEA. This example checks the selected Session before uploading and uses its
configured application environment. Uploading alone does not attach a file to a
message, copy it into Computer, or make it a Session output. Removing an attachment
from the draft only removes the reference from the next message; it does not delete
the uploaded file. Unsent attachments are not restored after a reload.

`file_id` and `artifact_id` refer to the same underlying file. Generated output IDs
can be used as later `file_id` inputs. The sidebar lists generated outputs; input
uploads remain visible in their message history. To see outputs, use an Agent that
saves managed Artifacts, such as [agents-api](../agents-api/) with `ctx.artifacts`.
This example offers file downloads, without an inline document viewer or output-reuse control.

The demo allows **10 files per message, 4 MiB per file**, uploaded one at a time.
The cap leaves room for multipart overhead under
[Vercel's function payload limit](https://vercel.com/docs/functions/limitations).
Larger files need the Files API's streaming upload grant flow. Writes are not
automatically retried; successfully uploaded attachments remain in the draft if
a later upload fails. An ambiguous write failure may have created a resource on GEA.
The file UI adds no application database tables or migrations.

## Sessions, refresh and errors

- The browser receives only a random, HttpOnly, SameSite=Lax app session cookie
  (Secure on HTTPS). PostgreSQL stores its SHA-256 hash. A separate short-lived
  cookie binds the login transaction to the initiating browser.
- State and PKCE are generated on the backend. State is atomically consumed once
  and expires after five minutes. Duplicate or mismatched callback parameters
  cannot exchange a code. Cancellation preserves an existing app session.
- Tokens, verifier and stored profile are encrypted with AES-256-GCM using
  `TOKEN_ENCRYPTION_KEY`, including row identity as authenticated data. Database
  credentials and encryption key are backend-only deployment secrets.
- A PostgreSQL `SELECT FOR UPDATE` lock serializes refreshes across all Vercel
  instances. Refresh starts one minute before expiry. The replacement access and
  refresh token are committed before another request can refresh. An ambiguous
  refresh failure marks the session as requiring reauthorization; it never
  automatically resubmits the old token.
- Logout uses the same lock and waits for confirmed revocation before deleting
  the session. On provider failure it retains the credentials for a retry and
  blocks API use. It signs out of this app, not the user's GEA browser session.
  GEA revokes the refresh token and its associated access tokens together; do not
  separately revoke the now-deleted access token, which this provider can reject.
- Sessions last seven days. Database failures and provider failures are errors,
  not anonymous success. There is no localStorage token, in-memory token store,
  application-global user token, or encrypted token cookie.
- Chat writes are not idempotent. They are sent once. On an ambiguous failure,
  use **Restore conversation** before sending again. The UI prepares the Session
  before invoking it and retains its ID if Run submission fails. Refreshing history also
  recovers a created conversation if the response was lost.
- Conversation history comes from GEA, scoped to OAuth tenant, user, application
  and environment. Select a conversation to continue it, **Load more conversations**
  to page the list, or **Load earlier messages** to prepend older messages. The
  selected ID is in the page URL; reload restores it. A new login can access the
  same user's history. GEA rechecks access on every request.
- `oauth_example_runs` stores only the most recent returned Run ID per session,
  because this API currently exposes neither a Run list nor a latest-Run field.
  This pointer enables status, reconnect and cancel across app sessions. It is
  consulted only after GEA authorizes the session; it grants no access by itself.
  Run `pnpm db:migrate` when upgrading an existing deployment. This adds one table
  to the example's own database; it requires no GEA database migration. Existing
  OAuth sessions and tokens are preserved.
- **Restore conversation** can reattach a known active Run. Replay replaces that
  Run's assistant baseline rather than appending duplicate output. Conversations
  created by a different client of the same GEA application can be read and
  continued, but this app cannot reconnect or cancel their prior Runs without
  a recorded Run ID. Sending a new turn records the new Run.
- Only conversations created through the Agents API appear in its list. Existing
  Worker-only chats remain on their original API and are not migrated here.
- The app displays reasoning and tool status, but does not submit interactive
  tool approvals or tool outputs. Choose an Agent whose flow does not require
  those interactions.

The app doesn't make an OAuth exchange and a PostgreSQL commit atomic. A process
crash after GEA rotates a token but before the database commit can require a fresh
sign-in. Normal concurrent requests and handled exchange failures are covered by
the tests. Keep this limitation explicit when extending the session lifecycle.

## Deploy on Vercel

The public `bmrlab/opengea` organization repository is eligible for a personal
Hobby project. Vercel restricts **private organization repositories** on Hobby,
provides team collaboration on Pro, and limits Hobby to personal, non-commercial
use. A public repository is not itself permission to use Hobby commercially.
See [Git deployment rules](https://vercel.com/docs/git) and
[Hobby plan](https://vercel.com/docs/plans/hobby).

1. Import `bmrlab/opengea`. Set **Root Directory** to `examples/oauth-app` and
   Framework Preset to **Next.js**, Node to **24.x**. The lockfile and package
   manager are local to this example. Build: `pnpm build`.
2. Connect a durable PostgreSQL database (for example a Neon database from
   Vercel Marketplace). Its plan/quotas are independent of Vercel's. Memory or
   local SQLite is not suitable for serverless sessions and rotating tokens.
3. Create the GEA production registration for the stable project domain. Add
   the `.env.example` variables to the project's **Production** environment.
   Keep the client secret and encryption key sensitive. Use a pooled database
   connection for request traffic if your provider recommends it; ordinary
   transaction-mode pooling supports the row locks used here.
4. Run `pnpm db:migrate` against that application's database using a temporary,
   untracked env file or deployment shell. Schema setup is idempotent. Builds
   intentionally require no database credentials and do not run migrations.
5. Deploy, then verify consent, userinfo, first message, follow-up, reload,
   refresh-token rotation and sign-out revocation. Use a separate client/origin
   for Preview; do not put production secrets into untrusted PR previews.

Routes request a 60-second function limit. The hosting plan applies its own
limits. Long Agent runs can continue on GEA; reconnect and read persisted results
when a host/browser connection ends.

To replace the old deployment, reuse its stable Vercel project/domain, connect
this repository and root directory, and replace the OAuth configuration with a
new independent application. Keep the previous deployment available for rollback
until the full live flow passes. There is no need to delete its database or the
old repository as part of replacing the deployment.

## Validation

```sh
# Create a separate disposable database for integration tests.
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5448/oauth_test pnpm test
pnpm type-check
pnpm build
```

Tests truncate only the `oauth_example_*` tables in `TEST_DATABASE_URL`; never
point that variable at production. GitHub Actions supplies PostgreSQL and runs
these checks without GEA credentials. See [VERIFICATION.md](VERIFICATION.md) for
which local and real-service checks were actually performed.
