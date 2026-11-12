import { test } from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error Plain JavaScript report renderer is also used by the CLI.
import { renderReport } from "../scripts/report.mjs";
test("report escapes untrusted case and result text", () => {
  const html = renderReport([
    {
      algorithm: "<script>",
      bench: { id: "x", snapshotHash: "y" },
      judgments: [
        {
          value: {
            kind: "summary",
            recall: 0,
            mrr: 0,
            ndcg: 0,
            failed: 1,
            selected: 1,
          },
        },
        {
          value: {
            kind: "case",
            caseId: "<img>",
            error: "<script>alert(1)</script>",
            recall: 0,
            ndcg: 0,
          },
        },
      ],
    },
  ]);
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;img&gt;"));
});
