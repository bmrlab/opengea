import { createFileRoute } from "@tanstack/react-router";
import { createNamespaceProbe } from "../../server/namespace-probe";

export const Route = createFileRoute("/api/namespace-probe")({
  server: { handlers: { POST: ({ request }) => createNamespaceProbe(request) } },
});
