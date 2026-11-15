import assert from "node:assert/strict";
import test from "node:test";
import { parseContentsResponse } from "../lib/evidence.ts";
const url = "https://example.org/research";
const response = (results, statuses) => ({
  ok: true,
  status: 200,
  data: { results, statuses },
});
test("contents retain only the requested evidence with its extraction limit", () => {
  const value = parseContentsResponse(
    response([
      { url, title: "Research", text: "x".repeat(12001), author: "private" },
    ]),
    url,
  );
  assert.equal(value.source.text.length, 12000);
  assert.equal(value.source.truncated, true);
  assert.equal(value.source.textScope, "page-text");
  assert.ok(!JSON.stringify(value).includes("private"));
});
test("HTTP 200 partial errors, missing sources and wrong pages stay failures", () => {
  assert.throws(() => parseContentsResponse({ ok: false, status: 503 }, url));
  assert.throws(() => parseContentsResponse(response([]), url));
  assert.throws(() =>
    parseContentsResponse(
      response([{ url: "https://example.org/other", text: "Other" }]),
      url,
    ),
  );
  assert.throws(() =>
    parseContentsResponse(
      response([{ url, text: "cached" }], [{ id: url, status: "error" }]),
      url,
    ),
  );
  assert.equal(parseContentsResponse(response([{ url }]), url).source.text, "");
});
