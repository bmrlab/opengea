# 第二次迭代：看 Trace

相对 01 改过程与引用工具。保留原始搜索上限 5 页 / 6000 字符预览；2000 字符正文窗口与 passageId 来自现有工具，未引入结构化观察。

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

## 本轮候选工具链真实结果

四道单轮自动通过 4/4，质量失分 0，执行/评分错误 0；clarify-breakfast 的 conversation 与 coverage 均为 1。必跑判分 14/14 已完成。保留 1 条人工争议，不将自动通过等同于业务验收。

[单轮首次结果](results.json) · [多轮首次结果](multi-results.json) · [逐项复核](review-notes.json) · [Case × Judge 对照](../comparison.md)

完整原始 Run 与 Trace 保留本地，公开 results 是裁剪后的分享版。执行失败、评分错误、有效 0 分和多轮未覆盖分别保留；不将历史分数挪来使用。该轮不代表全部 18 题验收。
