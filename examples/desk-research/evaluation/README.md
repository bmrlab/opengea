# 定位失分，再按同条件重跑

## 五步入口

[1 建题](../BENCHMARKS.md#1-建题从业务风险到-casejson) → [2 跑分](../README.md#2-跑分) → [3 定位失分](#3-定位失分) → [4 改 Agent](../iterations/README.md#4-改-agent) → [5 再跑分](../iterations/README.md#5-再跑分)。

## 3. 定位失分

| 观察 | 归类 | 下一步 |
| --- | --- | --- |
| execution 超时或 error | 执行失败 | 查该 Run 的执行错误与 Trace，不填 0 分 |
| Judge 请求、证据读取或提交失败 | Judge 错误 | 保留 error，定位评测链路，不用它评价质量 |
| Judge 完成且 score=0 | 有效质量失分 | 记录回答原句、规则理由和支持/反驳证据 |
| 多轮目标追问未发生 | 场景未覆盖 | 查 Simulator 与 coverage，保留已观察质量 |
| 自动 1 分但人工发现错链/错算 | 人工争议 | 保留自动分数和人工证据，不静默改分 |

先读结果：最终回答哪些句子越过输入或证据边界，Judge 为什么给 0？再读 Trace：搜了什么、读了哪些正文、URL 和来源 ID 从哪里来？失败记录至少包含 Case、Run、原句、Judge 理由、工具证据、改动假设和无法确认的部分。

历史定位例（不是新三轮结果）：旧 00 `counter-evidence` 把局部线索写成“核心顾虑”，inference 给 0；先沿原句找到对应来源，再核对 search_sources / read_source 的具体文本、人群和范围。来源存在只能证明抓取过，不能证明它代表全体通勤者。历史记录在 [旧 Exa 四轮](../iterations/history/EXA-ITERATIONS.md)；本次实际诊断与失败原句在各轮 review-notes.json。

### 本次例子：从预算题原句走到工具证据

第 2 轮候选批次 `budget-ceiling`，目标 Run `48e8c763-9904-4d41-9834-83f0b6e98d01`：

1. **结果原句**：标题写“北京CBD个案：完整套餐常超8元，仅单品能压到8元以内”。三项 Judge 自动都是 1。
2. **回到 Trace**：本题搜索 2 次、read_source 2 次、保存 1 次；北京日报来源是 `src_9a9609c344f03384`。
3. **定位正文**：read_source(offset=0) 已返回片段 `p_23a96e7dada5cfa7`，其中明确说“店里在早餐时段售卖两款只需6.6元的超值套餐”。这是同一北京 CBD 来源中的组合套餐，反驳“仅单品”这一绝对断言。
4. **记录分歧**：引用 URL 匹配、读取确实发生，但模型仍漏掉反例。保留自动 1 分，同时在人工复核记录证据矛盾；不能因采用 sourceId 就判定每句事实都正确。
5. **下一步假设**：结果复核应检查绝对表述与同页反例；过程复核应检查已读取片段怎样进入简报。本次不为消除争议改 Judge 或重抽回答。

[本题回答与原始自动判分](../iterations/02-trace-focused/results.json) · [逐项人工复核](../iterations/02-trace-focused/review-notes.json) · [工具调用观察](../iterations/trace-observations.json)。分享 Trace 裁剪了正文，以上片段定位来自保留在本地的完整原生证据。

导出原生结果用于分享：

```bash
node iterations/analyze-eval.mjs /absolute/path/to/run /new/path/results.json /absolute/path/to/run/evaluations/EVALUATION_ID
```

导出拒绝覆盖旧文件。它裁剪工具输出和 Trace，完整正文只在本地原生目录；复核不能把裁剪造成的缺失当作运行未读取。先比较相同 Case × Judge，再看改善、退化、未完成与人工争议。

## 本次真实比较的运行条件

三轮候选批次使用 [runtime-candidate.json](../iterations/runtime-candidate.json) 中的 CLI / App Server / SDK / contract 构件，Agent 和 Judge 预算未提高。先在示例根目录设置同一非秘密模型配置，再进入各轮 source（或它的逐文件一致执行副本）：

```bash
export CREATIVE_REASONING_BASE_URL="https://api.creative-reasoning.com/v1"
export LLM_MODEL_CATALOG_JSON="$(cat evaluation/cr-local.catalog.json)"
```

凭据仍只由本机授权环境注入，Catalog 只含变量名。总输出 4096、思考 1024，Simulator 自身 2048 上限仍优先。候选 SDK/contract 用隔离的本地安装覆盖执行副本依赖，三轮相同；不要在该覆盖目录运行会自动重装公开锁文件的 pnpm 命令。核对实际构件哈希后用该候选 `gea` 执行默认命令。源码 manifest 与运行器条件分别校验；普通公开 npm 安装对应已保留的失败首次批次，不是候选结果的复现证明。

## 评测规则校准与完整验收


以下命令使用当前入口的 CR 直连配置：在同一终端注入 `CREATIVE_REASONING_API_KEY`，使用 `creative-reasoning-1.5` 和 `modelSource: "local"`，见[启动说明](../README.md#配置-cr-api-key)。历史结果仍保留原模型，不作为新配置的验收；更换 Judge 模型后先重新校准，再建立可比较的基线。

先写清楚 Case 的输入和可观察验收条件，再选择独立的必过规则。单轮的 scope 检查限制条件、evidence 检查每条事实和确切来源、inference 检查推断边界。多轮另用 coverage 检查目标追问实际发生且得到回答，conversation 只评价已观察到的 Agent 质量。不能用一次追问后的高分代替完整场景，也不能把没有问过的能力判为 Agent 失败。

`fixtures/calibration.json` 是人工编写的 32 个正反例，不是 Agent 实跑结果。预期标签与 Judge 输入分离，包含预算超限、组合错算、错链、时间/人群范围、缺正文，以及同义追问、缺阶段、倒序、合并和质量差但覆盖完整的对话。先用真实 Judge 验证规则能区分这些情况。遇到 Judge 错误保留 error，不人工补分。

覆盖目标写入各Case的metadata.coverage，独立于答案质量。校准同时覆盖六类多轮场景，不能把其他场景当作不适用。

在示例根目录运行，输出目录必须不存在：

```bash
node evaluation/prepare.mjs fixtures /tmp/desk-calibration
gea eval judge --json '{"run":"/tmp/desk-calibration","judgeSource":"snapshot","judgeModel":"creative-reasoning-1.5","modelSource":"local","concurrency":2,"maxSteps":12,"timeoutMs":300000}'
node evaluation/summarize.mjs calibration /tmp/desk-calibration/evaluations/<evaluation-id> /tmp/calibration-summary.json
```

只有全部预期匹配且原生 evaluation 状态完成，校准汇总才返回成功。正确指出必要正文不可读取的 `insufficient_evidence` 符合特定负例；网络错误或其他错误不能冒充通过。

## 对同一份证据重评分

改 Judge 后，复制原生 Eval 目录（包含 run.json、benchmarks 和 executions），保留首次结果。`overlay` 创建新工作目录：rescore 模式保持原输入、工具配置和 Simulator，只替换评分规则；scenario 模式另外应用修正的两阶段 Simulator，供未来真实执行。

```bash
node evaluation/prepare.mjs overlay iterations/00-baseline/source /tmp/desk-rescore rescore
# 在新目录安装锁定依赖，然后对复制的原生运行记录评分
gea eval judge --json '{"cwd":"/tmp/desk-rescore","run":"/tmp/copied-native-run","judgeSource":"workspace","judgeModel":"creative-reasoning-1.5","modelSource":"local","concurrency":2,"maxSteps":12,"timeoutMs":300000}'
```

重评分回答“同一回答在新规则下得多少分”；它不等于修复后的 Agent 已执行。公开的 results.json 是脱敏分享格式，不能代替原生 Eval 输入。旧执行错误也不会被重评分变成正常完成。

导出选定的重评分用于复核，第三个参数为该次evaluation目录。导出器核对Run身份，只采用该次评分，拒绝覆盖已存在的文件；分享前仍须检查回答和Judge文字。

```bash
node iterations/analyze-eval.mjs /tmp/copied-native-run /tmp/rescore-share.json /tmp/copied-native-run/evaluations/<evaluation-id>
```

## 完整示例验收

这里执行当前示例根目录。新三轮 `iterations/00-baseline/source`、`01-result-focused/source`、`02-trace-focused/source` 已统一 CR。`iterations/history/*/source` 才是旧 Exa 四轮历史快照，overlay 不会迁移其 Agent 模型；若要用旧快照做新的 CR 直连执行，先在新工作副本统一 Agent、Simulator 和 Judge 的 CR 模型 ID，并记录新基线。

在修复后的项目运行全部 12 道单轮题和 6 道多轮题，不传 caseIds 即全选：

```bash
gea agent eval --json '{"benchmarkPath":"benchmarks/single-turn","modelSource":"local","executeOnly":true,"concurrency":2,"overrides":{"engine":{"maxSteps":16,"timeout":{"totalMs":240000}}}}'
gea agent eval --json '{"benchmarkPath":"benchmarks/multi-turn","modelSource":"local","executeOnly":true,"concurrency":2,"overrides":{"engine":{"maxSteps":16,"timeout":{"totalMs":240000}}}}'
```

分别保存命令返回的resultDirectory。先检查执行错误和对话，再对每个目录评分：

```bash
gea eval judge --json '{"run":"/path/from/resultDirectory","judgeSource":"snapshot","judgeModel":"creative-reasoning-1.5","modelSource":"local","concurrency":2,"maxSteps":12,"timeoutMs":300000}'
```

executeOnly退出成功仅证明执行完成；必须继续查看evaluation中的每项Judge结果。更新Judge后用judgeSource=workspace重评同一原生目录，保留旧evaluation；不要覆盖原始run.json。

retain-constraints 必须发生两次独立追问：先增加携带防漏条件并得到回答，再要求两个优先验证方向及理由并得到回答。多轮题均以 coverage 和 conversation 两项必过。`summarize.mjs conversation` 可额外拆分 retain-constraints 的覆盖、已观察质量及执行/评分错误。

Exa、模型别名和网页内容会变化。记录实际模型、工具链、运行目录、来源及全部失败；保留首次运行和复验，不能通过挑选重跑、降低阈值或只看平均分证明改进。本轮的候选 CLI 修复尚未发布，正式版本的可用性要在对应发布后另行验收。

Judge预算与Agent执行预算分开：这里为完整证据核对设300秒Judge预算、12步；Agent仍为240秒。此前90秒Judge试跑超时记录保留，增加评分预算不能证明Agent超时问题已修复。

保存研究记录时，工作台会核对报告与来源列表中的URL是否由本次对话的真实搜索或读取返回。错误链接会拒绝保存并反馈给Agent纠正；不会自动替换链接，也不会因为链接存在就判定事实正确。纯研究阶段不保存记录，仍依靠独立evidence Judge核对。

正文读取保留同一完整URL，按最多2000字符的窗口返回；query定位原句，nextOffset继续当前提取。未找到与提取截断都不是事实不存在的证明。搜索仅返回最多3页、每页600字符预览；范围、价格、人群等结论需要当前来源的具体支持。

## 2026-11-16 R2 有界复验

源码60f9e1c使用同一gea-pro、Agent 16步/240秒、Judge 12步/300秒；Judge规则未改。此前四道质量失败题（alternatives-not-products、audience-transfer、counter-evidence、validation-plan）本轮全部执行完成，12项严格Judge全部为1。[逐题回答与评分](results/r2-quality-four-share.json)。这仅关闭这四题当前候选的已观察失败，不代表全部题集或所有版本已经通过。

coverage在126203c到60f9e1c期间规则和Case目标相同。本轮19个固定正反例全部匹配，覆盖六类场景，not_applicable=0、error=0。[原生评分摘要](results/r2-coverage-summary.json)。这些是合成对话的真实Judge校准，不是Agent多轮实跑。

验收使用未发布的候选CLI（gea #1355，4015a5665，二进制SHA-256 a2874ae7f24404b6cd0802cd4fbab17c1961f7d0bfdff11b57090e521b55d357）和本地构建的SDK/contract（gea 5bd4093e）。公开npm版本本身尚未通过同一验收；未合并、发包或部署。

2026-11-17 定向修复：02 预算题加入反例核对后仅补跑一次，新回答承认6.6元套餐；scope=1、inference=1、evidence Judge error，整体 incomplete。旧批次保留且不混分；[补跑记录](../iterations/02-trace-focused/README.md#2026-11-17-预算题定向修复与一次补跑)列出原生证据与残余质量问题。

r2 后续：预算题累计3次真实尝试全部保留；最新 scope=1、evidence=1、inference=1，判分3/3，read_source=3，最终无 sourceId 占位符。北京6.6元套餐及来源已对应，仍有其他人工争议，详见 [r2汇总](../iterations/02-trace-focused/budget-ceiling-r2-summary.json)。
