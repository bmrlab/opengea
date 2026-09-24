# Run response relay

Successful streamed Runs return their headers and body immediately while the
application saves the Session-to-Run reference in `ConversationRuns`. This avoids
serializing an additional Durable Object cold start before the first byte.

The relay waits for that write before successful HTTP EOF. A failed write errors
the stream. Reader cancellation cancels the upstream and retains the pending
write until it settles, so disconnecting does not intentionally abandon recovery
state. HTTP errors keep the existing synchronous reference-save behavior.

`oauth_app.run_reference` records the upstream request/Run IDs and save duration,
without credentials or message bodies. The tests use a held persistence promise
to check first-byte delivery, EOF gating, failure and cancellation; the integration
suite verifies persisted recovery across logout and Runtime restart.
