# Verification

## Hosted recheck after Web restart, 2026-09-20

- The unchanged full verifier passed against Preview v4 / Web v0.55.5 at 14:11:57
  UTC after the operator restarted Web. Computer preparation/read/write/exec,
  uploaded inputs, exact output contents, continuation, cross-Session Artifact
  reuse, paginated history and Connections discovery all passed in one run.
- Sessions: `a889645b-bc6b-4b7c-ae82-c13a8438893c` and
  `c3a36595-2270-428c-af8c-d13ebe9f5e10`. Runs:
  `01a0bf28-3489-70e9-ab86-55b997963b46`,
  `01a0bf28-6a85-7780-8f64-eef5b5bf6f81`,
  `01a0bf28-85ad-75fe-b5e2-386770dcd971`.
- Report: `.gea/verification.json`. The temporary Project Key was revoked; no
  Production promotion or verifier relaxation. Earlier failures below remain
  historical, and the local GEA Redis resilience fixes were not deployed.

## SDK 0.1.260920-alpha.3, 2026-09-20

- Public SDK alpha.3: frozen install, types and two HTTP fixture tests passed.
- The alpha.1 macOS CI artifact passed validation/pack and the complete real-model local verifier: Session `95ebaa0f-3720-4ded-98f1-5a6a34d920b8`, Computer preparation/read/write/exec, uploads, exact output contents, output reuse and paginated history. Its native API listener closed after verification. Registry publication/integrity verification is recorded separately in the root acceptance record.
- Final Preview v4 was pushed with the alpha.1 macOS artifact, deployment `01a0bebd-264d-7357-9df5-a0590618a710`. Its content hash matches v3 below; no Production promotion.
- Preview v3 is ready: deployment `01a0beb0-05e8-70b8-9b58-4d0ff79f300b`, content `sha256:a939d0c26f8c23617c89385862a7566d1a3e0109f7b67c953d76e10b93eba265`. This push used published CLI alpha.0 while alpha.1 was building.
- Hosted Session `226a509a-94fa-4015-bacc-95236f2acac3` passed Computer prepare/write/read/exec and input uploads. The first Run POST returned HTTP 500 `Agent stream initialization failed.` Run `01a0beb0-cecf-719c-b3d9-dbadf4d42f4c`, Trace `e2aa701bae75bfc5dd17eeb20fde5ae7` records `Worker Durable Object resident capacity is exhausted`. Full hosted acceptance remains failed. The temporary Key was revoked; no Production promotion.

## SDK 0.1.260920-alpha.2, 2026-09-20

- Frozen installation, types, two HTTP fixture tests, validation/pack and the complete local real-model verifier passed. Local Session `9c990b18-5ce8-4180-a3a9-8c80d9f48b93`; evidence copied to `/tmp/opengea-alpha2-agents-api-local-report.json`.
- Hosted Session `509214c2-494e-403c-a751-4ef8c1eb9927` passed Computer prepare/read/write/exec, upload, file-bearing Run admission, artifact contents, follow-up, cross-Session output reuse and paginated history. Its final Connections read returned 403 because the temporary Key omitted `connections:read`. README now includes that required grant. The earlier attachment admission 403 did not recur on this path.
- Separate hosted attempts exposed stream registration/AbortError (`01a0bd74-35bc-75fb-9e32-88ceb4b0be06`), a history GET 429 (`8005b2c2-188b-4bce-af43-b13c16d5572e`), and Computer 412 (`efbeb697-ad94-4a21-9363-ee751083dd44`). The verifier now honors bounded GET retry delays and polls hosted Runs every two seconds; writes are never retried. The GET recovery fixture failed before the fix and passes after it; a separate fixture confirms Session creation is not retried on 429. The complete local verifier also passed again after the caller change (Session `ed68713d-3a7c-44d8-b646-9afffcf3d748`). These hosted attempts are not combined into a full hosted pass.
- All temporary acceptance Keys were revoked. No authorization schema or production deployment was changed by this update.
- Existing Preview Worker v2 is ready: deployment `01a0bd70-7aab-725b-b266-d249845c3295`, content `sha256:4b6cd68e33298508acaf5022b8f610f0f3e49742dd85f3d041e369b78ef59ee9`. No Production promotion.

## Web v0.55.1 hosted recheck, 2026-09-20

- Confirmed the production Web Pod runs `musecr.azurecr.cn/bmrlab/gea-web:v0.55.1`. Preview Computer prepare/write/read/exec all returned 200; readback matched the prepared bytes. The consumed-request 500 is resolved.
- Fixed two caller assumptions exposed by hosted validation: content downloads return a signed HTTPS object-store redirect (followed without the API credential), and Preview multipart uploads must explicitly select `environment=preview`. A default Production upload is intentionally inaccessible to a Preview Run.
- Hosted execution still fails for an uploaded attachment: Session `a3a02b9b-4fbf-42c3-a114-6d07f830e206`, request `01a0bcaf-1d81-70e9-a64f-75bf07d7fcaf`, HTTP 403 before Run creation. Source inspection identifies a missing principal in the second file-validation scope; no authorization bypass was applied.
- A plain-text control request was admitted (202) and its Web stream completed: Session `7f2aed9d-255f-455f-940b-06d411400f62`, Run `01a0bcaf-9580-76af-970b-c57a6b53653c`. This does not pass the full attachment/output verifier. All temporary Keys were revoked.

## SDK 0.1.260920-alpha.0, 2026-09-20

- Published SDK installation, types, validation/pack and the complete local real-model verifier passed with the published CLI artifact. Session `e86a2133-0aea-417c-bc9c-ada9c16fb6e6`: prepare/read/write/exec, upload, exact output bytes, reuse and history passed.
- Existing test project Preview v1 is ready: deployment `01a0babb-fb4f-709d-9a96-41c47c7bdd97`, Worker `01a0babb-fb3f-7572-aab1-2d21e093622c`.
- Hosted Key creation originally failed with `Studio API permission projection failed`. Production logs confirmed missing SpiceDB file/Computer relations. Additive schema synchronization restored successful creation for those permissions; diagnostic Keys were revoked.
- The next hosted check reached Session Computer but returned HTTP 500: Session `fdcb2b19-2c2f-4790-a6cd-b3f003adc2cc`, request `ee057be5-0130-486e-bf25-db6e095290ec`. [GEA #497](https://github.com/bmrlab/gea/pull/497) fixes the reproduced srvx consumed-request failure in the cloud Computer adapter. The Web fix still needs deployment; hosted file/Computer execution is not claimed passed.
- Temporary test Keys were revoked. No Production promotion.

## SDK 0.1.260918-alpha.0, 2026-09-18

- Updated public SDK/Contract dependencies and lockfiles to `0.1.260918-alpha.0`; no workspace-linked SDK. Node 24.16.0. Frozen installation, type checking, Agent validation and packaging passed.
- Packaging used the Session/Run-capable source CLI from GEA `73864e902`; CLI npm dependencies remain at their previous published version. No CLI release was triggered.
- This records local checks, not a Production deployment.

## SDK alpha.2 and published CLI acceptance, 2026-09-17

- Public SDK `0.1.260917-alpha.2` and CLI `0.1.260917-alpha.0`; frozen installation, type-check, validation and packaging passed.
- The complete real-model `pnpm verify` flow passed on the published CLI's native Runtime: empty Session preparation, Computer read/write/exec, file upload, output content, output reuse and paginated history. Initial Session: `acfb4a91-719c-473c-af78-46aedef7f8fe`.
- This example's verification was local. No Preview deployment or Production promotion was performed for this example.

## SDK / Agent Core recheck, 2026-09-17

- Public Agent SDK and Contract `0.1.260917-alpha.0`; frozen install and TypeScript passed. Public CLI `0.1.260916-alpha.0` validated and packed the unchanged Core Agent.
- The complete `pnpm verify` flow passed against the matching Catalog v2 source CLI/Runtime (GEA `261f19618`, Runtime behavior from #479): empty Session preparation, Computer read/write/exec, multipart upload, real model/tool execution, exact output bytes, output reuse in another Session and paginated history. Initial Session: `2990edc9-0722-49fe-9179-2659f524cc8b`.
- SDK dependencies came from npm, not workspace links. This recheck was local; no new Preview deployment or Production promotion is claimed.

Historical baseline: 2026-09-15 (Asia/Shanghai).

## Environment

- macOS ARM64, Node 24.16.0, pnpm 12.1.0.
- Public npm `@gea-ai/agent-sdk` and transitive Contract `0.1.260915-alpha.0`.
  Registry tarballs for all six SDK packages matched their CI artifacts and
  SHA512 metadata; 79 public exports were checked in an isolated consumer,
  including compiling the actual Agent Core WASM through its binary loader.
- Locally compiled CLI from GEA `1f81daac5` (release `170cf55f` plus the two CLI corrections below);
  matching native Worker Runtime from the same release source. No local SDK
  links, stub Worker execution or simulated model responses were used by this
  example's `pnpm verify` run.
- Actual Creative Reasoning model calls using the Agent's `model: "auto"`
  selection and Rust/WASM Agent Core.

## Published CLI recheck

CLI `0.1.260915-alpha.0` was released from merged GEA main `f06e0c904`.
[Release workflow](https://github.com/bmrlab/gea/actions/runs/34973131005)
passed its macOS ARM64 and Windows x64 build/smoke jobs and npm publication.
The wrapper and both platform packages are publicly available with matching
`latest` tags; downloaded tarballs match the tested CI artifacts byte-for-byte.

The macOS release artifact was installed in an isolated consumer with its bundled
Runtime. This example's full real-model HTTP verification passed again: Session
preparation, Computer operations, upload, Run completion, exact output bytes,
output reuse in another Session and paginated history. The broader checks below
record the earlier source-build acceptance; they were not all rerun for release.

## Passed checks

| Check                                                                          | Result                                                                                      |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Frozen npm dependency installation, TypeScript, Agent validation and packaging | Passed                                                                                      |
| Empty Session → Computer prepare, write, read and exec → multipart upload      | Passed; message history remained empty until a Run was created                              |
| Real Agent reads uploaded bytes and prepared Computer, then saves output       | Downloaded report matched both source strings exactly                                       |
| Second turn in the same Session                                                | Prior history retained; model recalled `savePreparedReport`                                 |
| Output reused as `file_id` in a second Session                                 | Second report contained the first report's exact bytes                                      |
| `/files/{id}/content` and `/artifacts/{id}/content` for an output              | Returned identical contents                                                                 |
| Paginated history                                                              | Followed `next_cursor` and found the original file reference                                |
| Signed upload grant with binary bytes, metadata patch, inventory and delete    | Bytes `[0,255,128,1,254]` survived; deleted content returned 410                            |
| Stream disconnect and reconnect                                                | Execution stayed running; reconnect received events                                         |
| Overlapping Run and Computer write                                             | Both returned 409 while a Run was active                                                    |
| Explicit cancellation                                                          | Run reached `aborted`                                                                       |
| Source reload to a new deployment                                              | Same Session retained every earlier turn; model recall and prepared Computer content passed |

Primary run: Session `014c2cbd-aa43-4c29-88ef-f27e297e1284`, followed by
Session `59583fc5-3856-4a45-afa7-788186c95c46`. The three initial Runs were
`4a1cf53e-a2dd-4b8a-9464-e1dcaae4a9cf`,
`2ec77f0c-1e56-4296-838e-4546d469e4ba` and
`e750bc1d-e72a-4074-8072-dc4e15af8539`.

The local GEA regression suites additionally passed API-key Connection import,
rotation, revision conflicts, disconnect and OAuth callback tests against HTTP
provider fixtures, plus native Axum/SQLite/V8 execution tests. These are protocol
tests, not evidence of a new MuseDAM/Feishu authorization or delivery check.

## CLI corrections found during acceptance

1. Bun adds charset parameters to multipart text file types. Passing the stored
   `text/plain;charset=utf-8` directly into a message caused Run admission to
   return 400. The local file-to-message conversion now uses the MIME essence
   (`text/plain`) while preserving the stored download Content-Type. The added
   regression failed before the fix and passed afterward.
2. Local Agent Session storage used deployment namespaces. Continuing after a
   source reload created another journal and hid earlier messages. Local staging
   now uses the stable project Worker namespace for `AGENT_SESSIONS`. A native
   regression reproduced the missing history and passed after the correction;
   the compiled CLI also passed real-model hot reload and recall.

These changes affect local CLI development. Packed Agent artifacts, cloud
deployment storage and the published SDK are unchanged. Start new local Sessions
when upgrading from the earlier development builds: existing deployment-scoped
journals remain stored but are not automatically migrated to the Worker namespace.

## Process restart boundary

After stopping and restarting the compiled CLI, the same Agent/Session IDs,
full message history and managed file contents were still readable. As specified
by the Computer contract, the prepared live environment had expired: its old
reference was rejected with `COMPUTER_OPERATION_FAILED` (HTTP 500), and the Runtime
reported that a new Session was required. Durable workspace bytes remained on
disk. This differs from source hot reload, which preserves the live environment.

## Scope

This example's Local flow was executed. Its Preview configuration uses the cloud
HTTP contract, but this new Agent was not published to Preview and its OAuth flow
was not exercised against production. The operator's production-cluster update
is separate from these local results. CLI publication is verified separately above.
