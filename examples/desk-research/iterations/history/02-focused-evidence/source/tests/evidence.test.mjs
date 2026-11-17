import assert from "node:assert/strict";
import test from "node:test";
import {
  parseSearchResponse,
  SEARCH_RESULT_LIMIT,
  SEARCH_TEXT_LIMIT,
} from "../lib/evidence.ts";
const response = (results) => ({ ok: true, status: 200, data: { results } });
test("Exa sources retain returned evidence without unrelated provider fields", () => {
  const value = parseSearchResponse(
    response([
      {
        url: "https://example.org/research",
        title: "Research",
        text: "Observed tradeoff",
        publishedDate: "2026-01-01",
        author: "private",
      },
    ]),
  );
  assert.equal(value.sources[0].text, "Observed tradeoff");
  assert.equal(value.sources[0].textScope, "search-text");
  assert.ok(!JSON.stringify(value).includes("private"));
});
test("provider errors and unsafe URLs cannot masquerade as empty research", () => {
  assert.throws(() => parseSearchResponse({ ok: false, status: 401 }));
  assert.throws(() =>
    parseSearchResponse(response([{ url: "file:///private" }])),
  );
  assert.deepEqual(parseSearchResponse(response([])).sources, []);
});
test("missing text and bounded extraction remain explicit evidence gaps", () => {
  const value = parseSearchResponse(
    response([
      { url: "https://example.org/empty" },
      { url: "https://example.org/long", text: "x".repeat(6001) },
    ]),
  );
  assert.equal(value.sources[0].text, "");
  assert.equal(value.sources[1].text.length, 600);
  assert.equal(value.sources[1].truncated, true);
  assert.equal(value.sources[1].textLimit, 600);
});

test("large search bodies retain a compact index of every exact source URL", () => {
  const results = Array.from({ length: 5 }, (_, index) => ({
    url: `https://example.org/articles/${index}?edition=full`,
    title: `Article ${index}`,
    text: "Body".repeat(1500),
    publishedDate: "2026-01-01",
  }));
  const value = parseSearchResponse(response(results));
  assert.deepEqual(
    value.sourceIndex,
    results
      .slice(0, SEARCH_RESULT_LIMIT)
      .map(({ url, title, publishedDate }) => ({
        url,
        title,
        publishedAt: publishedDate,
      })),
  );
  assert.ok(JSON.stringify(value.sourceIndex).length < 2000);
  assert.deepEqual(
    value.sources.map(({ text }) => text),
    results
      .slice(0, SEARCH_RESULT_LIMIT)
      .map(({ text }) => text.slice(0, SEARCH_TEXT_LIMIT)),
  );
});
