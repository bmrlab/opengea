import { createFileRoute } from "@tanstack/react-router";
import { artifacts } from "../../server/routes";
export const Route = createFileRoute("/api/artifacts")({
  server: {
    handlers: {
      GET: ({ request }) => artifacts(request),
    },
  },
});
