# Verification

Last verified: 2026-09-12.

This record distinguishes local Agent checks from real Feishu message delivery.

## Current Tool progress SDK upgrade

The example pins public SDK and Contract `0.1.260911-alpha.3`. Checks used the
published CLI `0.1.260911-alpha.0` with Node.js 24.16.0 and pnpm 12.1.0.

| Check                                 | Result                                                                                                                                                                                                                 |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public dependency installation        | Passed; SDK and Contract resolve to `0.1.260911-alpha.3` with registry integrity hashes                                                                                                                                |
| Frozen installation and TypeScript    | Passed without `--force` after updating the lockfile                                                                                                                                                                   |
| Published CLI `agent validate`        | Passed; one Agent, one Channel and one custom Tool                                                                                                                                                                     |
| Published CLI `agent pack`            | Passed; eight payload files                                                                                                                                                                                            |
| Published preset progress smoke check | Passed against a local provider fixture: one card, current Tool parameters/result, 12 spinner frames without new model events, animation stopping, final-answer replacement, 12.4-second duration and terminal cleanup |
| Published preset recovery smoke check | Passed; receiptless confirmation and stale-delivery correlation                                                                                                                                                        |

The package content hash is
`sha256:0354876eb4cb72e1c560c8e2a5ec37a4874e4360df8a395197e93273111fba57`.
The archive SHA-256 is
`aa4acc7392536e8dc87095d3cec61134f77ef21dfe82e7554b4ce851a1c1739d`.

Immediately after publication, npm exposed the version metadata while its default
tarball URL still returned 404; installation succeeded after the public tarball
became available. The final manifest uses an exact version, and the lockfile uses
normal registry resolution without a cache-busting URL or local tarball.

The local checks above made no real Feishu requests. Live animation and
generation-time acceptance remain separate from the deployment readiness below;
the version 5 delivery evidence belongs to the previous SDK.

## Preview v6 rollout (2026-09-12)

The existing test installation was paused before publication. Its receiver
acknowledged `stopped`; all 12 recorded operations in the existing test
conversation had succeeded, and its 29 delivery records had no pending item,
paused delivery or last error.

The example was rebuilt with public SDK `0.1.260911-alpha.3` and pushed to the
same Studio Project and Worker. Preview version 6 is active on deployment
`01a09142-8ba7-76cc-84c1-947a331319bb`, with Agent version
`01a09142-9082-74b1-b616-07c6b9db5167`. The Worker content hash is
`sha256:4cb2350b77486c1b38a40c8f030992afde6af2c34193a336961564334065cefc`.

The original installation was resumed. Receiver revision 46 reports `ready`,
with matching desired and active targets on the new deployment and no last
error. Installation identity, environment configuration and conversation history
were retained. Production was not promoted. This verifies Preview publication
and receiver readiness; the tester still needs to check the new cards and
animation in a real Feishu conversation.

## Previous streaming SDK upgrade (2026-09-11)

The previous check used public SDK and Contract `0.1.260911-alpha.2`, with the
published CLI `0.1.260911-alpha.0` and its bundled native Runtime. No private
CLI build or workspace-linked SDK was used for these checks.

| Check                                                | Result                                                                                                                                  |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Frozen public dependency installation and TypeScript | Passed                                                                                                                                  |
| Published CLI `agent validate`                       | Passed; one Agent, one Channel and one custom Tool                                                                                      |
| Published CLI `agent pack`                           | Passed; eight payload files                                                                                                             |
| Published preset smoke check                         | Stream update and terminal card passed; receiptless operator confirmation and stale-delivery correlation passed against a local fixture |
| Existing Preview upgrade                             | Published as version 5; receiver ready on the new deployment with no last error                                                         |
| Real hosted model request                            | `Reply with pong only` returned `pong`, finish reason `stop`, on version 5                                                              |

The package archive content hash is
`sha256:fb58965fb0d38a62606396bff04f111b2de360032b4de9d78ea4045bc8076a2c`.
Before switching Preview, new input was paused, the receiver acknowledged its
stop, and the existing test conversation had nine sent deliveries, no paused
delivery, and a successful latest operation. The existing installation was
resumed on the new deployment; its credentials and history were retained.
Production was not promoted.

Three subsequent real private messages completed on version 5. For each message,
Feishu acknowledged the processing reaction, card creation and reply, streaming
closure, final card update, and reaction removal. All 20 delivery tasks succeeded
on their first attempt, with no paused delivery or last error. A reply in the
existing conversation recalled its test code from before the SDK upgrade.

The first two answers were short and produced no intermediate `stream-update`.
The third answer updated the same CardKit card twice before finalization; both
incremental updates were acknowledged by Feishu. Ordered continuation cards for
answers exceeding the per-card limit remain a separate real-message check.
The local preset fixture makes no Feishu requests and remains distinct from
these provider acknowledgements; no Feishu UI screenshot was captured.

The previous deployment's persisted Feishu replies also confirm that
`current_sender` returned a stable sender-scoped `feishu:` principal in Preview,
and that the same conversation recalled its test code in later messages. These
are historical delivery records, separate from version 5 streaming acceptance.

## Earlier validation

The checks below were performed on 2026-09-10 with a locally built CLI (Bun
1.3.14) and native Worker Runtime (Rust 1.94.1).

## Packaging and local execution

The first check used the public SDK `0.1.260910-alpha.1`. Type-checking passed,
but Agent validation failed because the SDK's emitted JavaScript referenced
`channels.js` instead of `channels/index.js`.

The following checks passed after installing SDK and Contract
`0.1.260910-alpha.2` from the public npm registry. The checked-in lockfile uses
registry packages, without local tarballs or workspace links. A subsequent
`pnpm install --frozen-lockfile` also passed.

| Check                                         | Result                                                                                                      |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| TypeScript type-check                         | Passed                                                                                                      |
| Compiled CLI `agent validate`                 | Passed; one Agent, one Channel and one custom Tool discovered                                               |
| Compiled CLI `agent pack`                     | Passed                                                                                                      |
| Native Runtime requirements                   | All four Channel capabilities and their DO bindings present                                                 |
| Credential handling                           | Environment names and secret classification present; test credential values absent from every archive entry |
| Start native Worker Runtime and Agent         | Passed                                                                                                      |
| Real model request: `Reply with pong only`    | Returned `pong`                                                                                             |
| Real model request to invoke `current_sender` | Tool executed and returned the local caller's identity                                                      |

The two model requests used the local Agent HTTP entrypoint. Their principal was
`local-user`; they do not establish that Feishu sender identity or delivery works.
The Feishu credentials were unset for these requests; no real Feishu connection
was attempted.

After the journal fix was published, the example was upgraded to public SDK and
Contract `0.1.260910-alpha.3`. Type-checking, validation and packaging passed
again. That upgrade's archive had eight payload files and content hash
`sha256:964c5890ce10002ac1878a5d6c51daa46e181a9d6bd162b9626db4a124422793`.

## Feishu acceptance

The example was published to a dedicated Studio Project in Preview using the
locally compiled CLI. Its exact Preview deployment was active, and a hosted
model request returned `pong` with finish reason `stop`. Production was not
promoted.

The initial hosted receiver failed because the production Runtime deployment
omitted `WORKER_PLATFORM_HOST_URL`. The operator supplied the internal Web
Service URL and restarted the Runtime. With the Feishu credentials configured
as Project defaults for Preview, the receiver reached `ready` with no last error
on the published deployment.

The real private message `Hi` was accepted and persisted with a sender-scoped
`feishu:` principal. The Agent completed successfully and persisted the reply
`Hi! How can I help you today?`.

The first reply was blocked by an SDK journal bug: model usage was written as a
raw v1 `data-model-call` event among v2 Channel events. Reading that page failed,
so the Address could not project the completed run into an outbound reply.
[GEA PR #412](https://github.com/bmrlab/gea/pull/412) fixes the writer; SDK
`0.1.260910-alpha.3` is published and the rebuilt example is active in Preview.

The affected Preview session was repaired through an owner-side Durable Object
transaction after an exact-state dry run. Only the malformed event and its
event-ID index changed. The original messages, usage and successful run were
retained; recovery did not call the model again. The existing Address then
projected and sent one reply. Feishu acknowledged the send with a message ID,
and delivery status is `sent` at attempt 1, with no paused delivery or last
error. The same installation now runs the clean public-SDK bundle and reports
`ready`; temporary recovery code is absent from that bundle.

Remaining real-message checks beyond the persisted sender-Tool result:

- Compare two users' principals and conversation history.
- Preserve the conversation after restarting the local receiver.
- Reject new messages when the sender allowlist is `[]`.
- Confirm duplicate delivery of the same event does not execute or reply twice.

Real private-message ingress, Agent completion, Feishu reply delivery and recovery
of the original blocked operation are verified. The other checks listed above
remain separate acceptance checks.
