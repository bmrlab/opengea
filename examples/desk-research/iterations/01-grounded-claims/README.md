# 01：让关键事实与原始来源一一对应

## 改动来自哪里

00 的 `budget-ceiling` 已完成执行。轨迹里，搜索实际返回的便利店测评是 `yuejiaxmz.com/news/view/446047`，报告却引用了 `tbv.cn`；青浦的具体报道也被缩成政府网站首页。报告还把午餐福利资料扩展成“早餐基本自费、无补贴”的结论。这些不是多接一个工具能解决的问题。

首次内置 evidence Judge 的判定文字也指出引用域名错配，但提交参数缺少合法的 status，所以该次结果是 Judge error，不能当作自动 0 分。改动依据是已经完成的回答和实际检索轨迹的逐项复核，不是替 Judge 修补分数。01 启动时 00 的其余题目和评分仍在运行；完整开发集仍全部保留，不挑题。

## 单一假设

如果写作前核对三个关键事实的正文依据、来源 URL 和适用范围，Agent 应减少“事实可能来自真实资料，但链接或结论范围被自己改写”的错误。

只给 instructions 增加一段事实核对要求：直接复制实际来源链接；保留时间、地点、人群限制；无依据的数字或市场判断删除或降为假设。没有新增 Tool，没有更换模型，没有放宽 Judge，也没有给 Agent 标准答案。

`instructions.ts` 与无 DO 阶段的同名文件同步修改；完整项目实际使用前者。相邻 manifest 的 Benchmark 摘要相同。

## 如何判断是否改善

逐题检查原来错配的链接是否消失、主要事实是否能对应到本次返回正文，以及历史/局部材料有没有再次被写成当前普遍结论。同时保留 8 元预算、反向证据和可推翻的验证计划等原有要求，避免为了谨慎只输出“证据不足”。

实时搜索可能返回不同资料，因此不能要求新旧报告引用同一个页面。比较的是相同规则下的行为，并查看实际证据。

## 本轮实际结果

Run：`424119d3-9ee8-48de-bb94-13f2a16ebb80`；运行状态：`failed`。以下是首次结果，没有用重试覆盖。

| Case | scope | evidence | inference | 状态 | 检索 / 读原文 | 未匹配 URL / 提取 URL |
| --- | --- | --- | --- | --- | --- | --- |
| breakfast-scope | — | — | — | execution_error | 12 / 0 | 0 / 0 |
| budget-ceiling | error | 1 | error | incomplete | 6 / 0 | 1 / 7 |
| counter-evidence | error | 1 | error | incomplete | 7 / 0 | 0 / 6 |
| validation-plan | — | — | — | execution_error | 7 / 0 | 0 / 0 |

`error` / `—` 是错误或缺失，不能补成 0。空输出、部分输出或 0 个链接不能凭 URL 检查获得质量通过。URL 能在结果中找到，也不等于正文支持对应主张。

[逐题回答与 trajectory](results.json) · [Codex 复核与争议](review-notes.json) · [当前源码](source/instructions.ts) · [相邻版本的完整差异](changes.diff)

## 2026-11-16 修复

当前 `source/` 已同步预算核对、精确引用、短摘录保存和独立多轮覆盖检查。各题必达交互记录在metadata.coverage，与Agent回答质量分开。首次 `results.json` 与 `changes.diff` 对应 [原始清单](original-manifest.json)，不代表当前源码的验收结果；[当前清单](manifest.json) 记录修复后的哈希。教学与复验步骤见 [评测校准说明](../../evaluation/README.md)。完整验收结果另行保存，不覆盖首次失败。

## 同规则重评首次轨迹

[独立重评分](rescored-20261116.json)使用2026-11-16的新scope/evidence/inference规则，保留首次运行与评分。它检查旧回答，不是当前修复源码的执行验收。评分错误与旧执行失败均未补分；不能仅比较已完成项的平均分推导质量提升。

## 2026-11-16 R2独立验收

当前源码包含共同正确性修复；首次results和original-manifest保持不变。[新指令定向结果](r2-targeted-20261116.json)与[完整R2状态](../../VALIDATION.md)分别记录执行、质量和评分错误，不拼分。
