import assert from "node:assert/strict";
import test from "node:test";
import { researchStep } from "../lib/research-flow.ts";
import { parseSearchResponse, parseContentsResponse, sourceWindow } from "../lib/evidence.ts";
import { sourcePassages } from "../lib/source-passages.ts";

const url = "https://example.org/research";
const other = "https://example.org/other";
const envelope = (results) => ({ ok: true, status: 200, data: { results } });
const search = (urls = [url]) => ({ name: "search_sources", input: { query: "research" },
  output: parseSearchResponse(envelope(urls.map((url) => ({ url })))) });
const readSource = (text = "真实正文", requested = url) => ({ name: "read_source", input: { url: requested },
  output: sourceWindow(parseContentsResponse(envelope([{ url: requested, text }]), requested), {}) });
const failed = (name, input = {}) => ({ name, input, output: { message: "Exa request failed (HTTP 503)." }, is_error: true });
function context(...calls) {
  return {
    steps: calls.map((call, i) => ({ toolCalls: [{ id: `call-${i}`, name: call.name, input: call.input ?? {} }] })),
    messages: calls.map((call, i) => ({ role: "tool", content: [{ type: "tool_result", call_id: `call-${i}`, output: call.output, is_error: call.is_error ?? false }] })),
  };
}
const run = (...calls) => researchStep(context(...calls));
const read = { toolChoice: { type: "tool", toolName: "read_source" } };
const gap = { activeTools: ["search_sources", "read_source"], toolChoice: "auto" };

test("discovery requires completed source text, and another discovery requires another read", () => {
  assert.equal(run(), undefined);
  assert.deepEqual(run(search()), read);
  assert.deepEqual(run(search(), { name: "readToolOutput", output: "preview" }), read);
  assert.equal(run(search(), readSource()), undefined);
  assert.deepEqual(run(search(), readSource(), search()), read);
});
test("empty and failed searches allow further research or a gap answer, not a forced URL", () => {
  assert.deepEqual(run(search([])), gap);
  assert.deepEqual(run(failed("search_sources")), gap);
  assert.deepEqual(run(search([]), search()), read);
  assert.deepEqual(run(failed("search_sources"), search()), read);
});
test("failed or denied reads do not unlock saves and do not force an endless read retry", () => {
  assert.deepEqual(run(search(), failed("read_source", { url })), gap);
  const denied = context(search(), readSource());
  denied.messages[1].content[0].is_error = false;
  denied.messages[1].content[0].denied = true;
  assert.deepEqual(researchStep(denied), gap);
  assert.deepEqual(run(search(), failed("read_source", { url }), search([other])), read);
  assert.equal(run(search([url, other]), failed("read_source", { url }), readSource("另一正文", other)), undefined);
});
test("successful empty or whitespace-only windows are still evidence gaps", () => {
  for (const text of ["", " \n\t"]) assert.deepEqual(run(search(), readSource(text)), gap);
  assert.deepEqual(run(search(), { name: "read_source", input: { url }, output: { source: { url, passages: [] } } }), gap);
});
test("workbench passage text counts as a read, metadata and empty passages do not", async () => {
  const call = readSource();
  delete call.output.source.text;
  call.output.source.passages = await sourcePassages("src_0123456789abcdef", "真实正文");
  assert.equal(run(search(), call), undefined);
  call.output.source.passages = [{ passageId: "p_0123456789abcdef", text: "  " }];
  call.output.source.textLength = 200;
  assert.deepEqual(run(search(), call), gap);
});
test("reads must match a discovered URL and the requested URL", () => {
  assert.deepEqual(run(search(), readSource("正文", other)), gap);
  const mismatched = readSource();
  mismatched.input.url = other;
  assert.deepEqual(run(search([url, other]), mismatched), gap);
  assert.equal(run(search(), search([other]), readSource()), undefined);
});
test("tool results are joined by call ID, not position or tool name alone", () => {
  const value = context(search(), readSource());
  value.messages.reverse();
  assert.equal(researchStep(value), undefined);
  value.messages[0].content[0].call_id = "unrelated-read";
  assert.deepEqual(researchStep(value), read);
  value.messages = [];
  assert.equal(researchStep(value), undefined);
});
test("failure after a successful read remains a gap until actual text is read again", () => {
  assert.deepEqual(run(search(), readSource(), search([])), gap);
  assert.deepEqual(run(search(), readSource(), failed("read_source", { url })), gap);
  assert.equal(run(search(), readSource(), search([]), readSource()), undefined);
});
