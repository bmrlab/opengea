# Feishu Channel

A small Agent that receives private text messages through a Feishu bot's long
connection and replies in the same chat. No public webhook or web application is
needed for local development.

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

The example uses the public `@gea-ai/agent-sdk` package. It needs a CLI with
Channels support and a matching native Worker Runtime. The older published CLI
`0.1.260909-alpha.0` cannot build this example.

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
the app the permissions needed to receive private messages and reply as the bot,
then make the app available to your test users. Feishu documents the
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

1. `Reply with pong only` — the bot should reply `pong`.
2. `Call current_sender and show its JSON result` — the Tool should report a
   `user` principal with a stable `feishu:` ID and the `local` environment.
3. `Remember my test code: ORCHID-42`, followed by `What is my test code?` — check
   conversation continuity, including after restarting development.
4. From a second user, ask for the first user's test code and call
   `current_sender` — the principal should differ, and the first conversation
   should not be visible.
5. Set `FEISHU_ALLOWED_SENDERS=[]`, restart, and send a new message — it should
   not execute the Agent or produce a reply.

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
