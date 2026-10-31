import { defineTool, type AgentDurableObjectNamespace } from "@gea-ai/agent-sdk";
import { z } from "zod";
import { probeIdSchema, probeObjectName } from "../../lib/namespace-probe";
import type { NamespaceProbe } from "../../server/namespace-probe-object";

declare module "@gea-ai/agent-sdk" {
  interface AgentDurableObjectBindings {
    NAMESPACE_PROBES: AgentDurableObjectNamespace<NamespaceProbe>;
  }
}

export default defineTool({
  name: "read_namespace_probe",
  description:
    "Read a synthetic business record created on this application's Preview web page. Supply only its probeId; report the actual receipt, never infer or invent the marker. This does not read OAuth sessions or MuseDAM data.",
  input: z.object({ probeId: probeIdSchema }),
  async execute({ probeId }, context) {
    if (context.auth.current?.principalType !== "user")
      throw new Error("An authenticated user is required.");
    const name = probeObjectName(
      context.environment,
      context.identity.organization.id,
      probeId,
    );
    const binding = context.durableObjects.NAMESPACE_PROBES;
    if (!binding) throw new Error("The business DO binding is unavailable.");
    const receipt = await binding.getByName(name).read();
    if (!receipt.record) throw new Error("The web-created record was not found.");
    return {
      ...receipt,
      sessionId: context.identity.chat.id,
      runId: context.identity.run.id,
    };
  },
});
