# Verification

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
