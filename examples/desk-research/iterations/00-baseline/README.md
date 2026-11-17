# Baseline：建立完整研究能力

Baseline 已具备 Exa 搜索、正文读取和 DO 存储。它提供一个完整起点，用于观察 Agent 能否在早餐研究中保留预算、场景与来源约束。

## 给 coding agent 的任务文本

```text
为 ProductResearch 增加保存和读取研究简报的能力。
保留 Exa 搜索、read_source 正文读取和事实/假设区分。
用 ResearchStore DO 保存范围、简报和来源，按可信 Session/Chat ID 隔离。
验证同一对话能读回、不同对话读不到。交付代码和校验结果。
固定题目、Judge、模型与执行预算；保留每次执行、评分和错误。
```

## 运行与结果

[source](source/) · [源码差异](changes.diff) · [运行条件](../REPRODUCING.md) · [逐项对照](../comparison.md)

按[默认命令](../../README.md#2-跑分)执行并评分。每轮相同四题与一道澄清题；其余题未覆盖。公开 CLI 首次四题全部执行错误，评分未产出逐题结果，见 [首次执行](published-execution-results.json)和[评分中断](published-attempt.json)。下述成绩来自三轮统一候选工具链的独立批次。

四道单轮自动通过 2/4，预算题和反例题的 inference 为 0；没有执行或评分错误。澄清题 conversation 与 coverage 均为 1，判分完成 14/14。

这些失分提示下一轮应先处理结论与证据的关系：不能把局部材料推广成总体判断，也不能把待验证推断写成事实。

人工另发现 `validation-plan` 的最终回答将来源深链接截成日期目录，自动 evidence=1 没有识别。原回答与分数保持不变，该问题仍未解决。

[单轮结果](results.json) · [多轮结果](multi-results.json) · [人工核对](review-notes.json)

分享版 Trace 已裁剪，自动评分和人工争议分别保留。这些结果不等于完整题集或业务验收通过。
