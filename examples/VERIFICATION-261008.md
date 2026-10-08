# SDK 0.1.261008-alpha.0 verification — 2026-10-08

All eight examples pin the published Agent SDK and matching Contract to
`0.1.261008-alpha.0`. Examples with a CLI dependency pin that same published
launcher version; the other examples document installing it separately. Validation
used Node 24.16.0 on macOS ARM64. The pnpm 12 projects ran with pnpm 12.8.1;
Basic and OAuth retain pnpm 10.30.3. No private SDK imports are needed.

## Local results

| Example              | Frozen install | Type check | Tests                             | Published CLI validate / pack |
| -------------------- | -------------- | ---------- | --------------------------------- | ----------------------------- |
| agents-api           | pass           | pass       | 2 pass                            | pass                          |
| basic                | pass           | pass       | 19 pass                           | pass                          |
| code-mode            | pass           | pass       | 1 MCP + 1 package regression pass | pass                          |
| feishu-channel       | pass           | pass       | no test script                    | pass                          |
| oauth-app            | pass           | pass       | 52 pass, zero skipped             | pass                          |
| observational-memory | pass           | pass       | 10 pass                           | pass                          |
| subagent-limits      | pass           | pass       | 3 pass                            | pass                          |
| subagents            | pass           | pass       | 8 pass                            | pass                          |

Total: 96 passing tests. Basic's production build and the code-mode MCP build
passed. OAuth's test command builds the combined Worker and runs native Runtime
and real SQLite integration tests, with fixture HTTP services for OAuth, Agents
API and MuseDAM. This includes local API routing, token/session isolation,
revocation, connection failures, files and stream recovery; it is not a live
provider authorization test.

The earlier same-day install/type/test/build results for the five already checked
examples were retained. Their candidate-CLI validate/pack results were replaced
with checks using the published npm CLI. All eight now validate and pack using
published macOS CLI/native Runtime `0.1.261008-alpha.0`.

## Compatibility migrations

- Hidden Hacker News Connector operations use `allowedCallers: []`; the explicit
  `searchStories` tool retains its Connector access. MuseDAM keeps its scopes and
  uses the current default caller policy instead of removed `exposeToModel`.
- Code mode uses `programmaticToolCalling` and explicit `allowedCallers`. Warehouse
  reads and the code/Skill order tools remain programmatic-only. The hidden canary
  permits no callers. The direct order Agent explicitly disables programmatic
  calling and retains direct tool/Connector access.
- The same-Worker reviewer uses `defineRemoteAgent({ slug: "reviewer" })`, without
  inventing an Agent ID or adding separate authentication.
- Direct AI SDK dependencies are aligned with the published Agent SDK.

The original code-mode declarations failed both type checking and published CLI
loading because `exposure` and `codeMode` authoring were removed. The new
`pnpm test:package` compiles real declarations with the published CLI and checks
serialized caller permissions for all four Agents. It fails against the original
declarations and passes after migration. Existing MCP tests separately exercise
transport, pagination, missing-order errors and the bundled Skill aggregation.

On a fresh OAuth checkout, run `pnpm test` (or `pnpm build`) before
`pnpm type-check`, as CI does: the build generates the TanStack route tree. An
initial check before generation failed; after building it passed without a route
or type-suppression change.

## Boundaries and outstanding acceptance

No example was pushed to Preview or Production in this update. The local compiled
packages contain the new SDK; existing hosted Workers do not change with this PR.
Real-model subagent scheduling, live PTC/Skill execution, memory recall quality,
Feishu delivery and real MuseDAM authorization were not rerun on new hosted bundles.
The historical strict memory recall failure and incomplete 140-child load matrix
remain recorded in earlier verification reports; these local checks do not clear
them.

A separate v0.56.1 platform check successfully invoked an existing installed OAuth
Agent release, but that release's bundled SDK was not independently established.
It is not evidence of this example upgrade or real two-user OAuth isolation.
The launcher's Windows native fallback remains `0.1.260920-alpha.1`, unverified here.
