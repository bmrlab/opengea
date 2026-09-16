import { createFileRoute } from "@tanstack/react-router";
import { logout } from "../../server/routes";
export const Route = createFileRoute("/auth/logout")({
  server: {
    handlers: {
      POST: ({ request }) => logout(request),
    },
  },
});
