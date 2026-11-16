# 验收记录

源码、实际运行、自动质量评分和仓库发布状态分别记录。

## 2026-11-16 R2续修终态：BLOCKED

已交付来源短预览/原文窗口、逐案例局限、逐来源引文组织和Judge能力声明修复；仍不能宣称00–03全绿或公开分发验收完成。03最新no-microwave仍把单一产品条件泛化成品类结论，inference=0；00最新定向题连续误写同一个长URL，保存守卫两次正确拒绝后Agent执行失败；旧矩阵中另有00的响应体流解码错误和02三次约15秒启动超时。原失败与后续结果分别保留。

| 批次 | 代码 / SDK | 通过 | 质量失败 | 评分不完整 | 执行失败 |
| --- | --- | ---: | ---: | ---: | ---: |
| [03 已失败四题](evaluation/results/r2-quality-four-share.json) | 60f9e1c / 5bd4093e | 4 | 0 | 0 | 0 |
| [03 其余八单轮](iterations/03-scoped-inference/r2-remaining-single-20261116.json) | 60f9e1c / 5bd4093e | 6 | 1 | 1 | 0 |
| [03 六多轮](iterations/03-scoped-inference/r2-multi-20261116.json) | 60f9e1c / 5bd4093e | 6 | 0 | 0 | 0 |
| [00 四开发题](iterations/00-exa-baseline/r2-results-20261116.json) | 60f9e1c / 5bd4093e | 3 | 0 | 1 | 0 |
| [01 四开发题](iterations/01-grounded-claims/r2-results-20261116.json) | 60f9e1c / 5bd4093e | 3 | 1 | 0 | 0 |
| [02 四开发题](iterations/02-focused-evidence/r2-results-20261116.json) | 60f9e1c / 5bd4093e | 1 | 0 | 3 | 0 |
| [原03 breakfast证据独立重评分](iterations/03-scoped-inference/r2-sdk-regrade-20261116.json) | 60f9e1c / f92f4f5357 | 0 | 1 | 0 | 0 |
| [00 新指令定向题](iterations/00-exa-baseline/r2-targeted-20261116.json) | d14bdb3 / f92f4f5357 | 0 | 0 | 0 | 1 |
| [01 新指令定向题](iterations/01-grounded-claims/r2-targeted-20261116.json) | d14bdb3 / f92f4f5357 | 2 | 0 | 0 | 0 |
| [02 新指令定向题](iterations/02-focused-evidence/r2-targeted-20261116.json) | d14bdb3 / f92f4f5357 | 1 | 0 | 0 | 0 |
| [03 新指令定向题](iterations/03-scoped-inference/r2-targeted-20261116.json) | d14bdb3 / f92f4f5357 | 1 | 1 | 0 | 0 |

03首轮12单轮合计10通过、1质量失败、1评分不完整，六多轮全部通过。新的定向题使用改过的Agent指令，并独立执行和评分；SDK重评分仅改变评测运行时，使用原回答。不能混成同一次全量实验，也不从旧evaluation补分。[机器可读摘要](evaluation/results/r2-final-summary.json)。本轮用已知失败开发修复，不声称盲测或独立泛化效果。

coverage规则、六个Case及固定夹具从126203c至d14bdb3逐文件一致。19个coverage固定正反例全部匹配，not_applicable=0、error=0；[原生校准摘要](evaluation/results/r2-coverage-summary.json)。合成对话校准与六道真实多轮验收分开记录。

gea #1362（f92f4f5357）仅在无Artifact时收紧模型可见readEvidence来源和指引，保留所有权/摘要验证和失败读取处理。真实重评分三项均正常完成，evidence仍严格判0并揭示旧回答引用错配，没有制造质量通过。原生执行错误仍跳过Judge。

工具链：候选CLI gea #1355 / 4015a5665，SHA-256 a2874ae7f24404b6cd0802cd4fbab17c1961f7d0bfdff11b57090e521b55d357；SDK/contract为5bd4093e本地包，定向批次SDK改用f92f4f5357且contract不变。均未发包、合并或部署，不能视为公开npm版本通过。模型、16步/240秒Agent预算及12步/300秒Judge预算保持不变。

本地验证：主示例与00–03各22项测试、三个生成阶段14/20/20项测试及类型检查通过；SDK57项测试、定向lint和全仓类型检查通过。新增SDK行为测试先红后绿。最早四题项目只有evaluation/README.md早于60f9e1c的文档补充，全部运行代码、Case和Judge一致；其余旧矩阵项目逐文件匹配60f9e1c，四个新定向项目逐文件匹配d14bdb3。

以下章节保留历史时点的事实，“仍未完成”列表属于原验收记录；当前R2以本节和新增独立结果为准。

## 2026-11-15 Exa 质量迭代

当前示例对应 [03：限制推断范围](iterations/03-scoped-inference/README.md)。新主线 00–03 从 Exa 开始，只修改研究 instructions；Cases/Judges、模型、Connector、工具、DO 和前端保持一致。旧的 00–05 在 history 中保留原始源码与哈希，不混入新分数。

每轮重跑同一组 4 个开发题；最终版本另选 2 个单轮与 2 个多轮做回归。18 题是完整题库，本次没有声称 18 题全部验证。逐题结果、完整报告与精简 trajectory 见 [iterations](iterations/README.md)，执行失败、评分失败、质量失败分别记录。

正式质量运行使用 Node 24.16.0 + jiti 启动同一未修改的 GEA CLI 源码，搭配已发布 `0.2.261114-alpha.0` 原生组件与 SDK。发布版 Bun CLI 的本机 Exa POST 超时尚未修复，不能把 Node 路径的成功说成发布版 CLI 端到端通过。详见 [预检记录](iterations/PREFLIGHT.md)。

完整项目类型检查、11 项测试通过；分享结果分析器的独立行为测试通过。三个新生成阶段完成 frozen install、类型检查与测试（5/9/9 项）。公开 CLI 的完整项目 validate 和 pack 通过；10 份新旧源码快照哈希全部校验通过。离线检查不代表所有研究结论正确。

## 2026-11-15 仓库更新（较早记录）

当前 CLI、SDK、Feishu 包更新为 npm registry 最新 `0.2.261114-alpha.0`；npm 最新仍为 `12.2.2`。历史 00–04 快照保留原依赖与证据，不改写历史分数。

完整项目与三个重新生成阶段均完成 frozen install、类型检查及测试，分别为 11/5/9/9 项、0 跳过。全部四个项目用公开 CLI 的 validate/pack 通过。新增 [05 快照](iterations/history/05-published-toolchain/README.md)，旧快照保持不变。发布工作流重复这些离线检查，并校验历史快照哈希；不在 CI 调用模型、Exa 或飞书。

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

1. 发布版 CLI 的本机 Exa POST 路径，以及 Judge 格式错误和宽松判分的可靠性问题。剩余 10 题未纳入本次 Exa 迭代的真实回归；本次首次结果与诊断尝试分别保留。
2. Builder Preview 的 Agent / 单轮 Benchmark / Eval 上传、Trace Annotation 创建及导出。当前 review-notes.json 是本地纠错，不是平台 Annotation。
3. 飞书测试机器人真实收发与追加条件；Exa 版本的完整工作台真实彩排。历史 social-search 浏览器验收已通过，不能代替 Exa 搜索验收。
4. GEA 网站的生产发布与 OpenGEA 仓库合并是独立操作；本仓库更新不代表平台已部署。

Simulator Benchmark 与多轮结果在当前源码仍拒绝托管发布/上传（hosted_multi_turn_not_supported），多轮演示使用本地路径。CI 只安装、类型检查和测试，不访问模型、搜索或飞书。原始运行证据保留在私有 .gea，分享版迭代结果不包含上游账户与访问参数。

当前源码和 Quick Start 已恢复 Exa；仅配置本机环境变量不会自动创建 GEA Connection，需使用 `gea agent connect` 授权。详见 [04 接入记录](iterations/history/04-exa-ready/README.md)。

Quick Start 的 coding-agent 任务现使用自行生成的 4 单轮 + 2 多轮小题集，与本完整示例的 18 题分别描述。文档命令、内链、JSON 与构建检查通过；尚未执行新的 coding-agent 从空项目到真实评测的完整验收。
