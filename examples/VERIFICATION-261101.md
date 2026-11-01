# 2026-11-01 SDK/CLI 修复版升级与 OAuth Preview 业务 DO 验收

结论：除飞书外的八个示例升级到 SDK/Contract `0.1.261101-alpha.0`、CLI `0.2.261101-alpha.0`，
本地 install、type-check、test、validate、pack 全部通过；八份新归档均声明
`durable-object-application-namespace-v1`，且已打包修复后的 Artifact scope。OAuth Preview v27
使用新归档发布后，新 Session 的 `read_namespace_probe` Tool 实际读到网页写入的业务 DO 记录，
marker、写入时间与对象 ID 前缀三项与网页回执一致。

飞书示例仍固定 `0.1.261031-alpha.0`，其升级与 Preview 切换问题另行处理，不在本记录范围。
上一轮记录见 [VERIFICATION-261031.md](VERIFICATION-261031.md)。

## 修复内容与版本

| 包 | 版本 | npm integrity（与 npmjs registry 核对一致） |
| --- | --- | --- |
| `@gea-ai/agent-sdk` | `0.1.261101-alpha.0` | `sha512-Yan+b9D0vPF/…` |
| `@gea-ai/contract` | `0.1.261101-alpha.0` | `sha512-VnJ+o0zZ5VAF…` |
| `@gea-ai/cli` | `0.2.261101-alpha.0` | `sha512-m3BJEhZOdZ2x…` |
| `@gea-ai/cli-darwin-arm64` | `0.2.261101-alpha.0` | `sha512-FCib9FXG3x0W…` |

- SDK：`dist/agent-worker.js` 构造 Artifact scope 时由
  `{ type: "principal", ...initialization.runtime.auth.current }` 改为只投影 `principalType` 与
  `principalId`。旧写法把 OAuth principal 的 `attributes` 带入严格 schema，导致新 Session 在 Tool
  执行前失败。
- CLI：`gea-app-server` 内嵌的原生上传 schema 补上 `channel-publication-v1`。旧版二进制中该字符串
  出现 0 次，新版出现 4 次。OAuth 归档不声明此能力，因此这项修复不影响本次 OAuth 验收；它针对
  飞书 `agent push` 的 `Invalid deployment upload`。

npmjs 下载速度约 60KB/s，依赖改由 npmmirror 安装。lockfile 只记录 integrity，上表四个包均与
npmjs 一致；镜像元数据缺少 `@opentelemetry/sdk-trace-base@2.10.0` 的 deprecated 提示，已按
npmjs 恢复该行。各项目 frozen install 在 minimumReleaseAge 策略下通过。

## 本地检查

使用各项目声明的 pnpm 与 CLI `0.2.261101-alpha.0`。OAuth 与 basic 先 build。

| 示例 | type-check / validate / pack | 本地测试 |
| --- | --- | --- |
| oauth-app | PASS，web build PASS | 59 PASS、1 可选 Vite E2E SKIP |
| code-mode | PASS | test 1 + test:package 1 PASS |
| agents-api | PASS | 2 PASS |
| basic | PASS，web build PASS | 20 PASS |
| memory-agent | PASS | 无 test 脚本 |
| observational-memory | PASS | 11 PASS |
| subagent-limits | PASS | 4 PASS |
| subagents | PASS | 9 PASS |

八份归档均实际核验：manifest 含 `durable-object-application-namespace-v1`；`runtime/worker.mjs`
含字段投影写法，不含旧的展开写法。

| 示例 | 生成归档 contentHash（SHA-256） |
| --- | --- |
| oauth-app | `202397eae34591143a2fdb6f3f05cac649fc9ae04ed1ef13d4b730579af1971b` |
| code-mode | `37f970355586fc5c19c373c778fbbe649a1a2231dacef320e6b801f691d8db53` |
| agents-api | `b07271476c9241f1b213b180d57f17fe78d2fa7ae65282a5265c704d53d8f191` |
| basic | `d8e712d4dc661896d32277f1fd718f6a316b8c6678d480909f35ca328c7eea45` |
| memory-agent | `0a65507e59e0d81396de779c1e3cb10a2a01009ab08416e9655a6f192efae710` |
| observational-memory | `89c06160f4f8483a6640a588217e102d3875c329cdc6eaebfb72bad0b813ef8f` |
| subagent-limits | `a647351548e6a9c3903f146f05d00c9d730a441c8be3a827bf88b4465814f15b` |
| subagents | `3f3ca64f1ea9a6e5036653de2da0a73d380b41013cac7b94a22fe7d5f144e077` |

未运行 CI，也未运行会访问真实模型的其他示例 verify/dev/eval。

## OAuth Preview 业务 DO 验收

- Project `opengea-oauth-worker-test` / Worker `oauth-musedam-app`
  （`01a0a80e-b909-761e-bbdb-17325a254484`）。
- 发布前 Preview 为 v26 `01a192af-acd1-7128-ae78-1fe426cc7f21`，用 SDK `0.1.261031-alpha.0` 构建；
  其激活时间 2026-10-31T15:59:15.988Z 早于修复版 SDK 发布时间 2026-11-01T07:32:22Z。
- 以上表 oauth-app 归档（contentHash `202397eae345…`）发布 Preview **v27**
  `01a19658-9abb-710b-80dc-7130cda94ad2`，2026-11-01T09:02:37.681Z 激活；v26 变为 superseded，
  Production=null。Agent 版本由 22（`01a192af-c8ba-…`）变为 23（`01a19658-b339-…`）。
- 沿用 2026-10-31T16:02:50.104Z 网页写入的合成记录，probeId
  `fbfe6d03-bbb5-4c85-ad2e-bf844cbd6c2f`，没有新写入。同一已登录用户新建对话，只把 probeId
  告知模型，未提供预期 marker。

平台 trace 中 `execute_tool read_namespace_probe` span 的 `gen_ai.tool.call.result` 原文：

```json
{"className":"NamespaceProbe","objectIdPrefix":"1ea9f6ee643bb7a4","record":{"probeId":"fbfe6d03-bbb5-4c85-ad2e-bf844cbd6c2f","marker":"synthetic-d1c0ce93-1b0c-444c-b85b-1f3119225c39","createdAt":"2026-10-31T16:02:50.104Z"},"sessionId":"53251082-97e0-4742-aaaa-1fb85594cb49","runId":"c851ae41-f680-49ba-b3ec-31c5bfa32335"}
```

- trace `271d84e83f462a4b38817641c4069587`，installation `01a0a903-524f-758c-baf5-303475335a47`，
  Run status=finished；Tool 执行 2026-11-01T09:07:22.766Z–09:07:23.203Z。
- 与网页写入回执比对：marker、createdAt、objectIdPrefix `1ea9f6ee643bb7a4` 完全一致。
- 对照旧失败：v26 上的 Session `cefdb38f-…` / Run `169ceaef-…`（trace `e2576d0c…`）在 startup
  阶段以 `ZodError: Unrecognized key: "attributes"` 失败，Tool 未执行。

**结论**：SDK Artifact scope 修复解除了启动阻塞；网页写入与新 Session 的 Agent Tool 读取访问同一
应用业务 DO 存储，且该对象在 v26→v27 发布后保持可读。

## 未取得的证据与边界

- trace 不含平台脱敏的 namespace 所属前缀，本记录没有该项平台侧证据，不以 Worker ID 推测补填。
- `gea run get` 查询上述 runId 返回 `NOT_FOUND`，`run list` 按 sessionId 返回空；Run 证据仅来自
  trace。
- OAuth applicationId 仍未独立核验，页面 public Agent ID 不当作 applicationId。
- 旧 Session 仍固定在 Agent 版本 22，验收须新建 Session。
- 合成记录保留在 `NamespaceProbe` 中，不含 OAuth Token 或业务数据。
- Production 部署需另行获得用户批准；不合并 PR。

本机证据：`/tmp/opengea-261101-evidence/`（`gate-results.json`、`artifact-capabilities.json`、
各示例日志）与 `/tmp/gea-261101-inspect/`（新旧包解包比对、`push.json`、`trace-271d.json`）。
