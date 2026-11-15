# 01 — 普通文本澄清与证据边界

> 历史探索：本轮使用 social-search，保留原始源码与结果。正式示例现使用 Exa；本轮不能作为 Exa 基线。

## 改动依据

对应 00 的 R01/R02 真实纠错，仅修改完整项目与 v1 的 instructions：必要澄清不用 askUser，已知条件足够则研究；保持未变的用户限制；关键观察直接引用；强判断不能靠文末免责声明补救。模型、Cases、Judges 和搜索适配器不变。源码与工具链见 manifest.json。

## 同一 6 题的真实结果

| 范围 | 通过 | 质量失败 | 执行错误 | Judge 错误/缺失 |
| --- | ---: | ---: | ---: | ---: |
| 单轮 4 题 | 2 | 0 | 0 | 2 |
| 多轮 2 题 | 2 | 0 | 0 | 0 |

- 单轮 Run fcd3532f-a985-439d-8f05-5a4732d3bc47：audience-transfer、willingness-to-pay 三项 Judge 均通过；validation-plan 的 scope 返回非法 status；breakfast-scope 已有回答但缺最终评分文件。Run 清单标 completed，外层 CLI 却报 execution_backend_unavailable、退出 1，两者分别保留。
- 多轮 Run d9ad72a1-be9e-448b-b6cb-f6f3adf4dbf8：两题都实际走到第二轮，以 simulator_done 结束，conversation=1。预算从15元收紧到8元、引用追问均真实出现。产物完成后外层任务仍 running，收尾异常单独记录，不能称命令端到端成功。
- 对单轮两项不完整结果尝试官方 gea eval judge（judgeSource=snapshot），Task 1400ff9d-a6e8-4b0a-b319-c62dce3e067a 未产生评分进度；取消请求超时，随后终止该任务自己的 CLI。没有重新执行研究，也没有覆盖首次记录。

见 [首次单轮结果](results/single-turn-first.json)、[多轮结果](results/multi-turn.json)。本轮是 4/6 自动通过、2/6 未完成，不能说 6/6。

## 人工复核与下一轮

[review-notes.json](review-notes.json) 的 R03 明确保留人工与 Judge 分歧：预算题从单条标价推断“价格稳定、商业可持续”，缺少相应证据，即使自动评分为1也不能当作已解决。R03 仍未收口。

R04 记录搜索卡片约60字与真实笔记文本367字的信息差。02 增加关键来源文本读取，验证补充上下文的收益与可靠性；不能预设分数一定上涨。原始多轮回应虽已能完成，还存在引用拼合后需要用户追问才能纠正的问题。

CLI 与任务最终状态见 [lifecycle.json](results/lifecycle.json)；取消/退出不改写此前的逐题结果。
