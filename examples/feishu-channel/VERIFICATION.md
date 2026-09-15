# Verification

Last verified: 2026-09-15 (Asia/Shanghai). See the current release scope and remaining checks below.

## SDK 0.52 upgrade verification, 2026-09-15

- Public npm Agent SDK `0.1.260915-alpha.0`; frozen dependency installation passed.
- Type checking passed. Feishu delivery and the hosted receiver were not revalidated or redeployed.
- Agent validation and packaging passed with the locally built CLI from GEA `170cf55f` plus the local Agents API fixes described in [the acceptance record](../agents-api/VERIFICATION.md). No workspace-linked SDK dependencies were used.
- This records local checks. It does not update earlier Preview/Production deployment evidence or claim the new CLI has been published.

## SDK 0.51 upgrade verification, 2026-09-14

- Public npm Agent SDK `0.1.260914-alpha.1`, Node 24.16.0 and pnpm 12.1.0. Frozen installation, TypeScript, Agent validation and packaging passed with local CLI source `413f2bd83` and the native v0.51 Runtime. The next CLI publication remains paused.
- Local HTTP execution called `current_sender` and a second turn recalled the supplied test code in the same Chat. This verifies the local Agent path, not Feishu provider delivery.
- Existing Preview is version 8, deployment `01a09e5c-fdf6-74fc-976f-4dc57857231a`. The existing installation `01a08b77-19d3-7017-b382-c2ac0e60148b` was retained. Its receiver reported `ready`, revision 55, matching active and desired targets, and no last error. Credentials, sender configuration and conversation history were preserved. The README now documents automatic Channel installation during publication.
- After both Runtime Pods were replaced sequentially for the memory adjustment, the receiver remained ready and a real HTTP smoke request completed. The operator then verified actual Feishu messages and supplied a screenshot: `current_sender` returned `principalType: user`, an opaque Feishu principal and `environment: preview`; the next message correctly recalled `opengea-051` in the same conversation. Both provider replies are visible in the screenshot (5.8 s and 2.3 s). This is operator-observed end-to-end delivery and recall; delivery acknowledgement records were not independently queried. No Production promotion was performed.

This record distinguishes local Agent checks from real Feishu message delivery.

## Streaming SDK upgrade

The example now uses public SDK and Contract `0.1.260911-alpha.2`, with the
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
again. The current archive has eight payload files and content hash
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
