import { test } from "node:test";
import assert from "node:assert/strict";
import type { LanguageModelV4 } from "@ai-sdk/provider";
import type { AgentContextPrepareStepEvent } from "@gea-ai/agent-sdk/context";
import { ObservationMemory } from "./memory.ts";
import { observationalContext } from "./strategy.ts";

function database() {
  const values = new Map<string, unknown>();
  let tail = Promise.resolve();
  const storage: ConstructorParameters<typeof ObservationMemory>[0]["storage"] =
    {
      async get<T>(key: string) {
        return structuredClone(values.get(key)) as T | undefined;
      },
      async put(key: string, value: unknown) {
        values.set(key, structuredClone(value));
      },
      transaction<T>(
        operation: (
          tx: ConstructorParameters<typeof ObservationMemory>[0]["storage"],
        ) => Promise<T>,
      ): Promise<T> {
        const result = tail.then(() => operation(storage));
        tail = result.then(
          () => {},
          () => {},
        );
        return result;
      },
    };
  return () => new ObservationMemory({ storage });
}
function model(): LanguageModelV4 {
  return {
    specificationVersion: "v4",
    provider: "test",
    modelId: "observer",
    supportedUrls: {},
    async doStream() {
      throw new Error("generate only");
    },
    async doGenerate() {
      return {
        content: [
          { type: "text", text: "Owner is Mira; retention is now 30 days." },
        ],
        finishReason: { unified: "stop", raw: "stop" },
        usage: {
          inputTokens: { total: 12, noCache: 12, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 10, text: 10, reasoning: 0 },
        },
        warnings: [],
      };
    },
  };
}
test("DO commits are atomic, reject stale revisions, and survive reopening", async () => {
  const open = database();
  const value = {
    expectedRevision: 0,
    observations: "winner",
    covered: { count: 2, hash: "a".repeat(64) },
  };
  assert.deepEqual(
    await Promise.all([
      open().commit(value),
      open().commit({ ...value, observations: "stale" }),
    ]),
    [true, false],
  );
  assert.equal((await open().read()).observations, "winner");
  assert.equal((await open().read()).revision, 1);
});
test("observation and reflection usage survive activation and interrupted projection persistence", async () => {
  const open = database();
  const records: unknown[] = [];
  const strategy = observationalContext({
    memory: () => open(),
    observeAfterMessages: 2,
    reflectAtCharacters: 1,
    model: "example/memory",
  });
  const event: AgentContextPrepareStepEvent = {
    messages: [
      {
        role: "user",
        content: "Owner is Mira; retention was 90, corrected to 30.",
      },
      { role: "assistant", content: "Recorded." },
      { role: "user", content: "current unprocessed question" },
    ],
    contextSize: 3000,
    stepNumber: 0,
    runtimeContext: {
      modelId: "example/main",
      auth: { current: null },
      identity: {
        agent: { id: "agent" },
        chat: { id: "chat" },
        run: { id: "run" },
        organization: { id: "org" },
        workspace: { id: "workspace" },
        project: null,
        user: null,
      },
      env: {},
      environment: "production",
      durableObjects: {} as never,
      signal: new AbortController().signal,
      model: async () => model(),
      writeToolOutput: null,
      recordUsage: (entry) => records.push(entry),
      waitUntil() {
        throw new Error("foreground call");
      },
      async updateMessages() {
        throw new Error("prepareStep returns messages");
      },
    },
  };
  const result = await strategy.prepareStep!(event);
  assert.equal(result?.messages?.length, 2);
  assert.equal(
    result?.messages?.at(-1)?.content,
    "current unprocessed question",
  );
  assert.equal(records.length, 2);
  const reopened = observationalContext({
    memory: () => open(),
    observeAfterMessages: 2,
  });
  assert.deepEqual(await reopened.prepareStep!(event), result);
  assert.equal(records.length, 2);
  assert.equal(
    await reopened.prepareStep!({
      ...event,
      messages: [{ role: "user", content: "different chat content" }],
    }),
    undefined,
  );
});
