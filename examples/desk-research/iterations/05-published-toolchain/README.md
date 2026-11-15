# 05 — 仓库发布与工具链升级

2026-11-15，当前示例继续使用 Exa，SDK/Feishu 和公开 CLI 升级为 `0.2.261114-alpha.0`（当日 npm latest）。npm 为 `12.2.2`，Node 为 `24.16.0`，pnpm 为 `12.8.1`。

本轮是依赖与发布准备，不是新的质量优化实验。Agent 指令、搜索服务、18 道题与 Judges 保持不变；00–04 快照仍逐文件校验通过。更新的生成器指引指向完整示例 README 和独立飞书接入文档，不再依赖旧 Quick Start 章节。

## 实际验证

- 完整项目及 v1/v2/v3 重新生成项目均完成 frozen install、类型检查和测试：11/5/9/9 项，0 跳过。
- 全部四个项目使用已发布 CLI 的 `gea agent validate` 和 `gea agent pack` 通过，不依赖私有源码校验入口。
- 完整项目产物 18 文件；三个阶段分别 15/18/19 文件。v3 包含飞书 Channel。
- 本轮源码快照 63 文件，Benchmark SHA-256 与历史版本相同。

公开 CLI 的产物摘要见 [validation.json](results/validation.json)。仓库更新通过 [PR #33](https://github.com/bmrlab/opengea/pull/33)，其 CI 验证当前项目、生成阶段和快照完整性。

## 保留的验收边界

本轮没有重新执行模型或 Exa 搜索，没有新增质量分数。历史 social-search 结果不改写为 Exa 结果。正式 Exa 基线、平台 Annotation、飞书收发仍待真实验收；这些待办不因源码进入 main 而变成通过。
