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

## Not yet verified

`pnpm verify:remote` now provides the actual local-caller-to-hosted-target entry.
It packages only the caller, requires a user OAuth token, and reads the child from
the real issuer's Agents API. It has **not yet been run against MuseDAMChat**.
Creating the dedicated test OAuth application was blocked by automatic approval
review pending explicit user authorization for the client and its scopes. No
client credentials were issued by that rejected action. Existing applications'
callbacks and secrets were not changed. The second step, deploying the caller to
`softwarecopyright` and exercising cross-tenant admission, has not started.

The local fixture registers two definitions on one local API/Worker with local
Project Key admission. It is **not** a cross-tenant OAuth test and did not invoke
hosted MuseDAMChat. No claim is made about two independent hosted deployments,
consumer billing, private data isolation or Connector credential forwarding.

For the intended hosted demo, MuseDAMChat in tenant `tezign` was observed at
Preview v27 with no Production release. Tenant `softwarecopyright` had no store
installation. Store approval, Production publication, consumer installation and
an OAuth-admitted caller remain prerequisites to running `pnpm verify` against
that target. The earlier direct Preview smoke is not remote-call evidence.

No live test access token, credentials, generated package, database or process
logs are committed. CI has not been run for this change.
