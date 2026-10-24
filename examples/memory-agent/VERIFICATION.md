# Draft verification

Verified on 2026-10-24 at 19:57 CST (Beijing, UTC+8), on
`MacBook-Pro-10.local`, Apple M5 / macOS arm64.

- Node 24.16.0, pnpm 12.8.1, TypeScript 5.9.3.
- Installed public npm SDK `0.1.261024-alpha.1` and CLI `0.2.261024-alpha.0`.
  The SDK's published export map includes `./memory`; no source/workspace links.
- `pnpm install --frozen-lockfile`: passed with the checked-in dependency build
  policy in `pnpm-workspace.yaml`. An initial installation without that policy
  rejected unapproved transitive build scripts; the final installation passed.
- `pnpm type-check`: passed against the published SDK declarations.
- `pnpm agent:validate`: passed, `valid: true`, 5 tools, 0 connectors.
- `pnpm agent:pack`: passed, 6 files in the generated archive. Generated archives
  and `.gea` build artifacts are ignored by Git.

The first CLI validate/pack attempt could not access the macOS login Keychain.
Both commands were rerun successfully using a disposable, isolated App Server
state directory and an in-memory random test credential-store key. No existing
credential vault was replaced and no credential values were printed or retained
in this example. The temporary state was removed after command completion.

These checks certify compilation and packaging of the actual Agent definition
and Durable Object export using published packages. They do not certify model
behavior or durable storage across restart for this example. The manual
cross-Session, restart, search/correction/deletion walkthrough in README.md still
requires interactive verification with the caller's model access. No paid model
calls, cloud push, deployment, npm publication or merge were performed.

The single-slot tool-only example uses published base memory and does not depend
on the unmerged GEA enhancements #837, #838 or #839. It remains a draft pending
the user's later instruction after v0.58.2.
