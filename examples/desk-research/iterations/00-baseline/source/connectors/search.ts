import { geaConnect } from "@gea-ai/agent-sdk";

export default geaConnect({
  key: "social-search",
  name: "Social Research Search",
  operations: {
    request: {
      description:
        "Search public social discussions through the configured GEA Connector.",
    },
  },
}).require({ allowedCallers: [] });
