import { createFileRoute } from "@tanstack/react-router";
import { uploadFile } from "../../server/routes";
export const Route = createFileRoute("/api/files")({
  server: {
    handlers: {
      POST: ({ request }) => uploadFile(request),
    },
  },
});
