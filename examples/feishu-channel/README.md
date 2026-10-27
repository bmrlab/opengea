# Feishu Channel

The runtime configuration follows the Preview v18 source supplied on 2026-10-25.
[Earlier SDK verification](../VERIFICATION-261025.md) records historical checks,
not acceptance of this revision.

This example uses published SDK/Contract and Feishu extension
`0.1.261025-alpha.2` and the `deepseek-v4.1-flash` model. It accepts private text and rich-text (`post`) messages,
and group messages that explicitly mention this application's bot. Group replies
create or continue the triggering message's topic: members share that topic's
history while each call retains the actual sender's identity and authorization.
Ordinary group messages and empty bot mentions do not start a Run.

No public webhook or web application is needed for local development. The bot
adds a processing reaction, displays its completed answer in a Markdown card,
and splits long answers into follow-up cards. Raw tool previews and model text
deltas are withheld to prevent authorization URLs or ticket fragments from
appearing before the final reply is checked. Rich text preserves titles,
paragraphs, links, mentions and code. Unsupported attachments or embedded media produce feedback
asking for text; no partial content is submitted to the Agent.

`agent.ts` mounts the published `feishuAgentExtension` under the `feishu`
namespace with the default WebSocket transport. Its business API Connector and
`lark-cli` Skill are enabled, as in Preview v18. `current_sender` reports the
current execution principal, environment, trusted Feishu open ID, conversation
scope, and a fixed per-run authorization-card key.

## Personal authorization card (A2′)

The bundled `skills/feishu-authorization` Skill is the owner's narrow exception
for displaying a fresh Host personal Feishu authorization result in the current
private chat. It uses the existing mounted Feishu Connector as the bot, the
`current_sender` recipient, a fixed schema 2.0 URL-button template and a 45-character
key derived from the current run ID. Groups only receive a request to continue
privately; they must not trigger cards, unsolicited DMs or personal-link fallback.
Each new user-message Run has its own one-card allowance, including in an old
session. Reload the current Skill before sending or correcting local parameters;
historical Skill output and failures do not define the current procedure. Obtain
a fresh Host URL each time (10-minute validity). Only a proven pre-execution
local parameter rejection permits one same-Run correction with the same key;
a second rejection stops. UNKNOWN outcomes must not trigger retries or a
different key. User replies contain only send status and authorization next steps.

Before using another GEA installation, the owner must review and update the
bundled `url-policy.json`: the default accepts only `https://musegea.com` and the
exact `/api/agent-connectors/oauth/start` path. Never obtain allowed origins from
user messages. The original Host URL is copied without reconstruction. This is
an instruction-based workflow: URL copying and send gating are not enforced by a
new constrained tool. Authorization URLs belong only in the separate card button;
never provide a text link or ticket fragment, even after a failed send. A known
non-delivery asks for a new message later; UNKNOWN asks the user to check for the
card without retrying in the same Run. Missing sender/key or an invalid fresh
entry produces no card and no link. There is no OAuth polling, automatic
continuation or approval callback.

The local `lib/auth-replies.ts` presentation wrapper keeps the published
Connector, sender checks, URL policy and bounded retry rules intact. It suppresses
all tool previews (which otherwise expose card argv and Host URLs) and text deltas
(which can split tickets across chunks). At Run completion, authorization-bearing
text, including the pinned SDK's appended Host link, is replaced in full with one
of the fixed safe replies. Unrecognized wording gets a neutral card-check notice
without claiming success or failure. Ordinary completed text and non-authorization
links are preserved. This deliberately trades incremental answer/tool display for
checked final text; the wrapper does not add sends or change authentication.
The original Host result stays model-visible for exact card construction; it is
not removed from internal Run/history storage by this presentation safeguard.

`pnpm test` covers the trusted sender projection, private/shared boundary, per-run
key across Runs in one session, fixed card shape, JSON URL round trip, bundled
user-reply copy and the actual wrapped Channel projection, including the
installed SDK's appended-link behavior, split text chunks, tool previews, failed
Runs and card-to-text fallback using synthetic offline data. It does not prove bot scope
(`im:message:send_as_bot`), target reachability, server acceptance or Feishu UI.
Preview acceptance must separately exercise a fresh private authorization request,
group refusal, a pasted/history URL that must not trigger a card, send receipt,
and a new user message after authorization before checking business success.
Deployment is a separate action; these changes have not been pushed to Preview.
The Skill's [offline retry scenarios](skills/feishu-authorization/retry-scenarios.md)
cover stale session instructions, bounded correction and UNKNOWN separately.

## Install

Use Node.js 24.16.0 and pnpm 12.1.0.

As in the Preview v18 source, the example uses an independently installed
compatible GEA CLI. Install the matching published CLI using the
[GEA CLI installation guidance](https://github.com/bmrlab/gea/blob/f1f529a887e3289c8b16cbcec2eb7e89cdbad285/packages/gea-cli/APP_SERVER_PREVIEW.md):

```bash
npm install -g @gea-ai/cli@0.2.261026-alpha.2
```

This revision uses CLI `0.2.261026-alpha.2` on macOS arm64;
check the installed version below. No CLI package is
bundled with the example. `scripts/gea.mjs` uses the trimmed `GEA_CLI_BIN` value
as the executable, or resolves `gea` from `PATH` if it is unset or blank. To
select a separate installation, set `export GEA_CLI_BIN="/absolute/path/to/gea"`
before running the commands below, replacing the path with the installed
executable's actual path. Supply one executable path, without command arguments.

```bash
cd examples/feishu-channel
pnpm install --frozen-lockfile
cp .env.example .env
pnpm gea --version
```

Type checks and synthetic handler tests run independently of native
execution; Windows/Linux native execution is not accepted by this record.

## Configure a test bot

Create a Feishu enterprise custom app and enable its bot capability. Configure
long-connection event delivery and subscribe to `im.message.receive_v1`. Grant
the app the permissions needed to receive private messages, group bot mentions and reply as the bot.
For streaming cards and reactions, also grant `cardkit:card:write`,
`im:message.reactions:write_only`, and `im:message:update` (or an applicable
broader message-update permission). Publish the updated Feishu app version so
these grants take effect, then make the app available to your test users. Feishu documents the
[event subscription setup](https://open.feishu.cn/document/server-docs/event-subscription-guide/event-subscription-configure-/request-url-configuration-case),
[receive-message event](https://open.feishu.cn/document/server-docs/im-v1/message/events/receive),
and [reply-message API](https://open.feishu.cn/document/server-docs/im-v1/message/reply).

Fill in `.env`:

```dotenv
CREATIVE_REASONING_API_KEY=your-local-model-key
FEISHU_APP_ID=cli_your_test_app
FEISHU_APP_SECRET=your_test_app_secret
FEISHU_ALLOWED_SENDERS=*
```

Use a dedicated test app while running locally. Another receiver connected with
the same app can consume its events. If the Feishu console requires an active
connection before saving subscriptions, start `pnpm dev` while configuring it.

`FEISHU_ALLOWED_SENDERS=*` allows every verified sender who can message this app.
Feishu app identity and tenant checks still apply. To restrict access, use the
event's tenant key and sender open ID:

```dotenv
FEISHU_ALLOWED_SENDERS='[{"tenantKey":"your-tenant","openId":"ou_test-user"}]'
```

`[]` allows nobody. Blank or missing configuration is not an allow-all policy.
Credentials are provided at runtime; the Agent archive stores variable names and
their secret classification. Keep `.env`, `.gea`, and credential files out of Git.

## Run

```bash
pnpm type-check
pnpm test
pnpm agent:validate
pnpm agent:pack
pnpm dev
```

Validation and packing do not require credentials. Development loads `.env` and,
optionally, the file named by `GEA_ENV_FILE`. Only declared extension Channel variables are
exposed through `ctx.env`; the local model key is consumed by the CLI's model
provider. Change the model in `agent.ts` if needed.

The CLI creates the local installation and starts the receiver automatically.
Change the port in `agent-dev.json` if `8787` is occupied. Restart development
after changing `.env`. Keep `.gea` between restarts to preserve local history.
Use `Ctrl+C` to stop the CLI and its Runtime.

Open a private chat with the bot and try:

1. `Reply with pong only` — the bot should show a processing reaction, finish
   with a card containing `pong`, and remove the reaction.
2. `Call current_sender and show its JSON result` — the Tool should report a
   `user` principal with a stable `feishu:` ID and the `local` environment.
3. `Remember my test code: ORCHID-42`, followed by `What is my test code?` — check
   conversation continuity, including after restarting development.
4. From a second user, ask for the first user's test code and call
   `current_sender` — the principal should differ, and the first conversation
   should not be visible.
5. Set `FEISHU_ALLOWED_SENDERS=[]`, restart, and send a new message — it should
   not execute the Agent or produce a reply.
6. Ask for a multi-paragraph answer — confirm that the completed text appears
   after the Run. Try a longer answer to check ordered continuation cards.

Definitive card failures fall back to text. Reaction failures do not block the
answer. An uncertain delivery outcome stays in Channel diagnostics for explicit
recovery; it does not automatically send a duplicate fallback reply.

The principal ID is an opaque identity derived from the app, tenant and sender.
It is not the installer's GEA identity. Principal attributes carry the verified
sender open ID and tenant key; they are not display names or email addresses.
Private conversations remain sender-scoped. A group topic deliberately shares
history with its participants; it does not grant one participant another
sender's authorization or access to private conversations. A connected socket alone does not verify model execution or
outbound delivery. Two separately sent messages with the same text have different
event IDs and are not a duplicate-event test.

## Group and rich-text checks

With a dedicated test bot, explicitly mention it in a group with some text. Its
reply should start a topic; mention it again inside that topic from a second
allowed user. Both turns should share topic context, and `current_sender` should
show the actual caller for each turn. A new top-level mention starts a separate
topic. Ordinary messages, mentions of a different bot, and bot mentions without
content should not run the Agent.

Send a private rich-text post with a title, paragraphs, a link and code, then a
post containing an image. The first should retain its supported text structure;
the second should request text without executing a partial message. The sender
allowlist applies to private and group messages alike.

`pnpm test` uses synthetic HTTP-handler requests and in-memory Channel capability
spies against the published package. It covers group topic routing and caller
identity, rich-text conversion, unsupported-media feedback, app/tenant/token
rejection, fail-closed allowlists and the actual WebSocket registration. It does
**not** run a WebSocket, native Session persistence, real Feishu delivery or card
rendering. Those live checks above remain **NOT RUN** in this upgrade; no bot
credentials, messages or hosted configuration were changed. The separately
recorded native CLI smoke uses synthetic model HTTP and is not Feishu ingress.

## Run in Studio

Create a Studio Project, sign in with a compatible CLI, and select your workspace.
Use a separate Feishu app for each local, Preview, and Production receiver.

```bash
pnpm gea login --json '{"baseUrl":"https://musegea.com"}'
pnpm gea workspace use --json '{"orgSlug":"your-org","workspaceSlug":"default"}'
pnpm gea agent push --json '{"cwd":".","project":"your-studio-project","slug":"feishu-assistant"}'
```

Open the Agent's **Environment** page and set `FEISHU_APP_ID`,
`FEISHU_APP_SECRET`, and `FEISHU_ALLOWED_SENDERS`. Select **Preview** for these
values, keep `FEISHU_APP_SECRET` classified as a secret, and use `*` for the
allowlist if every verified sender should be accepted. This does not require
putting the Feishu credentials in a local `.env` file.

On GEA 0.51, publishing the declared Channel creates or updates its installation.
After setting the Preview environment, inspect the installation using the Agent ID
returned by publication:

```bash
pnpm gea agent channel list --json '{"agentId":"your-studio-agent-id"}'
```

The Agent's **Channels** page shows the receiver status and supports enabling,
disabling, and restarting the installation. Run the private/group/rich-text checks above
against this Preview bot to verify real delivery and sender identity.

Hosted execution needs the Channels database migration and matching Web, Worker,
and Worker Runtime services. Updating npm packages alone does not deploy them.
The local model key is not needed in Studio; hosted model access is configured
by the platform.

## Upgrade an existing installation

Upgrade the SDK, extension and CLI together, reinstall dependencies, and run `agent push` for the same Studio
Project and Worker slug. The hosted switch checks readiness and drains the old
receiver before replacing its target. The migration replaces a file-defined Channel with an extension Channel; do not
assume the prior Channel key, installation or Session history is retained. Inspect
the newly built manifest and hosted migration behavior before switching a bot.
Existing-installation continuity is NOT RUN in this upgrade. Confirm the receiver is `ready`
on the new deployment before repeating the private/group/rich-text checks.

Publishing an SDK version alone does not update an existing Agent bundle.
After the streaming adapter has written its new output state, returning to the
old text-only SDK requires an explicit state migration; a direct downgrade is
not supported.
