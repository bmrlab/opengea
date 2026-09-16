import { createFileRoute } from "@tanstack/react-router";
import { downloadFile } from "../../server/routes";
export const Route = createFileRoute("/api/files/content")({
  server: {
    handlers: {
      GET: ({ request }) => downloadFile(request),
    },
  },
});
