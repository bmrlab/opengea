import { apiKey, defineApiConnector } from "@gea-ai/agent-sdk";

export default defineApiConnector({
  key: "research-search",
  name: "Research Search",
  baseUrl: "https://api.exa.ai",
  auth: apiKey({ name: "x-api-key", placement: "header" }),
  connection: { principalType: "agent" },
}).require({ allowedCallers: [] });
