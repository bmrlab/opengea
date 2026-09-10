import { test } from "node:test";
import assert from "node:assert/strict";
import { cacheUsage } from "./metrics.mjs";
test("cache accounting preserves missing provider facts and uses total input as denominator", () => {
  const reported = {
    usage: {
      inputTokens: 100,
      inputTokenDetails: {
        cacheReadTokens: 70,
        cacheWriteTokens: 20,
        noCacheTokens: 10,
      },
    },
  };
  assert.equal(cacheUsage([reported, reported]).cacheReadShare, 0.7);
  assert.equal(
    cacheUsage([
      reported,
      { usage: { inputTokens: 30, inputTokenDetails: {} } },
    ]).cacheReadTokens,
    null,
  );
  assert.equal(
    cacheUsage([
      { usage: { inputTokens: 50, inputTokenDetails: { cacheReadTokens: 0 } } },
    ]).cacheReadTokens,
    0,
  );
});
