# 00：能够研究，但尚未建立严格的证据纪律

这份 baseline 一开始就使用 Exa，具备搜索、读网页、研究记录读写和完整工作台。基本 instructions 已要求来源、事实与假设区分、约束保留和后续验证；没有故意删除能力来制造失败。

首次使用固定的 4 题开发集。首次代码与Benchmark摘要见 original-manifest；模型、运行预算和运行器见 [protocol](../protocol.json)。执行 Run：`b39e1ec1-5b56-4f63-b553-5ddde880a7fe`。

## 从回答回到 trajectory

`budget-ceiling` 的回答看起来很完整，有价格表、来源和验证建议。但检查实际搜索结果后发现：便利店测评来源被换成另一个域名，部分深层链接被写成首页；午餐福利的信息也被扩展为“早餐福利空白”。因此“有来源链接”和“有一段局限性说明”不足以证明研究可靠。

`breakfast-scope` 也把较旧的局部资料放进全国上班族的机会分析，并出现“品类空白”等强表述。这提供了第一轮要检验的问题：结论是否真正受本次证据约束。

首次内置 Judge 出现提交格式错误。Judge 的分析文字可供复核，但非法提交没有有效分数；原始错误保留，不能把它补成 0 或 1。执行和自动评分分别报告。

下一轮见 [01：关键事实与来源对应](../01-grounded-claims/README.md)。

## 本轮实际结果

Run：`b39e1ec1-5b56-4f63-b553-5ddde880a7fe`；运行状态：`completed`。以下是首次结果，没有用重试覆盖。

| Case | scope | evidence | inference | 状态 | 检索 / 读原文 | 未匹配 URL / 提取 URL |
| --- | --- | --- | --- | --- | --- | --- |
| breakfast-scope | error | error | error | incomplete | 11 / 2 | 2 / 9 |
| budget-ceiling | error | error | error | incomplete | 7 / 0 | 3 / 4 |
| counter-evidence | error | 1 | 0 | failed | 4 / 0 | 1 / 6 |
| validation-plan | error | error | 0 | failed | 4 / 0 | 0 / 5 |

`error` / `—` 是错误或缺失，不能补成 0。空输出、部分输出或 0 个链接不能凭 URL 检查获得质量通过。URL 能在结果中找到，也不等于正文支持对应主张。

[逐题回答与 trajectory](results.json) · [Codex 复核与争议](review-notes.json) · [当前源码](source/instructions.ts)

## 2026-11-16 修复

当前 `source/` 已同步预算核对、精确引用、短摘录保存和独立多轮覆盖检查。各题必达交互记录在metadata.coverage，与Agent回答质量分开。首次 `results.json` 与 `changes.diff` 对应 [原始清单](original-manifest.json)，不代表当前源码的验收结果；[当前清单](manifest.json) 记录修复后的哈希。教学与复验步骤见 [评测校准说明](../../evaluation/README.md)。完整验收结果另行保存，不覆盖首次失败。

## 同规则重评首次轨迹

[独立重评分](rescored-20261116.json)使用2026-11-16的新scope/evidence/inference规则，保留首次运行与评分。它检查旧回答，不是当前修复源码的执行验收。评分错误与旧执行失败均未补分；不能仅比较已完成项的平均分推导质量提升。

## 2026-11-16 R2独立验收

当前源码包含共同正确性修复；首次results和original-manifest保持不变。[新指令定向结果](r2-targeted-20261116.json)与[完整R2状态](../../VALIDATION.md)分别记录执行、质量和评分错误，不拼分。
