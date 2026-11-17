# 三轮真实结果对照

本表仅使用修复前统一候选工具链批次的首次执行和对应评分；发布版首次失败另外完整保留，R4 与旧四轮分数不混入。执行失败不计为 0 分，缺少有效成对评分不计提升。

| Case | Judge | 00 Baseline | 01 看结果 | 02 看 Trace |
| --- | --- | --- | --- | --- |
| breakfast-scope | scope | 1 | 1 | 1 |
| breakfast-scope | evidence | 1 | 0 | 1 |
| breakfast-scope | inference | 1 | 1 | 1 |
| budget-ceiling | scope | 1 | 1 | 1 |
| budget-ceiling | evidence | 1 | 1 | 1 |
| budget-ceiling | inference | 0 | 1 | 1 |
| counter-evidence | scope | 1 | 1 | 1 |
| counter-evidence | evidence | 1 | 1 | 1 |
| counter-evidence | inference | 0 | 1 | 1 |
| validation-plan | scope | 1 | 1 | 1 |
| validation-plan | evidence | 1 | 1 | 1 |
| validation-plan | inference | 1 | 1 | 1 |
| clarify-breakfast | conversation | 1 | 1 | 1 |
| clarify-breakfast | coverage | 1 | 1 | 1 |

## 解释与复核

改善与退化只按同 Case、同 Judge 的有效成对评分计算；原始自动分数与错误保留在各轮 results.json / multi-results.json。人工争议单独列入 review-notes.json。

相邻轮次自动分数上升 3 项、下降 1 项，缺少有效成对判分 0 项。这只是本次样本的分数变化，不能据此宣称整体质量稳定提升。

发布版首次单轮三轮各 4 题均执行错误，另存于各轮 published-execution-results.json；不与本表候选批次混合。

详细归因边界与 R4 问题归类见 [R4-FINDINGS.md](R4-FINDINGS.md)。

## 人工争议：不改写自动分数

- 00-baseline / validation-plan / evidence：`https://zqb.cyol.com/html/2011-09/06`。最终答案把2011年来源深链接截成目录，该URL未出现在本次捕获来源中。自动evidence=1保留；引用身份审计不同意该引用已核对无误。
- 01-result-focused / counter-evidence / evidence：`这是北京CBD样本，不代表全国通勤者`。上一句94.2%费用等数据在北京日报正文中明确转引《白领早餐报告》，不能因为报道地点在CBD就把报告样本改成CBD。自动evidence=1保留；这是来源样本归属争议。
- 02-trace-focused / budget-ceiling / evidence：`仅单品能压到8元以内`。北京日报同一来源的search_sources与read_source均返回6.6元完整套餐，反驳该绝对断言。三项自动1分保留；这是正文读到、链接正确却漏掉反例的实质质量问题。

这些争议阻止把自动高分当作业务验收通过；没有为了消除分歧修改Judge或重抽回答。

## 预算题修复后的单题补跑（独立记录）

02 现已加入套餐/单品与反例核对指令，只补跑 `budget-ceiling` 一次：scope=1、inference=1、evidence=error（`Model finish reason does not match its content`），整体 incomplete，非通过。新回答承认6.6元套餐满足预算，原排他断言未复现；但最终回答留下未渲染 sourceId、套餐B组成缩略且未逐一 read_source。详见 [补跑说明](02-trace-focused/README.md#2026-11-17-预算题定向修复与一次补跑) 与 [原始导出](02-trace-focused/budget-ceiling-follow-up-results.json)。

上方比较表仍是修复前首次批次；02 对应 `pre-fix-manifest.json`。不把新单题与旧题混算为修复后4/4。00 深链接截断、01 转引报告误称“北京CBD样本”两项争议本次仅披露，未改 Agent 或补跑，仍未解决。

## r2 最新单题结果

02预算题含r1累计3/3次真实尝试，均保留。第2次自动三项1分仍有 read_source=0 和错配链接，继续修 Agent；第3次新增搜索后读取策略与精简的保存输出，scope=1、evidence=1、inference=1，判分3/3，整体passed。同次运行 read_source=3，最终无未渲染 sourceId；北京6.6元套餐及2个大包与正文、完整链接对应。仍有未知组合价推断、个案泛化、地铁出口位置表述和保存后重排等人工争议，不作业务验收通过。见[三次尝试汇总](02-trace-focused/budget-ceiling-r2-summary.json)和[详细说明](02-trace-focused/README.md#r2完整判分与正文读取引用交付修复)。旧三轮比较表不被该单题替换，00/01两条争议仍只披露。
