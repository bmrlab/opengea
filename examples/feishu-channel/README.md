# Feishu Channel

A small Agent that receives private text messages through a Feishu bot's long
connection and replies in the same chat. No public webhook or web application is
needed for local development. The bot adds a processing reaction and updates one
Markdown card with the current answer or Tool call. Active Tools show a rotating
character spinner; the final card keeps the last answer or Tool and displays
elapsed generation time. Long answers continue in follow-up cards.

`channels/feishu.ts` configures the SDK's built-in `feishuChannel` using declared
`ctx.env` values. `agent.ts` is an ordinary Agent. The `current_sender` Tool shows
the authenticated execution principal so you can check sender isolation.

## Install

Use Node.js 24.16.0 and pnpm 12.1.0:

```bash
cd examples/feishu-channel
pnpm install --frozen-lockfile
cp .env.example .env
```

The example pins the public `@gea-ai/agent-sdk` package to
`0.1.260911-alpha.3`. Install a CLI with Channels support and its matching native
Worker Runtime:

```bash
npm install -g @gea-ai/cli@0.1.260911-alpha.0
```

To use a locally built CLI, put the executable paths in your private `.env`:

```dotenv
GEA_CLI_BIN=/absolute/path/to/gea-darwin-arm64
GEA_WORKER_RUNTIME_BINARY=/absolute/path/to/gea-worker-runtime
WORKER_RUNTIME_SYSTEM_WORKER_ROOT=/absolute/path/to/system-workers
```

`GEA_CLI_BIN` points to the executable, without arguments. If a compatible `gea`
is already on `PATH`, omit it. The CLI and native Runtime are currently supported
on macOS arm64 and Windows x64; dependency installation and type-checking also
work on Linux. No private repository is needed to install the example's packages.

## Configure a test bot

Create a Feishu enterprise custom app and enable its bot capability. Configure
long-connection event delivery and subscribe to `im.message.receive_v1`. Grant
the app the permissions needed to receive private messages and reply as the bot.
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
pnpm agent:validate
pnpm agent:pack
pnpm dev
```

Validation and packing do not require credentials. Development loads `.env` and,
optionally, the file named by `GEA_ENV_FILE`. Only declared Channel variables are
exposed through `ctx.env`; the local model key is consumed by the CLI's model
provider. Change the model in `agent.ts` if needed.

The CLI creates the local installation and starts the receiver automatically.
Change the port in `agent-dev.json` if `8787` is occupied. Restart development
after changing `.env`. Keep `.gea` between restarts to preserve local history.
Use `Ctrl+C` to stop the CLI and its Runtime.

Open a private chat with the bot and try:

1. `Reply with pong only` — the bot should show a processing reaction, finish
   with a card containing `pong` and elapsed time, and remove the reaction.
2. `Call current_sender and show its JSON result` — the Tool should report a
   `user` principal with a stable `feishu:` ID and the `local` environment. The
   card shows the current Tool's name, parameters, result and status before
   subsequent answer text replaces it. This Tool is fast, so its intermediate
   states may coalesce before delivery.
3. `Remember my test code: ORCHID-42`, followed by `What is my test code?` — check
   conversation continuity, including after restarting development.
4. From a second user, ask for the first user's test code and call
   `current_sender` — the principal should differ, and the first conversation
   should not be visible.
5. Set `FEISHU_ALLOWED_SENDERS=[]`, restart, and send a new message — it should
   not execute the Agent or produce a reply.
6. Ask for a multi-paragraph answer — confirm that text updates in the card
   before completion. Try a longer answer to check ordered continuation cards.

Tools that remain active display a rotating character spinner, normally updated
about once per second through the existing Channel delivery loop. Provider
latency and rate limits can slow updates. Results, errors, approval waits and
subsequent answer text stop the animation; the final card contains no spinner.
Elapsed generation time includes model and Tool execution, excludes delivery
retries, and reports unavailable when event timestamps are missing.

The example uses the SDK's default presentation. For different reply styles or
reaction emoji, implement the desired behavior with `defineChannel` handlers.

Definitive card failures fall back to text. Reaction failures do not block the
answer. An uncertain delivery outcome stays in Channel diagnostics for explicit
recovery; it does not automatically send a duplicate fallback reply.

The principal is an opaque identity derived from the app, tenant and sender. It
is not the installer's GEA identity and does not contain a display name or email.
The preset currently handles private text messages; it ignores group messages
and attachments. A connected socket alone does not verify model execution or
outbound delivery. Two separately sent messages with the same text have different
event IDs and are not a duplicate-event test.

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

Create the first Channel installation with the CLI, using the Agent ID returned
by publication:

```bash
pnpm gea agent channel create --json '{"agentId":"your-studio-agent-id","channelKey":"feishu","environment":"preview"}'
pnpm gea agent channel list --json '{"agentId":"your-studio-agent-id"}'
```

The Agent's **Channels** page shows the receiver status and supports enabling,
disabling, and restarting the installation. Run the private-message checks above
against this Preview bot to verify real delivery and sender identity.

Hosted execution needs the Channels database migration and matching Web, Worker,
and Worker Runtime services. Updating npm packages alone does not deploy them.
The local model key is not needed in Studio; hosted model access is configured
by the platform.

## Upgrade an existing installation

Pause new Channel input and let accepted work and pending deliveries finish
before switching builds. Upgrade the SDK in the Agent project, reinstall
dependencies, then run `agent push` for the same Studio Project and Worker slug.
Resume the installation after its receiver is ready on the new deployment.

Publishing an SDK version alone does not update an existing Agent bundle.
After the streaming adapter has written its new output state, returning to the
old text-only SDK requires an explicit state migration; a direct downgrade is
not supported.
