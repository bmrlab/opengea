# Verification

Last verified: 2026-09-10.

This record distinguishes local Agent checks from real Feishu message delivery.
The CLI was built locally with Bun 1.3.14 and the native Worker Runtime with Rust
1.94.1. The npm CLI release was not used.

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

Remaining real-message checks:

- Invoke `current_sender` from Feishu and verify a stable `feishu:` principal.
- Compare two users' principals and conversation history.
- Preserve the conversation after restarting the local receiver.
- Reject new messages when the sender allowlist is `[]`.
- Confirm duplicate delivery of the same event does not execute or reply twice.

Real private-message ingress, Agent completion, Feishu reply delivery and recovery
of the original blocked operation are verified. The sender Tool and other checks
listed above remain separate acceptance checks.
