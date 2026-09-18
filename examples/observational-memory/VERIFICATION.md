# SDK / CLI acceptance, 2026-09-20

## SDK 0.1.260920-alpha.3, 2026-09-20

- Public SDK alpha.3: types and six tests passed. Validation/pack passed using the alpha.1 macOS CI native artifact. Registry installation/integrity is recorded separately in the root acceptance record.
- Final public SDK alpha.3 / CLI alpha.1 frozen install, type check and six tests passed. Both native platforms are retained in the lockfile; obsolete release-age exceptions were removed.
- Full real-model experiment `.gea/verification/2026-09-20T12-17-54.979Z-0f241466/report.json` completed. Raw and summary scored 15/15; observational-memory scored **14/15**, returning `signed DPA` instead of `DPA`. Strict scoring remains unchanged and the verifier exited nonzero. Restart, isolation, observation/reflection and complete usage checks passed. Final main-model inputs were 25,987 / 2,836 / 1,665 tokens; this single fixture is not a general recall/cost claim.
- That experiment started while the installed launcher was still alpha.0, with `GEA_CLI_BIN` and distribution root explicitly selecting the alpha.1 CI native artifact. Its report preserves that launcher metadata and executable path. The native artifact was subsequently verified identical to the published alpha.1 macOS package; final frozen installation uses alpha.1 throughout.
- Preview v8 is ready: deployment `01a0bebf-cb99-729a-ab78-72c24bbe8ad7`, content `sha256:f566c2d84e7b4ec7f857af06e4923e6fae4e9f1f17db6c1f5b11cc07b7b478b3`. No full hosted three-strategy experiment or Production promotion is claimed.

## SDK 0.1.260920-alpha.2, 2026-09-20

- Public SDK `0.1.260920-alpha.2`, CLI `0.1.260920-alpha.0`: frozen installation, types, six tests, validation/pack passed.
- Full three-strategy real-model run completed under `.gea/verification/2026-09-20T06-08-47.533Z-346dbcfa/report.json`. Raw and summary scored 15/15; observational-memory scored **13/15**, returning `Project Orchid` instead of `Orchid` and `signed DPA` instead of `DPA`. Exact-value scoring was not relaxed; acceptance exited nonzero.
- Restart persistence, fresh-session isolation, observation/reflection execution and complete usage accounting passed. Final main-model input was 25,987 / 7,674 / 1,866 tokens for raw / summary / observational-memory (92.8% less than raw in this fixture). This single synthetic run does not establish general recall quality or a systematic regression from the earlier 14/15.
- Existing Preview Worker v7 is ready: deployment `01a0bd70-dbdc-70c5-8be2-ed5917acff21`, content `sha256:44e9d0afab7cc3feb594711f92b561fe310dd26f2d329affe7453224faf81494`. No Production promotion.

- Published SDK and CLI `0.1.260920-alpha.0`; install, type checking, six tests, validation and packaging passed.
- Updated the real-model verifier to use UUID Session IDs required by the current contract. The previous timestamp/mode string produced HTTP 502 `Invalid UUID` before model execution.
- Native Runtime report `2026-09-20T00-59-07.151Z-a051549d` completed all three strategies with real model calls and restarts. Raw and summary recall scored 15/15. Observational memory scored 14/15 because `blocker` returned `signed DPA` while the strict atomic-document answer is `DPA`; scoring was not relaxed.
- Observational-memory acceptance passed exact restart restoration, fresh-session isolation, actual observation/reflection, complete usage and context reduction (93.35% final main input reduction in this synthetic run). Overall acceptance remains failed because recall was not 15/15. This does not establish general memory quality or cost savings.
- Existing Worker Preview v6 is ready: deployment `01a0bc52-ff73-77e3-a068-2cb4f6354c1b`. No full hosted three-strategy replay or Production promotion is claimed.
