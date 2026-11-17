# 产品创新 Desk Research：早餐产品机会

这是可独立运行的完整 Desk Research 示例；Quick Start 面向 coding agent，提供五步迭代索引，并以当前 ProductResearch 为起点增加 DO。任务是研究上班族早餐的使用场景、困难与已有方案，输出带来源的机会简报，并区分观察、推断和待验证假设。

- [Coding Agent Quick Start](./QUICKSTART.md)：建题、跑分、定位失分、改 Agent、再跑分的五步索引与 DO 扩展任务。
- [验收记录](./VALIDATION.md)：已执行的本地检查与尚未完成的真实验收。
- [English tutorial](./QUICKSTART.en.md)。
- [18 道题与验收标准](./BENCHMARKS.md)。
- [质量迭代记录](./iterations/README.md)：源码快照、固定题集、真实结果与改动说明。

## 五步主线

| 步骤 | 阅读入口 | 产物 |
| --- | --- | --- |
| 1. 建题 | [8 元预算题](BENCHMARKS.md#1-建题从业务风险到-casejson) | 一道可执行的 Case 与三个 Judge |
| 2. 跑分 | [默认评测](#2-跑分) | Run 与结果目录 |
| 3. 定位失分 | [先看结果，再看 Trace](evaluation/README.md#3-定位失分) | Case、原句、证据、假设 |
| 4. 改 Agent | [三轮与任务文本](iterations/README.md#4-改-agent) | 一个可复核的 diff |
| 5. 再跑分 | [同条件对照](iterations/README.md#5-再跑分) | Case × Judge 对照表 |

质量主线只有三轮：[Baseline](iterations/00-baseline/README.md) → [看结果](iterations/01-result-focused/README.md) → [看 Trace](iterations/02-trace-focused/README.md)。Baseline 已有搜索、读正文和 DO 存储。

根目录保留三轮之后的继续改进：结构化 observations / subject / fit / constraint、按原文片段生成观察和更完整的追问规则。它不等于第 2 轮源码；复现比较必须进入对应的 `iterations/<轮次>/source/`。

## 从完整源码启动

从此目录执行，使用 Node 24.16.0、pnpm 12.8.1：

```bash
npm install -g @gea-ai/cli@0.2.261114-alpha.0
pnpm install --frozen-lockfile
pnpm type-check
pnpm test
```

SDK 与 Feishu Extension 固定在 `0.2.261114-alpha.0`，锁文件独立于 GEA monorepo。CLI/本地 Runtime 需要另外安装匹配版本；不要将 SDK 已安装等同于 Simulator 可以在任意旧 CLI 运行。`VALIDATION.md` 记录本次实际工具链。

### 配置 CR API key

当前 Agent、Judge 和 Simulator 统一使用 CR 模型 `creative-reasoning-1.5`；dev 和 Eval 显式选择 `modelSource: "local"`。在运行 CLI 的同一终端，通过本机凭据管理工具注入有该模型访问权限的 CR key。以下仅展示占位变量，真实 key 不要放进源码、提示词、终端历史或报告：

```bash
export CREATIVE_REASONING_API_KEY="<YOUR_CR_API_KEY>"
```

PowerShell 使用 `$env:CREATIVE_REASONING_API_KEY = "<YOUR_CR_API_KEY>"`。CLI 内置直连读取此变量，不读取 `CR_API_KEY` 别名；默认 CR 地址由 CLI 设置，不需要在 `gea.worker.json` 增加模型 key。普通启动使用内置配置。三轮已记录的候选批次另用显式 `evaluation/cr-local.catalog.json`，它会优先于内置配置，详见 [运行条件](iterations/REPRODUCING.md#工具链与批次)。完整说明见[模型选择与配置](https://musegea.com/developers/agent-models)。

`local` 表示 Agent 在本机运行并直接请求远端 CR。GEA 登录用于 Project、上传结果等平台操作，Exa Connection 用于搜索；CR key、`GEA_API_KEY` 和 Exa key 各自独立。模型 key 不发给前端，不随 Agent 打包上传。缺 key、无模型权限或直连错误会报错；修正配置后重启 dev。

按教程完成 GEA 登录与 Workspace 选择，再单独授权 Exa 搜索 Connection：

```bash
gea agent connect --json '{"cwd":".","connectorKey":"research-search"}'
gea agent validate --json '{"cwd":"."}'
pnpm prepare:local
pnpm dev
```

搜索使用 Exa，Connector key 为 `research-search`。通过本机授权流程配置 API key；本地运行可在当前进程设置 `GEA_CONNECTOR_RESEARCH_SEARCH_API_KEY` 为已授权的 Exa key；它供 Connector 读取，不创建持久化 Connection。不要把 key 写进源码或命令参数。返回有长度上限的网页文本，缺失和截断会明确标记。三轮统一使用 Exa。

搜索每次最多返回3页、每页600字符预览，供选择来源。`read_source` 按完整URL读取最多12000字符的提取文本，每次展示2000字符；可用`query`定位原句或按`nextOffset`继续。`queryFound:false`只表示当前提取未找到，`nextOffset:null`也不保证网页全文已读完；仍须检查`extractionTruncated`。原文窗口始终保留对应URL和范围，不能把其他页面的事实配到这个链接。

工作台阶段的搜索/正文结果包含同一对话内的 `sourceId` 与 `passages[{passageId,text}]`。`save_research` 接收结构化 `observations`：用 `subject` 点名本条讨论的具体产品、组合或行为，选择来源及原文片段 `quoteId`，再针对用户条件填写 `fit` 与直接依据 `constraintEvidenceId`；缺乏条件依据必须保持 `unknown`。一份短简报选择最多4条关键观察；`hypotheses` 最多2个，以`basedOn`中的观察序号（从1开始）指向本简报已收录的证据，单独记录待验证问题、验证对象/动作、指标和放弃条件，`gaps` 记录本次资料缺口。工具从已捕获片段生成原文和规范 URL，不让模型重抄长链接或引文；未知、跨来源、跨对话标识均拒绝。身份与原文校验不等于事实相关性或适配语义已验证，仍需严格 Judge 与来源核对。

保存记录继续提供 `report` 和 `sources` 给工作台，保留片段标识供追问复用；最终交付采用生成的简报。

第二个终端进入此目录，将 dev 输出的两个 origin 和 key 文件路径交给配置脚本：

```bash
node scripts/configure-app.mjs \
  --api-origin http://127.0.0.1:REPLACE_API_PORT \
  --worker-origin http://127.0.0.1:REPLACE_WORKER_PORT \
  --api-key-file /absolute/path/from/agent-dev-output
pnpm app
```

打开 `http://127.0.0.1:4317`。前端通过 Node 后端调用 Agents API，Worker 数据接口通过单独的 server-only token 读取 DO。配置脚本和本地凭据都在 `.gea/`，不提交或录屏。

工作台仅绑定回环地址，供本机操作者查看当前演示 Worker 的研究记录。它没有个人用户隔离，不得直接作为多租户门户部署。Agent 的存储 Tool 只能访问自己的 Session 记录；后端读取 token 则能读取该示例 DO 中最近 100 条记录，故仅在演示项目里使用公开研究内容。

## 2. 跑分

先完成 CR 与 Exa 配置。在所选轮次的 `source/` 中，默认只执行同一组四题。当前已记录的候选批次另需 [相同本地工具链与 SDK](iterations/runtime-candidate.json)；公开 npm 版本对应失败的首次批次，不能替代候选验收：

```bash
gea agent eval --json '{"benchmarkPath":"benchmarks/single-turn","caseIds":["breakfast-scope","budget-ceiling","counter-evidence","validation-plan"],"modelSource":"local","executeOnly":true,"concurrency":2,"overrides":{"engine":{"maxSteps":16,"timeout":{"totalMs":240000}}}}'
```

保存命令返回的 `resultDirectory`（默认位于本项目 `.gea/` 下；指定 `outDir` 时以返回路径为准）。其中 `run.json` 记录运行身份，`executions/` 保存逐题回答和 Trace。然后对同一目录评分：

```bash
gea eval judge --json '{"run":"/absolute/path/from/resultDirectory","judgeSource":"snapshot","judgeModel":"creative-reasoning-1.5","modelSource":"local","concurrency":2,"maxSteps":12,"timeoutMs":300000}'
```

执行完成、评分完成、质量通过分别记录。退出成功或 `completed` 不等于通过；三项有效 1 分才算单轮通过，执行错误、Judge 错误和缺失评分不补成 0。分享版导出及错误分流见 [定位失分](evaluation/README.md)。

[多轮示例](BENCHMARKS.md#多轮意图识别与追加条件)用同样参数单独执行 `benchmarks/multi-turn` 的 `clarify-breakfast`，再对其结果目录评分。Simulator done 仅表示停止；coverage 与 conversation 都通过才算完整场景通过。其余题集未执行时明确记为未覆盖。当前 CLI 的单轮上传和多轮支持边界见 [验收记录](VALIDATION.md)。

## 文件对应

| 路径                                          | 作用                                                 |
| --------------------------------------------- | ---------------------------------------------------- |
| `agent.ts` / `instructions.ts`                | 显式注册能力与研究行为；没有 Computer                |
| `connectors/search.ts`                        | 声明 Exa API 和 Connection 认证                        |
| `tools/search-sources.ts` / `lib/evidence.ts` | 固定查询入口、响应校验、搜索摘录、数据边界与截断标记 |
| `tools/research-record.ts`                    | 根据受信 Session ID 读写研究                         |
| `durable-objects/research-store.ts`           | 异步 KV 保存研究记录，支持更新与列表                  |
| `worker.ts` / `gea.worker.json`               | Agent 与共享业务 DO，以及受 token 保护的读取 API     |
| `benchmarks/single-turn`                      | 范围、证据、推断边界                                 |
| `benchmarks/multi-turn`                       | 澄清、条件保留、追加要求与交付                       |
| `app/`                                        | 本地前端和 Node 后端，不包含真实凭据                 |
| `tests/`                                      | 搜索失败/证据边界、记录隔离与更新、本地后端访问边界     |

## 修改与复现

更新后执行 `pnpm type-check`、`pnpm test`，以及匹配 CLI 的 `gea agent validate --json '{"cwd":"."}'` / `gea agent pack --json '{"cwd":"."}'`。

本仓库只依赖公开 npm 包，标准安装不需要 GEA 私有源码。分享或复制项目时，不要包含 `.gea/`、凭据、构建产物或依赖。

后续只询问解释、取舍或引用核对时，直接回答所问部分，不重复生成整份报告。更新简报时复用同一会话的来源标识和片段；读取记录的模型视图不重复发送已经包含在report中的摘录，工作台保存的完整记录不变。

预算题后续三次尝试及残余质量问题见[独立记录](iterations/02-trace-focused/README.md#预算题后续尝试)，不与首批三轮分数混算。
