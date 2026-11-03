import type { BenchmarkBenchHandler } from "@gea-ai/agent-sdk/benchmark-app";
import { retrieve } from "./retrieval.ts";
const bench: BenchmarkBenchHandler = async (testCase, context) => {
  context.signal.throwIfAborted();
  return { value: retrieve(testCase.input, context.parameters) };
};
export default bench;
