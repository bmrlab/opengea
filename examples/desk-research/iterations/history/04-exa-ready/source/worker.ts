import { defineWorker } from "@gea-ai/agent-sdk/worker";
import type { AgentChannelFetchEnvironment } from "@gea-ai/agent-sdk/agent-worker";
import type { AgentDurableObjectNamespace } from "@gea-ai/agent-sdk";
import agent from "./agent";
import { RESEARCH_OBJECT } from "./lib/research";
export { ResearchStore } from "./durable-objects/research-store";

export const geaWorkerRoutes = [
  { path: "/research", match: "exact", methods: ["GET"] },
];

type Environment = AgentChannelFetchEnvironment & {
  RESEARCH: AgentDurableObjectNamespace;
  RESEARCH_VIEW_TOKEN?: string;
};

export default defineWorker<Environment>({
  agents: { "product-research": agent },
  fetch: async (request, env) => {
    if (new URL(request.url).pathname !== "/research")
      return new Response("Not found", { status: 404 });
    if (!env.RESEARCH_VIEW_TOKEN)
      return new Response("Research view is not configured", { status: 503 });
    if (
      request.headers.get("authorization") !==
      `Bearer ${env.RESEARCH_VIEW_TOKEN}`
    )
      return new Response("Unauthorized", { status: 401 });
    if (request.method !== "GET")
      return new Response("Method not allowed", { status: 405 });
    const response = await env.RESEARCH.getByName(RESEARCH_OBJECT).fetch(
      "https://research.internal/records",
    );
    const headers = new Headers(response.headers);
    headers.set("cache-control", "no-store");
    return new Response(response.body, { status: response.status, headers });
  },
});
