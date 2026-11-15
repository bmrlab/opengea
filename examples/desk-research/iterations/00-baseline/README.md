# 00 — 固定题集基线

> 历史探索：本轮使用 social-search，保留原始源码与结果。正式示例现使用 Exa；本轮不能作为 Exa 基线。

## 源码和运行

此版本保留原始研究指令、搜索摘录适配器及历史同步 SQL 存储。质量回归从 source/scripts/materialize.mjs 生成 v1-research，未运行历史 SQL/工作台路径。完整文件与工具链见 manifest.json。

固定单轮题：breakfast-scope、willingness-to-pay、audience-transfer、validation-plan；固定多轮题：budget-revision、challenge-citation。Agent/Judge/Simulator 均 gea-pro，modelSource=hosted、concurrency=2、maxSteps=16、totalMs=240000。

## 真实结果

| 范围 | 通过 | 质量失败 | 执行错误 | Judge 错误/缺失 |
| --- | ---: | ---: | ---: | ---: |
| 单轮 4 题 | 2 | 2 | 0 | 0 |
| 多轮 2 题 | 0 | 0 | 2 | 0 |

单轮 Run 797d87b5-31b3-48db-9a83-b9f02c2e5272，CLI 退出 0；多轮 Run dd9383dc-02df-4421-a57b-94a2bca9db54，CLI 退出 1。

- audience-transfer、willingness-to-pay 的 inference 判 0：零散来源被提升为核心痛点或普遍性判断。
- 两个多轮 Case 都调用了 askUser，停在等待输入，未进入目标用户追问。它们是执行错误，不是质量分为 0，也不是 Simulator 未覆盖后勉强算通过。
- 两个自动通过的单轮题不代表所有研究判断都正确；仍需人工复核。

逐题答案、Judge 原因和证据引用见 [单轮结果](results/single-turn.json)、[多轮结果](results/multi-turn.json)。纠错及对应 Trace 见 [review-notes.json](review-notes.json)。

## 下一轮决策

先修交互约定和证据表达：必要澄清走普通文本，关键观察逐项引用，逐句核对强判断。保持题目、Judge、模型和搜索适配器不变，以区分 Agent 改动与评分口径变化。Judge 的预检校准发生在本轮之前，见 ../PREFLIGHT.md。
