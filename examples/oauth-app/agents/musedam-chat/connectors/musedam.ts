import { defineMcpConnector, oauth2 } from "@gea-ai/agent-sdk";

const musedam = defineMcpConnector({
  key: "musedam",
  name: "MuseDAM",
  description:
    "Search and inspect assets accessible to the connected MuseDAM user.",
  serverUrl: "https://mcp-service.musedam.cc",
  transport: "streamable-http",
  connection: { principalType: "user" },
  auth: oauth2({
    authorizationUrl:
      "https://musedam-service.tezign.com/mini-dam-user/oauth/public/authorize",
    tokenUrl:
      "https://musedam-service.tezign.com/mini-dam-user/oauth/public/token",
    clientIdEnv: "MUSEDAM_MCP_CLIENT_ID",
    availableScopes: ["musedam"],
  }),
});

export default musedam.require({ scopes: ["musedam"], exposeToModel: true });
