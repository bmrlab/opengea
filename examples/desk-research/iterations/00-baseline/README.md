# Baseline

原始源码按 63/63 哈希恢复；统一覆盖当前 main 的 Cases/Judges，并把 Agent / Simulator 改为 CR 直连。

## 给 coding agent 的任务文本

```text
为当前 ProductResearch 增加保存和读取研究简报的能力。
保留 Exa 搜索、read_source 正文读取和事实/假设区分，不故意删能力造失败。
用 ResearchStore DO 保存范围、简报和来源，按可信 Session/Chat ID 隔离。
验证同一对话能读回、不同对话读不到。交付代码和校验结果。
本次复现从 5b43037 的 original-manifest 恢复；63/63 原文件哈希一致后，
统一叠加当前 main Cases/Judges 与 CR 直连配置。不要吸收后来共享行为修复。
共同边界：Cases/Judges 固定到 protocol 记录的 main；Agent、Simulator、Judge
都用 creative-reasoning-1.5 / local；Agent 16 步/240 秒、Judge 12 步/300 秒。
只使用授权凭据且不写进仓库。每次执行和评分都保留，不重抽、不挑绿、不手工补分。
```

## 源码和比较条件

[source](source/) · [manifest](manifest.json) · [来源记录](provenance.json) · [改动](changes.diff) · [统一比较条件](../protocol.json)

进入 source 安装锁定依赖，按 [默认命令](../../README.md#2-跑分)运行和评分。快照校验只保证源码内容，执行器不读取 protocol。

## 发布版首次失败

[首次四题执行](published-execution-results.json)全部执行错误；[评分中断记录](published-attempt.json)保留未产出逐题评分的原始身份和状态。收到 R4 工具链交接后，三轮完整换成同一候选运行条件重新执行；不选取部分成功样本，不与首次或 R4 分数拼接。

## 本轮候选工具链真实结果

四道单轮自动通过 2/4，质量失分 2，执行/评分错误 0；clarify-breakfast 的 conversation 与 coverage 均为 1。必跑判分 14/14 已完成。保留 1 条人工争议，不将自动通过等同于业务验收。

[单轮首次结果](results.json) · [多轮首次结果](multi-results.json) · [逐项复核](review-notes.json) · [Case × Judge 对照](../comparison.md)

完整原始 Run 与 Trace 保留本地，公开 results 是裁剪后的分享版。执行失败、评分错误、有效 0 分和多轮未覆盖分别保留；不将历史分数挪来使用。该轮不代表全部 18 题验收。
