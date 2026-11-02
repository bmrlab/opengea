# 2026-11-02 SDK alpha.1 示例验证

**升级与九个示例的本地静态/构建检查完成；飞书真实收发和完整 Channel 生命周期尚未验收。**
SDK 为发布包 `0.1.261102-alpha.1`。本地合成 Channel 的 HTTP 事件去重、WS 101/404
和帧 echo 已通过；使用的是含 #1100 的**非发布 CLI 构建**。本地 receiver 的
converge 请求仍返回 403，因此不能宣布跨部署 socket 保持、旧目标 409、matcher
授权引用负例已经在完整本地栈跑通。

本轮没有部署、访问 Preview/Production、发送真实飞书消息或读取飞书凭据。
[alpha.0 历史记录](VERIFICATION-261102.md) 中的 Preview 操作不属于本轮。

## 版本与改动

- 起点：`chore/sdk-261102-examples`，基线 `3a16283ea1890f6670ba723426aef6de49475be7`。
  保留上一轮改动；没有修改备份分支。`dump.rdb`、`runtime-perf*` 和生成产物不提交。
- 九个示例的 SDK、Contract、飞书扩展声明/锁文件/发布年龄精确例外均改为
  `0.1.261102-alpha.1`。直接依赖与实际安装版本逐一核对通过。
  示例没有直接声明另外四个已发布 SDK 包，不为凑包名新增依赖。
- **CLI pin 仍为 `0.2.261102-alpha.0`**，包括现有 manifest、lockfile、README。
  按任务约束不等待或升级尚未完成的 CLI 发布；alpha.0 不包含 #1100 的本地 WS 修复。
- 飞书使用官方扩展的显式 `transport: "websocket"` 与精确账号 matcher；不复制连接状态机。
  保留上一轮 HTTP fixture 的 `ctx.event` 迁移和 HTTP+matcher 拒绝测试。
- 本轮取出的 GEA `origin/main` 源码快照：
  `d678850e76e15433cc1483d27b2e173f2871d87c`，含 #1100（`384f8ac5d`）和
  #1102（`96cf2e0ec`）。未改动原 GEA checkout。
- Node `24.16.0`；各示例按自己的 `packageManager` 使用 pnpm。

## 九个示例的命令与结果

所有示例先执行 `pnpm install --no-frozen-lockfile`，迁移完成后移除旧 SDK 的临时
发布年龄例外，再执行 `pnpm install --frozen-lockfile`：**9/9 通过**。
下表中 validate/pack 使用发布 CLI alpha.0；环境和 App Server 状态隔离到临时目录，
托管入口指向不可用 loopback，没有使用现有登录配置。

| 示例 | type-check | test | build / validate / pack |
| --- | --- | --- | --- |
| feishu-channel | 通过 | 69 通过 | `build`、`agent:validate`、`agent:pack` 通过 |
| agents-api | 通过 | 2 通过 | `agent:validate`、`agent:pack` 通过 |
| basic | 通过 | 20 通过 | `build`、`agent:validate`、`agent:pack` 通过 |
| code-mode | 通过 | 1 通过；`test:package` 1 通过 | `mcp:build`、`agent:validate`、`agent:pack` 通过 |
| memory-agent | 通过 | 无 test 脚本 | `agent:validate`、`agent:pack` 通过 |
| oauth-app | build 后通过 | 59 通过、1 跳过 | `build`、`worker:validate`、`worker:pack` 通过 |
| observational-memory | 通过 | 11 通过 | `agent:validate`、`agent:pack` 通过 |
| subagent-limits | 通过 | 4 通过 | `agent:validate`、`agent:pack` 通过 |
| subagents | 通过 | 9 通过 | `agent:validate`、`agent:pack` 通过 |

表中每项均为在对应目录运行 `pnpm <脚本名>`。没有 build/test 脚本的示例不虚构检查。
OAuth 首次 `type-check` 报两个生成路由类型错误（`namespace-probe`）；`pnpm build`
生成 route tree 后，重新 `pnpm type-check` 退出 0，无源代码修补。
OAuth 的 59 项包含原生 Runtime/SQLite 集成测试；唯一跳过项是受
`GEA_VITE_OAUTH_E2E=1` 控制的 Vite OAuth E2E，未开启该 gate。
其他示例的模型驱动 `verify`、`compare`、`agent:eval` 没有执行，以上不代表真实模型验收。

复现飞书基本 gates（`GEA_CLI_BIN` 指向独立安装的 alpha.0）：

```sh
cd examples/feishu-channel
pnpm install --frozen-lockfile
pnpm type-check
pnpm test
pnpm agent:validate
pnpm agent:pack
```

归档 `dist/feishu-assistant-448d0b767807.gea-agent.zip`：

- SHA-256：`dbb75fc92932eeccf79ac427cf3526ea7b0ca70309a5f9c1a1856716ca7619a8`
- contentHash：`sha256:448d0b76780715ff513ace6efeb130067799572febfb4408f942c764415f3042`
- snapshotHash：`sha256:e8abc01a1e1b6d34d562a469a9790816b733cac183fcbad7a64833f15cf2ef10`
- 解压读取 `gea.agent-package.json`，确认 `workerManifest.requiredCapabilities` 包含
  `channel-connection-v1`、`channel-platform-user-matcher-v2`、
  `durable-object-application-namespace-v1`，不含 `channel-publication-v1`。

## #1102 matcher 投影回归：发布 SDK + 真实示例定义，离线

```sh
cd examples/feishu-channel
node scripts/reproduce-matcher-projection.mjs dist/feishu-assistant-448d0b767807.gea-agent.zip
```

退出 0。脚本加载本例实际 `agent.ts`（包括 matcher 与防授权链接回显包装）及新 pack
snapshot，调用发布 SDK 的真实 dispatch。`read_events`、`project_events` 分别在
TOOLS absent、denied、supported 三种替身环境下全部 HTTP 200；capabilityReads 均为 0。
`read_events` 返回 Session 替身事件；`project_events` 生成 advisory `reaction-add` intent。
旧 alpha.0 脚本中期望的 503 已改为回归断言。

这是 **6 个离线组合**，没有真实 Provider 网络请求、Host matcher 候选查询、Run 或持久化。
证明 #1102 的内部读取/投影不再错误依赖 admission capability；不证明真实表情已送达。
69 项示例单测另覆盖账号精确匹配、拒绝、消息解析、授权卡和文本投影保护。

## 本地 WS：源码 CLI + 发布 App Server/Runtime + 发布 SDK

CLI 从上述固定 `origin/main` 快照安装依赖并构建；最终使用 alpha.0 官方二进制中内嵌的
**Bun 1.3.14**，避免用系统 Bun 的成功替代原运行时回归。
CLI 自报 `0.2.261102-alpha.1`，但这只是源码版本字段，**不是 npm/CI 发布产物证明**。
本地 CLI SHA-256：`64d23741679e8f78095e2b7dffa0abb8d3fd10510c042cdd70ef0a9e11e451f2`。
App Server、Runtime、sandboxd、system-workers 和外置原生依赖取自独立安装的官方
`@gea-ai/cli-darwin-arm64@0.2.261102-alpha.0`，未修改二进制。
App Server SHA-256：`6c679b3575e21d533118d5663985610092cc4f3687d318017a3bdba10816f963`；
Runtime SHA-256：`03f55d5ce10e96cbd989aefde4362d5d6717731a5d936fe2fd5d88cdf38cdcd9`。

构建命令（`SOURCE` 为固定 SHA 的独立源码目录，`PUBLISHED` 为官方平台包目录）：

```sh
cd "$SOURCE"
pnpm install --frozen-lockfile
BUN_BE_BUN=1 GEA_CLI_BUN_NATIVE_TARGET=darwin-arm64 \
  "$PUBLISHED/gea-darwin-arm64" packages/gea-cli/scripts/build-executables.mjs darwin-arm64
# 将 PUBLISHED 的 gea-app-server、gea-worker-runtime、sandboxd、system-workers、
# node_modules 复制到 packages/gea-cli/dist；保留刚构建的 gea-darwin-arm64。
```

本地探针只继承 PATH/TMPDIR，自建 0700 临时项目、全新 SDK/SQLite 状态和合成 Channel，
不继承 GEA/飞书/模型凭据。Agents API 使用本地单用户模式 `GEA_LOCAL_API_AUTH=0`；
Runtime 平台鉴权保持原实现。模型入口为不可用 loopback，未调用模型。

```sh
cd examples/feishu-channel
GEA_CLI_BIN="$SOURCE/packages/gea-cli/dist/gea-darwin-arm64" \
GEA_EXPECT_CLI_VERSION=0.2.261102-alpha.1 \
GEA_CLI_SOURCE_SHA=d678850e76e15433cc1483d27b2e173f2871d87c \
node scripts/reproduce-local-ws.mjs
```

退出 0，真实本地栈结果：

- 首次事件：HTTP 200，`decision: "rejected", duplicate: false`。
- 同一事件重投：HTTP 200，`decision: "rejected", duplicate: true`，由真实 SDK AddressDO/SQLite 执行。
- 已声明 WS：`HTTP/1.1 101 Switching Protocols`；不存在的路由：HTTP 404。
- Node WebSocket 客户端连接成功，双向文本帧 `before` → `A:before`。
- 清理后本次 invocation 的剩余子进程数为 0。

这不是官方飞书 receiver 的 Provider E2E；没有验证 forwarded 决定在身份变化后的重投。

### 生命周期扩展探针：阻断，未伪装成通过

```sh
# 同上三个 GEA_CLI_* / GEA_EXPECT_CLI_VERSION 环境变量，再加：
GEA_WS_CHECK_CONVERGENCE=1 node scripts/reproduce-local-ws.mjs
```

此模式声明无外部连接的合成 receiver，使本地 Host 执行连接生命周期；计划检查重建后
同一 socket 从 A 切到 B 和重投去重。实际在启动阶段退出 1：
`POST /_gea/runtime/channel-object/converge` 返回 **403 Forbidden**，未进入后续断言。
最终 Bun 1.3.14 构建重复确认；清理后剩余子进程数为 0。

另一次无 receiver 的入站 WS 重建实验中，CLI 确实生成新 deployment，旧 socket 仍回 A；
源码 `crates/app-server/src/channels.rs` 的 `converge_installations` 跳过没有 receiver 的
Channel，不能把这一实验称为成功 converge。无 receiver 的默认脚本现在只声称基础 WS gate。

403 的观测边界是本轮源码 CLI + alpha.0 原生二进制组合；未通过修改产品代码、关闭 Runtime 平台鉴权、
手改授权引用或伪造 Host proof 来“跑通”。完整栈的跨部署保持、旧目标 409 和自动恢复仍未验证。

## Runtime converge/409：原生集成层通过，非完整示例链路

在同一固定 GEA 源码快照运行（独立临时 Rust target，没有改写原工作区构建缓存）：

```sh
CARGO_TARGET_DIR=/private/tmp/opengea-alpha1/runtime-target \
  cargo +1.94.1 test --locked --manifest-path crates/worker-runtime/Cargo.toml \
  channel_connection_object_converges_with_open_socket_and_durable_binding -- --nocapture
```

目标测试 **1 通过、0 失败**。它启动真实原生 Runtime/SQLite 和 loopback WS：
入站与合成 Provider socket 保持，converge 后下一帧进入新部署；切换期间在途帧有序；
旧目标 HTTP 请求返回 409 `channel_object_moved`，旧目标 WS 握手返回 409；
另起进程检查持久绑定。帧 provenance 篡改拒绝也有断言。

边界：这是源码编译的 **Rust Runtime 集成测试**，Worker 是测试内嵌合成 JS，
Host/对象存储/Provider 为 fixture；不是 alpha.1 SDK bundle 与真实本地 Host 的端到端，
也不是已发布 Runtime 二进制验收。它不能覆盖上节完整本地栈的 converge 403。

## 授权引用负例：Host 集成测试，非完整端到端

在固定 GEA 源码快照运行：

```sh
pnpm --dir packages/orpc exec vp test run src/workers/channel-authorization-reference.test.ts
```

**18 通过**。覆盖 Host 签发 `channel_member` / `oauth_token` 引用成功，之后吊销拒绝，
自造引用、换 member、跨安装、删除/替换 sender 等拒绝。
测试使用真实 Host 入站授权和 policy 代码，但数据库是 **pg-mem**，Runtime provenance、
Provider frame verifier 和 matcher resolve 是替身。不是实际 PostgreSQL、发布 Host、
本地 WS 到 Host 的全链路或真实飞书 E2E；不能用它填补授权负例的完整栈缺口。
本地 Host 没有托管 matcher 身份服务，示例没有移除 matcher 以冒充身份验收。

## 尚未验证与真实飞书/Preview 验收条件

- **CLI 发布产物**：需对应正式发布 CLI；本轮未验证它的 npm 标签、CI artifact 或实际安装回归。
- **完整本地生命周期**：需解决/解释以上组合的 converge 403，再执行跨部署 socket 保持、
  下一帧新目标、旧目标 409、重投在身份变化后保持首次决定，以及真实授权签发/伪造/吊销链路。
- **真实飞书/Preview**：需要另行部署授权、具备配套能力的 Host/Runtime、alpha.1 重打包的
  Worker，以及既有飞书应用和正确的组织 SSO/成员/Agent 权限。在私聊和群话题中实测表情、
  回复送达、current_sender、授权卡不泄漏与重新授权；同时验证未匹配/多匹配/吊销拒绝。
  历史 receiver ready 或模型完成不能替代这些验收。
- **多节点与 owner 转移**：未验证。单进程本地 socket 或 Runtime 测试不构成分布式验收。
- 未跑 GEA 全仓测试、全仓 type-check、CI 或其它示例的真实模型流程。

本机原始日志与汇总：`/private/tmp/opengea-alpha1/evidence/`，不提交二进制/SQLite/原始日志。
WS 每次运行另输出私有 `evidenceDirectory`，其中 `result.json` 与 `cli.log` 权限为 0600。
