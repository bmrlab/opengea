import { agentCore } from "@gea-ai/agent-sdk/agent-core";
import { researchStep } from "./lib/research-flow";
import { defineAgent } from "@gea-ai/agent-sdk";
import { instructions } from "./instructions";
import searchSources from "./tools/search-sources";
import readSource from "./tools/read-source";
import search from "./connectors/search";

export default defineAgent({
  name: "ProductResearch",
  slug: "product-research",
  description: "从公开资料整理早餐产品机会，区分观察、推断和待验证假设。",
  model: "creative-reasoning-1.5",
  computer: { enabled: false },
  instructions,
  engine: agentCore({ prepareStep: researchStep }),
  connectors: { search },
  tools: [searchSources, readSource],
});
