import { test } from "node:test";
import assert from "node:assert/strict";
import { expected, scoreRecord } from "./scenario.mjs";
test("recall scoring rejects obsolete decisions, invented facts and malformed output", () => {
  assert.equal(scoreRecord(JSON.stringify(expected)).correct, 15);
  const result = scoreRecord(
    JSON.stringify({
      ...expected,
      retentionDays: 90,
      owner: "Mallory",
      accessCode: "1234",
    }),
  );
  assert.equal(result.correct, 12);
  assert.deepEqual(
    result.errors.map((error) => error.key),
    ["owner", "retentionDays", "accessCode"],
  );
  assert.equal(scoreRecord("```json\n{}\n```").correct, 0);
});

test("recall scoring separates a JSON code fence from fact accuracy", () => {
  const result = scoreRecord("```json\n" + JSON.stringify(expected) + "\n```");
  assert.equal(result.correct, 15);
  assert.equal(result.format, "markdown-json");
  assert.equal(scoreRecord(JSON.stringify(expected)).format, "json");
  assert.equal(
    scoreRecord("Here is the answer: " + JSON.stringify(expected)).correct,
    0,
  );
});

test("the document-name answer key matches the recall question", () => {
  assert.equal(
    scoreRecord(JSON.stringify({ ...expected, blocker: "DPA" })).correct,
    15,
  );
});
