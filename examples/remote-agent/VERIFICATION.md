# Verification — 2026-11-02

The original build and live deployment used published SDK **0.1.261102-alpha.0**,
CLI **0.2.261102-alpha.0**, Node.js
**24.16.0**, pnpm **12.8.1**, macOS arm64 native Runtime.

## Current dependency cohort: alpha.1

After OpenGEA #29 updated the other nine examples, this example independently
upgraded SDK to `0.1.261102-alpha.1` and CLI to `0.2.261102-alpha.1`, both verified
published in npm. Only four GEA lockfile packages changed; the exact release-age
exceptions were updated without weakening the general policy.

Frozen installation, TypeScript checking, all eight verifier tests and the real
published CLI build passed. The generated remote declaration still selects the
same MuseDAMChat ID, Production and OAuth authority. This is local package/build
validation; it does not replace the hosted evidence recorded below or establish
a real local CLI-login-to-hosted invocation. The new bundle was not deployed.

## Original alpha.0 validation

- Dependency installation; TypeScript `tsc --noEmit`.
- Eight verifier tests: genuine finished result; reject missing tool receipts,
  unfinished/failed children, wrong target/parent/Session and missing result return;
  local-to-hosted completed `runWait` evidence; separate HTTP directories and
  denied cloud reads. The new local-to-hosted evidence case failed against the
  previous verifier before its implementation was updated.
- `pnpm build`: real CLI build of the OAuth-only caller. Generated manifest
  contains `publication-shared-worker-v1` and
  `durable-object-application-namespace-v1`. The reference retains the configured
  MuseDAMChat canonical ID, Production and `invocationAuthority: "oauth"`.
- `pnpm verify:local`: **real model calls and native Agent execution**. The local
  fixture resolves a target by canonical ID, not a slug shortcut. The verifier
  reads the tool receipt and the actual child Session/Run/history through HTTP.

| Evidence           | Value                                               |
| ------------------ | --------------------------------------------------- |
| Parent Run         | `405eb40b-60c0-473b-b0ef-43c1baed577b`              |
| Parent Session     | `bbf12868-84d5-4064-88f7-3a44283e1e24`              |
| Child Run          | `6e37e9d3-c61b-4630-a834-a96f0bae83ce`              |
| Child Session      | `c628b16e-b1dc-4406-b772-ec9cfade1113`              |
| Local target Agent | `dc75cd7e-c414-5872-b0ff-2a1d1858e12b`              |
| Terminal states    | Parent and child both `finished`                    |
| Child parent link  | Exactly the parent Run above                        |
| Returned marker    | `REMOTE_SMOKE_f5a5825f-115b-4b05-ae71-d2555794f633` |

Raw evidence is ignored under `.gea/local-remote-smoke/4f65b22b-ffa6-4116-9b6c-a63eca5db934/evidence/report.json`.
The owned dev process was stopped afterward. No deployment or installation is
performed by the local verifier.

## Earlier local attempt: blocked by caller identity on alpha.0

On 2026-11-02 a temporary project registered **only the local caller**, declared
the actual MuseDAMChat public ID `01a0a903-48d6-7764-bd9d-6260bb2117c2`, and selected
Preview with `invocationAuthority: "oauth"`. The CLI was logged in for hosted
model access; the caller Session used the CLI's ordinary local Project Key.

- Parent Run: `08bd42f7-2a7f-479c-8919-2302c5144bef`.
- Parent Session: `ab8b35af-2b37-4845-8a6e-2b62dbacd84e`.
- The real model issued one `agent(target: "musedam")` call.
- The actual tool result was HTTP **503**, `remote_run_rejected`, with no child
  Session/Run receipt. Parent `finished` is **not** delegation success.
- Raw evidence remains ignored under
  `.gea/cli-identity-probe/4dc69fc2-f31d-4e15-ba0e-bd0ef8044c00/evidence/report.json`.
  The owned local process was stopped afterward.

Source inspection at GEA main `49fae7c24dfec552f85c7f159dfb5728476a946b` explains
the boundary:

- `crates/api/src/local.rs` accepts a local Project Key or user OAuth bearer at
  public admission. Its outbound OAuth binding requires the root Session's
  retained OAuth authority; ambient CLI login is not used as the Session user.
- `packages/orpc/src/router/agent-api-cloud.ts` identifies ordinary Builder
  Playground user Runs as `kind: "host"`.
- `packages/orpc/src/agent-harness-v2/agent-child-authority.ts` rejects that
  identity with `root_oauth_required` before installed-target admission. Omitting
  `invocationAuthority` selects `project_key`, not current-user entitlement.

The focused existing authority tests passed **6 cases**, with **66 unselected**
cases. They ran in the existing cross-tenant checkout; the authority implementation
and test files are identical to the main commit above. This is not a full-suite
or hosted Builder execution result. Builtin publication roots have a different
admission path; the finding concerns ordinary Builder and local CLI callers.

These are platform identity-path gaps for the requested CLI/Builder demo, not a
missing target ID or a requirement to create an extra OAuth application. At that stage, OAuth client creation was paused. The subsequently authorized
hosted-to-hosted attempt is recorded below.

## Earlier hosted attempt: descriptor preparation failed before platform update

On 2026-11-02 the user approved a caller application in `softwarecopyright`
with only `openid` and `agents:invoke` and a loopback OAuth callback. Both Agent
executions are hosted; the callback only receives the browser authorization code.
The real authorization-code/PKCE exchange returned the consuming organization
`softwarecopyright` and the caller application identity.

Completed through the normal management APIs:

- Published caller `01a19b59-5570-7448-9cae-192ac04cb475` to Production,
  deployment `01a19b59-4413-764a-9199-22eb2116b2c7`.
- Promoted the specified MuseDAMChat build to Production, deployment
  `01a19658-9abb-710b-80dc-7130cda94ad2`.
- Submitted and approved the target application's two existing entry identities
  with explicit user approval. Only the specified entry was promoted; the other
  entry remains unpublished in Production.
- Enabled store distribution and installed the application in `softwarecopyright`.
- Enabled the caller application's OAuth and completed real user consent.

The verifier successfully created Session
`2043b642-b9a3-4f20-bfbf-d64dfe356eac`, then caller Run creation returned HTTP 503.
Read-only checks found no Run or message. One controlled request on that same
Session, with an Idempotency-Key, retained the exact failure:
`publication_deployment_prepare_failed`, request
`54fc21f6-b0b9-4493-8a82-9fab9e9155b7`.

The GEA shared-Worker descriptor reader passes a relative storage key to
`getObjectBuffer`, which requires a URL. A regression using the real reader and
a loopback HTTP object fixture reproduces `Invalid URL` before the fix. Converting
the prefixed key to the server-side object-store URL fixes the local integration
case. This was fixed by GEA #1105. After the owner updated Web/Worker, the live
recheck below passed without rebuilding this example or publishing a new npm
cohort. This earlier failed attempt created no parent or child Run. The target's store launch URL still points at
its existing Preview web app; this attempt invokes the Production canonical Agent
ID directly through the caller and does not validate that launch UI.

## Hosted recheck after platform update: passed

On 2026-11-02, the existing caller in **softwarecopyright** invoked the existing
**tezign** MuseDAMChat Production v23. No target code was bundled into the caller,
and no installation, release or permission was changed for these invocations.
The caller kept the published alpha.0 SDK/CLI build.

| Entry path                              | Parent Run                             | Remote child Run                       | Result                                                    |
| --------------------------------------- | -------------------------------------- | -------------------------------------- | --------------------------------------------------------- |
| Browser user, Preview → Production      | `01a19be0-90a0-74d9-b899-808cf8d2c522` | `0bca80c8-561c-4f95-a5b5-e01cb7b16fcc` | Both finished; `REMOTE_PREVIEW_20261102_1849` returned    |
| Browser user, Production → Production   | `01a19be3-3ea7-744f-83dd-c642ebf41ec5` | `3fb82451-8ed4-4109-ba55-b1f21e17a8b9` | Both finished; `REMOTE_PRODUCTION_20261102_1853` returned |
| User OAuth API, Production → Production | `5cee4ebe-a58e-49c9-9108-342b912e1e35` | `0812e336-d83b-4132-a09d-cfd9a52120e3` | Verifier passed all parent/child/target/result assertions |

Browser evidence includes actual `agent` receipts and completed `runWait` outputs,
plus finished parent Trace records. OAuth API verification directly read both
Runs, the target Session and message histories. The child's `parent_run_id`
exactly matches the parent above; its Session has target Agent ID
`01a0a903-48d6-7764-bd9d-6260bb2117c2` and environment `production`. Its marker was
`REMOTE_SMOKE_d5e8698e-3ec3-4412-985c-58606f1b49bf`.

The previous short-lived OAuth token returned 401 before creating a Session.
Normal sign-in using the same application and existing scopes restored access;
no additional OAuth application or grant was created.

Consumer organization usage showed both caller and target-installation usage,
attributed to the current user. After the two browser calls it recorded 8 model
requests, 21,056 tokens and 61.948 usage points, with no pending/unpriced usage.
After the API call it showed 12 requests, approximately 31.6K tokens and 81.65
points. This verifies product usage attribution, not an external invoice audit.

### UI issues observed

- New conversation → switch from Preview to Production produced one
  `getPlaygroundComputerTarget` 404 and a full-page error. Refresh restored the
  Playground; the Production invocation then completed. Stable reproduction has
  not yet been established.
- The target installation's Run list returned HTTP 200 with `items: []` after
  both browser remote children finished. Delegated child execution is therefore
  not fully represented in that installation view. The empty list is not evidence
  of absent execution or absent metering.

### Remaining acceptance boundaries

- The real local caller → hosted MuseDAMChat `pnpm verify:remote` OAuth path has
  not been completed. The earlier alpha.0 Project-Key/CLI-login attempt failed;
  it is not representative of the newer App Server login bridge.
- Automatic CLI login propagation needs a new interactive Session. The example
  now pins the released alpha.1 CLI with that App Server bridge, but a real
  local-to-hosted run using it remains unverified. The successful hosted evidence
  above came from the existing alpha.0-built deployments, not a republished alpha.1
  Worker.
- Fresh UI-driven installation, uninstalled/revoked-access negative cases,
  a separate non-admin browser user, private asset isolation and Connector
  credential forwarding were not tested. Prompts asked only for harmless text.
- The store launch URL still points to the original Preview web app; this test
  calls the canonical Production Agent and does not validate that launch UI.

No live credentials, raw customer data, screenshots, generated packages,
databases or process logs are committed. No cluster/production database access,
platform deployment or merge was performed during this recheck.
