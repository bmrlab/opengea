import type { BenchmarkJudgeHandler } from "@gea-ai/agent-sdk/benchmark-app";
import { z } from "zod";
import { inputSchema, outputSchema, metrics } from "./retrieval.ts";
const referenceSchema = z.object({ relevantIds: z.array(z.string()).min(1) });
const judge: BenchmarkJudgeHandler = async ({ cases, executions }, context) => {
  context.signal.throwIfAborted();
  const rows = executions.map((execution) => {
    const testCase = cases.find((c) => c.id === execution.caseId);
    if (!testCase) throw new Error("Missing Case");
    const input = inputSchema.parse(testCase.input);
    const reference = referenceSchema.parse(testCase.reference);
    const known = new Set(input.documents.map((d) => d.id));
    if (reference.relevantIds.some((id) => !known.has(id)))
      throw new Error("Unknown reference document");
    if (execution.status === "error")
      return {
        caseId: execution.caseId,
        status: "error",
        error: execution.error,
        query: input.query,
        algorithm: "failed",
        k: 0,
        ranking: [],
        recall: 0,
        reciprocalRank: 0,
        ndcg: 0,
      };
    const output = outputSchema.parse(execution.value);
    if (output.ranking.some((d) => !known.has(d.id)))
      throw new Error("Unknown ranked document");
    return {
      caseId: execution.caseId,
      status: "completed",
      error: null,
      ...output,
      ...metrics(
        output.ranking.map((d) => d.id),
        reference.relevantIds,
        output.k,
      ),
    };
  });
  if (!rows.length) throw new Error("Empty selection");
  const mean = (key: "recall" | "reciprocalRank" | "ndcg") =>
    rows.reduce((sum, r) => sum + r[key], 0) / rows.length;
  return [
    ...rows.map((row, i) => ({
      subjects: [executions[i]!.id],
      value: { kind: "case", ...row },
    })),
    {
      subjects: executions.map((e) => e.id),
      value: {
        kind: "summary",
        selected: rows.length,
        failed: rows.filter((r) => r.status === "error").length,
        recall: mean("recall"),
        mrr: mean("reciprocalRank"),
        ndcg: mean("ndcg"),
        visualization: "opengea.retrieval.v1",
      },
    },
  ];
};
export default judge;
