import { createFileRoute } from "@tanstack/react-router";
import { cancel } from "../../server/routes";
export const Route = createFileRoute("/api/chat/cancel")({
  server: {
    handlers: {
      POST: ({ request }) => cancel(request),
    },
  },
});
