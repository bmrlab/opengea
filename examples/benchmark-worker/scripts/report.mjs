import { readFile, writeFile } from "node:fs/promises";
export function renderReport(runs) {
  const escape = (value) =>
    String(value).replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char],
    );
  const percent = (value) => `${(value * 100).toFixed(1)}%`;
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Search quality</title><style>body{font:16px system-ui;max-width:1100px;margin:40px auto;padding:20px;color:#16273a;background:#f4f7fa}section{background:white;padding:24px;margin:24px 0;border-radius:12px}table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:10px;border-bottom:1px solid #ddd}meter{width:100px}small{overflow-wrap:anywhere}</style><h1>Knowledge search quality</h1><p>Worker-generated rankings and judgments. Macro averages include execution failures as zero. This is an exported report, not a GEA-hosted page.</p>${runs
    .map((run) => {
      const summary = run.judgments.find(
        (j) => j.value.kind === "summary",
      )?.value;
      if (!summary) throw new Error("Missing summary");
      return `<section><h2>${escape(run.algorithm)}</h2><small>Bench ${escape(run.bench.id)} · snapshot ${escape(run.bench.snapshotHash)}</small><p>Recall: ${percent(summary.recall)} · MRR: ${percent(summary.mrr)} · nDCG: ${percent(summary.ndcg)} · failures: ${escape(summary.failed)}/${escape(summary.selected)}</p><table><caption>Per-query quality at the configured cutoff</caption><tr><th>Case</th><th>Ranked documents</th><th>Recall</th><th>nDCG</th></tr>${run.judgments
        .filter((j) => j.value.kind === "case")
        .map(
          ({ value: r }) =>
            `<tr><td>${escape(r.caseId)}</td><td>${escape(r.ranking?.map((d) => d.id).join(" → ") ?? r.error)}</td><td>${percent(r.recall)}</td><td><meter min="0" max="1" value="${Number(r.ndcg)}">${percent(r.ndcg)}</meter> ${percent(r.ndcg)}</td></tr>`,
        )
        .join("")}</table></section>`;
    })
    .join("")}</html>`;
}
if (process.argv[1]?.endsWith("/report.mjs")) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output)
    throw new Error("Usage: node scripts/report.mjs results.json report.html");
  await writeFile(
    output,
    renderReport(JSON.parse(await readFile(input, "utf8"))),
  );
}
