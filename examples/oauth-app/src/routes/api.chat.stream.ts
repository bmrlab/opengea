import { createFileRoute } from "@tanstack/react-router";
import { stream } from "../../server/routes";
export const Route = createFileRoute("/api/chat/stream")({
  server: {
    handlers: {
      GET: ({ request }) => stream(request),
    },
  },
});
