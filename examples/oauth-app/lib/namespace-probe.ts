import { z } from "zod";

export const probeIdSchema = z.uuid();

// The platform shares storage across installations of this application.
// Business data still needs explicit environment and tenant partitioning.
export function probeObjectName(
  environment: string,
  organizationId: string,
  probeId: string,
) {
  if (environment !== "preview") throw new Error("Preview is required.");
  return JSON.stringify([
    "namespace-probe-v1",
    environment,
    z.uuid().parse(organizationId),
    probeIdSchema.parse(probeId),
  ]);
}

export interface ProbeRecord {
  probeId: string;
  marker: string;
  createdAt: string;
}
