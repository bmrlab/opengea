# News conversation UI

This client module renders the Agent's typed UI messages and owns reader decisions. `page.tsx` supplies only the server-selected mode and optional Chat ID. The [Basic README](../../../README.md) documents configuration and operation.

`NewsChat` loads hosted history through the application's authenticated Route Handler. Each load has an AbortController; starting another load, starting a new Chat or unmounting invalidates the earlier request. Restoring history remounts `ChatConversation`, replacing both messages and transport identity together.

`ChatConversation` owns one `StudioAgentChatTransport` and `useChat` instance. It distinguishes stream activity from the last known hosted execution state: stopping reception does not prove the Run ended. Hosted history refresh replaces the transcript with the server snapshot; it does not replay SSE. Seeding a partial assistant message and then appending a complete buffered stream repeats text. Approval continuations also depend on preexisting Tool parts, so simply clearing the last assistant message does not solve general replay.

The Tool renderer reads the local approval context. Only pending decisions on the latest message are actionable. The composer is blocked until all decisions are available, and AI SDK's completion predicate submits the assistant continuation. Rejected submission requires an explicit retry. The browser supplies decisions; the Agent owns trusted arguments, permissions and effects.

The server binds history and cancellation to a signed visitor/Chat/Agent grant. Cancel additionally checks the Run belongs to that Chat. `abort_requested` is displayed as an accepted request, with a subsequent history refresh needed to observe durable status. New Chat never means cancelling a previous execution. Local mode exposes only stop-receiving behavior because the CLI does not implement hosted lifecycle endpoints.

Keep schema and execution policy in the Agent source, application credentials in the server env module, and stream/history authority in the backend. Avoid local transcript persistence or automatic failed-request retries here.
