import { defineAgent } from "@gea-ai/agent-sdk";
import { MAIN_MODEL } from "../../models";
export default defineAgent({
  name: "raw",
  slug: "raw",
  model: MAIN_MODEL,
  computer: { enabled: false },
  context: false,
});
