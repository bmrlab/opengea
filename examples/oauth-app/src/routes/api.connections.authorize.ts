import { createFileRoute } from "@tanstack/react-router";
import { authorizeConnection } from "../../server/routes";
export const Route = createFileRoute("/api/connections/authorize")({
  server: {
    handlers: {
      POST: ({ request }) => authorizeConnection(request),
    },
  },
});
