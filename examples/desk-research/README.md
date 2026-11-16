# 产品创新 Desk Research：早餐产品机会

这是可独立运行的完整 Desk Research 示例；Quick Start 则面向 coding agent，从空项目自行构建，两者不互相依赖。任务是研究上班族早餐的使用场景、困难与已有方案，输出带来源的机会简报，并区分观察、推断和待验证假设。

- [Coding Agent Quick Start](./QUICKSTART.md)：从创建 Project 开始的官方 walkthrough。
- [验收记录](./VALIDATION.md)：已执行的本地检查与尚未完成的真实验收。
- [English tutorial](./QUICKSTART.en.md)。
- [18 道题与验收标准](./BENCHMARKS.md)。
- [质量迭代记录](./iterations/README.md)：源码快照、固定题集、真实结果与改动说明。
- [阶段版本与 coding agent 升级任务](./versions/README.md)：生成三个独立项目，用同一套 Benchmark 比较。

当前源码对应 Exa 质量主线的 [03 版本](iterations/03-scoped-inference/README.md)。历史快照与实际结果用于展示从失败中迭代；研究结论由运行时检索产生。环境问题、未完成评分与已知质量缺陷在验收记录中单列。

## 从完整源码启动

从此目录执行，使用 Node 24.16.0、pnpm 12.8.1：

```bash
npm install -g @gea-ai/cli@0.2.261114-alpha.0
pnpm install --frozen-lockfile
pnpm type-check
pnpm test
```

SDK 与 Feishu Extension 固定在 `0.2.261114-alpha.0`，锁文件独立于 GEA monorepo。CLI/本地 Runtime 需要另外安装匹配版本；不要将 SDK 已安装等同于 Simulator 可以在任意旧 CLI 运行。`VALIDATION.md` 记录本次实际工具链。

按教程完成 GEA 登录与 Workspace 选择、确认 `gea-pro` 可用，授权 Exa 搜索 Connection：

```bash
gea agent connect --json '{"cwd":".","connectorKey":"research-search"}'
gea agent validate --json '{"cwd":"."}'
pnpm prepare:local
pnpm dev
```

搜索使用 Exa，Connector key 为 `research-search`。通过本机授权流程配置 API key；单独设置环境变量不会创建 Connection。返回有长度上限的网页文本，缺失和截断会明确标记。新的质量迭代从 Exa baseline 开始；早期 social-search 与功能接入记录放在 `iterations/history/`，不参与新分数比较。

搜索每次最多返回3页、每页600字符预览，供选择来源。`read_source` 按完整URL读取最多12000字符的提取文本，每次展示2000字符；可用`query`定位原句或按`nextOffset`继续。`queryFound:false`只表示当前提取未找到，`nextOffset:null`也不保证网页全文已读完；仍须检查`extractionTruncated`。原文窗口始终保留对应URL和范围，不能把其他页面的事实配到这个链接。

工作台阶段的搜索/正文结果包含同一对话内的 `sourceId` 与 `passages[{passageId,text}]`。`save_research` 接收结构化 `observations`：用 `subject` 点名本条讨论的具体产品、组合或行为，选择来源及原文片段 `quoteId`，再针对用户条件填写 `fit` 与直接依据 `constraintEvidenceId`；缺乏条件依据必须保持 `unknown`。一份短简报选择最多4条关键观察；`hypotheses` 最多2个，以`basedOn`中的观察序号（从1开始）指向本简报已收录的证据，单独记录待验证问题、验证对象/动作、指标和放弃条件，`gaps` 记录本次资料缺口。工具从已捕获片段生成原文和规范 URL，不让模型重抄长链接或引文；未知、跨来源、跨对话标识均拒绝。身份与原文校验不等于事实相关性或适配语义已验证，仍需严格 Judge 与来源核对。

保存记录继续提供 `report` 和 `sources` 给工作台，保留片段标识供追问复用；最终交付采用生成的简报。只读 v1 没有研究存储，仍返回有界原文文本，不提供保存能力。


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

## 评测

```bash
gea agent eval --json '{"cwd":".","benchmarkPath":"benchmarks/single-turn","modelSource":"hosted","judgeModel":"gea-pro","concurrency":1}'
gea agent eval --json '{"cwd":".","benchmarkPath":"benchmarks/multi-turn","modelSource":"hosted","judgeModel":"gea-pro","concurrency":1}'
```

第一条是 12 Case × 3 Markdown Judge，第二条是 6 个 Simulator Case × 2 个 Judge（coverage 与 conversation）。每题的 `maxTurns` 包含首条用户消息；Simulator done 不是 Judge 通过。

两套 Benchmark 保持分开。单轮结果可以按教程推到 Studio 做 Trace Annotation；当前基线明确拒绝发布 Simulator Benchmark 与上传多轮结果，不通过删字段绕过。

修改模型时同时修改 `agent.ts`、多轮 Case 的 `simulator.model` 和命令里的 `judgeModel`。修改质量标准需要记录新的 Benchmark Snapshot，不能和仅修改 Agent 的回归混为一谈。

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

示例默认不启用飞书，避免普通本地启动要求 Channel 凭据。按[飞书接入说明](./FEISHU.md)生成 `v3-feishu`，或在当前项目挂载官方 Channel；保留原有研究能力。Preview 推送、真实飞书操作和生产发布是独立步骤，本地校验不会执行这些动作。

## 修改与复现

更新后执行 `pnpm type-check`、`pnpm test`，以及匹配 CLI 的 `gea agent validate --json '{"cwd":"."}'` / `gea agent pack --json '{"cwd":"."}'`。

本仓库只依赖公开 npm 包，标准安装不需要 GEA 私有源码。版本生成器仅复制源码与固定题集，不复制 `.gea/`、凭据、构建产物或依赖；不会覆盖已有目录。

后续只询问解释、取舍或引用核对时，直接回答所问部分，不重复生成整份报告。更新简报时复用同一会话的来源标识和片段；读取记录的模型视图不重复发送已经包含在report中的摘录，工作台保存的完整记录不变。
