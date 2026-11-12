# Phase 2：生产部署与实跑计划（未执行）

本文仅供另行授权后的操作者执行。Phase 1 没有登录或访问生产，没有部署、发版、打 tag、发布 npm 或写看板。

## 前置条件与明确阻塞

1. gea 负责人确认目标环境已部署包含 #1109 的 v0.67.0 实现、迁移 `0110_benchmark_workers`、Graphile Benchmark 队列和支持 Worker DO namespace 的 Runtime。旧开发版 0110 不可直接当成最终迁移。确认使用的源码提交与服务端契约兼容。
2. 用户/环境负责人提供：生产 `BASE_URL`、组织 `ORG_SLUG`、工作区 `WORKSPACE_SLUG`、专用 Project 的 slug/UUID、组织工作区作用域的完整 `RPC_BASE_URL`（不是猜测的公共 `/api`）、批准的唯一 `WORKER_NAME`。不得沿用默认工作区或现有业务 Worker 名。
3. 部署者有该 Project 编辑权限和有效登录会话。上传/登记需要会话；运行与读取可用同一会话或具备 `benchmarks.read/write` 的用户 PAT，仍受 Project 权限限制。不需要模型密钥。凭据只由操作者通过标准登录或权限为 0600 的 curl 配置提供，不放进命令参数、Git、报告或日志。本阶段不读取或准备任何实际凭据。
4. **自定义可视化在 GEA 内嵌展示尚不可验收**：当前源码明确移除了 HTML/App handler，只有 JSON 结果。需要 gea 先提供受支持的展示接口，或用户明确接受导出报告作为最终展示。不要虚构 visualization 注册命令，也不要把 `visualization` 字段当平台协议。
5. npm 最低兼容版本尚未确定；公开 `0.1.261102-alpha.2` 缺少 `benchmark-app`。Phase 2 必须使用下面的源码构建 SDK/CLI，不能只装同版本 npm 包。

## 构建与本地门禁

完整执行 README 的“Run with source-built SDK and CLI”：从指定提交 archive 到新的隔离目录，安装、构建 SDK/Contract、pack 两个 tarball、在 scratch example 的 YAML 写本地 overrides；提交文件不变。Node 24.16.0、pnpm 12.8.1。保存 source SHA、CLI 版本、bundle/snapshot hash。

CLI 本身不包含运行 `worker validate/deploy` 所需的完整 App Server。macOS arm64 在隔离源码目录构建正式源码 toolchain（本地编译，不发布 npm）：

```sh
corepack pnpm@12.8.1 --dir "$GEA_SOURCE/packages/gea-cli" build:toolchain
# 该命令构建 Runtime、sandboxd、App Server、CLI，组装并输出 GEA-Toolchain 路径。
# 使用输出目录内的 gea-darwin-arm64；先核对实际目录内容和 --version，不使用全局 npm gea。
export GEA_CLI=/absolute/path/to/output/GEA-Toolchain-VERSION-HASH/gea-darwin-arm64
"$GEA_CLI" --version
cd "$SCRATCH/example"
corepack pnpm@12.8.1 type-check
corepack pnpm@12.8.1 test
# dist/bundle 必须是新目录；只移走本示例已有的生成产物后重新 build。
corepack pnpm@12.8.1 build
"$GEA_CLI" worker validate --json '{}'
```

`build:toolchain` 内部执行 pnpm；应让当前 PATH 中 pnpm 对应该源码锁定的 12.8.1。源码 toolchain 构建需要 Apple Silicon、Xcode 工具链及 Rust 1.94.1。若输出结构变化，以 `gea-toolchain.json` 和源码打包脚本为准，先检查再继续。Phase 1 的单独 CLI 验证因缺 App Server 停止，完整 toolchain 路径尚未实测。

运行 `dev` 和 `verify:local`，确认 12/12 Case，两个算法、全量评分、子集重评、分页、重启持久化全部通过。原生本地流程不需要生产凭据。

## 部署与登记（以下命令本轮未执行）

操作者完成授权后才执行：

```sh
umask 077
jq -n --arg baseUrl "$BASE_URL" --arg orgSlug "$ORG_SLUG" --arg workspaceSlug "$WORKSPACE_SLUG" \
  '{baseUrl:$baseUrl,orgSlug:$orgSlug,workspaceSlug:$workspaceSlug}' > .local/login-target.json
"$GEA_CLI" login --json-file .local/login-target.json
jq -n --arg project "$PROJECT_SLUG" --arg name "$WORKER_NAME" \
  '{project:$project,name:$name}' > .local/deploy-input.json
"$GEA_CLI" worker deploy --json-file .local/deploy-input.json > .local/deployment.json
```

此命令上传 generic Worker 到 Project Preview；Benchmark 运行选择已登记的最新 ready 部署，不需要为了 Benchmark 发布 Agent 或调用 legacy Eval。检查返回状态、workerId/deploymentId 和 Worker 名。`gea.worker.json` 只打包 `dist/worker`；`dist/registration.json` 的 snapshotPath 与 generic CLI 的路径 `dist/worker/snapshot.json` 对齐。不要把源码 builder 的 `upload.json` 当作 generic CLI 配置直接使用。

平台没有 Benchmark Worker 专用 CLI 命令。以下 `rpc` 函数使用已有 ORPC envelope。`SESSION_CURL_CONFIG` 由操作者安全提供，含该组织/工作区有效会话认证及所需请求头；不得使用 `curl -v` 或打印配置。登记是会话接口，不能假定 PAT 可登记。

```sh
rpc() {
  curl --fail --silent --show-error --config "$SESSION_CURL_CONFIG" \
    -H 'Content-Type: application/json' \
    --data-binary "@$2" "$RPC_BASE_URL/benchmarks/$1" | jq -e '.json'
}
# CLI 输出必须先核验为 WorkerDeploymentRecord；不匹配时停止，不猜 ID。
jq --slurpfile deployed .local/deployment.json \
  '. + {workerId:$deployed[0].workerId,deploymentId:$deployed[0].deploymentId} | {json:.}' \
  dist/registration.json > .local/register-input.json
rpc register .local/register-input.json > .local/registration-receipt.json
export BENCHMARK_ID=$(jq -er '.id' .local/registration-receipt.json)
```

不要在 CLI 输出格式未核实或部署尚未 ready 时继续。通用上传失败可按平台状态恢复；登记失败不代表通用部署不存在。同部署登记幂等，修正原因后重试；保留两个 ID。

## Snapshot → 执行任务 → 评分任务

Snapshot 已由 build 生成并随 Worker 上传，在 register 时校验。此旁路未写入旧 Studio 的 Benchmark/Eval 表；下列 bench/judge task 是本例的执行/评测回执，不能用 `gea benchmark push` 或 `gea eval run` 替代。

```sh
# 固定 requestId 保存到文件；请求结果不明确时原样重试，禁止每次重新生成 UUID。
jq -n --arg id "$BENCHMARK_ID" --arg requestId "$(uuidgen | tr '[:upper:]' '[:lower:]')" \
  '{json:{benchmarkId:$id,requestId:$requestId,parameters:{algorithm:"bm25",k:3},concurrency:2}}' > .local/bench-input.json
rpc startBench .local/bench-input.json > .local/bench-receipt.json
export BENCH_TASK=$(jq -er '.id' .local/bench-receipt.json)
jq -n --arg id "$BENCHMARK_ID" --arg task "$BENCH_TASK" \
  '{json:{benchmarkId:$id,taskId:$task}}' > .local/task-input.json
rpc getTask .local/task-input.json > .local/task-status.json
```

每秒轮询 `getTask`，最多 5 分钟。completed 才读取/评分；failed/cancelled/interrupted 立即停止并保留证据；超时不自动新建任务。completed 只说明批次结束，还要核对每条 execution.status。

```sh
# 本 fixture 最多 12 条，limit 100 可一页读完；仍检查 nextCursor 为 null。
jq '.json.limit=100' .local/task-input.json > .local/results-input.json
rpc getResults .local/results-input.json > .local/executions-page.json
jq -e '.kind=="bench" and .nextCursor==null and (.items|length)==12 and all(.items[];.status=="completed")' .local/executions-page.json
jq -n --arg id "$BENCHMARK_ID" --arg source "$BENCH_TASK" \
  --arg requestId "$(uuidgen | tr '[:upper:]' '[:lower:]')" --slurpfile page .local/executions-page.json \
  '{json:{benchmarkId:$id,sourceRunId:$source,requestId:$requestId,executionIds:[$page[0].items[].id]}}' > .local/judge-input.json
rpc startJudge .local/judge-input.json > .local/judge-receipt.json
```

对 Judge ID 重复 getTask/getResults 流程，保存 `.local/judgments-page.json`：应为 13 个 judgment（12 行 + 1 汇总）。首个请求不传 cursor；后续分页用上页 nextCursor，直到 null。重评前两条：复制 judge-input，只保留前两个 executionIds，换新 requestId；应产生 3 个 judgment，Bench 原结果不变。再用 overlap 重复整个流程，不跨 Bench run 混合 executionIds。

导出每个算法的报告输入，两个算法对象合并成数组后运行自定义报告：

```sh
jq -n --slurpfile bench .local/bench-receipt.json --slurpfile ep .local/executions-page.json \
  --slurpfile jp .local/judgments-page.json \
  '{algorithm:"bm25",bench:$bench[0],executions:$ep[0].items,judgments:$jp[0].items}' > .local/bm25-report.json
# overlap 流程同样输出 .local/overlap-report.json，algorithm 改为 overlap。
jq -s '.' .local/overlap-report.json .local/bm25-report.json > dist/results.json
corepack pnpm@12.8.1 report dist/results.json dist/report.html
```

## 验收与回滚/清理

- 记录源码 SHA、部署 ID、Benchmark ID、snapshot hash、每次 requestId/taskId；无 secret。
- 12 条输入已在 snapshot 中，Worker/DO 真实执行持久化；24 个成功执行、两套 13 行评分、两套子集重评。基线 Recall/MRR/nDCG=1；BM25 约 0.972222/1/0.980447。差异不是任务失败。
- 跨部署保留版本的结果仍可读，重评不重跑 Bench；重复相同提交不会产生新任务。
- 报告中的标题、排名、指标对应真实导出 JSON，恶意文本被转义。导出 HTML 展示可验收；GEA 内自定义展示需先补齐上游接口，不能标记已通过。
- 取消：构造 `{json:{benchmarkId,taskId}}` 调用 `benchmarks.cancelTask`，确认终态。先停止活动任务再清理资源。
- 代码回滚必须考虑登记：新 Bench 选择最新已登记 ready 版本，单纯切换通用 Worker 的 Preview/Production 并不能保证回滚 Benchmark。必要时重新上传已验收代码并 register 成新部署，再做本例全量验证；DO namespace 不变，旧结果不随代码回滚删除。
- 清理使用 GEA 标准 Worker/Project 删除生命周期，仅删除这次专用资源，须操作者确认数据留存需求。当前没有可靠的 Benchmark Worker 删除 CLI 命令，不编造命令。删除可能级联清理旁路记录，先导出所需证据。
- 停止本例本地进程，清理本例 scratch/state 和凭据临时文件；不动其他工程、共享 checkout 或其它终端标签页。
