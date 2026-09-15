# Verification · OAuth app

Last verified: 2026-09-15 (Asia/Shanghai).

## File attachments and Session Artifacts

Branch: `codex/update-agents-api-examples`. Checked the Files and Artifacts
contract against GEA main `f06e0c904`, including independent uploads, shared
file/output IDs and managed content URLs in persisted messages.

- PostgreSQL 17 and a real local HTTP provider: **26 behavioral tests passed**.
  New tests first failed against the earlier implementation. They cover empty
  Session preparation without a Run, exact multipart binary bytes, configured
  environment, uploaded/output `file_id` inputs, file-only messages, Artifact
  cursors, denied access, origin checks, anonymous calls and oversized uploads.
- Signed downloads return the authorized URL without forwarding OAuth credentials
  or upstream cookies. Deleted content preserves HTTP 410; its regression first
  reproduced the previous generic 502 mapping.
- Type-check, Next.js production build and Vite+ formatting passed. No dependency
  upgrade or database migration was needed for the OAuth file UI.
- Chrome browser acceptance used the real Next.js backend and a separate PostgreSQL
  database with a local HTTP OAuth/Agents fixture. Uploading a synthetic text file
  created the Session first, preserved its exact bytes and made no Run. Sending
  only that attachment produced the expected `file_id` input. The sidebar paged
  through two generated outputs, Download reached the authenticated content route,
  and reload restored the saved attachment link and Session output list.
- Starting a new conversation cleared the previous messages and Artifacts.
  Desktop and 390 px viewport screenshots were checked; the page had no horizontal
  overflow. A MetaMask browser extension emitted its own connection errors during
  this check; those were unrelated to the app's file requests.

The browser fixture does not call a model or prove production OAuth compatibility.
The available local client configuration was a placeholder (`not-configured`), so
this new file UI was **not exercised against production**. No manual production
Vercel deployment, tenant authorization or Agent publication was performed.
Earlier real-service text-chat checks below remain historical evidence.

## 2026-09-14: Agents API and conversation history

Branch: `codex/oauth-app-example`.

Checked GEA `origin/main` at `c53496e26` and the production
`https://musegea.com/api/v1/openapi.json` on 2026-09-14. The new Agents API is
available in production. This example now uses backend HTTP `/api/v1` requests
for discovery, sessions, messages and Runs. It has no `@gea-ai/app-sdk` or other
GEA package dependency. No GEA source change, CLI build/release or SDK publication
is needed for this example migration.

- Local PostgreSQL + HTTP-provider tests: **22 passed**. New behavior was first
  exercised against the old implementation and failed, then passed after the
  migration. Coverage includes sparse discovery pages, opaque cursors, bounded
  page sizes, older messages, same-user history after a new login, denied reads/
  continuations/Run access, mismatched response identities, partial session
  creation without POST replay, and Run references across login sessions.
- Real AI SDK decoding tests check Run-baseline replay without duplicate output,
  mismatched replay identity, `204`, and bounded `503` attachment retries.
- Type-check, production build and formatting passed. The existing example CI
  is retained; no new GEA CI workflow was introduced.
- Added `oauth_example_runs` to the **example's Neon database** using the
  idempotent schema script. Existing sessions/tokens were preserved. GEA's
  database was not changed.
- Chrome on the stable Vercel Production domain discovered the authorized
  `tech-news` entry without a Worker URL. Initial history was empty, as expected:
  the Agents API does not include legacy Worker-only Chats.
- Session `01a09fbc-097d-75c5-bcd1-72d44a5f1f6d`: reloading during execution
  restored the saved user message and running status. **Restore conversation**
  reattached `/runs/<id>/stream` through the backend with HTTP 200. Explicit Stop
  returned HTTP 200 and Run `01a09fbc-1332-753e-a391-504fc95c83ec` became `aborted`.
- Continuing that session returned `OK`; Run
  `01a09fbd-e909-70fb-8789-555b8e9c3d5b` finished. A second independent session
  `01a09fbe-7427-717f-b06e-c1a3084c164c` returned `第二段会话正常`; Run
  `01a09fbe-7b7f-7608-84aa-2f3ad06d371b` finished.
- Switching back to the first session and asking for its original passphrase
  returned `蓝鲸九号`; Run `01a09fbf-d1ca-70e8-834d-1b21d0aac0bc` finished.
  Continuing the old session did not move it ahead of the newer one: GEA lists
  sessions by creation time descending, then ID, rather than last activity.
- Sign out completed revocation; a fresh OAuth login restored both conversations
  and the selected session's messages under the same user. No token is stored
  in browser storage; the backend retains the OAuth credentials.
- Real pagination: temporarily changed only the browser's history GET page size
  to `limit=1` with a scoped Fetch interception. GEA returned real cursors; **Load
  more conversations** appended the second session, and **Load earlier messages**
  prepended the original user message before its assistant reply. Both cursors
  ended at null and the buttons disappeared. No response data was mocked. The
  interception was cleared after the check; normal pages contain 20 items.
- Rechecked the cancellation UI fix on the final functional deployment: Stop
  was unavailable until the new Run was admitted, then showed the cancellation
  confirmation without a stale stream error. Run
  `01a09fc4-9c6e-746e-babd-9fc8f6030fc5` was saved as `aborted`.
- Production Vercel deployment `Ew7nefJpXpz4s3yPegeZj9cofHta` is Ready at
  `https://gea-oauth-example.vercel.app`, from functional commit `c51d692`.
  The existing example CI passed on that commit (run `34840156921`).
- Anonymous production Agents and Sessions requests both returned
  HTTP 401 / `UNAUTHORIZED`.

The live checks exercise the text conversation subset used by the example.
`PATCH` title/business metadata, `stream:false`, file inputs and interactive Tool
continuations were inspected in the current API contract but were not exercised
against production in this pass. This example does not provide those UI controls.
Tenant/user/Application denial is covered by local boundary tests; no second real
user or tenant was created for live isolation testing.

The earlier verification below records the original OAuth/Worker rollout. Its
Worker URLs and previous version-specific findings are historical evidence, not
the current example transport.

## Protocol and source

- OpenGEA PR #8 was confirmed merged. Rebased the prepared worktree onto
  `main` (`0e6405c`), omitting the two already-squashed upgrade commits whose
  final tree matched main. No merge commit or other example upgrade is included.
- Checked the current GEA OAuth provider, independent application token adapter,
  application registration scopes and Studio Agent HTTP routes against main.
- Production discovery returned issuer `https://musegea.com/api/auth`, S256 PKCE,
  and the standard authorize/token/userinfo/revoke endpoints. Independent
  application scopes include `agents:invoke`.
- Inspected the public `@gea-ai/app-sdk@0.1.260914-alpha.1` tarball. It still
  requires `organizationId` in the authorization helper and parses legacy
  installation metadata. Per the user's follow-up, this example uses HTTP for
  all GEA calls and has no dependency on that SDK.

## Local verification

- Node 24.16.0, pnpm 10.30.3, PostgreSQL 17.
- `pnpm type-check`: passed.
- `pnpm test` against a dedicated PostgreSQL database: 22 behavioral tests passed.
  Real SQL transactions and a local HTTP provider cover browser/state binding,
  PKCE, callback replay and cancellation, verified profile, encrypted token
  persistence, concurrent rotating refresh, ambiguous refresh failure, CSRF,
  session isolation, streaming/history, logout, and retryable revocation failure.
- Stream tests use the real AI SDK parser for SSE messages, `204` completion,
  `503` attachment retry and non-retried authorization failure.
- `pnpm build`: passed without GEA credentials; all application API routes build
  as Node functions. No GEA CLI or release workflow is used.
- Local Chrome inspection passed for the signed-out UI and session recovery entry.
- `vp fmt`: passed for the example, root index and CI workflow.

## Real-service verification

Production site: https://gea-oauth-example.vercel.app/. The existing Vercel
project/domain was reused with a new independent GEA application. Its Neon
database was retained; only this example's separate tables were added. The old
repository and prior deployment remain available for rollback.

- Vercel account plan: **Hobby**. Git connection to the **public**
  `bmrlab/opengea` organization repository succeeded. Root Directory is
  `examples/oauth-app`, Next.js, Node 24.x, production branch `main`. The PR
  branch was explicitly deployed to Production for the stable OAuth callback.
  No plan upgrade or CLI/SDK release workflow was triggered.
- GEA: registered an internal independent application, associated the basic
  `tech-news` Agent, published its Production application release, and approved
  the four scopes plus Production runtime in the owning `tezign` tenant.
- Chrome: GEA consent appeared with the correct application, tenant and scopes.
  Cancel returned `access_denied` to the app. Approve completed code exchange and
  the authenticated userinfo request; the app displayed the verified organization
  and pairwise subject. GEA selected the single eligible tenant automatically.
- Browser cookie inspection: only a 43-character opaque application session,
  `HttpOnly`, `Secure`, `SameSite=Lax`; no GEA access/refresh token in the browser.
- Real refresh: forced **only the app's UAT session expiry timestamp** into the
  past twice, then restored through Chrome. Both exchanges saved a different
  access token and refresh token with the same authorization identity; the second
  exchange used the first replacement pair. This is a forced-expiry rotation
  check, not a claim that one-hour natural expiry was waited out. Six concurrent
  requests and one exchange are additionally covered by the real-SQL local test.
- Real authorized read-only history and Run status returned HTTP 200. Reload and
  Restore conversation recovered both user turns and empty failed-run assistant
  records. Failed runs are shown explicitly in the UI; new runs succeeded after
  configuring the installation as described below.
- Real logout: after the revocation fix, retrying the blocked session removed its
  database row and the saved old access token returned **401** from GEA userinfo.
  A fresh sign-in and single sign-out also completed without a failure notice;
  the application session cookie was cleared. No GEA browser sign-out was needed.

### Issues found and fixed during live verification

1. Global `no-referrer` made Chrome HTML form submissions send a null Origin,
   correctly rejected by the app's CSRF check with 403. The document now uses
   `strict-origin-when-cross-origin`; callback redirects retain `no-referrer`.
   Chrome login and cancellation then passed without changing CSRF checks.
2. GEA persists `parts: []` for an assistant that fails before output. AI SDK's
   nonempty-message validator rejected this valid record. A narrowly validated
   empty-assistant case now preserves it, with an explicit execution-error UI.
   The new behavioral test first failed with 502, then passed with recovered history.
3. GEA refresh-token revocation also invalidates its associated access tokens.
   Revoking that now-deleted access token separately can fail. Logout now revokes
   the refresh grant once, then deletes the app session after provider success.
   The behavior test reproduces the provider's token removal and verifies that
   the old access token and old app session are unusable.

### Model execution and tenant configuration

The first two real user turns were admitted and persisted, but GEA execution
finished with `status: error` before assistant text was produced:

- Chat: `01a09ecf-4b52-712b-a7de-46aa4bcd2d40`.
- First Run: `01a09ecf-4c24-7352-aacf-06cd11465a41`,
  2026-09-14 07:26:20–07:26:24 UTC.
- Follow-up Run: `01a09ed5-5f56-7560-834a-90234f39c5a5`,
  2026-09-14 07:32:58–07:33:02 UTC.

Production Web logs at 07:26:24 and 07:33:02 UTC identified
`installation_environment_missing`, consumer `agent`, names
`["REQUIRE_SEARCH_APPROVAL"]`. Worker logs then reported
`Agent host rejected /tools/initialize (500)`. The model had not started.
The tenant installation does not inherit the publisher's environment, so the
basic Agent's declared variable must be configured separately.

Used GEA's existing administrator management HTTP procedures to read the exact
installation/release, set only `REQUIRE_SEARCH_APPROVAL=true`, and read back
`configured: true`. This keeps search approval enabled. No Runtime code,
memory limit, infrastructure setting or publisher release was changed.

After configuration, real Chrome text-only prompts produced:

- Chat: `01a09eeb-b2b3-7195-9a3e-8009d715158d`.
- First reply Run: `01a09eeb-b2e9-75d8-9b97-1af099b12ca4`,
  07:57:22–07:57:29 UTC, **finished**, with a Chinese greeting.
- Follow-up Run: `01a09eec-b180-7005-a026-acce455f1422`,
  07:58:27–07:58:35 UTC, **finished**, correctly recalling the first request.
- Reload restored both user/assistant pairs through the OAuth-authorized history
  API. A longer HTTP explanation completed in Run
  `01a09eed-d86e-75ea-91f9-1b1eb3ad2e9b` at 08:00:27 UTC. Its reconnect raced with
  completion and returned **204**, followed by successful persisted history.
- Another longer Run, `01a09eee-ca88-74ac-ada8-372c4260bbc0`, remained **running**
  after reload. **Restore conversation** returned **200 text/event-stream** and
  displayed resumed model output.

The first live Stop attempt exposed a separate example defect: the request had
no JSON body. Production GEA rejected it with **400 `invalid_json`** before
execution dispatch, which the example mapped to 502. A control request with `{}`
passed JSON parsing. The cancel route now sends `{}`; its new real-SQL/HTTP
behavioral test failed with 502 before the fix and passes with cancellation and
restored `aborted` status afterward.

On the updated Production deployment (`784b39a`), Chrome **Stop run** completed
without an error. GEA's persisted Run `01a09ef5-7a7d-754c-a0f2-7f3209991fff`
changed to **aborted**, 08:08:02–08:08:20 UTC, in the same Chat. The UI returned
to Ready. First reply, follow-up, persisted history, active-stream reconnection
and explicit cancellation have now all passed real-service verification.

The 15 behavioral tests, type check and production build passed locally and in
[GitHub Actions](https://github.com/bmrlab/opengea/actions/runs/34821034047).
[Production deployment](https://vercel.com/zhuo-jinggangs-projects/gea-oauth-example/8qwwfCsS9WuRdhpo8GiLbLjoeV2H)
is Ready on the original domain. No credentials or temporary screenshots are
included in the PR.

## Production recheck after Web v0.51.2

The production Web logs confirm `gea-web` version `v0.51.2` on 2026-09-14.
The existing app deployment and OAuth registration were reused.

- Read the installation through its existing authenticated administrator HTTP
  API, removed only the temporary `REQUIRE_SEARCH_APPROVAL=true` override with
  the current release precondition, then read back `overridden: false`.
- The publisher's Production Agent/Project also have no stored value for this
  variable. This live check therefore verifies omission and the Agent's code
  default, not a stored publisher value. The full stored-value inheritance order
  is covered by GEA's PostgreSQL tests in PR #448.
- Without the tenant override, Chrome created Chat
  `01a09f47-58f0-7059-b158-2283a80020b2`. Run
  `01a09f47-595b-7416-87a9-c8c300ffea06` finished and replied
  “无需租户配置，对话正常”. A follow-up correctly repeated that reply.
  Both requests and persisted history returned HTTP 200. Reload restored the
  authenticated session and both user/assistant pairs.
- Installation-page verification initially found an independent rollout issue:
  `export_organization_chat_traces` was missing from the production SpiceDB
  organization definition. The operator ran the deployed
  `chat-trace-export-backfill.mjs` schema/grant operation; the installation page
  then loaded successfully, and Configuration showed the variable without an
  override marker. This permission rollout belongs to the chat trace export
  change included in the same Web image, not the configuration-inheritance PR.

The temporary tenant override remains removed. No OAuth client, publisher
configuration, Agent release, Runtime, SDK, CLI or Vercel deployment was changed
for this recheck. Earlier refresh/revocation/cancellation results above remain
separate checks; they were not repeated for this Web configuration change.
