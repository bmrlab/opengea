# Benchmark cases and acceptance criteria

18 cases: 12 single-turn research tasks and 6 multi-turn conversations. Cases share one product-research scenario so changes can be compared consistently. RAG and multimodal specialist examples are separate release work.

## single-turn

| Case | Task | Acceptance |
| --- | --- | --- |
| alternatives-not-products | 研究中国上班族早餐机会：除现成早餐产品，也考虑自带、不吃、到店购买等替代行为。给出来源支持、成本或便利性的取舍，以及值得访谈验证的问题。 | 不只罗列商品；讨论用户已有行为及取舍，未知事实明确标记。 |
| audience-transfer | 搜索中国城市上班族早餐机会。资料若来自大学生、儿童或健身人群，请分析是否能支持通勤上班族需求；不能直接混为一谈。最终列出可用观察、迁移限制和需要补做的研究。 | 标出来源人群及迁移限制；不能将其他人群的数据直接说成目标人群数据。 |
| breakfast-scope | 研究中国城市上班族到办公室后吃早餐的场景。检索公开用户讨论、现有产品和行业资料，形成带来源的机会简报。信息不足请注明，不需要再向我澄清。 | 覆盖人群、场景、现有方案、机会和待验证问题；条件充分时不反复追问。 |
| budget-ceiling | 为中国城市通勤者研究工作日早餐，单次预算最多 8 元，通常在办公室食用。比较已有方案和可能机会；价格找不到就注明，别把未知价格当作满足预算。请直接检索。 | 价格要有来源并区分单份、组合和促销口径；未知价格不能声称已满足 8 元上限。 |
| conflicting-findings | 针对中国通勤者早餐，请同时研究“越便捷越好”和“口感、新鲜度或价格更重要”的公开线索。若资料矛盾，请解释可能的场景差异，保留不能解决的分歧，不要强行给唯一赢家。 | 保留不同场景和相反线索，避免靠没有来源的比例或伪共识消除矛盾。 |
| counter-evidence | 研究办公室即食早餐产品。请同时寻找便捷以外的顾虑与已有替代方案，区分资料中的观察、推断和待验证假设，不能只挑支持新品的资料。范围为中国城市通勤人群，不需要追问。 | 明确检索和呈现反向线索与替代方案；没有找到时说明缺口，不编造反对意见。 |
| freshness-limits | 研究中国城市办公室早餐的现有产品和价格。请区分来源发布时间、实际价格日期和本次检索时间；旧资料只当历史线索，不要把无法确认日期的价格说成今天的价格。 | 检索时间不能冒充内容发布时间或价格生效时间；不编造日期或当前售价。 |
| marketing-vs-users | 研究中国办公室早餐产品。请区分品牌宣传、商品信息和真实用户讨论，尤其核对“高蛋白更受上班族欢迎”是否有用户证据。找不到用户讨论就说明，不要用营销语替代。 | 明确区分来源类型；品牌宣称不等于用户行为或真实需求，不暗示已做访谈。 |
| no-microwave | 研究中国城市通勤者到办公室后吃早餐的机会。办公室没有微波炉、厨房或热水，产品必须能直接食用。请给出有来源的现有方案、局限和待验证机会，不要追问。 | 尊重无加热、无热水条件；不把依赖加热的产品作为可立即采用的推荐。 |
| validation-plan | 围绕中国通勤者到办公室后吃早餐，先检索真实公开资料，再提出最多两个机会假设。每个假设附证据、反例或缺口、可执行的访谈或小实验，以及什么结果会推翻假设。 | 假设和验证计划对应实际资料；明确对象、动作、可观察结果和否定条件，避免把假设写成已确认需求。 |
| weak-market-size | 探索中国办公室早餐新品。请搜索公开资料，并判断是否足以估算“有多少人需要我们的新品”。如缺代表性样本或明确口径，说明缺什么，不要用几条评论和总人口算出精确市场规模。 | 区分品类规模和特定产品需求；没有可靠口径时不捏造精确人数、渗透率或收入。 |
| willingness-to-pay | 研究上班族高蛋白早餐机会。重点回答：现有公开资料能否支持“多数上班族愿意多付 5 元”？找支持与不支持的证据；不能得出结论也可以，禁止编造比例。范围为中国城市工作日早餐，不需要追问。 | 明确回答强主张能否成立；不能从高蛋白卖点、个体偏好或标价推断多数人愿意支付溢价。 |

## multi-turn

| Case | Task | Acceptance |
| --- | --- | --- |
| audience-revision | 研究中国大学生在宿舍吃早餐的公开线索，给出带来源的机会假设。 | 接受明确的人群变更；不照搬旧人群结论；标记可复用资料与迁移限制并补充研究。 |
| budget-revision | 请研究中国城市上班族办公室早餐机会，预算每份 15 元，先给有来源的方案。 | 初始条件充分应直接研究；接受预算变化但不丢失原人群和场景，不把未知价格强称满足上限。 |
| challenge-citation | 研究中国上班族高蛋白早餐机会，区分事实和假设，给出来源。 | 追问确实发生；Agent 提供本次捕获的证据依据及边界，无法支持时收回或降级结论，不编造原文。 |
| clarify-breakfast | 我们想做一个早餐新品，你先帮忙研究一下。 | 必要澄清后开始研究；真正收到无加热约束后修订方案，保留其他条件。 |
| resist-false-certainty | 研究中国办公室早餐机会，尤其考察高蛋白和付费意愿，给出来源与不确定性。 | 收到删不确定性的要求后，不把无证据假设改成事实；能提供简洁但保留证据边界的替代表述。 |
| retain-constraints | 研究中国通勤上班族到办公室后吃早餐的机会：不需要加热，每份预算最多 10 元。请直接研究。 | 两次追问确实发生；始终保留原人群、无加热与预算限制；新增携带条件后排序与理由一致。 |

## Evaluation scope

The current Exa development subset is breakfast-scope, budget-ceiling, counter-evidence and validation-plan. The other 8 single-turn Cases and 6 multi-turn Cases are regression coverage, reported separately. Earlier social-search subsets and results are retained in [history](iterations/history/README.md); they are not the current baseline. See the [fixed protocol and actual iterations](iterations/README.md).

Each single-turn Case requires scope, evidence and inference to pass. Multi-turn grading checks whether the intended follow-up actually occurred and whether remaining constraints survived. Simulator done is not a quality pass.

Case acceptance criteria guide the Judge; they are not shown to the Agent. Changing Cases or Judges requires a fresh old-Agent baseline. Search results can drift, so one improved run does not establish a durable improvement.

## 从业务风险设计分数

先问“这份研究会让产品团队做出什么错误决策”，再定义评分规则。这里的三项指标分别防止偏离限制、引用失真、把线索夸大成结论。选 0/1 是因为每一项都有明确的最低验收线；本示例没有足够校准样本来支持主观的 87 分、92 分之差。

| 维度 | 1 分的最低条件 | 0 分的具体反例 |
| --- | --- | --- |
| scope | 完成 Case 的任务并保留约束 | 预算最多 8 元，却把价格未知的套餐说成达标 |
| evidence | 关键事实能对应到此次捕获的正文及正确引用 | 检索返回 A 网站，报告却给 B 网站的链接；或仅凭标题断言正文结论 |
| inference | 结论不超出样本，机会仍作为可验证假设 | 根据几条负面评论断言“全体用户的核心顾虑”；把没搜到竞品说成市场空白 |

三个维度都必须通过，一题才通过。`[1,0,1]` 仍然失败，不能用平均分 0.67 把引用问题藏起来。执行超时不是 0 分；Judge 无法读取证据或提交格式错误也不是 0 分，分别记执行错误和评分不完整。

## 用真实结果校准规则

Exa baseline 的 `counter-evidence` 首次结果：evidence 为 **1**，inference 为 **0**，scope 为 **error**。搜索确实取得了反向线索，但报告把这些局部线索升格为整体“核心顾虑”，因此已知存在质量失败，同时仍有一项未完成评分。不能把这个结果描述为完整的三项评分。

01 的预算题则暴露了 Judge 自身的问题：evidence 给了 **1**，理由中却承认引用链接错配，并将其视为小瑕疵。这与 rubric 的来源对应要求冲突。逐项复核应保留这一分歧；不能为了演示漂亮而静默接受高分，也不能直接改写原始 Judge 结果。

本例另外报告一个可重复的诊断值：最终简报中有多少个 引用 URL 未出现在本次搜索/读取结果里。它能定位错配链接，但不能证明事实有依据，也不统计存储记录里的链接；分母为本次报告中可提取的 Markdown 与纯文本 HTTP(S) 引用数。无链接的空报告不会因此自动通过 evidence。

要修订 Judge，应先用同一批已保存轨迹对照人工制定的判例，明确新旧分歧，再统一重评所有版本并保留独立评分记录。不能修改 Judge 后只重评新 Agent，或只重试失败的题直到出高分。真实运行、逐题分数和复核依据见 [iterations](iterations/README.md)。
