import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { z } from "zod";

const loopbackOrigin = z.url().refine((value) => {
  const url = new URL(value);
  return (
    url.protocol === "http:" &&
    url.hostname === "127.0.0.1" &&
    url.pathname === "/" &&
    !url.search &&
    !url.hash &&
    !url.username &&
    !url.password
  );
}, "Use an HTTP loopback origin (127.0.0.1) without a path.");
const settingsSchema = z.object({
  apiOrigin: loopbackOrigin,
  workerOrigin: loopbackOrigin,
  agentId: z.uuid(),
  apiKey: z.string().trim().min(1),
  viewToken: z.string().trim().min(1),
});
const messageSchema = z
  .object({ input: z.string().trim().min(1).max(8000) })
  .strict();
const sessionRoute = /^\/api\/sessions\/([0-9a-f-]{36})\/(runs|messages)$/u;

export function createWorkbench(options) {
  const settings = settingsSchema.parse(options);
  const upstreamFetch = options.fetch ?? fetch;
  return createServer(async (request, response) => {
    const reply = (status, body) => {
      response.writeHead(status, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      });
      response.end(JSON.stringify(body));
    };
    const origin = `http://127.0.0.1:${request.socket.localPort}`;
    if (request.headers.host !== new URL(origin).host)
      return reply(403, { error: "Invalid host" });
    if (request.headers.origin && request.headers.origin !== origin)
      return reply(403, { error: "Invalid origin" });
    const pathname = new URL(request.url, origin).pathname;
    const method = request.method;
    try {
      const staticFile = {
        "/": ["index.html", "text/html"],
        "/client.js": ["client.js", "text/javascript"],
        "/style.css": ["style.css", "text/css"],
      }[pathname];
      if (method === "GET" && staticFile) {
        response.writeHead(200, {
          "content-type": `${staticFile[1]}; charset=utf-8`,
          "cache-control": "no-store",
          "content-security-policy":
            "default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self'; frame-ancestors 'none'; base-uri 'none'",
        });
        return response.end(
          await readFile(new URL(staticFile[0], import.meta.url)),
        );
      }
      let target;
      let body;
      let token = settings.apiKey;
      if (method === "GET" && pathname === "/api/research") {
        target = new URL("/research", settings.workerOrigin);
        token = settings.viewToken;
      } else if (method === "POST" && pathname === "/api/sessions") {
        if (request.headers.origin !== origin)
          return reply(403, { error: "Origin required" });
        target = new URL("/api/v1/sessions", settings.apiOrigin);
        body = {
          agent_id: settings.agentId,
          environment: "preview",
          metadata: { source: "product-research-quick-start" },
        };
      } else {
        const match = sessionRoute.exec(pathname);
        if (!match || !z.uuid().safeParse(match[1]).success)
          return reply(404, { error: "Not found" });
        if (method === "GET" && match[2] === "messages") {
          target = new URL(
            `/api/v1/sessions/${match[1]}/messages?limit=100`,
            settings.apiOrigin,
          );
        } else if (method === "POST" && match[2] === "runs") {
          if (
            request.headers.origin !== origin ||
            !request.headers["content-type"]?.startsWith("application/json")
          )
            return reply(403, { error: "JSON from this origin required" });
          let text = "";
          for await (const chunk of request) {
            text += chunk.toString();
            if (Buffer.byteLength(text) > 32768)
              return reply(413, { error: "Message too large" });
          }
          const parsed = messageSchema.safeParse(JSON.parse(text));
          if (!parsed.success) return reply(400, { error: "Invalid input" });
          body = { input: parsed.data.input, stream: false };
          target = new URL(
            `/api/v1/sessions/${match[1]}/runs`,
            settings.apiOrigin,
          );
        } else return reply(405, { error: "Method not allowed" });
      }
      const upstream = await upstreamFetch(target, {
        method,
        redirect: "error",
        signal: AbortSignal.timeout(300000),
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!upstream.ok)
        return reply(upstream.status, {
          error: `Upstream HTTP ${upstream.status}. Check the local Agent. Do not automatically resubmit.`,
        });
      return reply(upstream.status, await upstream.json());
    } catch {
      // A timed-out write may already be accepted. Never retry it here.
      return reply(502, {
        error:
          "Request failed or result unknown. Refresh messages before submitting again.",
      });
    }
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const config = JSON.parse(
    await readFile(new URL("../.gea/workbench.json", import.meta.url), "utf8"),
  );
  const apiKey = (await readFile(config.apiKeyFile, "utf8")).trim();
  const viewToken = (
    await readFile(new URL("../.gea/view-token", import.meta.url), "utf8")
  ).trim();
  const server = createWorkbench({ ...config, apiKey, viewToken });
  server.listen(4317, "127.0.0.1", () =>
    process.stdout.write("Research workbench: http://127.0.0.1:4317\n"),
  );
}
