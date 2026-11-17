import assert from "node:assert/strict";
import test from "node:test";
import { researchStep } from "../lib/research-flow.ts";

const step = (...names) => ({ toolCalls: names.map((name) => ({ name })) });
const read = { toolChoice: { type: "tool", toolName: "read_source" } };
test("discovery requires an actual source read, including after another search", () => {
  assert.equal(researchStep({ steps: [] }), undefined);
  assert.deepEqual(researchStep({ steps: [step("read_research"), step("search_sources")] }), read);
  assert.deepEqual(researchStep({ steps: [step("search_sources"), step("readToolOutput")] }), read);
  assert.equal(researchStep({ steps: [step("search_sources"), step("read_source")] }), undefined);
  assert.deepEqual(researchStep({ steps: [step("search_sources"), step("read_source"), step("search_sources")] }), read);
});
