import { createFileRoute } from "@tanstack/react-router";
import { history, run } from "../../server/routes";
export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      GET: ({ request }) => history(request),
      POST: ({ request }) => run(request),
    },
  },
});
