import { expect, it } from "vitest";
import { probeObjectName } from "../lib/namespace-probe";
import readProbe from "../agents/musedam-chat/read-namespace-probe";

const first = "018f0000-0000-7000-8000-000000000001";
const second = "018f0000-0000-7000-8000-000000000002";
const probe = "018f0000-0000-7000-8000-000000000003";

it("partitions synthetic business objects by trusted tenant and rejects Production", () => {
  expect(probeObjectName("preview", first, probe)).not.toBe(
    probeObjectName("preview", second, probe),
  );
  expect(() => probeObjectName("production", first, probe)).toThrow("Preview");
  expect(() => probeObjectName("preview", "", probe)).toThrow();
  expect(() => probeObjectName("preview", first, "arbitrary-object-name")).toThrow();
});

type Context = Parameters<typeof readProbe.execute>[1];
function toolContext(overrides: Record<string, unknown> = {}) {
  return {
    auth: { current: { principalType: "user", principalId: "verified-user" } },
    environment: "preview",
    identity: { organization: { id: first }, chat: { id: "new-session" }, run: { id: "new-run" } },
    durableObjects: {},
    ...overrides,
  } as unknown as Context;
}

it("fails closed before business lookup for non-user or Production executions", async () => {
  await expect(readProbe.execute({ probeId: probe }, toolContext({ auth: { current: null } }))).rejects.toThrow("authenticated user");
  await expect(readProbe.execute({ probeId: probe }, toolContext({ environment: "production" }))).rejects.toThrow("Preview");
  await expect(readProbe.execute({ probeId: probe }, toolContext())).rejects.toThrow("binding is unavailable");
});

it("reads the trusted tenant's exact object and preserves the actual receipt", async () => {
  const receipt = {
    className: "NamespaceProbe",
    objectIdPrefix: "1234567890abcdef",
    record: { probeId: probe, marker: "synthetic-fixture", createdAt: "2026-10-31T00:00:00.000Z" },
  };
  const names: string[] = [];
  const context = toolContext({
    durableObjects: {
      NAMESPACE_PROBES: {
        getByName(name: string) {
          names.push(name);
          return { async read() { return receipt; } };
        },
      },
    },
  });
  expect(await readProbe.execute({ probeId: probe }, context)).toEqual({
    ...receipt, sessionId: "new-session", runId: "new-run",
  });
  expect(names).toEqual([probeObjectName("preview", first, probe)]);
});

it("does not report success when the Tool reaches an empty namespace", async () => {
  const context = toolContext({
    durableObjects: { NAMESPACE_PROBES: { getByName() { return { async read() { return { record: null }; } }; } } },
  });
  await expect(readProbe.execute({ probeId: probe }, context)).rejects.toThrow("record was not found");
});
