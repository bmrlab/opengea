import assert from "node:assert/strict";
import test from "node:test";
import { sourcePassages } from "../lib/source-passages.ts";
test("passages are bounded contiguous original slices with stable source-bound identities", async () => {
  const text = `原文标题\n\n${"这是来源中的连续正文，标点与空格必须保持。".repeat(70)}\n结尾。`;
  const a = await sourcePassages("src_0123456789abcdef", text);
  assert.ok(a.length > 1);
  for (const p of a) {
    assert.ok(p.text.length <= 400);
    assert.ok(text.includes(p.text));
    assert.match(p.passageId, /^p_[a-f0-9]{16}$/);
  }
  assert.deepEqual(await sourcePassages("src_0123456789abcdef", text), a);
  const b = await sourcePassages("src_ffffffffffffffff", text);
  assert.notEqual(a[0].passageId, b[0].passageId);
  assert.deepEqual(await sourcePassages("src_0123456789abcdef", ""), []);
});
