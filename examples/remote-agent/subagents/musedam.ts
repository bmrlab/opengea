import { defineRemoteAgent } from "@gea-ai/agent-sdk";

// Public Agents API ID, NOT the Builder editor resource ID in the page URL.
// Replace with your installed target. The target is not bundled into this Worker.
export default defineRemoteAgent({
  agentId: "01a0a903-48d6-7764-bd9d-6260bb2117c2",
  description: "Ask MuseDAMChat to handle the user's delegated request.",
  environment: "production",
  invocationAuthority: "oauth",
});
