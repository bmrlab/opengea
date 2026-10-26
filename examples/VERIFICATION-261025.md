# Published SDK and CLI upgrade, 2026-10-25 CST

All eight existing examples pin public SDK/Contract/Feishu extension consumers to
`0.1.261025-alpha.2`, and CLI consumers to the October 25 alpha.2 release. Node 24.16.0;
pnpm 10.30.3 for Basic/OAuth and 12.1.0 for the other examples. Independent lockfiles
were regenerated with `pnpm install --no-frozen-lockfile` and checked with
`pnpm install --frozen-lockfile --offline` after the registry downloads completed.

| Example | Type check | Tests | Additional checks |
| --- | --- | --- | --- |
| agents-api | `pnpm type-check` PASS | `pnpm test`: 2/2 | Frozen install PASS |
| basic | `pnpm type-check` PASS | `pnpm test`: 20/20 | `pnpm build` PASS |
| code-mode | `pnpm type-check` PASS | `pnpm test`: 1/1; `pnpm test:package`: 1/1 | `pnpm mcp:build` PASS; published CLI compiles caller permissions |
| feishu-channel | `pnpm type-check` PASS | `pnpm test`: 9/9 | Published CLI `agent validate`: valid=true |
| oauth-app | `pnpm type-check` PASS after build generates routes | `pnpm test`: 52/52 | Native Runtime/SQLite HTTP fixtures; combined Worker build PASS |
| observational-memory | `pnpm type-check` PASS | `pnpm test`: 11/11 | Frozen install PASS |
| subagent-limits | `pnpm type-check` PASS | `pnpm test`: 4/4 | Frozen install PASS |
| subagents | `pnpm type-check` PASS | `pnpm test`: 9/9 | Frozen install PASS |

Total: 109 tests passed, no failed/skipped tests in these final suites.

The Feishu Extension now exchanges tenant credentials through Host
`ctx.credentials.exchange`; the synthetic handler fixture was updated to that
public contract. Its initial four group-handler failures reproduced the missing
fixture capability; all existing security/routing assertions pass after the fix.
This is synthetic admission coverage, not live Feishu delivery or authorization cards.
The Extension registration is retained; later authorization-card changes remain in
PR #22 and are not replaced by a legacy Channel definition.

Initial CI-mode installs rejected stale locks until explicitly regenerated.
Several optional native downloads timed out despite an install exit 0. After the
exact public native package finished downloading, frozen installs from the cache
restored the native dependency; the actual published CLI package test then passed.
A redundant download was interrupted after the cached installation succeeded.
The first OAuth type-check ran before its generated route tree existed; build then
type-check passed. One validation attempt hit the locked macOS keychain; a disposable
local App Server/config and an ephemeral test key passed without changing user credentials.
No unknown dependency build scripts were approved.

The earlier Vite-discovery failure belongs to the old CLI. This PR records build
and native HTTP fixture acceptance; the signed-in local OAuth/Vite consumer gate is
rerun with PR #20. It does not accept live MuseDAM chat, hosted tenant parity, visual
browser UAT, actual OAuth providers, real models, paid calls, Windows/Linux native
execution, or Production deployment. Local tests do not wait for GitHub CI.

Sanitized command receipts are retained by the operator under
`/Users/zhuo/gea-tasks/opengea-update-merge/evidence/19-*`.

CLI target updated on 2026-10-26 to `0.2.261026-alpha.2`. Earlier dated test results above are historical; see [the current CLI verification](./VERIFICATION-261026.md) for fresh results.
