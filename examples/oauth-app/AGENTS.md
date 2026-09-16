# OAuth Worker example

TanStack Start frontend/backend with SQLite Durable Object sessions, with the MuseDAM Agent in the same deployable Worker.

- Read README.md and VERIFICATION.md before changing deployment or authorization.
- Use published dependencies; never introduce cross-repository runtime imports.
- Hosted mode uses app session cookies. Explicit local mode uses the loopback single-user Agents API and must be labeled local. Keep GEA tokens, OAuth secrets and the encryption key on the backend.
- Preserve current-user/application/tenant/environment isolation, one-time PKCE state, serialized refresh and confirmed logout revocation.
- Fetch Connections from the Agents API before allowing a Run. Errors must not become connected/empty success.
- Use SQLite Durable Objects with stable Worker namespaces; keep Preview and Production object names separate.
- Run type-check, tests and build. Worker integration tests always use native GEA Runtime and real SQLite with HTTP service fixtures. Do not introduce Miniflare, Wrangler or the Cloudflare Vite plugin.
