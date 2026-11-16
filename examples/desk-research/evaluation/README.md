# 校准 Judge，再验收 Agent

先写清楚 Case 的输入和可观察验收条件，再选择独立的必过规则。单轮的 scope 检查限制条件、evidence 检查每条事实和确切来源、inference 检查推断边界。多轮另用 coverage 检查目标追问实际发生且得到回答，conversation 只评价已观察到的 Agent 质量。不能用一次追问后的高分代替完整场景，也不能把没有问过的能力判为 Agent 失败。

`fixtures/calibration.json` 是人工编写的 32 个正反例，不是 Agent 实跑结果。预期标签与 Judge 输入分离，包含预算超限、组合错算、错链、时间/人群范围、缺正文，以及同义追问、缺阶段、倒序、合并和质量差但覆盖完整的对话。先用真实 Judge 验证规则能区分这些情况。遇到 Judge 错误保留 error，不人工补分。

覆盖目标写入各Case的metadata.coverage，独立于答案质量。校准同时覆盖六类多轮场景，不能把其他场景当作不适用。

在示例根目录运行，输出目录必须不存在：

```bash
node evaluation/prepare.mjs fixtures /tmp/desk-calibration
gea eval judge --json '{"run":"/tmp/desk-calibration","judgeSource":"snapshot","judgeModel":"gea-pro","modelSource":"hosted","concurrency":2,"maxSteps":12,"timeoutMs":300000}'
node evaluation/summarize.mjs calibration /tmp/desk-calibration/evaluations/<evaluation-id> /tmp/calibration-summary.json
```

只有全部预期匹配且原生 evaluation 状态完成，校准汇总才返回成功。正确指出必要正文不可读取的 `insufficient_evidence` 符合特定负例；网络错误或其他错误不能冒充通过。

## 对同一份证据重评分

改 Judge 后，复制原生 Eval 目录（包含 run.json、benchmarks 和 executions），保留首次结果。`overlay` 创建新工作目录：rescore 模式保持原输入、工具配置和 Simulator，只替换评分规则；scenario 模式另外应用修正的两阶段 Simulator，供未来真实执行。

```bash
node evaluation/prepare.mjs overlay iterations/00-exa-baseline/source /tmp/desk-rescore rescore
# 在新目录安装锁定依赖，然后对复制的原生运行记录评分
gea eval judge --json '{"cwd":"/tmp/desk-rescore","run":"/tmp/copied-native-run","judgeSource":"workspace","judgeModel":"gea-pro","modelSource":"hosted","concurrency":2,"maxSteps":12,"timeoutMs":300000}'
```

重评分回答“同一回答在新规则下得多少分”；它不等于修复后的 Agent 已执行。公开的 results.json 是脱敏分享格式，不能代替原生 Eval 输入。旧执行错误也不会被重评分变成正常完成。

导出选定的重评分用于复核，第三个参数为该次evaluation目录。导出器核对Run身份，只采用该次评分，拒绝覆盖已存在的文件；分享前仍须检查回答和Judge文字。

```bash
node iterations/analyze-eval.mjs /tmp/copied-native-run /tmp/rescore-share.json /tmp/copied-native-run/evaluations/<evaluation-id>
```

## 完整示例验收

在修复后的项目运行全部 12 道单轮题和 6 道多轮题，不传 caseIds 即全选：

```bash
gea agent eval --json '{"benchmarkPath":"benchmarks/single-turn","modelSource":"hosted","executeOnly":true,"concurrency":2,"overrides":{"engine":{"maxSteps":16,"timeout":{"totalMs":240000}}}}'
gea agent eval --json '{"benchmarkPath":"benchmarks/multi-turn","modelSource":"hosted","executeOnly":true,"concurrency":2,"overrides":{"engine":{"maxSteps":16,"timeout":{"totalMs":240000}}}}'
```

分别保存命令返回的resultDirectory。先检查执行错误和对话，再对每个目录评分：

```bash
gea eval judge --json '{"run":"/path/from/resultDirectory","judgeSource":"snapshot","judgeModel":"gea-pro","modelSource":"hosted","concurrency":2,"maxSteps":12,"timeoutMs":300000}'
```

executeOnly退出成功仅证明执行完成；必须继续查看evaluation中的每项Judge结果。更新Judge后用judgeSource=workspace重评同一原生目录，保留旧evaluation；不要覆盖原始run.json。

retain-constraints 必须发生两次独立追问：先增加携带防漏条件并得到回答，再要求两个优先验证方向及理由并得到回答。多轮题均以 coverage 和 conversation 两项必过。`summarize.mjs conversation` 可额外拆分 retain-constraints 的覆盖、已观察质量及执行/评分错误。

Exa、模型别名和网页内容会变化。记录实际模型、工具链、运行目录、来源及全部失败；保留首次运行和复验，不能通过挑选重跑、降低阈值或只看平均分证明改进。本轮的候选 CLI 修复尚未发布，正式版本的可用性要在对应发布后另行验收。

Judge预算与Agent执行预算分开：这里为完整证据核对设300秒Judge预算、12步；Agent仍为240秒。此前90秒Judge试跑超时记录保留，增加评分预算不能证明Agent超时问题已修复。

保存研究记录时，工作台会核对报告与来源列表中的URL是否由本次对话的真实搜索或读取返回。错误链接会拒绝保存并反馈给Agent纠正；不会自动替换链接，也不会因为链接存在就判定事实正确。纯研究阶段不保存记录，仍依靠独立evidence Judge核对。
