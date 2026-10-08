import { defineRemoteAgent } from "@gea-ai/agent-sdk";

export default defineRemoteAgent({
  slug: "reviewer",
  description: "A separately addressable top-level Agent in this Worker.",
});
