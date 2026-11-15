import { defineAgent } from "@gea-ai/agent-sdk";
import { instructions } from "./instructions";
import searchSources from "./tools/search-sources";
import researchRecord from "./tools/research-record";
import search from "./connectors/search";

export default defineAgent({
  name: "ProductResearch",
  slug: "product-research",
  description: "从公开资料整理早餐产品机会，区分观察、推断和待验证假设。",
  model: "gea-pro",
  computer: { enabled: false },
  instructions,
  connectors: { search },
  tools: [searchSources, researchRecord],
});
