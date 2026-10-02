import { defineWorker } from "@gea-ai/agent-sdk/worker";
import web from "@tanstack/react-start/server-entry";
import musedam from "./agents/musedam-chat";

export {
  LoginFlow,
  OAuthSession,
  ConversationRuns,
} from "./server/session-objects";

export default defineWorker({
  // Platform-only execution. Application calls use the Agents API and fixed IDs.
  agents: { "musedam-chat": musedam },
  // TanStack owns the pages, OAuth callbacks and application API routes.
  fetch: (request) => web.fetch(request),
});
