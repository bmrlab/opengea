# Verification record

Last verified: 2026-09-08 (Asia/Shanghai).

## Public packages and local execution

- Node 24.16.0, pnpm 10.30.3, and published npm SDK/CLI 0.1.260908-alpha.0 on macOS ARM64. No private dependency links are used by the example.
- Dependency installation, TypeScript, Agent validation and packaging passed. The package contains one MCP Connector and zero custom Tools. Computer is disabled.
- MuseDAM's public OAuth metadata was checked live: Authorization Code, S256 PKCE, `musedam` scope, and no client secret. The public `muse-mcp` client completed the actual browser authorization and local loopback callback; the CLI reported `connected`.
- A real local model discovered and invoked `musedam__musedam_search_assets` directly. Searches returned successful MCP results and the Agent cited returned asset IDs/URLs. A second request with the same Chat ID reused the earlier results without another Tool call and distinguished metadata from unread document contents. Both responses were HTTP 200 with no stream errors.
- Local credentials, model keys, asset contents, OAuth tickets and generated archives are excluded from Git. Verification outputs containing asset data remain local and are not fixtures in this repository.

## Hosted Preview

The example is published to a dedicated `ask-muse` Studio Project. Preview has the non-secret `MUSEDAM_MCP_CLIENT_ID=muse-mcp` variable.

- A GEA-session Run returned the user-owned Connector authorization link. The user completed MuseDAM team selection and consent through the hosted callback.
- A subsequent GEA-session Run discovered and called `musedam__musedam_search_assets` twice with successful MCP outputs, returned three cited assets, and finished successfully. A same-Chat follow-up reused those results with no Tool call and distinguished metadata from unread document contents.
- Final Preview is Worker version 2, built from the final example source. Both search and follow-up Runs reported `finished`.
- Connection isolation was tested through the published backend SDK and a temporary Preview Project key: an external `gea:` principal returned HTTP 400; the same raw user ID without the prefix received `configured: false` and a separate authorization URL, with no asset search. It could not reuse the GEA-session Connection.
- The hosted callback redirected to `result=completed`, but the Web result page showed an `Unauthorized` route error. The successful post-callback search established that authorization and Connection storage had completed. The Web reserved-route registry was stale; the page fix is tracked in [GEA PR #390](https://github.com/bmrlab/gea/pull/390). A new Web deployment is needed for that result-page fix.
- Temporary Preview API keys used for verification were revoked. No provider credentials or private asset results are committed.

## Boundaries

- Production promotion has not been performed.
- Windows runtime execution was not tested on this macOS machine. The Linux workflow checks public dependency installation and types without a CLI or OAuth account.
- Live search results depend on the authorized account and team. This is a search-and-answer Agent, not a fixed public asset dataset or a synthetic OAuth fixture.
