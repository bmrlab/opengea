# Code mode with a bundled Skill: Production observations

Verified on **2026-10-03**, using published SDK **0.1.261003-alpha.1**, macOS CLI
**0.1.261003-alpha.0**, Node **24.16.0**, pnpm **12.1.0**, MCP SDK **1.32.0**,
and hosted model alias **creative-reasoning-1.5**. The dedicated example runs on
AWS China Production with Worker Runtime **v0.55.35**. No cluster upgrade was needed.

The Skill report passed in both independent trials. Each model read the Skill
instructions and made exactly one `executeJavaScript` call with a file reference
and separate input. It neither read nor generated JS source. Real remote MCP
calls fetched each of the four pages once, and the custom policy was applied
inside the script. Only aggregate data returned to the model.

**Both complete comparison runs failed**, because the ordinary-tool control had
tool errors in both trials; dynamic code mode also failed trial 1. Failed runs
remain in the results below. We ran exactly two trials, with unchanged prompts,
bundles and acceptance checks, and did not replay accepted Runs or keep trying
until all modes passed. These are observations, not a stable benchmark.

## Results

All three report modes receive the same natural-language task, shared model and
arithmetic instructions, synthetic MCP service, and custom discount policy.
Their mode-specific instructions differ to explain the available interfaces.
No model-response fixtures were used. A separate fourth Run checks MCP protocol
boundaries using the dynamic code Agent.

| Trial | Mode           | Strict result | Model requests | Input tokens | Output tokens | Top-level calls | Model span seconds |
| ----- | -------------- | ------------- | -------------: | -----------: | ------------: | --------------: | -----------------: |
| 1     | code           | **Fail**      |              5 |       18,466 |         2,102 |               4 |             32.463 |
| 1     | direct         | **Fail**      |              6 |      110,453 |         6,271 |              18 |             71.705 |
| 1     | skill          | Pass          |              3 |        6,452 |           296 |               2 |             11.005 |
| 1     | mcp-boundaries | Pass          |              3 |        8,490 |         2,628 |               2 |             29.604 |
| 2     | code           | Pass          |              5 |       17,843 |         1,227 |               4 |             80.744 |
| 2     | direct         | **Fail**      |              6 |      110,473 |         6,210 |              18 |             68.372 |
| 2     | skill          | Pass          |              3 |        6,452 |           284 |               2 |              9.722 |
| 2     | mcp-boundaries | Pass          |              5 |       19,034 |         4,015 |               4 |             47.788 |

| Trial | Report mode | Generated JS bytes | Script argument bytes | Unique tool-result bytes | Tool-result bytes across model requests |
| ----- | ----------- | -----------------: | --------------------: | -----------------------: | --------------------------------------: |
| 1     | code        |              2,787 |                 2,952 |                    6,552 |                                  21,375 |
| 1     | direct      |              6,644 |                 7,188 |                   60,070 |                                 180,546 |
| 1     | skill       |                  0 |                   102 |                    1,352 |                                   2,369 |
| 2     | code        |              2,118 |                 2,248 |                    6,505 |                                  21,481 |
| 2     | direct      |              6,580 |                 6,722 |                   60,058 |                                 180,534 |
| 2     | skill       |                  0 |                   102 |                    1,352 |                                   2,369 |

In trial 2, both dynamic code mode and Skill passed. For this successful pair,
Skill reduced trace-reported input tokens from **17,843 to 6,452 (63.8%)**, output
tokens from **1,227 to 284 (76.9%)**, and unique model tool-result bytes from
**6,505 to 1,352 (79.2%)**. Generated JS went from **2,118 bytes to zero**; the
file-reference call arguments were **102 bytes**, versus **2,248 bytes** across
dynamic script calls. This illustrates two benefits: code mode keeps raw rows
inside execution, and a Skill also keeps reusable source out of model context.
We do not calculate successful ordinary-tool savings from either failed control.
The earlier successful two-mode observation remains in [COMPARISON.md](COMPARISON.md).

Tokens are summed from actual model trace usage, not estimated from bytes.
Unique tool-result bytes count each top-level tool result once; the last column
includes repeated history across model requests. Counts include instructions,
discovery and ordinary output offloading. Model span duration is summed model
request time, not end-to-end latency. These numbers are not billed costs, and
two trials cannot establish general reliability, latency or token savings.

### Failures retained

- **Trial 1 dynamic code:** the model fetched all four pages, returned a raw sample
  row, then fetched all four again for aggregation. Final totals were correct,
  but eight page reads violated the once-per-page requirement. The checker failed
  there; trace inspection also found the raw-row leak. These were model-authored
  calls, not automatic SDK retries or script replay.
- **Both ordinary-tool trials:** four `readToolOutput` calls used limits
  8,381 / 8,399 / 8,399 / 8,411 at offset 4,000, exceeding the shared contract's
  maximum of 7,000. These calls were recorded as errors; the strict comparison
  failed even though the model continued. We did not increase limits or remove
  the successful-tool-call requirement.
- **MCP boundaries passed in both trials:** full `content`, `structuredContent`
  and `_meta` evidence, schema-less text returns, the original `isError` envelope,
  and a successful read beginning after the missing-order call settled.

The Skill result in both trials was:

```json
{
  "regions": {
    "north": {
      "paidOrders": 25,
      "units": 51,
      "grossCents": 69000,
      "netCents": 62097
    },
    "south": {
      "paidOrders": 50,
      "units": 99,
      "grossCents": 136375,
      "netCents": 129541
    }
  },
  "totals": {
    "paidOrders": 75,
    "units": 150,
    "grossCents": 205375,
    "netCents": 191638
  }
}
```

## Reproduction and immutable identities

Follow [README.md](README.md), including the third `GEA_SKILL_AGENT_ID`.
`pnpm compare` starts a fresh independent comparison. Set `GEA_COMPARE_DIR` to
an existing evidence directory to inspect its accepted Runs without reposting.
Do not rerun an uncertain submission without recovering its original Run ID.

- Project: `opengea-code-mode` / `01a10007-059d-7278-8705-cff488be2910`.
- Agent Worker: `01a10007-0ddb-7114-841d-fbdf259c53ff`.
- Production **v4** deployment: `01a1011b-069a-77fd-8954-c350cee1eef4`.
- Bundle hash: `sha256:a9fb6b9c55ee28263e696b4ccdd8ecabaff0934038df050205379b9547f189c1`.
- Skill source SHA-256: `d69023e25a41357455ac29f6f5d08b720145ed21d3a0990c2a9e0cd6cb0e56d0`.
- Lockfile SHA-256: `05b0608f5acd994a1c179ae2441b0021d08fe138d1ea558275fab82d3ddf073b`.
- Remote MCP deployment: `01a1004a-7419-779c-8b41-c50cdb003f86`.
- Remote MCP endpoint: `https://worker--01a1004a-73ee-720e-b227-e1bf47c38181.aws-cn-prod.museai.cc/mcp`.

Agent v3 was Preview only; the evidence here is from v4. Historical v1 warehouse
and v2 comparison records remain unchanged in [VERIFICATION.md](VERIFICATION.md)
and [COMPARISON.md](COMPARISON.md).

| Mode   | Agent ID                               | Agent version ID                       |
| ------ | -------------------------------------- | -------------------------------------- |
| code   | `01a1004d-42d3-70ff-9911-e25ef3dd06ad` | `01a1011b-22c7-71c1-afca-b31736636842` |
| direct | `01a1004d-430f-775e-aba5-0266666a59b0` | `01a1011b-22ce-7524-8527-0d0a50358516` |
| skill  | `01a1011a-0769-701a-800a-249bd683662c` | `01a1011b-22da-7453-98de-135d37cb5a79` |

| Trial | Mode           | Run ID                                 | Chat ID                                | Trace ID                           |
| ----- | -------------- | -------------------------------------- | -------------------------------------- | ---------------------------------- |
| 1     | code           | `01a1011c-45d6-739f-8700-360fc0d9f461` | `01a1011c-458f-758b-8449-703c6b23f2e9` | `851302c3fd8364856789123e8b0ffe22` |
| 1     | direct         | `01a1011c-ed8e-722e-8fa0-bd8ed1aefbc1` | `01a1011c-ed42-77ad-8a00-b8cdec5b21bc` | `85b6f97213ce30feeb00eefa5ee8d14c` |
| 1     | skill          | `01a1011e-397a-72dd-9922-55759782aa7a` | `01a1011e-3942-757d-9e38-f8b6a98dbcf3` | `3b510ea9de75b27db118f0a8b68fbfb3` |
| 1     | mcp-boundaries | `01a1011e-95ff-720c-b52e-6a4f8bfe463d` | `01a1011e-9599-7759-88de-2a54df6d3768` | `04eb0e76565d4935bb49b3d3e917a208` |
| 2     | code           | `01a1011f-d559-75ef-b0b5-3cd426e2ab85` | `01a1011f-d4c1-77f5-9a7e-8f4b642b98ae` | `5b751f2caeacd528173a29c5d917dac1` |
| 2     | direct         | `01a10121-436f-757c-bec5-8be6851023fb` | `01a10121-4311-72c9-b2aa-025c46cf8857` | `df540bb28eee533774b6024a17e9efdb` |
| 2     | skill          | `01a10122-8478-77fe-a96f-a163c271d914` | `01a10122-843e-747b-ac45-15d821505755` | `98c5f801d65b6151c838910d4cfa64a5` |
| 2     | mcp-boundaries | `01a10122-d4e5-778f-bf75-22767d8a9152` | `01a10122-d489-744d-9d98-7fa949d71f7f` | `96e99cbab7e45b226796968da7590cee` |

Raw messages, traces and report JSON remain in ignored local evidence directories
`.gea/comparison/production-20261003-skill/` and
`.gea/comparison/production-20261003-skill-trial2/`; no credentials or raw traces
are committed. The deployment and Runs remain available for authorized inspection.

## Local validation and limits

Passed: frozen dependency install, TypeScript, real localhost HTTP MCP transport
test, official remote MCP probe, Agent validation and packaging, bundle inspection,
and formatting/diff checks. The packaged Skill belongs only to `orders-skill`.
The local test runs the actual Skill body against the local MCP service and checks
full and north-only totals, invalid region rejection before any calls, and
propagated MCP errors without retries. Its custom policy boundary is deterministic;
it does not claim to test the V8 sandbox or autonomous model behavior. The two
Production Skill Runs separately exercise the real model, bundled source resolver,
V8 execution, remote MCP and custom tool.

This update does not revalidate the introductory warehouse probes, Python Skill
execution, authenticated/OAuth MCP, SSE resumption, network faults, cancellation,
timeouts, capability revocation, approval flows or sustained load. The script is
read-only over synthetic data; no customer data or external business writes were
used. A failed script does not roll back completed calls. Reusable source remains
subject to the Agent's existing permissions and execution budgets.
