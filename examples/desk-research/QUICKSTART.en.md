# Agent Builder Quick Start: five steps

Start from the [complete example](README.md). The quality baseline already searches with Exa, reads source bodies and stores research in a Durable Object. Workbench and Feishu are [functional extensions](versions/README.md), not quality rounds.

## Baseline task for a coding agent

```text
Add save/read research briefs to ProductResearch while preserving Exa search and source reading.
Use ResearchStore Durable Object storage for scope, report and sources.
Isolate records by the trusted Session/Chat ID; never let the model select another session.
Verify that the same conversation reads its record and another conversation cannot.
Do not store credentials or private data. Deliver code, validation evidence and remaining gaps.
```

## 1. Build a case

Use the [8-yuan budget example](BENCHMARKS.md#1-建题从业务风险到-casejson): input, metadata.acceptance, judgeRules and three Markdown Judges. Acceptance reaches the Judge context, not the tested Agent's user message. Required minScore: 1 is a gate, not the scoring implementation.

## 2. Run and score

Inject `CREATIVE_REASONING_API_KEY` into the local process; Agent, Simulator and Judge use `creative-reasoning-1.5` with `modelSource: "local"`. Supply the separately authorized Exa key as `GEA_CONNECTOR_RESEARCH_SEARCH_API_KEY`. Follow [setup](README.md#配置-cr-api-key) and the [default evaluation command](README.md#2-跑分). Preserve the returned resultDirectory and score that exact Run. Execution completion, grading completion and quality acceptance are separate outcomes.

## 3. Locate the failure

First read the final answer and Judge reasons. Record the Case, exact sentence, evidence and hypothesis. After the result-focused change, inspect the Trace: searches, source reads and citation origins. Separate execution errors, Judge errors, valid zeros and missing multi-turn coverage using the [diagnostic guide](evaluation/README.md#3-定位失分).

## 4. Change the Agent

Copy the task from [baseline](iterations/00-baseline/README.md), [result-focused](iterations/01-result-focused/README.md) or [trace-focused](iterations/02-trace-focused/README.md). Keep Cases, Judges, model and budgets fixed. Round 01 changes output instructions; round 02 changes the process and citation tools. Structured observations in the root example remain a later improvement.

## 5. Run again

Compare by Case × Judge, including improvements, regressions, unfinished grading and manual disagreements. Retain all attempts; never select only good reruns or fill missing scores. `protocol.json` records agreed conditions and is not read by the runner. Manifests verify source content only; shared Traces are cropped, with full evidence kept locally.
