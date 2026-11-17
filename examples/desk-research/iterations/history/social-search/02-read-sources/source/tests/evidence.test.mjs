import assert from "node:assert/strict";
import test from "node:test";
import { parseSocialSearchResponse } from "../lib/evidence.ts";

function response(items) {
  return {
    connector: "social-search",
    ok: true,
    data: {
      ok: true,
      status: 200,
      data: { code: 200, data: { code: 0, success: true, data: { items } } },
    },
  };
}

test("social evidence retains source excerpts but excludes account and transport credentials", () => {
  const value = parseSocialSearchResponse(
    response([
      {
        model_type: "note",
        note: {
          id: "abc123",
          title: "办公室早餐",
          desc: "携带方便，但口感有取舍",
          timestamp: 1730000000,
          user: { nickname: "private author" },
          xsec_token: "private transport token",
        },
      },
    ]),
  );
  assert.equal(value.sources[0].text, "携带方便，但口感有取舍");
  assert.equal(
    value.sources[0].url,
    "https://www.xiaohongshu.com/explore/abc123",
  );
  assert.equal(value.sources[0].sourceType, "social-post");
  assert.equal(value.sources[0].textScope, "search-excerpt");
  assert.ok(!JSON.stringify(value).includes("private"));
});

test("nested provider errors cannot become empty successful research", () => {
  assert.throws(() =>
    parseSocialSearchResponse({
      connector: "social-search",
      ok: true,
      data: { ok: false, status: 422 },
    }),
  );
  const failed = response([]);
  failed.data.data.data.success = false;
  assert.throws(() => parseSocialSearchResponse(failed));
  assert.deepEqual(parseSocialSearchResponse(response([])).sources, []);
  assert.throws(() =>
    parseSocialSearchResponse(
      response([{ note: { id: "../unsafe", desc: "text" } }]),
    ),
  );
});

test("missing excerpts remain missing; large excerpts are visibly truncated", () => {
  const value = parseSocialSearchResponse(
    response([
      { note: { id: "empty", title: "title only" } },
      { note: { id: "long", desc: "x".repeat(6001) } },
    ]),
  );
  assert.equal(value.sources[0].text, "");
  assert.equal(value.sources[1].text.length, 6000);
  assert.equal(value.sources[1].truncated, true);
});
