import { defineAgent } from "@gea-ai/agent-sdk";
import { agentCore } from "@gea-ai/agent-sdk/agent-core";
import { observationalContext } from "./context/strategy";
import { ObservationMemory } from "./context/memory";
import { MAIN_MODEL, MEMORY_MODEL } from "./models";
export { ObservationMemory };
export default defineAgent({
  engine: agentCore(),
  name: "observational-memory",
  slug: "observational-memory",
  model: MAIN_MODEL,
  computer: { enabled: false },
  durableObjects: { OBSERVATIONS: ObservationMemory },
  context: observationalContext({
    model: MEMORY_MODEL,
    observeAfterMessages: 8,
    reflectAtCharacters: 1600,
    memory: ({ durableObjects, identity }) =>
      durableObjects.OBSERVATIONS.getByName(
        JSON.stringify([identity.agent.id, identity.chat.id]),
      ),
  }),
});
