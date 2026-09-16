import { createFileRoute } from "@tanstack/react-router";
import { conversations, createConversation } from "../../server/routes";
export const Route = createFileRoute("/api/conversations")({
  server: {
    handlers: {
      GET: ({ request }) => conversations(request),
      POST: ({ request }) => createConversation(request),
    },
  },
});
