# Remote Agent by public ID

This Worker contains only a caller. Its `musedam` reference selects an independently
admitted Agent with `defineRemoteAgent({ agentId, invocationAuthority: "oauth" })`.
The target code is not copied into the caller's published bundle.

```text
User OAuth → caller Agent → agent(target: "musedam") → remote Session / Run
                         ← runWait + actual remote result ←
```

`subagents/musedam.ts` currently selects the MuseDAMChat demo's **public Agent ID**
`01a0a903-48d6-7764-bd9d-6260bb2117c2`. The Builder editor resource ID in its page
URL is different and must not be used here. Replace the reference with a target
you are authorized to call. Knowing an ID does not grant permission.

## Install and build

Use Node.js **24.16.0**, pnpm **12.8.1**. This example pins public SDK
`0.1.261102-alpha.0` and CLI `0.2.261102-alpha.0`; it does not use a private GEA
checkout or your globally installed CLI.

```sh
cd examples/remote-agent
pnpm install --frozen-lockfile
pnpm type-check
pnpm test
pnpm build
```

The shipped native CLI supports macOS arm64. Credentials and `.gea` evidence stay
out of Git. The generated package must declare `publication-shared-worker-v1` and
`durable-object-application-namespace-v1` for the new hosted publication model.

## Run the local transport example

```sh
pnpm exec gea login
pnpm verify:local
```

This command uses your existing CLI login for **real hosted model requests**, so
model usage is billable. Agent execution itself is in the **local native Runtime**.
It creates an ignored temporary project, adds a separate public target definition,
discovers its canonical ID, restarts with an ID-only `defineRemoteAgent` reference,
and invokes the parent through the local Agents API. It does not substitute a
same-Worker `slug` reference. It shuts down only its own child process afterward.

The local fixture registers both definitions on one local API/Worker and uses its
local Project Key. It verifies ID dispatch, distinct child Session/Run identities,
parent linkage, completion and result return. **It does not verify the hosted
MuseDAMChat target, OAuth delegation, installation or cross-tenant isolation.**
The actual example source remains OAuth-only and points to the hosted target;
the local fixture never changes that source or publishes its test target.

Evidence and process logs are under `.gea/local-remote-smoke/<id>/`. The verifier
reads actual tool receipts and child Runs; a parent's claim of success, a started
child, a failed child or a different target cannot pass.

## Run the hosted cross-tenant example

Use Production on both sides for the cross-tenant demo. Do not use the Developer
Playground or `gea agent run` as proof of OAuth delegation: those use developer
admission, not the original OAuth user's authority.

1. In publisher tenant A, build/publish the target Worker to Production with the
   matching SDK/CLI/Host/Runtime. Submit its application for store review and have
   a platform administrator approve the exact entry/scopes snapshot.
2. In consumer tenant B, install that approved application. Installation belongs
   to B; it does not replace each user's OAuth consent.
3. Publish this caller to a dedicated Builder Project in B, and promote its tested
   Preview build to Production. Keep the target environment in
   `subagents/musedam.ts` aligned with the caller's environment. For example:

   ```sh
   pnpm exec gea workspace use --json '{"orgSlug":"softwarecopyright","workspaceSlug":"default"}'
   pnpm exec gea agent push --json '{"cwd":".","project":"remote-agent-demo","slug":"remote-agent-caller"}'
   ```

   Create the project first. These are explicit hosted writes; the local smoke
   command does not perform them or change your selected organization.

4. Use the caller application's normal OAuth flow with a B user and
   `agents:invoke`. The source user must be entitled to the target installation.
   The target's Project Key is not configured and is not a fallback. Target
   admission follows the original caller, not a requirement to associate the
   source OAuth Client with the target Project.
5. Copy `.env.example` to `.env`. Set the caller's **public** Agent ID and a fresh
   user OAuth access token. Keep this token server-side and out of terminal
   history, browser JavaScript, prompts, logs and commits. Run:

   ```sh
   pnpm verify
   ```

The verifier creates a fresh parent Session, requests a unique harmless marker,
waits for the parent, finds the real `agent` receipt, reads the child Run/Session,
and checks the target ID, parent link, terminal state and marker in both histories.
It does not directly call MuseDAMChat as a substitute for delegation. It records
partial evidence on failure and never retries mutation requests automatically.

To demonstrate the authorization boundary, perform a fresh invocation before B
installs the target (must be denied), after install/consent (must succeed), and
after explicitly disabling B's test installation (new admission must be denied).
A negative result is only meaningful after the caller itself is authenticated and
runnable. Restore only the test installation you intentionally changed.

## Boundaries

- OAuth authorizes the remote code; data access and billing follow the original
  caller and consumer tenant. Verify tenant/Run/usage records separately; this
  script cannot prove billing ownership from a successful answer.
- Remote personal Connector credentials are not automatically forwarded. This
  smoke asks for text only and does not test MuseDAM asset search or file access.
- Parent and target need separate Runs; no new public target URL is created for
  each installation. Run release/deployment records are execution provenance.
- New Sessions are used deliberately. Old Sessions without a valid stable storage
  namespace may be read-only or fail execution with
  `publication_session_storage_unresolved`.
- See `VERIFICATION.md` for what was actually run. Local success is not a hosted
  or cross-tenant acceptance result.
