# Verification · single-Worker OAuth application

Last verified: 2026-09-16. This example uses published
`@gea-ai/agent-sdk@0.1.260916-alpha.0` and one root lockfile. Earlier Next.js and
two-Worker deployments are historical checks, not proof of the combined deployment.

## Completed local checks

- Node 24.16.0 and pnpm 10.30.3; type-check and TanStack Start build pass without
  OAuth credentials.
- 35 app tests pass with Miniflare and real SQLite: 26 HTTP integration tests,
  six stream tests, two Markdown rendering tests and the build-output check.
- A current-source macOS CLI validates and packs one combined Worker: web handler,
  client assets, MuseDAM Agent/Connector, Agent Session objects and app SQLite
  objects. The manifest retains app variables and stable Worker namespaces.
- The same 26 HTTP tests pass against the extracted combined artifact on native
  GEA Worker Runtime. SQLite, encryption, RPC, egress and HTTP dispatch are real;
  only remote GEA/provider HTTP is simulated.
- A combined-artifact check serves the actual app HTML and confirms anonymous
  invocation of its embedded Agent returns HTTP 401.

These cover persistent sessions across Runtime restart, one-time browser-bound
PKCE state, concurrent refresh/logout, revocation retry, user connection gates,
exact file uploads, file-only messages, authorized history, reconnect, cancellation,
Artifact downloads, and user/environment isolation. Upstream credentials/cookies
are not relayed to the browser or signed object-store requests.

The output check rejects local secrets and generated Wrangler configuration in
upload directories. Generated artifacts and test credentials are not committed.

## Combined Preview acceptance

The combined artifact was uploaded with a locally built CLI to the existing test
web Worker's Preview. Studio confirms that the app and the embedded MuseDAM Agent
share one source Worker and deployment. The new Agent is linked to the existing
independent application with a Preview release and enabled tenant installation;
Production remains disabled.

Chrome confirmed the original app cookie, signed-in account and earlier
conversation history survive the deployment. The app discovers the newly linked
Agent, detects its missing per-user MuseDAM connection, blocks Send, and opens the
real MuseDAM team-authorization page. Completing this new connection and a real
combined-deployment chat/upload remains pending team selection.

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
set `GEA_TEST_WORKER_DIR` to it, set `GEA_WORKER_RUNTIME_BIN` and
`WORKER_RUNTIME_SYSTEM_WORKER_ROOT`, then run:

```sh
pnpm exec vitest run tests/oauth.integration.test.ts
```
