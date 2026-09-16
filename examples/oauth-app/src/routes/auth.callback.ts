import { createFileRoute } from "@tanstack/react-router";
import { callback } from "../../server/routes";
export const Route = createFileRoute("/auth/callback")({
  server: {
    handlers: {
      GET: ({ request }) => callback(request),
    },
  },
});
