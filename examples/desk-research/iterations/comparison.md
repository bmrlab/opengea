# 三轮真实结果对照

本表仅使用三轮统一工具链批次的首次执行和对应评分（工具链见[运行条件](REPRODUCING.md#工具链与批次)），不同运行条件的分数不混入。执行失败不计为 0 分，缺少有效成对评分不计提升。

| Case | Judge | Baseline | 第一次迭代（专注结果） | 第二次迭代（专注 Trace） |
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

## 人工争议：不改写自动分数

- 00-baseline / validation-plan / evidence：`https://zqb.cyol.com/html/2011-09/06`。最终答案把2011年来源深链接截成目录，该URL未出现在本次捕获来源中。自动evidence=1保留；引用身份审计不同意该引用已核对无误。
- 01-result-focused / counter-evidence / evidence：`这是北京CBD样本，不代表全国通勤者`。上一句94.2%费用等数据在北京日报正文中明确转引《白领早餐报告》，不能因为报道地点在CBD就把报告样本改成CBD。自动evidence=1保留；这是来源样本归属争议。
- 02-trace-focused / budget-ceiling / evidence：`仅单品能压到8元以内`。北京日报同一来源的search_sources与read_source均返回6.6元完整套餐，反驳该绝对断言。三项自动1分保留；这是正文读到、链接正确却漏掉反例的实质质量问题。

这些争议阻止把自动高分当作业务验收通过；没有为了消除分歧修改Judge或重抽回答。

## 预算题后续尝试

三次后续尝试独立记录，分别为评分不完整、自动通过但仍有错链、自动通过且成功读取三次正文；不替换上方首批分数。详见[全部尝试与残余争议](02-trace-focused/README.md#预算题后续尝试)及[机器汇总](02-trace-focused/budget-ceiling-summary.json)。当前源码的离线检查没有新增模型分数。
