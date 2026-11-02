# Verification — 2026-11-02

Published SDK **0.1.261102-alpha.0**, CLI **0.2.261102-alpha.0**, Node.js
**24.16.0**, pnpm **12.8.1**, macOS arm64 native Runtime.

## Passed

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

## Actual hosted-target attempt: blocked by caller identity

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

## Hosted-to-hosted OAuth attempt: deployment preparation blocked

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
case. The platform fix must be reviewed and deployed before continuing the live
attempt. No platform deployment was performed during this verification.

**No parent Run or remote child Run was created. This is not a successful
cross-tenant remote invocation.** The target's store launch URL still points at
its existing Preview web app; this attempt invokes the Production canonical Agent
ID directly through the caller and does not validate that launch UI.

## Not yet verified

`pnpm verify:remote` provides the actual local-caller-to-hosted-target entry.
It packages only the caller, requires a user OAuth token, and reads the child from
the real issuer's Agents API. This local OAuth-admitted path has not been run
against MuseDAMChat; the ordinary local Project-Key attempt above failed.

The local fixture registers two definitions on one local API/Worker. It is not a
cross-tenant OAuth test. Hosted parent/child completion, result return, consumer
billing, private data isolation and Connector credential forwarding remain
unverified. No live token, credentials, generated package, database or process
logs are committed.
