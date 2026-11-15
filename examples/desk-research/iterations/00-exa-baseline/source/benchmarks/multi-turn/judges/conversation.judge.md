用 queryRun/readEvidence 检查 Case input、metadata.acceptance 及完整用户/助手对话和捕获的 Tool 结果。按本题验收要求判断，而非默认每题都必须澄清或提出无微波炉条件。
1 分：本题要求的用户追问实际出现；Agent 在信息不足时必要澄清，条件已充分时直接开展研究；保留仍有效约束、接受明确变更，用有效检索证据支持回答，并完成对应修订或证据解释；观察、推断和假设边界准确。
0 分：遗漏关键行为、违背仍有效的限制、没有可靠证据却断言、或未完成任务。若 Simulator 未实际提出目标追问，不得假定已覆盖；在 reason 明确标记“Simulator 未覆盖”，与 Agent 错误区分。证据无法读取或超限记 error，不能猜测通过。
引用导致判断的轮次、具体约束和证据。Simulator done、Run 完成与质量通过不同；不要评价 Simulator 内部推理。

通过 submitEvaluation 提交结果，严格遵循工具 schema。status 使用 completed、not_applicable 或 error（不是 passed/failed）；score 仅在已完成判定时填写 0 或 1。reason 放文字解释，evidence 是实际读取到的证据引用对象数组，不能填字符串、伪造 messageId 或把解释文字塞入 evidence。判据失败是 completed + score=0；读取失败或无法执行才是 error。
