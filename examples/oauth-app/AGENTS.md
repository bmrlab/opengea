# OAuth Worker example

TanStack Start frontend/backend with SQLite Durable Object sessions, with the MuseDAM Agent in the same deployable Worker.

- Read README.md and VERIFICATION.md before changing deployment or authorization.
- Use published dependencies; never introduce cross-repository runtime imports.
- Both hosted and local modes require app OAuth session cookies and forward the signed-in user bearer. Local execution uses loopback Agents API and its existing verified-user contract; never substitute a service key or local-user. Keep GEA tokens, OAuth secrets and the encryption key on the backend.
- Preserve current-user/application/tenant/environment isolation, one-time PKCE state, serialized refresh and confirmed logout revocation.
- Fetch Connections from the Agents API before allowing a Run. Errors must not become connected/empty success.
- Use SQLite Durable Objects with stable Worker namespaces; keep Preview and Production object names separate.
- Run type-check, tests and build. Worker integration tests always use native GEA Runtime and real SQLite with HTTP service fixtures. Do not introduce Miniflare, Wrangler or the Cloudflare Vite plugin.
