# 同一个研究助手的三个阶段

业务任务始终是“上班族早餐产品机会研究”。三个阶段共用原始单轮 / 多轮 Cases 和 Judges；功能增加本身不代表质量变好。根目录是完整工作台版本，飞书按 Quick Start 挂载；`v3-feishu` 已预先完成挂载。

| 阶段         | 能力                                                | 适合展示                                  |
| ------------ | --------------------------------------------------- | ----------------------------------------- |
| v1-research  | 搜索 Connector、证据处理、研究简报、单轮 / 多轮题集 | 一个小 Agent 和第一条评测基线             |
| v2-workbench | 增加共享 DO、Session 读写与本地前端                 | coding agent 增加业务能力，原题集检查退化 |
| v3-feishu    | 在 v2 上挂载飞书 Channel，复用同一 DO               | 新入口接入、消息和存储链路验收            |

v1 已要求引用支持和区分假设；不会故意删掉正确约束制造“升级效果”。Annotation 驱动的质量修复发生在任一阶段，用实际失败和前后 Eval 说明。

## 生成独立项目

在 `examples/desk-research` 执行；目标的父目录必须存在，目标目录必须不存在：

```bash
node scripts/materialize.mjs v1-research ../breakfast-v1
node scripts/materialize.mjs v2-workbench ../breakfast-v2
node scripts/materialize.mjs v3-feishu ../breakfast-v3
```

每个生成目录都有独立 package 与锁文件，执行：

```bash
pnpm install --frozen-lockfile
pnpm type-check
pnpm test
gea agent validate --json '{"cwd":"."}'
gea agent pack --json '{"cwd":"."}'
```

生成器拒绝已有目标，避免覆盖 coding agent 的修改。它不复制登录、搜索授权、环境变量、运行结果或依赖。各项目按 Quick Start 配置登录和 Connection；v2/v3 先 `pnpm prepare:local` 再 `pnpm dev`。v3 还需飞书测试机器人配置。v1 没有工作台，用 Eval 或本地 Agents API 验证，不运行 v2 的 app 命令。

## 演示 coding agent 升级

先生成 v1，运行单轮与多轮 Eval，保存原始结果。另生成 v2/v3 仅作为验收参考；让 coding agent 在自己的 v1 项目中实际实现升级，而不是展示一次文件覆盖。

给 coding agent 的 v1 → v2 任务：

```text
保持早餐研究任务、Connector key、Agent key、模型、Cases 和 Judges 不变。
增加 ResearchStore 业务 DO；Tool 以可信 Session ID 读写，不接受模型选择其他 Session。
在同一 Worker 增加受服务端 token 保护的研究读取接口，默认拒绝访问。
用本地 Node 后端连接 Agents API，前端支持新对话、追问、消息刷新、研究记录与来源。
凭据留在后端；明确这是本机单操作者工作台。
验证更新后刷新仍可读、不同 Session 不互相覆盖、浏览器不会得到 key。
重跑原单轮/多轮 Benchmark，报告真实结果和退化，不修改 Judge 来追求涨分。
```

v2 → v3：

```text
挂载官方 Feishu Channel，保留当前 Agent 的 tools、instructions 与 connectors。
禁用不需要的飞书业务 Connector/Skill；显式 Worker 声明 geaWorkerRoutes。
使用独立测试机器人、发送者 allowlist；配置缺失时不要放开访问。
验证飞书追问能更新记录，工作台能读到同一 Worker 的记录。
再次运行固定 Benchmark。分开报告评测结果与真实飞书链路验收。
```

## 展示 Evals 驱动的质量改进

1. 从实际 Trace 添加一条纠错，导出 Annotation；若没有失败就如实说明，扩充有代表性的难题。
2. 让 coding agent 根据证据诊断并修改一个问题。既可能改 instructions，也可能改搜索、解析或来源保留。
3. 原题集可覆盖时保持 Snapshot 不变；新增题目时先让旧 Agent 跑新题集。
4. 固定模型与配置，重跑后同时展示改善、退化、错误和证据变化。搜索结果漂移要单独说明。

每次记录：阶段、源码 commit / diff、Agent 版本、Benchmark Snapshot、模型、配置差异、Run ID / 结果目录、逐题质量与失败原因。没有真实运行之前不填写分数。

后续三个专题沿用这个过程：多轮看对话决策；RAG 看检索与引用支持；多模态看真实媒体中的证据和时间 / 区域定位。后两者需要各自可审查的资料与 Case，不把这里的网页搜索包装成已完成的 RAG 或多模态验收。
