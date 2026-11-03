import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { retrieve, metrics } from "../retrieval.ts";
import bench from "../bench.ts";
import judge from "../judge.ts";
const context = {
  taskId: "test",
  snapshotHash: `sha256:${"0".repeat(64)}`,
  parameters: {},
  signal: new AbortController().signal,
};
test("metrics use rank discounts and count misses", () => {
  const result = metrics(["x", "a", "b"], ["a", "b"], 3);
  assert.equal(result.recall, 1);
  assert.equal(result.reciprocalRank, 0.5);
  assert.ok(
    Math.abs(result.ndcg - (1 / Math.log2(3) + 0.5) / (1 + 1 / Math.log2(3))) <
      1e-12,
  );
  assert.equal(metrics([], ["a"], 3).ndcg, 0);
  assert.throws(() => metrics(["a", "a"], ["a"], 3));
});
test("BM25 rewards rare discriminating terms; empty matches stay empty", () => {
  const input = {
    query: "common rare",
    documents: [
      { id: "a", title: "", text: "common common common" },
      { id: "b", title: "", text: "rare" },
      { id: "c", title: "", text: "common" },
    ],
  };
  assert.equal(retrieve(input, {}).ranking[0]?.id, "b");
  assert.deepEqual(retrieve({ ...input, query: "unseen" }, {}).ranking, []);
  assert.throws(() => retrieve(input, { k: 0 }));
});
test("fixture executes without references; Judge includes failed cases in denominator", async () => {
  const fixture = JSON.parse(
    await readFile(new URL("../benchmark.json", import.meta.url), "utf8"),
  );
  const executions = await Promise.all(
    fixture.cases.map(async (c: { id: string; input: any }, i: number) => ({
      id: `e${i}`,
      caseId: c.id,
      status: "completed" as const,
      ...(await bench({ id: c.id, input: c.input }, context)),
    })),
  );
  const judgments = await judge({ cases: fixture.cases, executions }, context);
  assert.equal(judgments.length, 13);
  const failed = await judge(
    {
      cases: [fixture.cases[0]],
      executions: [
        {
          id: "error",
          caseId: fixture.cases[0].id,
          status: "error",
          error: "intentional failure",
        },
      ],
    },
    context,
  );
  assert.equal((failed[1]!.value as any).failed, 1);
  assert.equal((failed[1]!.value as any).mrr, 0);
});
