# 02：先收敛证据，再写研究结论

## 01 暴露的问题

预算题的第一次修改没有消除引用错配。trajectory 里有 6 次搜索、4 次读取被折叠的工具输出，却没有 `read_source`；最终回答仍把一篇便利店测评链接换成 `xgupiao.com`，还出现不完整的 `https://` 链接。它也在保存前后输出了两篇相近简报。提示“注意核对”并未变成实际工作步骤。

## 单一假设与改动

大量宽泛搜索会扩大需要同时记住的证据集。改为先做最多三个针对性查询、选择少量关键来源并读正文，再围绕最多三个发现与两个假设写作，应降低来源混淆。证据明显不足时允许一次定向补充；没有新增工具或减少原有验收要求。

这轮只替换 instructions 的报告组织要求，保留 01 的事实核对要求。减少重复报告也是为了让这一小证据集只被组织一次。模型、Exa、工具、Cases/Judges 和预算不变。

## 已观察到的改善与剩余问题

预算题第一次取得 scope/evidence/inference 三项均为 1；这并不证明所有问题已解决。该题没有执行要求中的 `read_source`，说明 Agent 未完全遵循步骤；不能把“写了流程要求”当作“流程已执行”。

研究范围题仍把两个历史个案概括为“到岗后吃早餐已是常态”“核心矛盾在气味和时长管理”。即使后面承认样本有限，前面的总体判断仍过强。下一轮因此聚焦结论的适用范围，而不是再增加搜索能力。

下一轮：[03：限制推断并明确反证条件](../03-scoped-inference/README.md)。

## 本轮实际结果

Run：`886dcf61-7b70-479f-979d-995fbc36d0e2`；运行状态：`completed`。以下是首次结果，没有用重试覆盖。

| Case | scope | evidence | inference | 状态 | 检索 / 读原文 | 未匹配 URL / 提取 URL |
| --- | --- | --- | --- | --- | --- | --- |
| breakfast-scope | 1 | error | 0 | failed | 4 / 2 | 0 / 4 |
| budget-ceiling | 1 | 1 | 1 | passed | 3 / 0 | 0 / 3 |
| counter-evidence | 1 | 1 | error | incomplete | 2 / 0 | 0 / 2 |
| validation-plan | 1 | error | error | incomplete | 3 / 0 | 0 / 3 |

`error` / `—` 是错误或缺失，不能补成 0。空输出、部分输出或 0 个链接不能凭 URL 检查获得质量通过。URL 能在结果中找到，也不等于正文支持对应主张。

[逐题回答与 trajectory](results.json) · [Codex 复核与争议](review-notes.json) · [当前源码](source/instructions.ts) · [相邻版本的完整差异](changes.diff)

## 2026-11-16 修复

当前 `source/` 已同步预算核对、精确引用、短摘录保存和独立多轮覆盖检查。各题必达交互记录在metadata.coverage，与Agent回答质量分开。首次 `results.json` 与 `changes.diff` 对应 [原始清单](original-manifest.json)，不代表当前源码的验收结果；[当前清单](manifest.json) 记录修复后的哈希。教学与复验步骤见 [评测校准说明](../../evaluation/README.md)。完整验收结果另行保存，不覆盖首次失败。

## 同规则重评首次轨迹

[独立重评分](rescored-20261116.json)使用2026-11-16的新scope/evidence/inference规则，保留首次运行与评分。它检查旧回答，不是当前修复源码的执行验收。评分错误与旧执行失败均未补分；不能仅比较已完成项的平均分推导质量提升。

## 2026-11-16 R2独立验收

当前源码包含共同正确性修复；首次results和original-manifest保持不变。[新指令定向结果](r2-targeted-20261116.json)与[完整R2状态](../../VALIDATION.md)分别记录执行、质量和评分错误，不拼分。
