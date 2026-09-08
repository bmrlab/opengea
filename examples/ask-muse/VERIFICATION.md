# Verification record

Last verified: 2026-09-08 (Asia/Shanghai).

## Public packages and local execution

- Node 24.16.0, pnpm 10.30.3, and published npm SDK/CLI 0.1.260908-alpha.0 on macOS ARM64. No private dependency links are used by the example.
- Dependency installation, TypeScript, Agent validation and packaging passed. The package contains one MCP Connector and zero custom Tools. Computer is disabled.
- MuseDAM's public OAuth metadata was checked live: Authorization Code, S256 PKCE, `musedam` scope, and no client secret. The public `muse-mcp` client completed the actual browser authorization and local loopback callback; the CLI reported `connected`.
- A real local model discovered and invoked `musedam__musedam_search_assets` directly. Searches returned successful MCP results and the Agent cited returned asset IDs/URLs. A second request with the same Chat ID reused the earlier results without another Tool call and distinguished metadata from unread document contents. Both responses were HTTP 200 with no stream errors.
- Local credentials, model keys, asset contents, OAuth tickets and generated archives are excluded from Git. Verification outputs containing asset data remain local and are not fixtures in this repository.

## Hosted Preview

The example has been published to a dedicated Ask Muse Studio Project. Preview has the non-secret `MUSEDAM_MCP_CLIENT_ID=muse-mcp` variable. A GEA-session Run returned the user-owned Connector authorization link. Hosted authorization and post-authorization search verification are still in progress; local OAuth success alone does not establish hosted Connection ownership.

## Boundaries

- Production promotion has not been performed.
- Windows runtime execution was not tested on this macOS machine. The Linux workflow checks public dependency installation and types without a CLI or OAuth account.
- Live search results depend on the authorized account and team. This is a search-and-answer Agent, not a fixed public asset dataset or a synthetic OAuth fixture.
