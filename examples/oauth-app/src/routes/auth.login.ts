import { createFileRoute } from "@tanstack/react-router";
import { login } from "../../server/routes";
export const Route = createFileRoute("/auth/login")({
  server: {
    handlers: {
      POST: ({ request }) => login(request),
    },
  },
});
