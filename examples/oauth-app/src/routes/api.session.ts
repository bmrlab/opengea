import { createFileRoute } from "@tanstack/react-router";
import { session } from "../../server/routes";
export const Route = createFileRoute("/api/session")({
  server: {
    handlers: {
      GET: ({ request }) => session(request),
    },
  },
});
