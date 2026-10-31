# 2026-10-31 SDK/CLI 升级与 Preview 验证

结论：九个示例依赖安装、type-check、validate 与 pack 均通过；所有新归档均声明
`durable-object-application-namespace-v1`。本地测试合计 175 项通过、1 项可选 Vite E2E 跳过。
飞书 matcher v2 声明已核验；OAuth 示例已加入通过本地检查的网页写入/Agent Tool 读取入口。
Preview 与真实业务验收尚未执行；以下不代表托管验收通过。

## 为何升级与为何必须重建发布

- SDK、Contract 与飞书扩展固定为 `0.1.261031-alpha.0`；CLI 固定为 `0.2.261031-alpha.0`。
- GEA #1084 将执行 Worker 身份与 DO 存储归属分开。新发布的应用，其网页与 OAuth
  安装 Agent 使用源 Worker 的存储命名空间；业务仍须通过对象名及授权隔离环境、组织和用户。
- 新 CLI 构建应声明 `durable-object-application-namespace-v1`。已经发布的旧归档不会因
  修改 package.json、升级 Host 或安装 CLI 自动获得这一声明，必须用新 SDK/CLI 重建并发布。
- 本次版本也包含 GEA #1088 的 artifacts 分区。具体行为仍需新产物与新执行证据确认。
- 验收创建新 Session。旧 Session 在跨命名空间升级时可继续保留旧 release；旧安装的业务
  数据不会自动合并。本次不迁移历史业务对象，不修改生产配置。

## 本地检查

九个示例 pnpm install 通过，16 个直接 GEA 依赖的声明/安装版本一致，九份 lockfile 由正常安装生成。
使用各项目声明的 pnpm 和已安装的 CLI `0.2.261031-alpha.0`，未使用旧 SDK、源仓库运行时或能力绕过。

| 示例 | type-check / validate / pack | 本地测试 |
| --- | --- | --- |
| feishu-channel | PASS | 68 PASS |
| oauth-app | PASS，web build PASS | 59 PASS、1 可选 Vite E2E SKIP |
| code-mode | PASS | test 1 + test:package 1 PASS |
| agents-api | PASS | 2 PASS |
| basic | PASS，web build PASS | 20 PASS |
| memory-agent | PASS | 无 test 脚本 |
| observational-memory | PASS | 11 PASS |
| subagent-limits | PASS | 4 PASS |
| subagents | PASS | 9 PASS |

OAuth HTTP/SQLite 集成使用新 CLI 的原生 GEA Runtime与真实 SQLite；远程 OAuth/API 是本地 fixtures。
新增验证覆盖 Preview、登录、同源检查、唯一合成对象写入、Tool 的可信组织对象名与真实 receipt 返回。
所有九份生成归档的 manifest 均已实际核验新 DO 能力。二进制归档保留在各示例 dist，按仓库约定不提交。

| 示例 | 生成归档 contentHash（SHA-256） |
| --- | --- |
| feishu-channel | `dcfb58facb0b7015d3591722ac22d79735f0334b63f12264512f98044e972b58` |
| oauth-app | `adc509ce43d896a107b15bc95001f8ecf407536fa0f95508e0c034006b9d7e31` |
| code-mode | `e89ca1d8257f71ae1ba78f0da1730d282e2462234cc1aeacae90b1cd7fc89a46` |
| agents-api | `64f8e3ba5a10b4a4bae8505362f27602a3606551e0923f2b8a5a0dc48eb48821` |
| basic | `682453aa88402ec69ca31343528c1aa6c4ad5d8f990b92a8797eb87e78445f8f` |
| memory-agent | `f4b3b34a27dc6de0da9a78419c3bd9849f931b66143f732958bd012f12546095` |
| observational-memory | `db3c32a652b2ce65d2cdc5e8ddf8d2a898a1f97c8ae3664e60e72c7ee35147dc` |
| subagent-limits | `ee3035ebf6f83d3ac1f5bf9e68f797253894051674f56785b3fcd30e200052f6` |
| subagents | `71b06f18afce57450412a7f4633912c30b5478bb8d11cd7101158b7dd756d349` |

本地过程中的两个问题均已解决：

- 项目外绝对 outDir 导致 pack 路径安全校验拒绝；从项目目录执行默认 pack 成功。
- 新增 Tool 未声明业务 DO 类型导致 TS2339；通过 SDK 的 `AgentDurableObjectBindings` 接口扩展，
  使用 `AgentDurableObjectNamespace<NamespaceProbe>` 正确声明，移除强制类型转换后全部检查通过。

本机证据目录：`/private/tmp/opengea-sdk-upgrade-20261031-evidence/`。
安装与飞书测试见 `resume-2`；飞书默认 pack/manifest 见 `resume-3`；其余最终 gates、
九份归档能力与 hash 见 `resume-4/gate-results.json` 和 `resume-4/artifact-capabilities.json`。
未运行 CI，也未运行会访问真实模型的其他示例 verify/dev/eval。

## 飞书 matcher

保留现有精确 `openId === candidate.account.accountId` matcher。新归档已确认保留
`channel-platform-user-matcher-v2` 与 `{ execution: "sdk-function", protocolVersion: 2 }`。
真实验收须记录命中用户、Channel 安装/版本、消息及原话题回包、时间和 trace/Run ID。
此前 10-30 的部分 Preview 发布与 receiver 握手失败仅属历史证据，本次状态待检查。

## XD 业务 DO 等价入口

OAuth 示例新增 Preview 专用 `/namespace-probe` 页面：已登录的网页用户通过同源 POST
创建唯一合成记录；Agent 的 `read_namespace_probe` Tool 使用同一 `NamespaceProbe` class
和包含环境、可信组织、probe ID 的对象名读取。此 class 不包含 OAuth Token 或历史业务数据。
网页只把 probe ID 告知新 Session，不把预期 marker 告知模型；验收比较真实 Tool receipt。
两侧的完整 marker、写入时间及对象 ID 前缀应一致，并从平台证据核对脱敏 namespace 前缀。
网页写入会拒绝 Production、匿名及跨源请求；Tool 拒绝非用户主体、非 Preview 和不存在的记录。

该入口与本地测试不是托管通过证据，真实 Preview 验收尚未执行。

## 发布边界

沿用既有 Project/Worker slug；Preview 发布需绑定本次新构建。
Production 部署必须另行获得用户批准；不合并 PR。
