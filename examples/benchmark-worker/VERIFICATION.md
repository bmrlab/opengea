# Local verification — 2026-11-03

Source: gea `acfe1dc5` (includes #1109), isolated `git archive` build. No production requests or model calls.

| Check | Result |
| --- | --- |
| Frozen source dependency install | Passed, pnpm 12.8.1 / Node 24.16.0 |
| SDK + Contract build and pack | Passed; tarballs installed through scratch-only overrides |
| Source CLI darwin-arm64 build and help | Passed |
| Native Worker Runtime build | Passed |
| Installed-consumer TypeScript | Passed |
| Unit tests | 4 passed: metrics, retrieval, failed execution accounting, report escaping |
| Benchmark bundle + snapshot + upload plan | Passed, no upload |
| Generic CLI artifact builder | Passed, worker/snapshot files and DO/IDENTITY manifest validated |
| Source CLI `worker validate` end-to-end | Blocked: standalone CLI has no App Server toolchain |
| Native local execution | Both algorithms, 12 completed Cases each |
| Judge / rejudge | 13 judgments per full run; 3 for each two-Case subset; saved Bench evidence unchanged |
| Idempotency / pagination | Repeated submission retained same ID; pages of 2 retrieved all evidence |
| Restart persistence | 24 saved executions byte-for-structure equal after native host restart |
| Exported visualization | HTML report generated; escaping tested; browser visual inspection unavailable in this session |
| Hosted custom visualization | Unsupported by current GEA contract; not verified |

| Algorithm | Recall@3 | MRR@3 | nDCG@3 | Failed |
| --- | ---: | ---: | ---: | ---: |
| overlap | 1 | 1 | 1 | 0/12 |
| bm25 | 0.9722222222 | 1 | 0.9804467197 | 0/12 |

The public SDK with the source package's same version lacks the Worker exports. Public install succeeds, but source tarballs are required for the compatible type contract. No fabricated public release version is claimed.

The source README's `cursor=0` example omits result ordinal zero. This example omits the first cursor and follows `nextCursor` instead. No upstream code was changed.

Full logs, JSON results and generated HTML are retained in the task's `evidence/` directory, outside this repository. Local state (including invocation token and DO files) is excluded from evidence and Git.
