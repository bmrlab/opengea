# Remote MCP comparison — 2026-10-03

The remote MCP path and custom-tool composition passed on AWS China **Production**
using published SDK/CLI `0.1.261003-alpha.0` and hosted model alias
`creative-reasoning-1.5` (`anthropic-messages`). No model-response fixtures were used.

Both modes returned the exact same correct result:

```json
{
  "regions": {
    "north": { "paidOrders": 25, "units": 51, "grossCents": 69000, "netCents": 62097 },
    "south": { "paidOrders": 50, "units": 99, "grossCents": 136375, "netCents": 129541 }
  },
  "totals": { "paidOrders": 75, "units": 150, "grossCents": 205375, "netCents": 191638 }
}
```

## Observed difference

| Measurement                                                             | Ordinary tools | Code mode |
| ----------------------------------------------------------------------- | -------------: | --------: |
| Model requests                                                          |              4 |         5 |
| Model-visible tool calls                                                |             14 |         4 |
| Unique tool-result JSON bytes entering model input                      |         64,466 |     6,656 |
| Tool-result bytes across all model requests, including repeated history |        135,338 |    21,753 |
| Trace-reported input tokens, summed                                     |         82,104 |    19,789 |
| Trace-reported output tokens, summed                                    |          6,063 |     1,105 |
| Model span duration, summed                                             |       48.871 s |  20.445 s |
| Remote page reads                                                       |              4 |         4 |

Code mode exposed **89.7% fewer tool-result bytes** and recorded **75.9% fewer input
tokens** in this pair. It did **not** reduce model requests: discovery cost an extra
turn. These are one-pair observations, not stable latency, cost or win-rate claims.
Model span duration excludes other execution time; token sums are reported usage,
not a price calculation or cache-adjusted billing figure.

Both Agents used the same data, policy, model alias, output token limit and normal
platform output-offload behavior. The shared task prompt was identical; each
Agent's instructions explained its available interface. Code mode performed
namespace/search discovery, schema inspection, list/policy retrieval, then four
MCP reads and all row calculations inside a script. Raw orders were not returned
in any script result. It still made six underlying tool calls (page list, policy
and four pages); four visible calls does not mean only four operations occurred.

Ordinary mode called the four page tools and policy directly. Default tool-output
offload then required eight `readToolOutput` calls. The model copied the retrieved
data into its pure-computation JavaScript call. That is the supported default
behavior, not a deliberately disabled optimization. No offload limit was changed
for this comparison. Final answers alone were not used as proof: the verifier
also checked four distinct page calls and code-mode parent/child trace links.

## MCP protocol evidence

The official MCP client probe and local HTTP transport test passed:
initialization, tool listing, pagination, declared output schemas, full envelopes,
text-only results with no output schema, invalid-input rejection and remote
`isError` results. The service uses official MCP SDK `1.32.0`, stateless Streamable
HTTP with bounded JSON responses, and no business data or outbound requests.

A separate real-model Production Run verified inside `executeJavaScript`:

- `content[0].text` JSON equals the real `structuredContent` for a page.
- `_meta.dataset` is preserved as `synthetic-orders-v1`.
- `lookup_order` returns text-only data with no `structuredContent`.
- A missing order retains `isError: true` and `ORDER_NOT_FOUND` text.
- A subsequent page read succeeds.
- `describeTool` includes the page's structured-content schema; the schema-less
  lookup does not acquire an invented structured-content schema.

The final boundary script returned all three evidence booleans as `true`, the
original remote error and `recoveredPage: 2`. Child spans show page 2 started
50 ms after the missing-order call ended. No SDK script retry or replay was added.

## Execution identity

| Resource                | ID                                                           |
| ----------------------- | ------------------------------------------------------------ |
| Studio Project          | `opengea-code-mode` / `01a10007-059d-7278-8705-cff488be2910` |
| Agent Worker            | `01a10007-0ddb-7114-841d-fbdf259c53ff`                       |
| Agent Worker deployment | `01a1004d-2f8f-727e-8669-8dc1b52dd9ac` (version 2)           |
| Code Agent              | `01a1004d-42d3-70ff-9911-e25ef3dd06ad`                       |
| Code Agent version      | `01a1004d-42e6-7748-b226-c021b431f485`                       |
| Direct Agent            | `01a1004d-430f-775e-aba5-0266666a59b0`                       |
| Direct Agent version    | `01a1004d-4318-7628-aa2f-2c489079b333`                       |
| MCP Worker              | `01a1004a-73ee-720e-b227-e1bf47c38181`                       |
| MCP Worker deployment   | `01a1004a-7419-779c-8b41-c50cdb003f86`                       |

| Case                | Run                                    | Trace                              |
| ------------------- | -------------------------------------- | ---------------------------------- |
| Code report         | `01a10050-3f8c-7608-bb2a-0861e5f85689` | `f249a2eecc41d1fa7092a89da993d62a` |
| Direct report       | `01a10051-9a6d-7486-820d-3f970fb74812` | `a281580d4f6a6a34a37b9c9dcbce7e4f` |
| MCP boundary, final | `01a1005d-01e4-7628-be55-0ba34ca07153` | `58d830998810e30172e333447d55c70f` |

Retrieve traces with `pnpm gea trace inspect --json
'{"project":"opengea-code-mode","traceId":"<trace>"}'` and follow `nextCursor`.
Private raw messages, script inputs/outputs, full trace pages and inspection
reports remain in ignored `.gea/comparison/production-20261003-sequential/`.

## Diagnostic attempts and limitations

An initial accepted code Run briefly had no public Chat projection. The polling
script now waits within its deadline for that projection; it reused the accepted
Run and did not submit it again. The direct Agent emitted a progress text before
its final JSON. The verifier was corrected to parse the final text part rather
than concatenating intermediate progress into JSON; the strict result comparison
was retained, and the same Run was inspected again.

The first MCP boundary Run (`01a10052-99f1-772b-9d24-379129bc049b`) was **not counted
as passed**: the prompt did not specify the metadata evidence type precisely, and
the model returned a dataset string rather than a boolean and treated
`describeTool` strings as objects with a `.description` property, producing missing
descriptions in the first evidence object. Its remote calls succeeded, but its
requested evidence shape did not. After confirming that Run had finished, the
prompt was clarified to require booleans and awaited descriptions in one object;
the next boundary Run preserved envelopes correctly but issued the error lookup
and page-2 read together with `Promise.all`. It demonstrated sibling-call isolation,
not sequential recovery. A trace ordering assertion was then added and rejected
that Run (`01a10054-8c6e-73bc-95fd-79522ca8f095`) on inspection. These two diagnostic
attempts remain in `.gea/comparison/production-20261003/` and
`.gea/comparison/production-20261003-final/` respectively. The final boundary check
requires receiving the error before issuing the next read, and compares the real
child spans' start/end timestamps. Each additional test was deliberate and
read-only, after the prior Run had finished; no uncertain operation was replayed.
The code/direct report Runs were inspected again, never reposted.

Frozen dependency install, TypeScript, real local MCP transport test, native MCP
Worker build/validation, Agent validation/packaging and formatting checks passed.
The older warehouse evidence in [VERIFICATION.md](VERIFICATION.md) remains a
separate version-1 result; it is not relabeled as verification of this deployment.

Still untested here: authenticated/OAuth MCP, SSE subscriptions/session resumption,
network faults, timeouts, cancellation/revocation during remote calls, approval
flows, sustained concurrency, budget saturation and external write semantics.
This synthetic smoke test does not qualify the complete runtime for every
production workload. The demo service and synthetic sessions remain available.
