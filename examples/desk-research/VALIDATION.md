# 验收记录

源码、实际运行、自动质量评分和仓库发布状态分别记录。

## 2026-11-15 仓库更新

当前 CLI、SDK、Feishu 包更新为 npm registry 最新 `0.2.261114-alpha.0`；npm 最新仍为 `12.2.2`。历史 00–04 快照保留原依赖与证据，不改写历史分数。

完整项目与三个重新生成阶段均完成 frozen install、类型检查及测试，分别为 11/5/9/9 项、0 跳过。发布工作流重复这些离线检查，并校验历史快照哈希；不在 CI 调用模型、Exa 或飞书。

Quick Start 面向 coding agent 独立开发，本完整示例增加独立的 [飞书接入说明](FEISHU.md)。仓库更新由 PR 合并记录证明；以下真实服务验收缺口仍然保留。

## 2026-11-14 工具链与本地检查（历史）

- CLI、SDK、Feishu 包：当时 npm latest `0.2.261113-alpha.0`。CLI 已实际升级并核对版本。npm `12.2.2`；Node `24.16.0`；pnpm `12.8.1`。
- 完整项目 frozen install、TypeScript 检查通过；11 项测试通过、0 跳过，覆盖来源解析与错误、详情链接与响应对应、后端访问边界、研究记录隔离/更新、阶段生成及拒绝覆盖。
- v1/v2/v3 重新生成后独立 frozen install、type-check、测试通过，分别 5/9/9 项、0 跳过。
- GEA 源码 `0324280477e4515587720583a8bce0bd354fcbd5` 的校验和打包通过；单轮 12 Cases × 3 Judges，多轮 6 Cases × 1 Judge。此前复制式 walkthrough 的初始化、Connector 和 Feishu 变体源码校验、打包通过；当前 Quick Start 已改为独立 coding-agent 任务，不以旧检查代替新流程的端到端验收。
- GEA 文档集合构建为 42 篇。源码检查使用维护者 checkout 的校验器；OpenGEA 的正常安装、测试和真实 Eval 使用公开 npm 依赖。
- 五份源码快照逐文件 SHA-256 验证通过，Benchmark 摘要一致。详见 [版本与实际结果](./iterations/README.md)。

## 历史探索实际运行（social-search，非 Exa 基线）

- social-search 真实搜索返回笔记，详情接口真实返回同一来源的 367 字文本。模型轻量预检真实返回 READY、Eval completed、CLI 退出 0。
- 00/01/02 在 v1 搜索阶段运行固定 4 单轮 + 2 多轮子集。逐题结果包含错误和未完成项，其余 12 题随后完成，02 合计 18 题为 13 通过、1 执行错误、4 Judge 错误。
- 基线多轮被 askUser 挂起；第一轮改版的两个 Simulator Case 实际完成并通过 Judge。完整分数与第二轮结果见迭代页。
- 原同步 SQL DO 的运行未完成。改用异步 KV 后，存储预检 `76acafa1-3297-48cd-ac31-63a8d3a9b373` 真实完成读空、保存、读回；完整项目 Run `ce5abf7f-dac9-485d-8467-903580d05b7b` 在预算题中完成 read_research、4 次搜索和 save_research，命令退出 0。后者 executeOnly，没有 Judge，不能记成质量通过。
- SQL 改 KV 不迁移旧 SQL 记录；用于本次全新的演示数据。单元存储夹具仅验证逻辑，真实浏览器已验证报告保存、6 个引用展示及刷新后恢复 2 条消息与 1 条研究记录；仍未证明跨进程重启或多用户隔离。

## 仍未完成

1. 用户本机配置 Exa Connection 后，以 04 源码建立新的 18 题 Exa 基线，以及 Judge 格式错误、证据读取错误、缺失评分的稳定完成；首次运行与重评分保留分别记录。
2. Builder Preview 的 Agent / 单轮 Benchmark / Eval 上传、Trace Annotation 创建及导出。当前 review-notes.json 是本地纠错，不是平台 Annotation。
3. 飞书测试机器人真实收发与追加条件；Exa 版本的完整工作台真实彩排。历史 social-search 浏览器验收已通过，不能代替 Exa 搜索验收。
4. GEA 网站的生产发布与 OpenGEA 仓库合并是独立操作；本仓库更新不代表平台已部署。

Simulator Benchmark 与多轮结果在当前源码仍拒绝托管发布/上传（hosted_multi_turn_not_supported），多轮演示使用本地路径。CI 只安装、类型检查和测试，不访问模型、搜索或飞书。原始运行证据保留在私有 .gea，分享版迭代结果不包含上游账户与访问参数。

当前源码和 Quick Start 已恢复 Exa；仅配置本机环境变量不会自动创建 GEA Connection，需使用 `gea agent connect` 授权。详见 [04 接入记录](iterations/04-exa-ready/README.md)。

Quick Start 的 coding-agent 任务现使用自行生成的 4 单轮 + 2 多轮小题集，与本完整示例的 18 题分别描述。文档命令、内链、JSON 与构建检查通过；尚未执行新的 coding-agent 从空项目到真实评测的完整验收。
