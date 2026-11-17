# 第一次迭代：看结果

相对 00 只改变两个 instructions 文件。依据是历史结果，是否改善必须由本轮新运行验证。

## 给 coding agent 的任务文本

```text
阅读历史 Baseline 的最终回答和 Judge 理由，不根据 Trace 增加过程改动。
失败证据：预算题引用域名错配，午餐资料被推成早餐无福利；counter-evidence
把局部负面材料概括为“核心顾虑”。逐题记下 Case、原句和 Judge 理由。
只修改 instructions.ts 与 versions/v1-research/instructions.ts：
合并旧 01 的三个关键事实逐条核对、直接复制来源 URL 要求，
以及旧 03 的结论主语/样本范围限制、假设验证与放弃条件要求。
不改搜索、存储、正文工具，不提前加入最多三个查询或 sourceId。
交付相邻 diff；按同一四题和 clarify-breakfast 首次重跑，保留全部错误。
共同边界：Cases/Judges 固定到 protocol 记录的 main；Agent、Simulator、Judge
都用 creative-reasoning-1.5 / local；Agent 16 步/240 秒、Judge 12 步/300 秒。
只使用授权凭据且不写进仓库。每次执行和评分都保留，不重抽、不挑绿、不手工补分。
```

## R4 交接补充

结果复核还要检查：个案是否被称作主流预算、购买行为是否被推成偏好、试验是否改变无热水等原条件、机会问题是否暗含矛盾前提。这是仍需验证的问题清单，不能当作修复通过。对应历史证据、适用边界及不计作提升的运行问题见 [R4 归类](../R4-FINDINGS.md)。

## 源码和比较条件

[source](source/) · [manifest](manifest.json) · [来源记录](provenance.json) · [改动](changes.diff) · [统一比较条件](../protocol.json)

进入 source 安装锁定依赖，按 [默认命令](../../README.md#2-跑分)运行和评分。快照校验只保证源码内容，执行器不读取 protocol。

## 发布版首次失败

[首次四题执行](published-execution-results.json)全部执行错误；[评分中断记录](published-attempt.json)保留未产出逐题评分的原始身份和状态。收到 R4 工具链交接后，三轮完整换成同一候选运行条件重新执行；不选取部分成功样本，不与首次或 R4 分数拼接。

## 本轮候选工具链真实结果

四道单轮自动通过 3/4，质量失分 1，执行/评分错误 0；clarify-breakfast 的 conversation 与 coverage 均为 1。必跑判分 14/14 已完成。保留 1 条人工争议，不将自动通过等同于业务验收。

[单轮首次结果](results.json) · [多轮首次结果](multi-results.json) · [逐项复核](review-notes.json) · [Case × Judge 对照](../comparison.md)

完整原始 Run 与 Trace 保留本地，公开 results 是裁剪后的分享版。执行失败、评分错误、有效 0 分和多轮未覆盖分别保留；不将历史分数挪来使用。该轮不代表全部 18 题验收。
