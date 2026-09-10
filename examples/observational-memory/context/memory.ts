import { DurableObject } from "cloudflare:workers";
import { z } from "zod";

const coveredSchema = z.strictObject({
  count: z.number().int().positive(),
  hash: z.string().regex(/^[a-f0-9]{64}$/),
});
const stateSchema = z.strictObject({
  revision: z.number().int().nonnegative(),
  observations: z.string(),
  covered: coveredSchema.nullable(),
});
const commitSchema = z.strictObject({
  expectedRevision: z.number().int().nonnegative(),
  observations: z.string().min(1),
  covered: coveredSchema,
});

export type ObservationState = z.infer<typeof stateSchema>;
export type ObservationCommit = z.infer<typeof commitSchema>;
export type ObservationStore = Pick<ObservationMemory, "read" | "commit">;

export class ObservationMemory extends DurableObject {
  async read(): Promise<ObservationState> {
    const value = await this.ctx.storage.get<unknown>("observations-v1");
    return value === undefined
      ? { revision: 0, observations: "", covered: null }
      : stateSchema.parse(value);
  }

  async commit(value: ObservationCommit): Promise<boolean> {
    const input = commitSchema.parse(value);
    return this.ctx.storage.transaction(async (storage) => {
      const stored = await storage.get<unknown>("observations-v1");
      const current =
        stored === undefined ? { revision: 0 } : stateSchema.parse(stored);
      if (current.revision !== input.expectedRevision) return false;
      await storage.put("observations-v1", {
        revision: current.revision + 1,
        observations: input.observations,
        covered: input.covered,
      });
      return true;
    });
  }
}
