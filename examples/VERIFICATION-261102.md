# 2026-11-02 SDK/CLI 升级：Channel SDK 修复已提交，真实飞书恢复未验收

> 历史 alpha.0 阶段记录。当前 SDK alpha.1 的结果与未通过项见 [alpha.1 验证记录](VERIFICATION-261102-alpha1.md)。本次任务没有部署或访问 Preview/生产。

当前状态：**Preview v26 的真实飞书消息验收失败；已复现 SDK matcher 检查阻断事件
读取/投影的问题，并按用户追加的「修复一下」授权，在独立 GEA checkout 修复、测试、
提交非 Draft [PR #1102](https://github.com/bmrlab/gea/pull/1102)。**
精确 head：`910c29cedcae66ffaecb27e2d9992c02f6248029`。
Preview 尚未应用修复，未合并、未发布 npm、未访问或部署 Production。
原 GEA 工作区保持不动；opengea 升级仍为未提交改动，全示例和完整 Channel 验收未完成。
下文按阶段保留当时的观察；最新修复与验证结果见文末。

分支：`chore/sdk-261102-examples`。当前 Git HEAD 仍为基础提交
`3a16283ea1890f6670ba723426aef6de49475be7`；升级和本文是未提交工作区改动。
未恢复或修改 `wip/local-261016-backup-20261102`；`dump.rdb`、
`examples/runtime-perf/`、`examples/runtime-perf-multistep/` 未纳入改动。

## 已完成的升级与接口核对

- 九个受版本控制的示例全部安装成功，九份 pnpm-lock 已正常生成。
  16 个直接 GEA 依赖的声明与实际安装版本一致：SDK/Contract/飞书扩展
  `0.1.261102-alpha.0`，CLI `0.2.261102-alpha.0`。
  现有 manifest 中没有直接使用的 chat-ui/app-sdk/extensions-sdk/computer-e2b
  依赖，因此未为凑齐包名新增依赖。
- README 安装命令、CLI pin 和 pnpm 精确发布年龄例外已同步。
  部分旧锁文件的 261101 条目尚处 pnpm 默认等待期；安装时临时允许其精确版本以便迁移，
  完成后移除旧例外。最终 package/lock/workspace 文件无旧 GEA pin。
- 已 fetch GEA `origin/main`，确认为
  `55b8fe9da33a21dc0c0d5fc830a05c4ef72f7ee7`，读取该提交的
  [ADR-0009](https://github.com/bmrlab/gea/blob/55b8fe9da33a21dc0c0d5fc830a05c4ef72f7ee7/docs/specs/0184-agent-channels/adr-0009-channel-connection-object.md)
  和 `docs/development/testing.md`、#1097 的 extension/SDK 差异，以及实际 npm 包 `.d.ts`。
  GEA 工作 checkout 保持原来的 `1c7c245659e2a01e2d8826274d22f7629c79290f`，未切换或编辑。
- 飞书示例原本已由 `agent.ts` 挂载官方 `feishuAgentExtension`，不存在独立
  `channels/feishu.ts`。本次显式选择 `transport: "websocket"`；保留精确账号 matcher
  与授权卡文字投影保护。连接 resume、Host 授权引用和 `ctx.event` 由官方扩展/SDK 负责，
  未复制底层连接状态机或自行构造授权 proof。
- 修正旧测试的 HTTP + matcher 非法组合，新增该组合应被拒绝的测试。
  HTTP 解析 fixture 使用无 matcher Channel，并按新 `ctx.event` 类型提供测试替身。
  该替身**无持久化去重或真实 Host 认证能力**，不能作为这些能力的通过证据。

## 已执行结果

环境：macOS ARM64，Node 24.16.0；各示例使用自身 packageManager 指定的 pnpm。
原全局 CLI 仍为旧版本，本次在临时目录独立安装并使用目标 CLI，没有覆盖全局安装。

| 检查 | 结果与边界 |
| --- | --- |
| 九个示例 `pnpm install` | 全部通过，锁文件已更新；未追加全量 frozen 安装验收 |
| 飞书 `pnpm type-check` | 通过，最终 agent.ts 已检查 |
| 飞书 `pnpm test` | 69 通过、0 失败、0 跳过；均为离线测试 |
| 飞书 `pnpm agent:validate` | 通过，`valid: true` |
| 飞书 `pnpm agent:pack` / build 所用命令 | 通过，使用目标发布 CLI |
| 飞书归档能力检查 | 实际 manifest 含 `channel-connection-v1`、`channel-platform-user-matcher-v2`、`durable-object-application-namespace-v1`；无旧 `channel-publication-v1`，无 Controller DO binding |
| 原生最小 Channel 安装与 HTTP 事件 | 本地 App Server + Host + Runtime + 真实 SDK/SQLite 通过；见下文 |
| 原生最小 Channel 入站 `WS()` | 失败，握手超时；新临时项目重复复现 |
| 其余八个示例 type-check/test/build/validate/pack | **未运行**；发现底层阻断后停止，不沿用旧记录宣称通过 |
| CI | 未运行 |

飞书归档：`dist/feishu-assistant-ef46ed23f825.gea-agent.zip`。

- contentHash：`sha256:ef46ed23f825fda4e62ef0ed43bc5a053043839924a7ed8bd4571afc112d6b55`
- archive SHA-256：`66ddec2dbc4ae61314962698b189ffeec023569931eaab100a11808e22da3f29`
- snapshotHash：`sha256:e8abc01a1e1b6d34d562a469a9790816b733cac183fcbad7a64833f15cf2ef10`

归档是本地构建证据；随后 Preview 发布及连接证据见文末，两者不等于真实消息收发验收。未提交二进制。

## CLI 阻断：最小复现

独立于飞书配置的最小 Channel 声明一个 `WS("/socket")` echo 路由和一个
`POST("/event")` 路由。POST 调用真实 `ctx.event(...).reject(...)`，outbound
返回本地合成发送结果。模型配置指向 loopback 的不可用端口，未执行模型调用。
使用发布 CLI 自动启动真实原生 App Server/Runtime、本地 Host 与真实 SDK bundle，
不使用 GEA 源码包，不替换 SDK 内部函数。

脚本：[feishu-channel/scripts/reproduce-local-ws.mjs](feishu-channel/scripts/reproduce-local-ws.mjs)。
该脚本默认不进入 `pnpm test`；这是一个当前预期失败的原生回归复现入口。

```sh
# 首次准备；使用自己的临时目录，不改全局 CLI。
verify_tmp=$(mktemp -d /tmp/opengea-261102-cli.XXXXXX)
npm install --prefix "$verify_tmp" @gea-ai/cli@0.2.261102-alpha.0 --no-audit --no-fund
export GEA_CLI_BIN="$verify_tmp/node_modules/.bin/gea"
cd examples/feishu-channel
pnpm install --frozen-lockfile
node scripts/reproduce-local-ws.mjs
```

脚本核对 CLI/SDK 精确版本，自建 0700 临时项目与 CLI 配置目录，仅使用 loopback 地址，
不继承 GEA/飞书/模型凭据；结果与 CLI 日志以 0600 保存。
其原始 TCP 握手带正确的 Upgrade、Connection、Sec-WebSocket-Version 和 Key，
不依赖特定 WebSocket 客户端库。脚本结束时清理本次 invocation 的子进程，
不会按全局进程名终止其他 GEA 实例。

最终复现实测（exit 1）：

```json
{
  "cli": "0.2.261102-alpha.0",
  "sdk": "0.1.261102-alpha.0",
  "firstEvent": {"status": 200, "body": {"decision": "rejected", "duplicate": false}},
  "repeatedEvent": {"status": 200, "body": {"decision": "rejected", "duplicate": true}},
  "declaredSocket": {"timedOut": true, "statusLine": "", "responseBytes": 0},
  "absentSocket": {"timedOut": false, "statusLine": "", "responseBytes": 0},
  "failure": "declared WS route must complete its handshake",
  "remainingOwnedProcesses": 0
}
```

预期：已声明 WS 路由返回 `HTTP/1.1 101`，不存在的路由返回 404。
实际：已声明路由等待 5 秒仍无响应字节；不存在路由在干净复现中直接断开且无 HTTP 状态
（早期手工探针亦出现超时）。Node 原生 WebSocket 客户端同样无法建立连接。
手工直接探测 Runtime 的未授权/未路由入口会立即返回 HTTP 404，证明原始握手发送与接收可用；
该对照**不是**绕过 Host 的合法 WS 成功证据。

源码定位线索：`55b8fe9d` 的
`packages/local-backend/src/commands/agent-packages/dev.ts:2621` 注册 upgrade 处理器，
其中无路由应显式写回 404，合法路由在 `:2142` 的 `proxyUpgrade` 转发到 Runtime。
观测与这两个预期不符。定位范围是**发布 CLI 的本地入站 upgrade 链路**，
尚未区分 Bun HTTP 适配、代理 socket 转发或原生升级交互的具体根因；未修改底层代码。

## 第一阶段的飞书验收结论与未验证项

不能宣称「飞书 Channel 在新模型下已经修好」。本次实际到达：

1. 飞书示例的类型、69 项离线行为测试、validate、pack 和新协议能力声明通过。
   授权卡防泄漏、账号精确匹配、HTTP 消息解析等属于离线覆盖。
2. 真实本地原生栈的**合成 Channel**安装和事件首次拒绝/重复拒绝通过，持久化由 SDK
   AddressDO/SQLite 执行；这不是官方飞书 receiver 的 Provider 端到端收发。
3. 入站 WS 初始握手失败，尚未执行：切换 Worker 目标后的 socket 保留、下一帧由新部署处理、
   请求旧目标的 409 `channel_object_moved`、托管 Provider socket 保留、认证变化后的首次
   forwarded/rejected 决定保持、Host 签发授权引用的伪造/跨安装/换发送者拒绝与吊销后拒绝。
   这些项目既没有本次端到端通过证据，也没有用本次示例单测替代验证。
4. **未做真实飞书验收**。只读确认示例没有 `.env`，未设置 `GEA_ENV_FILE`，没有继承的
   `FEISHU_*` 值。没有新建应用、发送飞书消息、调用真实 Provider、部署或访问生产。
   上游既有测试和历史 Preview 记录都不能补足本轮缺失的验收。

## 本机证据与恢复入口

- 安装/版本、飞书 tests/validate/pack、manifest 与原生复现摘要：
  `/private/tmp/opengea-261102/evidence/`。
- 最终独立复现的 `result.json`、`cli.log`、项目与本地 SQLite：
  `/var/folders/pn/68qblh2j0z903pjytnwjnv9c0000gn/T/opengea-channel-ws-261102-lwtSbH/`。
- 原生二进制 SHA-256（官方 npm 安装）：
  - CLI：`c90ca9c6b2b70f46f4ed2c3450784ac89f8ec6c3820698272e2520c13829f64f`
  - App Server：`6c679b3575e21d533118d5663985610092cc4f3687d318017a3bdba10816f963`
  - Runtime：`03f55d5ce10e96cbd989aefde4362d5d6717731a5d936fe2fd5d88cdf38cdcd9`

本地 WS 根因与其余八个示例完整 gates、授权负例仍待补齐。用户后续批准了已有 Preview 发布，
没有批准 Production 发布；当前仍无完成版 PR。

## 用户追加授权：已有飞书 Preview v26（12:31–12:33 CST）

用户明确回复「发布到 preview」，授权本阶段沿用已有 Project/Worker 发布；
未扩展到 Production、创建飞书应用或改变授权配置。

发布前实时检查（不使用历史记录推断当前状态）：

- Project/Worker slug 均为 `opengea-feishu-channel`；Project ID
  `01a08b76-6151-7624-97ef-06585b7a7255`，Worker ID
  `01a08b76-9132-76c0-84ea-419c23d796b3`。
- Preview 为 v25 `01a19642-086b-7130-b344-8d6bac481390`，Production target 为 null。
- 原安装 `01a13d6b-168a-70ba-b0db-594e7797f37a`，环境 preview，enabled=true。
  连接状态 failed，错误为 `channel_receiver_runtime_unavailable`。
- 已有托管飞书环境变量名称存在；没有读取或输出其值，也未修改配置。
  本地无凭据不等于已有托管安装无凭据。
- 用目标发布 CLI 再次 pack，archive/content/snapshot hash 均与上文完全相同。

执行命令（使用临时安装的 261102 CLI 和独立 App Server 状态目录，沿用已有登录）：

```sh
cd examples/feishu-channel
"$GEA_CLI_BIN" agent pack --json '{"cwd":"."}'
"$GEA_CLI_BIN" agent push --json '{"cwd":".","project":"opengea-feishu-channel","slug":"opengea-feishu-channel"}'
"$GEA_CLI_BIN" worker inspect --json '{"workerId":"01a08b76-9132-76c0-84ea-419c23d796b3"}'
"$GEA_CLI_BIN" agent channel receiver get --json '{"installationId":"01a13d6b-168a-70ba-b0db-594e7797f37a"}'
```

push 退出 0，耗时 12.71 秒。Worker 上传完成路径只选择 Preview target；
发布后再读 Worker，确认 Preview 指向 v26，Production 仍为 null。

| 项目 | 实测结果 |
| --- | --- |
| Preview version | 26 |
| deploymentId | `01a19a86-c91b-730a-aac4-cdf61724c17b` |
| createdAt | `2026-11-02T04:31:26.964Z` |
| Worker status | ready；不把旧部署的 active 字段当作当前 Preview 指针 |
| Worker contentHash | `sha256:e15ec0f9488a50b10e263dead04413a2e739ea4369825e88a508a2308f184b9e` |
| installation | 保留原安装 ID，未创建第二个安装 |
| connection state / transport | ready / websocket |
| workerDeploymentId | `01a19a86-c91b-730a-aac4-cdf61724c17b` |
| connectionDeploymentId | `01a19a86-c91b-730a-aac4-cdf61724c17b` |
| permission | allowed=true，reason=null |
| lastError / retryAt | null / null |
| socketOpenSince | `1793593896765`，即 `2026-11-02 12:31:36.765 +08:00` |

两次 ready 样本相隔 58.9 秒，socketOpenSince 相同；最后观测时间为
`2026-11-02T04:33:05.853Z`。这证明该安装连接对象已收敛至新目标，
托管飞书 receiver 在这个观测窗口内保持 ready。发布前连接失败，因此**没有**证明
一条已打开的旧部署 socket 跨本次发布不断线。

Worker contentHash 是上传部署记录的 hash；上文 pack contentHash/zip SHA-256
是不同范围的归档值，不把两者当作应相等的文件校验和。本次未另行下载远端完整 bundle。

**发布后最初尚未做真实飞书消息收发验收。** 以下为当时结论；后续用户实测失败见下一节。已确认托管连接启动，尚未通过用户消息证明 matcher
身份、Agent 执行、回复送达、授权卡、事件重投或授权吊销行为；本地 WS 阻断也未因此消失。
没有调用 receiver restart、修改安装开关/凭据、部署 Production 或发送测试消息给他人。

脱敏结果保存在 `/private/tmp/opengea-261102/preview-evidence/`：
`before.json`、`receiver-before.json`、`prepublish-pack.json`、`push.json`、
`after.json`、`receiver-after.json`、`receiver-stable.json`。文件权限为 0600。


## 用户真实消息验收失败：2026-11-02 13:48 CST

用户向已有 Preview 飞书机器人发送消息，反馈没有回复。本阶段仅做只读诊断，
未重启 receiver、重投消息、修改凭据或再次部署，也未访问 Production 运维接口。

### 已确认的链路

- 13:48:12.565856：`channel.event_arrived`。
- 13:48:13.384275：`channel.inbox_enqueued`。
- Run `bf27bbb5-1c84-8495-aa64-308960ba5608`，Session
  `683ba484-1b28-8e00-b371-dfc76f2c6c01`；Run 于 13:48:18.936 正常结束。
- Trace `49ca29601d8be9fc30442ec83a971e2e`：模型 HTTP 200，
  `gen_ai.usage.output_tokens=3`，存在非空 `gen_ai.output.messages`；
  `gea.session.status=completed`。未将消息正文或模型回复写入证据文件。
- `agent.session.terminal_delivery` 出现在 13:48:18.972799；
  随后的 `session_terminal` 内部操作 HTTP 200。
  该事件说明 Session 终态处理，**不代表飞书消息已送达**。
- 诊断末次 receiver 查询仍为 ready，目标仍为 v26，permission allowed=true，
  lastError/retryAt=null，socketOpenSince 仍为 `1793593896765`。

### 失败迹象与排查限制

最初成功读取的日志快照含 205 条记录，complete=true，截止 13:50:54.277734。
其中 Worker 响应状态计数为 200×50、503×142、404×1、409×1；这些是整个查询窗口
的计数，不能全部归到该 Run。Run 完成后仍反复出现 503。
未观察到 `channel.projection_completed` 或 `channel.outbound_*` 事件。

源码 `crates/worker-runtime/src/lib.rs` 的 `Worker response headers: status=...`
表示 **Worker 请求响应**，不是飞书 API 的响应；不能据此声称飞书接口报错。
现有日志没有对应请求路径或失败原因，尚未证明 503 与回复缺失之间的具体因果关系。
当前证据将调查重点缩小到生成输出之后的 Channel 投影/投递链路，不能区分
示例包装逻辑、SDK、Host、Runtime 或持久状态问题。

后续窄时间窗及 console 查询返回 `complete=false`、`reason=time_budget`、
空 records 且 nextCursor=null；因此不能将后续空结果当作“没有错误”。
管理接口 `agent channel deliveries` 需要该消息的 conversationId/principalId。此前将飞书
安装直接归为非 custom、不适用此接口的推断不成立：本次 packed snapshot 的 provider
实际为 custom。尚未从可用日志取到完整地址参数，因此本阶段未读取 AddressDO 管理状态。
继续线上关联需要具备请求路径/错误原因的 Preview 服务端诊断，或正确地址参数下的
受支持只读管理查询。

**真实飞书验收已尝试但未通过：入站、创建 Run、模型完成已跑过；回复送达未通过。**
这不是仅本地 WS 的问题，也不能以 receiver ready 声称示例已修好。
尚未定位 SDK/CLI 根因；未修改 GEA 主仓库。原任务中的跨部署 socket 连续性、
409 moved、重复事件首次结果及授权引用负例仍未完成托管端到端验收。

只读复查命令（同前使用目标 CLI 与已有登录，原始输出可能含正文，分享前应脱敏）：

```sh
"$GEA_CLI_BIN" run get --json '{"projectSlug":"opengea-feishu-channel","runId":"bf27bbb5-1c84-8495-aa64-308960ba5608"}'
"$GEA_CLI_BIN" trace inspect --json '{"project":"opengea-feishu-channel","traceId":"49ca29601d8be9fc30442ec83a971e2e"}'
"$GEA_CLI_BIN" worker logs --json '{"deployment":"01a19a86-c91b-730a-aac4-cdf61724c17b","since":"2026-11-02T05:48:10Z","until":"2026-11-02T05:51:00Z","order":"oldest"}'
"$GEA_CLI_BIN" agent channel receiver get --json '{"installationId":"01a13d6b-168a-70ba-b0db-594e7797f37a"}'
```

脱敏证据：`preview-evidence/message-logs.json`、`message-run-detailed.json`、
`message-observations.json`、`message-diagnosis.json`、`receiver-final.json`。
本节未包含凭据、授权链接、用户消息正文或模型回复正文。

### 补充：用户也未看到自动表情

用户补充飞书消息没有自动添加表情。已核对实际安装的
`@gea-ai/agent-extension-feishu@0.1.261102-alpha.0`：
`input.accepted` 事件处理器立即通过 `advanceAdvisory` 入队 `reaction-add`，
最终调用飞书 reaction API，emoji_type 为 `OnIt`；它不等待模型完成。
表情和正文都依赖 Channel 事件投影与 outbox 投递，虽然使用不同投递 lane。

用当前示例 `agent.ts` 实际注册、包装后的 Channel 做离线诊断：手动调用
`input.accepted`，确实入队一个 advisory `reaction-add`；执行发布包 outbound
适配器，在完全模拟的 credentials/fetch 下得到 POST reactions / OnIt 和 sent。
真实网络调用为 0。这证明示例包装没有删除这个事件处理器；不代表托管投影或
真实飞书表情 API 已通过。没有表情本身也不能排除表情被快速移除或独立发送失败。

因此之前“生成回复之后的链路”表述过窄：更准确的调查范围是 **从 input.accepted
开始的 Channel 对外反馈链路**。入站/Agent 执行和事件投影/outbox 是不同环节；
Run 完成、receiver ready 不保证任一对外反馈已发送。结合无表情、无正文、缺少
投影/出站日志，优先怀疑这条共用反馈链路，但还没有具体失败请求或错误响应来
证明根因；不把此离线诊断包装成托管端到端修复。


## 已复现的 SDK / Host 缺陷：matcher 能力检查阻断事件读取和投影

**确认存在组件调用约定不兼容；按原任务要求停止修复/发布操作，未改 GEA 主仓库。**
这个缺陷可以解释“收到消息、模型完成，但表情和正文都没有”的现象；线上那 142 条
503 尚未取到具体请求路径/错误体，不能将它们全部宣称为已与本缺陷一一关联。

### 证据链

1. 实际发布的 `@gea-ai/agent-sdk@0.1.261102-alpha.0` 中，
   `dist/agent-channel-author-runtime.js:627` 的 `executeChannelBehavior` 在分派具体
   command 之前，只要 definition 声明了 platformUserMatcher，就调用
   `createChannelCapabilities`。该函数经 `hostJson` 无条件访问
   `environment.TOOLS.fetch(.../channel/initialize)`。
2. 本例的 matcher 声明仍保留，未经删除或降级。Host main `55b8fe9d` 的
   `packages/orpc/src/workers/channel-host.ts:1090` 对内部命令收窄平台绑定：
   identity 保留；tools 只在 v2 outbound 中保留，并且只有 outbound 注册
   `createAgentChannelCapabilitiesHandler`。read_events / project_events 均没有
   所需的 tools grant/handler。注册表会拒绝未授权的绑定调用。
3. 实际 SDK HTTP 路由 `/_gea/channels/v2/read_events` 和
   `/_gea/channels/v2/project_events` 将这个执行异常转换成 HTTP 503、
   `channel_command_failed`、retryable=true（`agent-worker.ts:2530`）。
4. AddressDO 每次先 read_events 再 project_events；失败后保持待投影状态并再次设置
   约 1 秒后的 alarm。因此模型执行可以结束，而对外反馈始终不入队。
5. SDK 的 `input.accepted` 投影才会入队 `reaction-add`。在上述断点失败会先于
   表情任务的生成，符合用户报告的现象；没有向飞书发出请求也就不会有飞书 API 错误。

### 可重复的离线 SDK 路由复现

脚本：`examples/feishu-channel/scripts/reproduce-matcher-projection.mjs`。
它使用当前示例真实 agent 定义、目标 npm SDK 的公开 HTTP handler，以及本次 pack 的
Channel descriptor；直接调用内部 executor 仅用于展示被 HTTP 层遮蔽的异常。
身份、Session journal、能力响应均为内存 fixture，不连接 Host/Runtime/飞书。
本节是 **SDK 路由级复现，不是新的真实 Host/Runtime 端到端验收**。

```sh
cd examples/feishu-channel
node scripts/reproduce-matcher-projection.mjs \
  dist/feishu-assistant-ef46ed23f825.gea-agent.zip
```

命令退出 0（表示下面的缺陷断言及正对照全部成立，并非功能已修复）。

| command | TOOLS fixture | HTTP | 底层结果 |
| --- | --- | --- | --- |
| read_events | 缺失 | 503 channel_command_failed | TypeError，Session 读取次数 0 |
| read_events | initialize 返回 403 | 503 channel_command_failed | Channel capability initialize rejected (403)，Session 读取次数 0 |
| read_events | initialize 返回 matcher-v2 能力 | 200 | Session 读取次数 1 |
| project_events | 缺失 | 503 channel_command_failed | TypeError，无投影结果 |
| project_events | initialize 返回 403 | 503 channel_command_failed | initialize rejected，无投影结果 |
| project_events | initialize 返回 matcher-v2 能力 | 200 | 生成 advisory reaction-add intent |

正对照只改变内存 capabilities fixture，没有删除 matcher、放宽真实授权或向线上注入
能力。真实网络调用为 0。脱敏输出：
`/private/tmp/opengea-261102/evidence/matcher-projection-repro.json`。

后续应由 GEA 组件修复把 matcher 的 Host 能力要求与内部事件读/投影的最小权限约定对齐，
并补上 matcher + 真实 Host/Runtime + 表情/回复投递的集成用例；不能用示例移除 matcher
来掩盖问题。修复后需重建 bundle，重新验收本例。当前 Preview 未修复、未再次部署，
原升级任务的其余 gates、提交与 PR 仍未完成。

## 用户追加授权修复：GEA PR #1102（2026-11-02）

用户随后明确要求「那你修复一下」。在 `/private/tmp/gea-channel-matcher-fix-261102`
建立独立 checkout，fetch 后基于 main `a7c2861b50ce637bbe694056cd03a7dfa7681636`
修复；未切换或编辑 `/Users/zhuo/dev/tezign/gea` 原工作区。

- 非 Draft PR：https://github.com/bmrlab/gea/pull/1102，base main，未合并。
- 分支：`fix/channel-matcher-event-projection`。
- 精确 head：`910c29cedcae66ffaecb27e2d9992c02f6248029`，单个英文提交。
- `executeChannelBehavior` 将 matcher capability 探针移至 `authorize_ingress`，
  复用该路径的 capabilities 初始化。内部 journal/projection/receipt 不再申请不存在的
  TOOLS grant。入站 matcher 检查、旧 Host 拒绝、目标身份检查和 Host 权限均保留。
- SDK 回归测试覆盖无 TOOLS 的事件读取、投影、回执和旧 Host 入站拒绝；Host 集成测试
  串起真实 command handler、invocation registry、SDK HTTP handler，断言 TOOLS
  initialize 为 403 时 read/project 仍成功，并生成 reaction/reply intents。
  此集成测试的数据库、Runtime transport 和 Session journal 是边界 fixture。

### 检查结果与复跑命令

在上述 GEA commit、Node 24.16.0 上执行：

```sh
pnpm install --frozen-lockfile
pnpm run generate:i18n
pnpm --dir packages/agent-sdk exec vp test run \
  src/agent-channel-author-runtime.test.ts \
  src/channel-platform-user-matcher.test.ts \
  src/channel-user-policy.test.ts src/agent-channel-runtime.test.ts --maxWorkers=1
pnpm --dir packages/orpc exec vp test run \
  src/workers/channel-host.test.ts src/workers/channel-matcher-executor.test.ts \
  src/workers/channel-user-authorization.test.ts src/workers/channel-capabilities.test.ts \
  --maxWorkers=1
PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH" \
  pnpm --dir packages/orpc test src/router/runtime-selected-connectors.test.ts
pnpm type-check
pnpm exec vp lint packages/agent-sdk/src/agent-channel-author-runtime.ts \
  packages/agent-sdk/src/agent-channel-author-runtime.test.ts \
  packages/orpc/src/workers/channel-host.test.ts
pnpm exec vp fmt --check packages/agent-sdk/src/agent-channel-author-runtime.ts \
  packages/agent-sdk/src/agent-channel-author-runtime.test.ts \
  packages/agent-sdk/src/agent-channel-runtime.md \
  packages/orpc/src/workers/channel-host.test.ts
git diff --check
```

结果：SDK 65 项、Host 126 项、隔离 PostgreSQL 授权 60 项全部通过，无跳过；
全 workspace type-check、限定文件 lint/format、提交 hook 均通过。
测试 PostgreSQL 由仓库脚本新建临时集群、迁移并自动清理，不使用线上数据库。
首次 PostgreSQL 检查在 createdb 阶段因磁盘不足失败；仅清理本次 checkout 的
`crates/agent-core/target` 构建中间产物后复跑通过。
修复前新增 SDK 用例有 2 项预期失败，错误为访问缺失的 `TOOLS.fetch`。

### 原生 Runtime 前后对照（飞书 API 模拟）

使用目标发布 CLI 自带的原生 V8 Runtime，加载真实 SDK + 官方 Feishu extension
bundle；matcher 保持开启。Session journal、identity 和 outbound provider 响应
均为 fixture，关闭外网 egress，真实飞书调用为 0。baseline 仅将 SDK 中本次修改的
源文件替换为基础提交版本，其余 fixture 与 fixed bundle 相同。

| 观察 | baseline | fixed |
| --- | --- | --- |
| read_events | 503 channel_command_failed | 200 |
| project_events | 未到达 | 200 |
| reaction-add / reaction-remove | 未到达 | 模拟 sent |
| entity-create / entity-reply / stream-close / card-final | 未到达 | 模拟 sent |
| 最终卡片 / pending | 未到达 | 合成文本 pong / 0 |
| 错误 target 身份 | 未到达 | 403 |

本机临时 probe、bundle 和结果位于 `/private/tmp/gea-channel-native/`，复跑现有产物：

```sh
python3 /private/tmp/gea-channel-native/run.py baseline
python3 /private/tmp/gea-channel-native/run.py
```

两条命令均退出 0 表示各自断言成立；baseline 的 0 不表示功能成功。
这些 probe 未纳入 PR，是本机原生 Runtime 对照证据；可跨 checkout 重跑的回归测试
为上面的已提交 SDK/Host 用例。这里没有将 fixture 验证称为真实 Host/SQLite/飞书
端到端，也未以错误 target 的 403 替代所需旧目标 409 channel_object_moved 验收。

日志：`/private/tmp/gea-channel-fix-{sdk-tests,host-tests-final,postgres,type-check-final,lint}.log`；
结果：`/private/tmp/gea-channel-native/{baseline-result,result}.json`。

### 修复后的交付边界

修复代码已提交并推送，但 **Preview 仍为未修复的 v26；真实飞书恢复未验证**。
没有发布 npm、合并 PR 或部署新的 bundle。已有 bundle 内含旧 SDK，必须用修复 SDK
重建再更新 Preview，单独更新 Host 不能改变已有 bundle。
本次修复不解决发布 CLI 的本地 WS 阻断；fetch 到的 main 已含独立 #1100 修复，
本次没有对该 CLI 修复做发布产物验收。
原任务中其余八个示例 gates、opengea 提交/PR、跨目标 socket/409、授权引用负例
及真实飞书恢复验收仍未完成；不把本次 251 项回归测试当作这些项目的通过证据。
