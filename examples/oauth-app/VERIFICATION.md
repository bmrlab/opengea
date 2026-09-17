# Verification · single-Worker OAuth application

## SDK alpha.2 and public development Runtime, 2026-09-17

- Public SDK `0.1.260917-alpha.2`, CLI `0.1.260917-alpha.0`; frozen installation, TanStack Start build, type-check, Worker validation and combined packaging passed without source-built binaries.
- 40 tests passed, one optional combined-artifact test was skipped in the normal suite. A separate run against the extracted combined Worker then passed all 27 OAuth integration cases, including that artifact case. HTTP fixtures execute against the published native Runtime and real SQLite; they are not a live external OAuth/MuseDAM test.
- `pnpm dev` with the pinned public CLI served app HTML and `/api/session` returned the Local developer identity plus the embedded MuseDAM Agent discovered through the local Agents API. Temporary processes were stopped after verification.
- The embedded Agent uses the new Core default. No new OAuth Preview deployment, live MuseDAM authorization/chat, or Production promotion was performed in this upgrade.

## Historical baseline, 2026-09-16

This earlier verification used published
`@gea-ai/agent-sdk@0.1.260916-alpha.1` and one root lockfile. Earlier Next.js and
two-Worker deployments are historical checks, not proof of the combined deployment.

## Completed local checks

- Node 24.16.0 and pnpm 10.30.3; type-check and TanStack Start build pass without
  OAuth credentials.
- 40 app tests pass on native GEA Worker Runtime: 26 OAuth HTTP integration
  tests, two local-API HTTP tests, nine stream tests, two Markdown rendering tests
  and the build-output check. No Miniflare or Wrangler dependency remains.
- A current-source macOS CLI validates and packs one combined Worker: web handler,
  client assets, MuseDAM Agent/Connector, Agent Session objects and app SQLite
  objects. The manifest retains app variables and stable Worker namespaces.
- 27 OAuth HTTP cases pass against the extracted combined artifact on native GEA
  Worker Runtime, including combined application serving. SQLite, encryption, RPC,
  egress and HTTP dispatch are real;
  only remote GEA/provider HTTP is simulated.
- A combined-artifact check serves the actual app HTML and confirms anonymous
  invocation of its embedded Agent returns HTTP 401.

These cover persistent sessions across Runtime restart, one-time browser-bound
PKCE state, concurrent refresh/logout, revocation retry, user connection gates,
exact file uploads, file-only messages, authorized history, reconnect, cancellation,
Artifact downloads, and user/environment isolation. Upstream credentials/cookies
are not relayed to the browser or signed object-store requests.

The output check rejects local secrets and deployment configuration in
upload directories. Generated artifacts and test credentials are not committed.

## Local Vite and Agents API acceptance

With the current-source CLI, `pnpm dev` starts the plain Vite browser server plus
native Runtime and Rust Agents API. Chrome renders the Local developer identity,
Agent discovery and the missing MuseDAM connection gate. Real local API calls
create a Session, upload a text file and obtain a Connector authorization ticket.
Vite configuration restart releases the SQLite owner before replacement startup;
source edits rebuild the Worker and refresh the page, preserving history.

The CLI's native end-to-end tests also exercise real Agent execution, stream
disconnect, file/Connector resources, reload, failure recovery and SQLite restart.
The app's local HTTP tests simulate the public API to cover token-free proxying,
file input, streamed chat, remembered Run recovery and public-origin rejection.
Real MuseDAM authorization/chat in local mode remains unverified. Model execution
uses the CLI's provider configuration, not a browser OAuth token.

## Combined Preview acceptance

The combined artifact was uploaded with a locally built CLI to the existing test
web Worker's Preview. Studio confirms that the app and the embedded MuseDAM Agent
share one source Worker and deployment. The new Agent is linked to the existing
independent application with a Preview release and enabled tenant installation;
Production remains disabled.

The SDK was upgraded to `0.1.260916-alpha.1`, rebuilt and deployed to the same
Worker. Chrome confirmed the original app cookie, signed-in account and earlier
history survive. The bundled Agent's per-user MuseDAM connection is ready.
A new Session accepted an uploaded text file; the real Agent read its validation
marker, searched MuseDAM once, read offloaded results with `readToolOutput` and
returned ten asset summaries. After disconnecting the initial stream, the same
active Run reconnected with HTTP 200 SSE and completed; a later reconnect returned 204. These checks use the bundled Agent through hosted user OAuth.

The new Worker transport replays standard AI SDK events from the Run boundary.
The example accepts this format using exact Session/Run response headers, while
retaining the legacy `gea-replay` baseline format. Behavioral tests cover replacing
partial output without duplication and rejecting missing/mismatched Run identity.
On final Preview v7, refreshing during execution and clicking Restore conversation
returns HTTP 200 SSE and displays the complete answer. An explicit cancel returns
`abort_requested`; the Run subsequently settles as `aborted`.

Concurrent Run admission still surfaced as a generic 502 in the earlier API
rollout check. This backend error classification is outside this SDK/example update.

## Earlier real-service acceptance

The prior two-Worker Preview verified real GEA OAuth, app cookies, MuseDAM setup,
chat attachments and Markdown/tool rendering. After the SDK fix, a real search
used `readToolOutput`, completed over a 61.6-second stream, returned `finished`,
and restored its answer after refresh. This does not establish single-Worker
hosted acceptance.

Chrome checks covered desktop and 390 × 844 layouts: independent conversation
scrolling, a visible composer and mobile navigation/settings drawers.

## Release boundaries

Published CLI `0.1.260915-alpha.0` predates required Agent application config
support. The current-source CLI preserves `gea.worker.json` and accepts the
Streams/AsyncLocalStorage imports used by TanStack Start. A compatible CLI release
is required for a registry-only deployment workflow; no new SDK release is needed.

The app uses manual fetch redirects, Cache-Control headers, Web Crypto AES-GCM
and plain per-operation configuration for SQLite RPC. Production promotion and
SQLite replication/failover are not covered. The testing hostname is omitted.

## Reproduce

Run `pnpm install --frozen-lockfile`, `pnpm type-check`, `pnpm test`, then use a
compatible CLI for `pnpm worker:validate` and `pnpm worker:pack`.

For combined native tests, extract the generated Agent ZIP into a temporary folder,
set `GEA_TEST_WORKER_DIR` to it, set `GEA_WORKER_RUNTIME_BINARY` and
`WORKER_RUNTIME_SYSTEM_WORKER_ROOT`, then run:

```sh
pnpm exec vitest run tests/oauth.integration.test.ts
```
