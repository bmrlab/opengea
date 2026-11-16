# Agent Builder Quick Start

完整教程以[开发者文档](https://musegea.com/developers/agent-builder-quick-start)为准，从创建 Project 开始，按步骤让 coding agent 实现、评测并迭代研究助手。

本仓库提供[可运行的完整项目](README.md)、[质量迭代记录](iterations/README.md)和[题集与评分标准](BENCHMARKS.md)。

本教程的本地模型调用使用 CR API key 直连：将 key 通过本机凭据管理工具注入 `CREATIVE_REASONING_API_KEY`，Agent、Judge 和 Simulator 使用 `creative-reasoning-1.5`，命令显式选择 `modelSource: "local"`。配置步骤见[启动说明](README.md#配置-cr-api-key)。
