# 02 — 核对关键来源文本

> 历史探索：本轮使用 social-search，保留原始源码与结果。正式示例现使用 Exa；本轮不能作为 Exa 基线。

## 改动和边界

新增 read_source：只接受小红书 explore 链接，通过原 social-search Connector 读取对应笔记文本。拒绝不匹配的笔记ID、接口失败和无结果；不向模型转交作者账户或上游访问参数。文本最多6000字并标记截断，不代表读过图片、视频或评论。指令要求核对核心判断的1–2条来源，不批量读取全部结果。

依据是实际预检的信息缺口：同一条笔记的搜索摘录约60字，详情为367字，包含摘要没有的设备、人群和做法限定。它是能力改进假设，不是已经证实的质量涨分。

另将完整项目的研究 DO 改为异步 KV，修复实测同步 SQL 路径未完成的问题。质量回归仍使用不含 DO 的 v1 阶段，KV 修复不计入质量分数变化。Cases、Judges、模型与参数均和00/01相同；Benchmark 摘要一致。

## 固定 6 题结果

| 范围 | 通过 | 质量失败 | 执行错误 | Judge 错误/缺失 |
| --- | ---: | ---: | ---: | ---: |
| 单轮 4 题 | 1 | 0 | 0 | 3 |
| 多轮 2 题 | 2 | 0 | 0 | 0 |

- 单轮 Run 2f05f5a9-7d49-4d40-828e-ae5dac23dab2，CLI 退出0。audience-transfer 通过；breakfast-scope 是 evidence_unavailable；validation-plan 是 Judge status 格式错误；willingness-to-pay 是模型 HTTP500/overloaded_error。没有将这些错误写成质量失败或通过。
- 多轮 Run 1194358c-fb31-419e-a2e5-37b0defa4dec，两个真实对话的 conversation 均为1。产物完成后任务仍 running，命令收尾异常另行保留。
- 本轮为3/6自动通过、3/6未完成。没有证据支持“增加读取工具后整体质量提升”；与01相比，确定通过的覆盖反而减少，错误原因并不都属于 Agent。

完整逐题内容见 [单轮](results/single-turn.json)、[多轮](results/multi-turn.json)。扩展的其余12题另列 coverage 结果，不能混入00/01/02的6题比较。

## 后续判断

继续核查 Judge 的证据读取和结构化提交稳定性，并保留01的人工纠错。需要修改评审规则时建立新的基线，不在这一轮改规则以换取绿灯。完整工作台的 API 接入修复在03，未改研究 Agent 或题集。

## 其余 12 题实际覆盖

- 单轮 Run `1c175509-db47-43ba-a1ab-d9e7917b7059`：7 通过，budget-ceiling 执行错误。
- 多轮 Run `5c58bb11-2af1-496e-b050-d7804ed9e35b`：3 通过，clarify-breakfast 的 Judge 请求失败。
- 与本轮固定 6 题合计：13/18 通过、1 执行错误、4 Judge 错误。全部 Case 有结果记录；不代表全部通过。
- 外层 CLI 在产物完成后未退出；官方 local-cancel 超时，随后终止本任务的 CLI 进程，退出状态另见 lifecycle.json。未修改评分、未重跑研究来替换失败。

详见 [补充单轮](results/coverage-single.json)、[补充多轮](results/coverage-multi.json)。

CLI 与任务最终状态见 [lifecycle.json](results/lifecycle.json)；取消/退出不改写此前的逐题结果。
