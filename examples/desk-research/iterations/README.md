# 三轮质量迭代：建题 → 跑分 → 定位失分 → 改 Agent → 再跑分

| 轮次 | 定位依据 | 改动 |
| --- | --- | --- |
| [00-baseline](00-baseline/README.md) | 原始能力与首次执行 | 搜索、读正文、DO 记录 |
| [01-result-focused](01-result-focused/README.md) | 最终回答 + Judge 理由 | 仅 instructions：事实对来源、限制结论主语 |
| [02-trace-focused](02-trace-focused/README.md) | 工具调用与引用来源 | 小证据集、逐一读正文、sourceId / passageId 与工具生成链接 |

## 本次真实重跑

| 轮次 | 单轮自动通过 / 4 | 单轮质量失分 | clarify-breakfast | 判分完成 | 人工争议 |
| --- | ---: | ---: | --- | ---: | ---: |
| Baseline | 2 | 2 | conversation=1，coverage=1 | 14/14 | 1 |
| 看结果 | 3 | 1 | conversation=1，coverage=1 | 14/14 | 1 |
| 看 Trace | 4 | 0 | conversation=1，coverage=1 | 14/14 | 1 |

这是修复前同一候选条件下的首次结果；发布版首次 12 题执行错误及评分中断另存。自动分数不替代人工复核：第 2 轮预算题读到了 6.6 元套餐，却写“仅单品能压到8元以内”，三项 Judge 仍给 1。不能据此宣称整体质量提升或业务验收通过。[逐项对照](comparison.md) · [机器汇总](run-summary.json)。

## 1. 建题

[8 元预算题](../BENCHMARKS.md#1-建题从业务风险到-casejson)展示从业务风险到 input、metadata.acceptance、judgeRules 与三份 Judge。三轮使用同一份当前 main 的 Cases / Judges，不改变题目求通过。

## 运行器和批次边界

先前使用发布版 CLI/SDK 的三个四题批次均执行失败，随后评分未产出逐题结果，已中断并保留各轮 `published-execution-results.json` / `published-attempt.json`。收到 R4 交接后，三轮完整改用同一 [候选工具链](runtime-candidate.json)、显式 CR Catalog（总输出 4096 / 思考 1024）与本地 SDK/contract；这是新的运行条件批次，不是 Agent 提升。没有从两批挑选分数。

当前 results.json / multi-results.json 对应候选批次。源码从当时的 manifest 原样复制进独立本地执行项目（02 首批对应 `pre-fix-manifest.json`，当前 `manifest.json` 对应预算题修复后的源码）；包声明与锁文件仍保留公开版本，实际 SDK 构件以 runtime-candidate.json 的 SHA 和内容哈希为准。普通 npm 安装不能证明复现该候选结果，不能宣称正式发布版端到端通过。Judge 仍固定到 opengea main 4f4f51c，R4 未推的 inference 规则没有引入。

## 2. 跑分

在各轮 `source/` 安装锁定依赖，注入 CR 和 Exa 凭据，执行 [默认四题命令](../README.md#2-跑分)；另跑同一 `clarify-breakfast` 多轮题。每次首次执行与评分均保留，不补分、不挑重跑结果。其余 8 个单轮与 5 个多轮题不在此次比较覆盖内，不能宣称完整验收。

## 3. 定位失分

先看回答与 Judge 理由，再看 Trace。历史上的错链、个案升级为“核心顾虑”、只搜不读只是改动的历史依据，不预设新运行必然复现。若新运行没有出现，应如实报告；环境或 Judge 失败也不能编成 Agent 的质量结论。详细分流与本次预算题的“原句 → 工具正文 → 人工争议”例子见 [evaluation](../evaluation/README.md#3-定位失分)。另见 [实际工具调用观察](trace-observations.json)。

## 4. 改 Agent

每轮 README 含可直接复制的 coding agent 任务。先写失败证据、假设、允许改动和不能改的条件，再交付 diff 与验证记录。第 1 轮只修改两个 instructions 文件；第 2 轮保留这些要求，再改变过程和引用工具。结构化 observations / subject / fit / constraint 的推断规则继续留在根目录，不进入三轮。

`changes.diff` 是相邻轮次的源码差异；Baseline 的 diff 是原始版本叠加统一评测条件的差异。`provenance.json` 记录来源，`manifest.json` 提供逐文件哈希。

## 5. 再跑分

[comparison.json](comparison.json) 与 [comparison.md](comparison.md) 按 Case × Judge 对齐三轮，保留改善、退化、未完成和人工争议。有效 0 分、执行错误、Judge 错误、缺少评分分别记录；没有有效成对判分就不能算提升。

[protocol.json](protocol.json) **记录**比较条件，靠约定执行，执行器不读取它。三轮保持 Cases、Judges、模型、预算与运行器一致；第 2 轮明确改变过程与引用工具。换 Judge 就三轮统一重评，不能将评测修复算作 Agent 提升。Exa 是实时搜索，模型别名也可能漂移；一次差异不证明统计意义上的提升。

```bash
node scripts/snapshot-iteration.mjs verify 00-baseline
node scripts/snapshot-iteration.mjs verify 01-result-focused
node scripts/snapshot-iteration.mjs verify 02-trace-focused
```

在示例根目录执行。快照验证只证明本轮源码未变，忽略生成的 node_modules / .gea / dist，不保证实验条件自动一致或结果正确。分享版 Trace 是裁剪导出，完整原始证据保留本地；裁剪中看不到正文不能推定原始 Run 没有正文。

## R4 停工交接

[R4 问题归类](R4-FINDINGS.md)把预算泛化、行为推偏好、设备条件和矛盾前提放入第 1 轮结果复核；把保存后重写、引用身份与运行步骤放入第 2 轮 Trace 复核。协议、Judge 与运行预算变更单独列出，不计作 Agent 提升，不移用其分数。

## 历史与继续改进

旧 00–03 原文件原样迁入 [history](history/README.md)。旧分数不迁入新三轮。根目录的结构化观察、细化推断与追问处理是三轮之后的继续改进；[versions](../versions/README.md) 只讲功能扩展。

## 预算题修复后的单题补跑（独立记录）

02 现已加入套餐/单品与反例核对指令，只补跑 `budget-ceiling` 一次：scope=1、inference=1、evidence=error（`Model finish reason does not match its content`），整体 incomplete，非通过。新回答承认6.6元套餐满足预算，原排他断言未复现；但最终回答留下未渲染 sourceId、套餐B组成缩略且未逐一 read_source。详见 [补跑说明](02-trace-focused/README.md#2026-11-17-预算题定向修复与一次补跑) 与 [原始导出](02-trace-focused/budget-ceiling-follow-up-results.json)。

上方比较表仍是修复前首次批次；02 对应 `pre-fix-manifest.json`。不把新单题与旧题混算为修复后4/4。00 深链接截断、01 转引报告误称“北京CBD样本”两项争议本次仅披露，未改 Agent 或补跑，仍未解决。
