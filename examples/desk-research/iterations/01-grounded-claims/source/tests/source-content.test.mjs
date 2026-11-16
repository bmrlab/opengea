import assert from "node:assert/strict";
import test from "node:test";
import { parseContentsResponse, sourceWindow } from "../lib/evidence.ts";
const url = "https://example.org/research";
const response = (results, statuses) => ({
  ok: true,
  status: 200,
  data: { results, statuses },
});
test("source windows retain exact identity, neighboring context and explicit gaps", () => {
  const text = "前".repeat(3500) + "目标价格仅适用于学生" + "后".repeat(5000);
  const result = parseContentsResponse(response([{ url, text }]), url);
  const first = sourceWindow(result, { query: "目标价格" });
  assert.equal(first.source.url, url);
  assert.equal(first.queryFound, true);
  assert.ok(first.source.text.includes("目标价格仅适用于学生"));
  assert.equal(
    first.source.text,
    text.slice(first.source.textOffset, first.source.nextOffset),
  );
  assert.ok(first.source.text.length <= 2000);
  assert.equal(first.source.truncated, true);
  const tail = sourceWindow(result, { offset: first.source.nextOffset });
  assert.equal(tail.source.textOffset, first.source.nextOffset);
  assert.equal(
    sourceWindow(result, { query: "不存在的说法" }).queryFound,
    false,
  );
  assert.throws(
    () => sourceWindow(result, { offset: text.length + 1 }),
    /outside/,
  );
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
