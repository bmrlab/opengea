import assert from "node:assert/strict";
import test from "node:test";
import { parseSocialNoteResponse, noteIdFromUrl } from "../lib/evidence.ts";
const fixture = (note) => ({
  ok: true,
  data: {
    ok: true,
    status: 200,
    data: {
      code: 200,
      data: { code: 0, success: true, data: [{ note_list: [note] }] },
    },
  },
});
test("detail reading preserves returned note text and its boundaries without account fields", () => {
  const value = parseSocialNoteResponse(
    fixture({
      id: "abc123",
      title: "Title",
      desc: "Longer source text",
      time: 1730000000,
      user: { name: "private" },
      xsec_token: "private",
    }),
    "abc123",
  );
  assert.equal(value.source.text, "Longer source text");
  assert.equal(value.source.textScope, "note-text");
  assert.equal(value.source.truncated, false);
  assert.ok(!JSON.stringify(value).includes("private"));
  assert.equal(
    parseSocialNoteResponse(
      fixture({ id: "abc123", desc: "x".repeat(6001) }),
      "abc123",
    ).source.truncated,
    true,
  );
});
test("detail errors and different notes cannot masquerade as the requested evidence", () => {
  assert.equal(
    noteIdFromUrl("https://www.xiaohongshu.com/explore/abc123"),
    "abc123",
  );
  for (const url of [
    "https://attacker.test/explore/abc123",
    "http://www.xiaohongshu.com/explore/abc123",
    "https://www.xiaohongshu.com/explore/abc123?token=private",
  ])
    assert.throws(() => noteIdFromUrl(url));
  assert.throws(() =>
    parseSocialNoteResponse(fixture({ id: "other", desc: "text" }), "abc123"),
  );
  assert.throws(() =>
    parseSocialNoteResponse(
      { ok: true, data: { ok: false, status: 503 } },
      "abc123",
    ),
  );
  const empty = fixture({ id: "abc123" });
  empty.data.data.data.data = [];
  assert.throws(() => parseSocialNoteResponse(empty, "abc123"));
});
