# 本次 Exa 运行的环境与评分问题

这些记录用于区分 Agent 质量与运行环境故障，不计入质量提升。

## Exa Connection 与本地 HTTP 路径

使用用户提供的本机 Exa 凭据，已通过本地 Connection API 保存授权。凭据不进入源码、快照或本报告。也验证了 CLI 支持的 Connector 环境变量路径，结果相同。

发布版 `@gea-ai/cli@0.2.261114-alpha.0` 的首次尝试 `f657e2fb-2173-44d2-9728-685f0c1fc7aa` 在 Connector 请求处失败，之后取消；它不是有意义的质量 baseline。DO 读取和模型调用正常，Worker 记录等待平台响应头 120 秒超时。直接使用同一 Exa 请求，Python、Node 和 Bun 原生 fetch 能返回真实正文；启用 CLI 的 HTTP 初始化后，Bun 下 POST 请求出现卡住。该定位限于本机环境，不声称 Exa 服务整体故障。

为继续检验 Agent，正式 00–03 均使用同一未修改的 GEA 源码 CLI，经 Node 24.16.0 + jiti 启动，并指定 npm 已发布的 App Server、Worker Runtime 和 system-workers。源码提交和完整条件见 protocol。预检 `32554d66-60fa-4c1a-992c-6b83c86f3248` 已取得真实 Exa 正文，但其 90 秒预算不足；正式各轮统一使用 240 秒预算。

临时诊断日志已从 GEA 源码恢复。此工作没有修改共享 CLI 的网络实现，也没有声称发布版 CLI 的问题已修复。正式各轮的 Agent、SDK、工具及 Exa 调用均为真实执行，没有替换搜索结果或模拟成功。

## Judge 的有效结果与失败

00 的执行完整，但 12 项评分只有 3 项合法完成，9 项是 error。部分提交把 `status` 的标签混进 reason，未形成合法提交。分析文字不是有效分数，不能手工补齐 status 后冒充自动通过。

另一次用 `gea-fast` 的单项重评分探查使用发布版 CLI，任务 `4df17e0f-b629-41b1-aaf9-e3d4bbf8b943` 未取得有效判分；取消请求超时，随后终止了独占该探查的本地 Host。命令退出 1，评分文件仍为 running，按未完成保留，不进入跨版本比较。没有用它替代原评分，也没有改变主线的 Judge 模型。

01 的预算题 evidence 自动给 1，但理由承认引用错配；Codex 逐项复核不同意该宽松解释。原分数保留，争议单列。若之后校准 Judge，必须统一重评所有版本，不能只给新 Agent 换更宽松的裁判。

## 维护者复现本次 Node 运行器

需要已有 GEA 源码 checkout，固定到 protocol 中的提交并完成仓库依赖安装；不要在有未提交工作的 checkout 中切换提交。以下是本次 macOS arm64 路径，其他平台不在此次验证范围。进入要评测的完整快照目录，先配置该项目的本机 Exa Connection，再运行：

```bash
export GEA_SOURCE_ROOT=/absolute/path/to/gea-at-recorded-commit
export GEA_PUBLISHED_ROOT="$(npm root -g)/@gea-ai/cli/node_modules/@gea-ai/cli-darwin-arm64"
export GEA_APP_SERVER_BINARY="$GEA_PUBLISHED_ROOT/gea-app-server"
export GEA_WORKER_RUNTIME_BINARY="$GEA_PUBLISHED_ROOT/gea-worker-runtime"
export WORKER_RUNTIME_SYSTEM_WORKER_ROOT="$GEA_PUBLISHED_ROOT/system-workers"

node "$GEA_SOURCE_ROOT/packages/gea-cli/node_modules/jiti/lib/jiti-cli.mjs" \
  "$GEA_SOURCE_ROOT/packages/gea-cli/src/bin.ts" agent eval --json \
  '{"cwd":".","benchmarkPath":"benchmarks/single-turn","caseIds":["breakfast-scope","budget-ceiling","counter-evidence","validation-plan"],"modelSource":"hosted","judgeModel":"gea-pro","concurrency":2,"overrides":{"engine":{"maxSteps":16,"timeout":{"totalMs":240000}}}}'
```

这只是与已记录实验保持一致的维护者复现方式，不是要求普通 Quick Start 用户依赖 GEA 源码。不要复用其他项目的 .gea 或把本机凭据复制进快照。本次正式轮次使用独立项目目录和新 Session；历史 Run 的研究记录没有注入新 Case。
