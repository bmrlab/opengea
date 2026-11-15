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

The fixed iteration subset selects breakfast-scope, willingness-to-pay, audience-transfer, validation-plan, budget-revision and challenge-citation. The other 12 cases are not included in those scores. Execution errors, Judge errors, missing coverage and quality failures remain distinct.

Each single-turn Case requires scope, evidence and inference to pass. Multi-turn grading checks whether the intended follow-up actually occurred and whether remaining constraints survived. Simulator done is not a quality pass.

Case acceptance criteria guide the Judge; they are not shown to the Agent. Changing Cases or Judges requires a fresh old-Agent baseline. Search results can drift, so one improved run does not establish a durable improvement.
