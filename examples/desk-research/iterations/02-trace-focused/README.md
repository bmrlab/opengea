# 第二次迭代：看 Trace

相对 01 改过程与引用工具。原始版本保留搜索上限 5 页 / 6000 字符预览；r2 最后一次修复将模型可见搜索输出改为来源索引，通过工具策略在每次搜索后要求 read_source。2000 字符正文窗口与 passageId 来自现有工具，未引入结构化观察。

## 给 coding agent 的任务文本

```text
先检查新 01 的工具调用与引用来源，记录搜索次数、read_source 次数和错链。
若新 Trace 没复现历史问题，如实写，不伪造“只搜不读”的转折。
保留第 1 轮输出要求；加入旧 02 的小证据集、逐一 read_source、只交一份简报。
从 9df3b5a / 626db4a 拆出确切来源身份、sourceId、[[sourceId]] 引用、
保存时拒绝手写 URL，以及 passageId 正文片段与读取窗口的相关实现。
不加入结构化 observations / subject / fit / constraint 规则。
验证确切链接生成、未知/跨会话 ID 拒绝、手写 URL 不写入、原文片段身份。
按同条件重跑；失败、Judge 错误与未完成保留，不能改变题目或补分。
共同边界：Cases/Judges 固定到 protocol 记录的 main；Agent、Simulator、Judge
都用 creative-reasoning-1.5 / local；Agent 16 步/240 秒、Judge 12 步/300 秒。
只使用授权凭据且不写进仓库。每次执行和评分都保留，不重抽、不挑绿、不手工补分。
```

## R4 交接补充

Trace 复核还要检查：保存后是否重写、引用是否由工具生成、缺口来源是否被错误限制、等待发生在搜索还是模型阶段。这是仍需验证的问题清单，不能当作修复通过。对应历史证据、适用边界及不计作提升的运行问题见 [R4 归类](../R4-FINDINGS.md)。

## 源码和比较条件

[source](source/) · [manifest](manifest.json) · [来源记录](provenance.json) · [改动](changes.diff) · [统一比较条件](../protocol.json)

进入 source 安装锁定依赖，按 [默认命令](../../README.md#2-跑分)运行和评分。快照校验只保证源码内容，执行器不读取 protocol。

## 发布版首次失败

[首次四题执行](published-execution-results.json)全部执行错误；[评分中断记录](published-attempt.json)保留未产出逐题评分的原始身份和状态。收到 R4 工具链交接后，三轮完整换成同一候选运行条件重新执行；不选取部分成功样本，不与首次或 R4 分数拼接。

## 修复前候选工具链真实结果

以下结果绑定 [修复前 manifest](pre-fix-manifest.json)，不代表当前源码已重跑四题。四道单轮自动通过 4/4，质量失分 0，执行/评分错误 0；clarify-breakfast 的 conversation 与 coverage 均为 1。必跑判分 14/14 已完成。保留 1 条人工争议，不将自动通过等同于业务验收。

[单轮首次结果](results.json) · [多轮首次结果](multi-results.json) · [逐项复核](review-notes.json) · [Case × Judge 对照](../comparison.md)

完整原始 Run 与 Trace 保留本地，公开 results 是裁剪后的分享版。执行失败、评分错误、有效 0 分和多轮未覆盖分别保留；不将历史分数挪来使用。该轮不代表全部 18 题验收。

## 2026-11-17 预算题定向修复与一次补跑

仅修改 02 的两份 instructions，要求核对单品/套餐、价格与购买条件，并在排他结论前查找已捕获的反例；未写死价格或答案，未修改 Cases / Judges、工具实现或执行预算。

原四题结果及争议保持原样，绑定 [修复前 manifest](pre-fix-manifest.json)；本段 r1 的源码绑定 [r1 manifest](r1-manifest.json)，当前 [manifest](manifest.json) 为后续 r2。仅 `budget-ceiling` 在相同 CR / Exa / 候选工具链下新执行一次，没有重跑其余题目或拼出新的 4/4。

| Case | scope | evidence | inference | 整体 |
| --- | --- | --- | --- | --- |
| budget-ceiling（修复后） | 1 | error | 1 | incomplete |

evidence Judge 的原始错误是 `Model finish reason does not match its content`，每项 Judge 都只有一次 attempt；不重评、不补分。Agent 正常执行，Run 与 evaluation 均 completed，但判分仅完成 2/3，不能记作自动通过。执行批次 `205f72a6-faaa-4ea8-9d3d-c5a716b869e7`，target Run `3f79488d-6621-4bff-b6d3-f870c2429074`，evaluation `fd81f54f-b5b4-4fa7-a307-347c994ed91c`。

人工核对：本次搜索再次返回同一 `p_23a96e7dada5cfa7` 的 6.6 元套餐正文；回答明确列出套餐并承认其满足预算，原“仅单品能压到8元以内”错误未复现。仍有残余问题：最终回答未交付保存工具已渲染的链接报告，而带 `[[sourceId]]`；套餐B组成有缩略；`read_source=0`（搜索已带正文），过程要求未完全遵守。原自动分数、补跑错误和人工判断分开保留，不能宣称业务质量验收或稳定修复通过。

[真实补跑结果](budget-ceiling-follow-up-results.json) · [条件、原生证据哈希与人工复核](budget-ceiling-follow-up.json)

## r2：完整判分与正文读取、引用交付修复

含 r1 共使用 **3/3 次真实尝试**（每次为一次目标执行及对应 Judge 批次），已停止请求。每项 Judge 每批次只有一次 attempt，未更换题目、Judge、模型、执行预算或手工分数。所有中间结果保留，不挑选绿灯。

| 尝试 | 源码 | scope | evidence | inference | 原生结果 | read_source | 最终占位符 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1（r1） | r1-manifest.json | 1 | error | 1 | incomplete | 0 | 有 |
| 2（r2 指令修复） | r2-attempt-2-manifest.json | 1 | 1 | 1 | passed | 0 | 无 |
| 3（r2 流程修复） | manifest.json | 1 | 1 | 1 | passed | 3 | 无 |

第2次虽取得完整判分，但北京套餐段落错配上海来源，且仍未调用 read_source，所以没有按自动1分宣布目标完成。第3次继续修 Agent：搜索只向模型返回来源索引，新增工具调用顺序策略，在搜索后要求 read_source；读取后才可自行决定继续研究或保存。保存工具返回已渲染 report 与 status，避免同时携带冗余来源列表；两份指令区分输入占位符和输出完整链接，并核对套餐中各项数量。策略接入根 Agent 与 v1/v3 生成入口，不改 Cases/Judges 或发布包。

第3次原生证据确认：3次正文读取成功，最终无未渲染 sourceId。原北京日报片段 p_23a96e7dada5cfa7 再次被 read_source 返回；回答承认6.6元完整套餐，套餐B写明2个大包，且与北京日报完整链接对应。判分完成 3/3，错误 0。这次是对目标项的核验，不代表整体业务质量验收。

仍需保留的人工争议：最终报告被重排而非逐字交付，另有保存过程文字；3元粥加主食的总价未知却被推成接近或超8元；6–12元面包区间不能证明“多数超8元”；便利店选择主因存在个案泛化；成都麦当劳6.6元标牌位于地铁站出口处，报告“站内”表述不够精确。自动分数不覆盖这些问题，也不因此被手工改写。北京6.6元两款套餐与“仅单品”这项原错误已在本次对应正文、数量和链接核对中消失。

批次 `54496343-c788-4aa0-aa47-1b0c3d301053`，target Run `004c8c67-e3cc-4ac9-b327-b0443af1e475`，evaluation `897f6103-32ee-4538-a182-720eb0882da3`。本次增量：最终源码类型检查、16/16测试（含搜索后读取策略）、manifest、执行源码与编译Case/Judge hash核对。尝试2的类型检查和15项测试单独保留。未整轮重测其他题目。

[三次尝试汇总](budget-ceiling-r2-summary.json) · [第2次真实结果](budget-ceiling-r2-attempt-2-results.json) · [第2次条件及争议](budget-ceiling-r2-attempt-2.json) · [第3次真实结果](budget-ceiling-r2-attempt-3-results.json) · [第3次条件、正文与原生哈希](budget-ceiling-r2-attempt-3.json)
