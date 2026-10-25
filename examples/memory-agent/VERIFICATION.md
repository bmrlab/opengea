# Verification

## Published alpha.2 upgrade, 2026-10-25 CST

Node 24.16.0 / pnpm 12.8.1. SDK/Contract `0.1.261025-alpha.2` and CLI
`0.2.261025-alpha.2` are public registry dependencies. Frozen install and
`pnpm type-check` pass. Target published CLI validate returns valid=true,
5 tools and 0 connectors; pack succeeds with 7 payload files. The archive
SHA-256 was independently verified. Local build/config state uses disposable
directories and an ephemeral random key; no existing credential was copied.

There is no test script in this small declarative example. The actual Agent
definition, exported AgentMemory object and five generated tools were compiled
and packaged; no model-dependent cross-Session/restart interaction is claimed.
The README and dev config now use CLI-owned listener discovery rather than
promising the ignored legacy apiPort.

The initial refresh checked the old lock against the new release-age list and
rejected old alpha.2 entries. Temporary exact old-version exceptions allowed
pnpm to regenerate the lock, then were removed. A final online frozen install
passes the normal policy; no broad policy relaxation remains.

## Historical checks

Verified on 2026-10-24 at 23:38 CST (Beijing, UTC+8), on
`MacBook-Pro-10.local`, Apple M5 / macOS arm64.

- Node 24.16.0, pnpm 12.8.1, TypeScript 5.9.3.
- Installed public npm SDK `0.1.261024-alpha.2` and CLI `0.2.261024-alpha.0`.
  SDK and transitive contract were upgraded together with registry integrity
  values in the independent lockfile. No source/workspace links are used.
- `pnpm install --frozen-lockfile`: passed with the checked-in dependency build
  policy and exact release-age exceptions in `pnpm-workspace.yaml`.
- `pnpm type-check`: passed against the published SDK declarations.
- `pnpm agent:validate`: passed, `valid: true`, 5 tools, 0 connectors.
- `pnpm agent:pack`: passed, 6 files in the generated archive. Generated archives
  and `.gea` build artifacts are ignored by Git.
- Vite+ formatting and `git diff --check`: passed.

CLI validate/pack used disposable App Server state and config directories and an
in-memory random test credential-store key. No existing credentials were read or
replaced, and no credential values were printed or retained. Temporary state was
removed after completion. No production services or paid models were contacted.

GEA #838, #837 and #839 are merged. All seven SDK packages were published as
`0.1.261024-alpha.2` via tag `npm/v0.1.261024-alpha.2` and individually confirmed
on the registry before this example upgrade. The example pins that release to
check compatibility with the published memory improvements. Its single-slot,
tool-only configuration does not exercise #839's multi-slot recall allowance.
CLI stays on the published macOS `0.2.261024-alpha.0`; no new CLI is required for
these SDK changes.

These checks certify compilation and packaging of the actual Agent definition
and Durable Object export using published packages. The SDK's separate native
integration tests verify SQLite isolation and restart persistence; this example
has not had model-dependent cross-Session/restart interactive acceptance. The
manual walkthrough in README.md remains the procedure for that verification.
No deployment or cloud push was performed. The PR is ready for review and is
intentionally left unmerged.
