# Verification · single-Worker OAuth application

## SDK 0.1.260922-alpha.2 and chat completion, 2026-09-22

- Installed the published SDK alpha.2, preserving CLI `0.1.260920-alpha.1`.
  Type checking, Vite build, 48 tests (one optional artifact case skipped), Worker
  validation/packing and all 27 extracted-artifact native Runtime tests passed.
- Preview v12 deployment `01a0c855-3ab5-761f-aa4d-4fd39978f68c` is selected for
  the existing Worker. Publication Preview release
  `01a0c855-c446-705d-a42f-663843fff742` references that source deployment; real
  Runs use installed deployment `6a2d2e47-3d02-55ef-bcee-fbab7cfc5e83`.
  Hosted login, MuseDAM connection and previous conversation history survived.
  Production remains disabled. Managed configuration and namespaces were retained.
- Four no-tool requests streamed OK and reached backend `finished`, without a 502:

  | Sample | Run | Browser first protocol bytes | Browser terminal bytes | Model span end to terminal bytes |
  | --- | --- | --- | --- | --- |
  | A | `01a0c857-066b-70d7-adce-2a2b7b56a922` | 10.56s | 14.39s | 0.84s |
  | B | `01a0c857-becb-75cb-b969-99c59101f1da` | 4.58s | 9.33s | 0.95s |
  | C | `01a0c858-b785-760b-8b8f-d4add73c12a5` | 4.93s | 11.95s | 1.56s |
  | D | `01a0c85b-0266-7459-9cc0-42ba8f2ae1b0` | 5.12s | 9.21s | 1.10s |

  Browser durations start at POST dispatch. Model-to-browser timings correlate
  Trace and browser clocks and are approximate; first protocol bytes are not
  model TTFT. These small shared-production samples are not a controlled benchmark
  or confirmed full cold-start test, and do not establish lower peak memory.
- On D, input was observed enabled about 53ms after terminal bytes, while artifact
  and navigation refreshes finished approximately 0.94s and 1.63s later. There was
  no post-run history GET. This removes the old 1.21–3.50s blocking refresh observed
  on alpha.1. Chrome records `net::ERR_ABORTED` after those terminal bytes, while the app
  and backend both complete successfully; the network cancellation source was not
  isolated. These samples are distinct from the earlier HTTP 502s.
- Trace attributes report five reused unchanged Context saves per invocation.
  Total persistence writes were 14 / 16 / 14 / 14, versus 19 in the two prior
  alpha.1 samples; counts also depend on emitted events. Final artifact lookup took
  143–195ms. No external MuseDAM tools or attachments were exercised by these
  hosted performance samples; the previous memory-pressure failure is not proven
  resolved by four successful requests.
- Confirmed terminal streams now release input without waiting for navigation or
  artifact refresh. Refreshes run concurrently and are cancelled on a new turn or
  conversation switch. Tests hold refresh responses pending, submit another turn,
  and verify stale responses cannot overwrite newer state. Stream tests reject
  premature EOF/errors after finish, preserve abort outcomes and retain state
  reload for ambiguous finishes and 204 replay recovery.
- The production Web image remains v0.55.13. The new Host-side one-request Session
  preparation path in GEA PR #537 is not active until a Web image containing that
  change is deployed. SDK and frontend changes alone do not remove all startup
  latency; sample A still spent 3.54s in legacy Session preparation.

## SDK 0.1.260922-alpha.1, 2026-09-22

- Updated the published SDK and lockfile; CLI remains `0.1.260920-alpha.1`. Type checking, Vite build, 40 ordinary tests, Worker validation/pack and all 27 extracted combined-artifact native Runtime/SQLite tests passed.
- Preview v11 deployment `01a0c80c-6e9b-74db-92d3-642adeb2dcbd` is selected for the existing Worker. Publication Preview release `01a0c80c-7e1b-708b-ac0c-b1b59be605f4` references that exact source deployment. Real Runs resolve to installed deployment `5d0f4333-046c-5579-a73f-b26a4f8452f8`; new SDK persistence/finish trace attributes are present. Production remains disabled; managed variables and stable namespaces were preserved.
- Hosted login, MuseDAM connection state and existing conversation history survived the update. The first no-tool request returned browser HTTP 502 during a logged Runtime memory-pressure admission failure; its Run `01a0c80d-c1ce-70c8-9d1d-f7b1582e5695` finished, and Restore conversation recovered its OK answer. This is not a successful streaming sample.
- Subsequent no-tool Runs `01a0c810-0172-75c1-b665-b336b6fe4cf1` and `01a0c811-2025-715a-bf38-06e2ec8c1ec7` both streamed OK and finished. Browser first protocol bytes were 3.65s / 4.99s; stream completion was 8.21s / 10.50s. These individual shared-production samples do not establish a significant overall speedup over the prior SDK at the same 2-core limit. They are not model first-token timings or full deployment-cold comparisons.
- A final request after confirmed application/Agent deployment eviction on both nodes also returned HTTP 502. Run `01a0c817-3c4b-749b-bd77-bed73ba3dd4a` finished in the backend; Runtime logs again showed memory-pressure DO admission refusal (working set about 1.72–1.77 GiB against a 1.5 GiB threshold). Full cold-start streaming acceptance remains blocked. These observations do not establish whether the new SDK changes peak memory.
- No external MuseDAM tool or attachment operation was exercised in this SDK-only performance check. The existing memory-pressure failure remains unresolved; no new memory limit/eviction policy change was made.

## SDK 0.1.260920-alpha.3, 2026-09-20

- Public SDK alpha.3 plus the alpha.1 macOS CI native artifact: type checking, Vite build, 40 ordinary tests, validation/pack and all 27 extracted combined-artifact native Runtime/SQLite tests passed. Registry installation/integrity is recorded separately in the root acceptance record.
- After public CLI alpha.1 became available, frozen installation, the 40-test suite and types passed again using its default npm-installed native Runtime, without a Runtime override. Both native platforms remain in the lockfile.
- Preview v10 is ready: deployment `01a0bec0-7441-7237-a868-7bf50e24b04d`, content `sha256:e6ea3a978aae3e2eddebbb33b235a628f2a4dd64fa71c106389b5499d74fc954`. Publication Preview release `01a0bec0-c3d3-743a-a24b-67ae1300f365` references that exact deployment. Existing namespaces and managed configuration were not changed; Production remains disabled.
- Before this deployment, the previously signed-in browser already displayed a session-restoration error. Historical alpha.2 login/search success below is not current alpha.3 hosted acceptance.
- After reload, login, the MuseDAM connected state and the conversation list recovered without new consent. Restoring the prior Session `7df136a6-2575-4d4c-855d-c515b29992c6` still failed. A fresh read-only search created Session `e9e7a85d-cb50-46fb-b84e-ed728975d8b4`, but the Agent request failed before any search result appeared. The uncertain write was not repeated. No trace was returned by the project-scoped query for that time window, so this record does not attribute the OAuth failure to the capacity error seen in other examples. Hosted chat acceptance remains incomplete.

## SDK 0.1.260920-alpha.2, 2026-09-20

- Public SDK `0.1.260920-alpha.2` and CLI `0.1.260920-alpha.0`: frozen installation, types, Vite build, 40 tests and validation/pack passed. The extracted combined artifact passed all 27 native Runtime/SQLite integration tests, including the packaged app/Agent case.
- Preview source deployment and its Agent publication release were updated together. The release `01a0bd70-d225-73c9-91d7-38a923f1bd11` references source deployment `01a0bd70-b547-715d-9031-c5106673933a`. Stable namespaces and managed configuration were preserved.
- Chrome retained the existing login, MuseDAM connection and conversation history. A fresh real-user OAuth Session `7df136a6-2575-4d4c-855d-c515b29992c6` performed one read-only MuseDAM search, read the offloaded output and rendered two asset names. Refresh restored the same tool results and answer. Run `01a0bd74-6866-71a8-b50b-02d1e127b1c3`. This did not repeat external consent or upload a new attachment.
- Existing Preview Worker v9 is ready: deployment `01a0bd70-b547-715d-9031-c5106673933a`, content `sha256:4297399ca10f25242f80dd7501e27d2898d370233d2cf3fc9915662f1da231cb`. No Production promotion.

## Web v0.55.1 hosted recheck, 2026-09-20

- Browser history now loads all ten visible conversations, restores the selected conversation and retains the signed-in user/MuseDAM connection; the previous history 502 is resolved.
- In the Studio Project Trace list, clicking the duration cell now retains `otelInstallationId` and opens the full detail for Trace `91fb3b2e4bd2fdc552ead8542c80e61d`. The old row-click 404 is resolved. The API still correctly requires the installation scope.
- This recheck exercised history and Trace reads; no new OAuth chat/tool call or Production promotion was performed.

## SDK / CLI 0.1.260920-alpha.0, 2026-09-20

- Published dependencies installed and lockfile refreshed. Type checking, Vite build and 40 tests passed (one optional combined-artifact case skipped in that command).
- Validation/pack passed. Re-running the native Runtime/SQLite OAuth integration suite against the extracted combined artifact passed all 27 tests, including the artifact-specific case.
- Existing Worker Preview v8 is ready, deployment `01a0bc52-fcbd-7777-98c4-d16f589059e9`. Stable namespaces and managed configuration were preserved.
- Browser readback retained the signed-in user and connected MuseDAM state. History loading returned 502 from the example's `/api/conversations` proxy. Production diagnosis identified an old immutable Session (`01a0a8a0-a1e6-729c-ae63-38fa649c410d`) whose SDK advertises managed execution but no logical Run capability. Authorization recovery called its absent `run-state` endpoint and received 404, failing the entire list. [GEA #498](https://github.com/bmrlab/gea/pull/498) gates the new endpoint on the existing capability; all 10 PostgreSQL/SDK integration cases and workspace types pass. Web deployment and hosted retest are pending. This is not complete hosted chat acceptance or a Production promotion.

## SDK 0.1.260918-alpha.0, 2026-09-18

- Updated public SDK/Contract dependencies and lockfiles to `0.1.260918-alpha.0`; no workspace-linked SDK. Node 24.16.0. Frozen installation, type checking, Agent validation and packaging passed.
- Packaging used the Session/Run-capable source CLI from GEA `73864e902`; CLI npm dependencies remain at their previous published version. No CLI release was triggered.
- Build and 40 tests passed, with 1 packaged-Worker-only test skipped by default. The extracted Agent Worker archive was then tested against the matching native Runtime: all 27 OAuth integration tests passed, including the packaged Agent route check.
- This records local checks, not a Production deployment.

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
