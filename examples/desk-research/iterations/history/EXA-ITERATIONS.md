# 从 Exa baseline 开始改进研究质量

2026-11-16 R2续修已使用下面的历史失败和完整题库定位问题，因此这些Case不再是本轮的盲测/独立保留集。首次结果、原始manifest及当时的比较仍保留；当前共享修复与新真实结果以[最新验收记录](../../VALIDATION.md)为准，不能将两个时期的分数混为同一次实验。


这条主线从一个已经能用 Exa 检索、读取网页和保存研究记录的 Agent 开始。每轮先读 Case 的回答与 trajectory，找出一个具体问题，再改 Agent，重跑同一组题。功能接入不计作研究质量提升。


## 版本

- [00：Exa baseline](00-exa-baseline/README.md)。
- [01：关键事实与来源对应](01-grounded-claims/README.md)。
- [02：收敛证据工作集](02-focused-evidence/README.md)。
- [03：限制推断范围](03-scoped-inference/README.md)。

环境和 Judge 故障详见 [预检记录](../PREFLIGHT.md)。

## 固定比较条件

[protocol.json](exa-protocol-20261115.json) 固定模型、运行预算、题目和运行器。开发集是 4 题：研究范围、8 元预算、反向证据、验证计划。它们代表四种决策风险，而不是四个措辞不同的同一问题。其余 8 个单轮题和 6 个多轮题用于检查改动的迁移与退化。

每题的 scope、evidence、inference 都是独立的 0/1 必过项。只有三项完成且均为 1 才算该题通过；执行失败、Judge 错误和缺少评分单独统计。具体评分设计见 [Benchmark 说明](../../BENCHMARKS.md)。不能用平均分掩盖证据失败。

比较时保持 Cases、Judges、Exa Connector、工具实现和运行参数不变。修改评分标准时，先在同一保存轨迹上统一重评；要比较新Agent行为时，再按同一配置重新执行旧Agent与候选。不能把换了标准后的分数称为提升。Exa 搜索结果和模型别名可能漂移，因此报告同时保留实际查询、来源信息和原始产物摘要，单次差异不代表统计显著提升。

## 首次结果对照

| 版本 | 完整自动通过 | 已知质量失败 | 评分不完整 | 执行错误 | 合法判分 / 应有判分 |
| --- | ---: | ---: | ---: | ---: | ---: |
| [00](00-exa-baseline/README.md) | 0 | 2 | 2 | 0 | 3/12 |
| [01](01-grounded-claims/README.md) | 0 | 0 | 2 | 2 | 2/12 |
| [02](02-focused-evidence/README.md) | 1 | 1 | 2 | 0 | 8/12 |
| [03](03-scoped-inference/README.md) | 1 | 0 | 2 | 1 | 6/12 |

每行是同样 4 题。已知质量失败的题可能同时有缺失评分；每轮详情页列出全部判分。这里的自动通过不替代复核：03 预算题自动三项通过，却把 8.5 元组合写进“8 元以内案例”，Codex 复核明确保留这个问题。分数未完整且存在 Judge 漏判，不能据此宣称整体通过率稳定提高。

能确认的具体变化：00 的预算题 4 个引用中有 3 个未匹配实际来源；02 变为 3 个引用全部匹配，并取得首次三项有效通过。02 的 4 份完整报告合计 12 个引用均匹配，00 为 24 个引用中 6 个未匹配。03 的研究范围题从“个案推出常态”改为逐项限定样本，inference 从 02 的 0 变为 1。但 03 验证计划题在 240 秒预算内没有正常结束，多轮引用追问也发生同类超时；不能把这轮称为全面优于 02。

这组材料适合演示“读结果与轨迹 → 提出一个假设 → 小改动 → 同题复跑 → 检查回归与裁判”。它还不是一套全部通过的发布验收结果。

## 03 的独立回归

没有用以下四题修改 00–03 instructions，且只运行 03，不能声称它们相对 baseline 有提升。

| Case | 首次自动结果 | 复核边界 |
| --- | --- | --- |
| audience-transfer | evidence=1、inference=1、scope=error | 评分不完整 |
| freshness-limits | scope=1、inference=1、evidence=error | 评分不完整 |
| challenge-citation | 执行超时 | 已发生引用追问，不能将部分回答算通过 |
| retain-constraints | conversation=1 | 只发生一次追问，要求的第二次排序追问未发生；完整场景未覆盖 |

[单轮回归回答和轨迹](03-scoped-inference/regression-single.json) · [多轮对话和轨迹](03-scoped-inference/regression-multi.json)。完整题库共 18 题，首次仅执行 4 个开发题 + 4 个独立回归题；后续完整验收单独记录，不覆盖首次结果。多轮的 `simulator_done` 只表示 Simulator 结束，不能替代目标追问覆盖检查。

## 阅读一轮迭代

- 先看 README 中上一轮的失败证据，以及这轮要验证的假设。
- 查看首次的 `changes.diff` 理解该轮假设；当前 `source/` 已包含共同修复，不把它与首次结果混用。
- 对照 `results.json` 的逐题分数、Judge 理由、回答和 trajectory。
- 阅读 Codex 逐项复核，区分自动判分、研究质量问题和执行环境问题。
- 看未改善项和回归结果，再决定下一轮是否值得做。

`source/` 是当前可运行的完整项目，`manifest.json` 提供逐文件哈希与 Benchmark 摘要。2026-11-16 同步了公共正确性与评分修订；首次结果对应各轮 `original-manifest.json`，不能拿旧分数评价已修复源码。分享结果中的工具输出仅保留检索查询和来源元信息；完整正文和原始轨迹留在本地。这里的 Codex 逐项复核是本地记录，不冒充 Builder Annotation。

## 复现与新增迭代

在某轮 `source/` 中安装锁定依赖，登录 GEA，并配置 `research-search` 的本机 Connection。密钥不属于快照或报告。然后用相同的选题和预算运行：

```bash
gea agent eval --json '{"benchmarkPath":"benchmarks/single-turn","caseIds":["breakfast-scope","budget-ceiling","counter-evidence","validation-plan"],"modelSource":"hosted","judgeModel":"gea-pro","concurrency":2,"overrides":{"engine":{"maxSteps":16,"timeout":{"totalMs":240000}}}}'
```

首次运行采用 Node + jiti 启动未修改的 GEA CLI 源码，搭配已发布的原生运行时，详见 protocol。原因是本机发布版 Bun CLI 的 Exa POST 路径超时，而 Node 路径能取得真实结果。因此这里不声称上述发布版 CLI 命令已通过本机端到端验收。运行器必须在各轮保持一致；不要悄悄切换后继续比较。

在示例根目录记录下一轮源码，并导出经过逐项检查的分享结果：

```bash
node scripts/snapshot-iteration.mjs create 04-next-hypothesis
node scripts/snapshot-iteration.mjs verify 04-next-hypothesis
node iterations/analyze-eval.mjs /path/to/eval-result iterations/04-next-hypothesis/results.json
```

导出工具拒绝覆盖旧文件。再次执行或重评分使用新文件名，并写明与原始 Run 的关系。调整后的报告不能替代首次结果。

## 编写与使用 Benchmark

按 [校准与验收步骤](../../evaluation/README.md) 编写可观察的 Case 验收条件、用独立正反例检验 Judge，再执行完整题库。00–03 的当前源码统一使用修复后的评分规则；原始版本比较和修复后验收分开记录。
