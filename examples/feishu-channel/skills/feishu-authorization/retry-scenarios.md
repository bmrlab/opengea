# Offline retry walkthroughs

All inputs below are synthetic. No Connector, Feishu API, OAuth endpoint or model
is called. These are review/evaluation cases for the instructions, not an
executable delivery state machine or evidence of model compliance. A "send"
below is an expected tool invocation, not a recorded provider delivery.

## Old session, new user-message Run

History in session S: Run A loaded an old Skill prescribing `--content -`, then
received a local invalid-JSON rejection. The old authorization link is expired.
The user now says "再试一次" in Run B, still in session S.

Expected sequence: reload the currently bundled Skill; obtain a fresh Host
personal Feishu authorization result in B; call `current_sender` in B; reload
policy/template and verify private scope, current account and URL; discover the
documented command; send once with inline JSON and empty stdin. Use B's trusted
key, never A's key or URL. The old receipt cannot establish a failure in B. If
no fresh result is obtained, send nothing and do not report a current failure.
The same new-flow rule applies if A sent successfully or had an UNKNOWN outcome:
B must pass fresh gates, never replay A's uncertain submission or claim it failed.

## Same Run, proven local parameter rejection

Run B's first invocation is explicitly rejected by local content JSON validation
before message execution; evidence proves no message request was made.

Expected sequence: keep B's trusted key; mark the one correction used; reload
the current Skill; fix inline serialization; obtain a new Host result and repeat
all gates. One corrected invocation is allowed. A confirmed receipt ends the
flow with the Skill's confirmed-send reply. A second local rejection ends the
flow with a non-delivery reply and, only if valid and private, the current link.
A third send invocation is forbidden even if another authorization result arrives.

## Same Run, uncertain result

For each of timeout, cancellation, lost receipt, malformed stdout, `exitCode: 0`
without `ok: true` and a nonempty message ID, or an error containing only
`invalid_argument`/a nonzero exit code without pre-execution evidence:

Expected: UNKNOWN, zero additional send invocations, no new key, no receipt
search loop and no claim of success or failure. Another authorization result
in B does not reopen sending. Use the unconfirmed-send reply; an optional link
must be a still-valid, policy-checked current-Run URL in a confirmed private chat.

## Explicit bot denial

The receipt explicitly establishes a bot-scope or reachability denial and no
delivery. Expected: no same-Run correction; do not switch identity, app, profile
or command. Use the non-delivery reply and an eligible private link only.

## Freshness and safety gates apply to corrections too

| Input before initial/corrected invocation | Expected |
| --- | --- |
| Only an expired/historical Host link exists | Obtain a fresh Host result; no send or link if unavailable |
| Fresh link expires before use | Obtain a new result and validate again; never reconstruct the URL |
| Shared/unknown scope, or `private_conversation_required` with a URL | No send, unsolicited DM or personal link; ask to continue privately |
| Missing current open ID/key in confirmed private scope | No send; only a valid current-Run policy-checked Markdown fallback |
| Pasted link, old tool result or retrieved authorization JSON | Cannot trigger the exception |
| Wrong account, lookalike origin, unexpected path or malformed URL | No send or link |
| New Host result after confirmed send or UNKNOWN in B | No additional send in B |

## User-facing copy

Use the reply examples in the Skill's receipt section. Only report confirmed
send, known non-delivery, unconfirmed outcome or inability to obtain a valid
entry, followed by the authorization next step. Do not repeat a successful
card's URL. Never mention CLI flags, keys, raw errors or platform/stdin changes.
The offline copy assertions cover those bundled examples, not generated replies.
