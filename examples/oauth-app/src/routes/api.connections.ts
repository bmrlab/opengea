import { createFileRoute } from "@tanstack/react-router";
import { connections } from "../../server/routes";
export const Route = createFileRoute("/api/connections")({
  server: {
    handlers: {
      GET: ({ request }) => connections(request),
    },
  },
});
