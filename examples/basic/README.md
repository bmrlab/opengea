# Basic: GEA Agent + Next.js

A small **Tech News assistant** that really calls a model and searches Hacker News through its public [Algolia API](https://hn.algolia.com/api). Results are live search metadata, not fabricated fixtures or full article reads. A Benchmark checks real Tool execution and citation of returned discussion links.

This example explicitly selects the SDK's Rust Agent Core with `engine: agentCore()`. The SDK supplies prebuilt WASM; tools stay in TypeScript and the frontend continues to consume AI SDK UI messages.

The browser uses [AI SDK](https://ai-sdk.dev/) and [AI Elements](https://elements.ai-sdk.dev/), has no login step, and calls only its own Next.js backend. Anonymous signed cookies isolate Chats between browsers. Approval cards let readers approve or decline individual Tool calls. Local transcripts stay in memory; hosted mode can restore server history while the signed session remains valid.

## Architecture and files

```text
Local:  Browser → Next.js Route Handler → loopback gea agent dev → Creative Reasoning
Hosted: Browser → Next.js Route Handler → GEA preview/production Agent → hosted model gateway
```

Agent and Next.js are independent processes. Next.js never executes the Agent or emulates Worker Runtime. “Local” describes the Agent runtime's location, not the model's location.

```text
examples/basic/                 # command working directory unless stated otherwise
  package.json
  pnpm-workspace.yaml
  pnpm-lock.yaml
  .env.example                 # CR key, read only by local Agent launcher
  agent-{project,dev,eval}.json # exact Agent source root and CLI inputs
  apps/web/
    .env.example               # server-only application configuration
    app/news-chat.tsx           # same typed UI in both modes
    app/api/agent/run/route.ts  # session, ownership, Origin, upstream stream
    app/api/agent/chats/        # hosted history and explicit cancellation
    server/                    # env and signed anonymous cookies
    components/ai-elements/     # installed upstream component source
  packages/agent/
    agent.ts                   # Core engine, capability requirements and Agent slug
    AGENTS.md                  # instructions
    tools/index.ts             # one discovered Tool Set
    tools/_search-stories.ts   # precise input and structured output
    connectors/hacker-news.ts  # fixed external host, no credentials
    messages.ts                # type-only package export
    benchmarks/cases/          # TypeScript and SQLite searches
    benchmarks/judges/         # deterministic Tool/citation Judge
```

## 1. Install and build without the CLI

Use Node **24.16.0** (`.node-version`) and pnpm **10.30.3**. From any parent directory:

```bash
git clone https://github.com/bmrlab/opengea.git
cd opengea/examples/basic
corepack enable
pnpm install --frozen-lockfile
pnpm type-check
pnpm test
pnpm build
```

These checks need no private GEA checkout, running Agent, credentials or `.gea` directory. SDK and Contract are pinned to npm **0.1.260910-alpha.2**, with AI SDK **7.0.9** and `@ai-sdk/react` **4.0.10**. CLI is not an install/build dependency: Linux Next.js hosting never needs a macOS/Windows executable.

## 2. Run locally

Use GEA CLI **0.1.260910-alpha.1** for **macOS ARM64 or Windows x64**. It includes the WASM bundler required by this example; the SDK provides the compiled Agent Core.

```bash
npm install --global @gea-ai/cli@0.1.260910-alpha.1
gea agent --help
pnpm run setup:env
```

Setup preserves existing files, copies `.env.example` to `.env`, and creates `apps/web/.env.local` with a random session secret. Fill **`examples/basic/.env`** with your `CREATIVE_REASONING_API_KEY`. This file is read only by the local Agent launcher, never copied into Next.js or the Agent artifact.

```bash
pnpm dev
```

This starts Agent dev at **127.0.0.1:8787**, using `packages/agent` as source root, and Next.js at **localhost:3000**. Open [localhost:3000](http://localhost:3000/). Ctrl+C or either process exiting stops both. Default local mode needs no GEA login or Project API key. Next.js sends HTTP directly to `http://127.0.0.1:8787/gea/agents/tech-news/run` without a fake key.

For separate terminals, run `pnpm dev:agent` and `pnpm dev:web`, both from `examples/basic`. The launcher expects `gea` on PATH. For local-binary validation, use a temporary PATH containing a symlink/wrapper named `gea`; never commit machine-specific paths.

If port 3000 is occupied, keep that process running, set `APP_ORIGIN=http://localhost:3001` in `apps/web/.env.local`, and run `pnpm --dir apps/web dev --port 3001`. Increment again if necessary. To change Agent port, update both `agent-dev.json` and `GEA_AGENT_URL`.

Try “Find three stories about TypeScript”, then “Explain the first result”, then **New chat**. The UI renders streamed text, reasoning when available, Tool progress, structured results, errors and copyable answers. Attachments and regeneration are unavailable in the current API and are not exposed.

**Stop receiving response** closes the local browser stream; it does not acknowledge Agent cancellation. Local dev has no managed history/cancel endpoints: refreshing starts a new Chat, and a follow-up can fail while an interrupted Run is still active. Start a new Chat if needed. Hosted controls are described below.

### Rust Agent Core

[`packages/agent/agent.ts`](packages/agent/agent.ts) imports `agentCore` from
`@gea-ai/agent-sdk/agent-core` and selects it explicitly. The framework's default
engine remains AI SDK; this example demonstrates the Core option.

The SDK already contains the compiled WASM. A compatible CLI embeds those bytes
in the Worker bundle, so Agent authors do not compile Rust or supply a separate
WASM file. Rust owns the model protocol and loop, while the existing TypeScript
search Tool, approval policy and AI SDK UI remain in use. Capability-based model
selection is unchanged.

### Search approval (enabled by default)

Search requires approval by default, including when `REQUIRE_SEARCH_APPROVAL` is absent. To disable it, set `REQUIRE_SEARCH_APPROVAL=false` in **`examples/basic/.env`** and restart the Agent. Hosted execution uses the same default; configure this declared Agent environment value in the target Preview or Production environment to override it. It belongs to the Agent, not the Next.js environment.

Each search displays its parameters with **Approve** and **Decline** buttons. For a parallel batch, decide every pending call before continuation is submitted. Approved calls may execute; declined calls return a denial to the model. The composer stays disabled while decisions are pending. If sending the decisions fails, **Retry sending decisions** intentionally resubmits them; ordinary failed messages are not automatically retried. Approval changes execution permission, not the Tool arguments.

Try asking for separate TypeScript and SQLite searches in one step, then approve one and decline the other. The model may choose a different call pattern; the interface renders the calls it actually makes. After a denial, the Agent is instructed not to repeat or substitute the search without a new request.

`pnpm agent:eval` disables approval only in the Benchmark child process because Benchmarks have no interactive approver. It does not change `.env` or the running browser demo. When invoking `gea agent eval` directly, set `REQUIRE_SEARCH_APPROVAL=false` in that process environment.

### Declare model capabilities

[`packages/agent/agent.ts`](packages/agent/agent.ts) describes the search assistant's needs instead of choosing a model:

```ts
model: "auto",
modelRequirements: {
  agentic: 0.8,
  copywriting: 0.6,
  speed: 0.6,
},
```

Tool execution is the main requirement; concise explanations and interactive responses also matter. This text-only example leaves `multimodal` unconstrained. Each value is a minimum capability requirement from 0 to 1, not a measured Benchmark score or latency guarantee.

The SDK selects a suitable model and records it in the built Agent version. Change capability requirements in this file and rerun `pnpm agent:eval`; updating the SDK can also affect newly built versions. The Benchmark tests the resulting Agent against real model and search calls. Publish a new version when you want to use the change in GEA.

### Optional: hosted models with a local Agent

Keep Next.js in `GEA_MODE=local`, sign in with `gea login`, select a Workspace with `gea workspace use`, then bypass the CR-key launcher:

```bash
gea agent dev --json '{"cwd":"packages/agent","host":"127.0.0.1","port":8787,"modelSource":"hosted"}'
```

PowerShell: `@{ cwd = "packages/agent"; host = "127.0.0.1"; port = 8787; modelSource = "hosted" } | ConvertTo-Json -Compress | gea agent dev --json-file -`.

Hosted execution requires model access in the selected Workspace. Validate the Agent in that environment before publishing it for others. Restart Agent dev after changing model access mode or credentials. See [models](https://musegea.com/developers/agent-models).

## 3. Types and Benchmark

The CLI discovers the actual `defineToolSet` in `tools/index.ts`, ignoring underscore-prefixed implementation files. `messages.ts` uses SDK `InferAgentUITools` and `AgentMessageForTools` on that same Tool Set. `useChat<NewsMessage>`, `StudioAgentChatTransport<NewsMessage>` and the Tool renderer share this type.

Next.js imports only `import type { NewsMessage } from "@opengea/basic-agent/messages"`. The export has only a `types` condition, so there is no browser runtime entrypoint. No input/output interface is copied. Rename Tool output `stories` and `pnpm type-check` fails at the renderer and Judge. Restore or update the consumers before building.

`.gea/bindings.d.ts` is not needed, committed or consumed by Next.js. All types derive from current source on every check. Add Tools to the existing Tool Set with `_`-prefixed implementation files. If adding independently discovered files, include them in the exported type too. Runtime-discovered MCP/host Tools do not have full static schemas; retain that boundary. SDK-first streams have no custom `data-*` events.

Tool and Connector changes trigger CLI rebuild/restart. Record the OpenGEA commit, SDK versions and immutable Agent deployment/version together when releasing the corresponding UI. A stable preview/production URL is an environment pointer, not a type guarantee.

```bash
pnpm agent:validate
pnpm agent:eval
pnpm type-check
```

Both Cases use the real model and public API, incur model usage, and run a TypeScript Judge without a second LLM Judge. Results live under `packages/agent/.gea/evals`. Live data changes; the Judge checks real execution and returned citations, not fixed story titles. API failures do not become empty successful results. See [Benchmarks](https://musegea.com/developers/agent-benchmarks) and [Trace](https://musegea.com/developers/trace).

## 4. Publish Agent preview, then promote

Create a Studio Project in the intended organization/Workspace. Use `gea login` and `gea workspace use` to select it. From `examples/basic`, replace `my-project` with its actual Studio Project slug:

```bash
pnpm agent:pack
gea agent push --json '{"cwd":"packages/agent","project":"my-project","slug":"opengea-basic"}'
```

PowerShell: `@{ cwd = "packages/agent"; project = "my-project"; slug = "opengea-basic" } | ConvertTo-Json -Compress | gea agent push --json-file -`.

`cwd` is the source root even though Git root is `opengea/`. Only Agent source/reachable imports enter the archive, not the whole repository. Inspect `packages/agent/dist/*.zip`: no `apps/web`, `.env`, CR key, Project key or session secret belongs there.

Push creates an immutable Worker deployment and updates Preview. Inspect that version in Studio and run Playground.

Engine selection lives in the Worker bundle; current SDK snapshots omit
`engine`. Rebuild the Agent after upgrading the SDK because previously built
archives retain their original snapshot. Other declared capabilities still
require compatible server and Runtime versions.

### Upload the local Benchmark and Eval

Keep the Agent source unchanged after publishing Preview, and run `pnpm agent:eval`. Upload the Benchmark definition, then the completed local result to the same Project:

```bash
gea benchmark push --json '{"cwd":"packages/agent","project":"my-project","benchmarkPath":"benchmarks","key":"basic-search","title":"Basic search quality"}'
gea eval push --json '{"cwd":"packages/agent","project":"my-project","result":"<resultDirectory>","benchmarkKey":"basic-search"}'
```

Replace `my-project` with your Project slug and `<resultDirectory>` with the exact `resultDirectory` printed by the Eval command. An absolute path works; a relative path is resolved from `packages/agent`, for example `.gea/evals/<completed-run-directory>`. Keep `basic-search` consistent between both commands. These uploads use your CLI login and selected Workspace; they do not require a Project invocation API key or rerun the model.

In **Project → Benchmarks**, open **Basic search quality** to inspect its two Cases and TypeScript Judge. In **Project → Evals**, open the uploaded Run to see scores, Judge reasons, Agent outputs and message/Tool trajectories. The Eval links to the published Agent version when its captured Agent and application content match that version. If you change source, publish and evaluate the new version before uploading its result. See the [Benchmark guide](https://musegea.com/developers/agent-benchmarks) for PowerShell commands and more options.

### Connect Next.js to Preview

In **Project → API Key**, create a key for Preview. Copy the Agent overview's stable Preview invocation URL and remove its final `/run`. Change `apps/web/.env.local`:

```dotenv
GEA_MODE=hosted
GEA_AGENT_URL=https://preview--worker--<worker-id>.<gea-apex>/gea/agents/tech-news
GEA_PROJECT_API_KEY=<your-preview-project-key>
```

The key needs **`runs:write`** for execution/cancellation and **`chats:read`** for history and Run status. Keep `APP_ORIGIN` and `SESSION_SECRET`, restart Next.js and start a **new Chat**. The same browser transport still calls `/api/agent/run`. Server `StudioAgentClient` fixes the URL/key; the browser cannot choose either. No `agentId` is required in the request: URL and key select the environment.

### Hosted history and cancellation

The application records the Chat in `?chat=...` and keeps its latest Run identity in the signed ownership cookie. Reloading the page or choosing **Refresh conversation** reads the latest 100 server messages and the last known Run's status. Older messages remain on the server; this example does not page through them. Starting a new Chat cancels any pending history load so old results cannot replace the new conversation.

**Disconnect stream** stops reception while the hosted execution may continue. Refresh retrieves the current server snapshot; it does not replay buffered SSE or resubmit a message. This example keeps explicit history refresh. SDK 0.1.260910-alpha.0 includes the optional `StudioAgentChatTransport.onReplay` callback, but this UI does not enable it; automatic replay additionally requires the matching hosted server baseline. Replaying a whole Run over partial history without that callback can duplicate text and lose approval context.

**Cancel Agent execution** calls GEA's explicit cancellation endpoint, including after disconnecting. `abort_requested` means the request was accepted, not that every Tool has already stopped. The UI keeps that distinction and allows refreshing to retrieve the final status. The composer is disabled while the last retrieved execution is active. Both history and cancellation check the signed visitor/Chat/Agent binding; cancellation also verifies that the supplied Run belongs to that Chat before issuing the effect. Lost or expired cookies cannot recover an anonymous Chat merely from its URL.

After preview validation, use **Promote to Production** in Agent details for the exact active preview version. There is no `gea agent deploy` command here. Copy the Production URL and create a production key. Promotion does not copy environment values, rotate keys or deploy Next.js. See [API keys and environments](https://musegea.com/developers/agent-studio-configuration).

## 5. Deploy Next.js independently

GEA hosts the Agent, not Next.js. On a Node.js host, use `examples/basic` as the install/build working directory:

```bash
pnpm install --frozen-lockfile
pnpm type-check
pnpm build
pnpm --dir apps/web start
```

Configure these **server-only runtime** values:

| Variable              | Value                                                                      |
| --------------------- | -------------------------------------------------------------------------- |
| `APP_ORIGIN`          | Exact public origin such as `https://news.example.com`, no trailing slash  |
| `SESSION_SECRET`      | Stable random secret of at least 32 characters, shared by all app replicas |
| `GEA_MODE`            | `hosted`                                                                   |
| `GEA_AGENT_URL`       | Matching Agent base URL, without `/run`                                    |
| `GEA_PROJECT_API_KEY` | Matching Project/environment key                                           |

No CR key, CLI or `NEXT_PUBLIC_*` credential is needed by hosted Next.js. This uses Node Route Handlers, not static export. Choose hosting with streamed Responses and appropriate request timeouts. The route requests `maxDuration = 120`; provider plan/hard limits still apply. Disable proxy buffering and align load-balancer timeouts. See [Next.js self-hosting](https://nextjs.org/docs/app/guides/self-hosting) and [duration configuration](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/maxDuration). Unlimited request duration is not promised.

SSE passes through immediately with `x-gea-agent-chat-id`, `x-gea-agent-run-id` and `x-gea-request-id`. Browser credentials and upstream cookies are not forwarded. HttpOnly/SameSite cookies become Secure for HTTPS origins. Anonymous session and per-Chat signed grants expire after 24 hours and bind to the configured Agent URL, with no shared database. Lost cookies lose access; rotating the session secret invalidates grants. This is an anonymous demo, not an account or abuse-control system: use your host's admission/rate controls before exposing billed anonymous calls widely.

**Contract changes:** build UI and Agent from the same commit. For breaking Tool changes, first make the UI accept both output versions or use a separate Worker identity; validate preview, promote its Agent, then retire compatibility after active Chats end. Do not silently point an old UI at an incompatible Agent. Use new Chats across breaking changes because retained AgentSession messages can contain the old structure.

## Verification

[VERIFICATION.md](VERIFICATION.md) records executed checks, binary/source versions, remote calls and gaps. Local build success is not evidence of a hosted Agent run or a deployed Next.js production application.
