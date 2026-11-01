# 2026-10-30 SDK/CLI 升级验证

本次九个例子的正常安装、frozen install、类型检查、构建和可用的 validate 最终均通过。
飞书 matcher 源码与托管归档已完成；Preview push 返回 503，虽已切到 v24，receiver 仍绑定 v23 且失败，
因此 **Preview 完整部署与真实飞书试用尚未验收**。本记录不替代真实飞书测试或 CI。

## 版本与范围

- 所有现有 `@gea-ai/*` SDK 依赖：`0.1.261030-alpha.0`。
- CLI 依赖及当前操作文档固定版本：`0.2.261030-alpha.1`。
- 直接使用 Zod 的例子同步到 SDK 使用的 `4.6.5`，修复旧版缺少 `validate/validateAsync` 的类型不兼容。
- 九份 lockfile 均由正常 `pnpm install` 生成，再以各例子的 packageManager 执行 frozen 校验。
- Node `24.16.0`，macOS arm64；本次没有验证其他平台。历史验证记录保留原版本。

## 本地结果

| 例子 | frozen / type-check / 构建 / validate | 测试 |
| --- | --- | --- |
| agents-api | PASS | 2 PASS |
| basic | PASS（Agent 构建及 Next.js build） | 20 PASS |
| code-mode | PASS | 1 PASS；test:package 1 PASS |
| feishu-channel | PASS（托管构建用 agent pack） | 68 PASS |
| memory-agent | PASS | 无 test 脚本 |
| oauth-app | PASS（先 build 生成路由类型） | 53 PASS，1 个可选真实 Vite E2E SKIP |
| observational-memory | PASS | 11 PASS |
| subagent-limits | PASS | 4 PASS |
| subagents | PASS | 9 PASS |

`agent build` 面向本地执行，按设计拒绝托管 matcher；飞书例子的 `pnpm build` 使用官方
`agent pack` 构建可上传 Worker 归档，未删 matcher 或绕过能力门禁。
飞书旧 HTTP 测试替身补齐 `authenticateUser`，另覆盖四类 matcher 拒绝反馈、群内私聊指引、
精确比较与挂载后声明保留。Host 唯一性和真实成员/SSO 状态未在例子里伪造验证。
OAuth validate 曾与测试的构建并发争用同一 App Server 项目而报 `project_owned_by_another_host`；
测试结束后串行重跑通过。OAuth 测试使用本地原生 Runtime/SQLite 与合成 HTTP 服务。

没有运行 verify、dev、eval、compare 等会创建真实 Run 或访问模型的命令；没有调用真实飞书服务发送消息。

## Matcher 与 Preview

SDK `feishuAgentExtension({ platformUserMatcher })` 接收同步函数，示例采用
`sender.openId === candidate.account.accountId`；Host 负责候选范围、恰好一个用户、成员与权限检查。
零/多匹配或故障不启动 Run，也不回退 OAuth/外部身份。发布包类型与现行文档一致。
归档 Channel 描述含 `{ execution: "sdk-function", protocolVersion: 2 }`，Worker manifest
要求 `channel-platform-user-matcher-v2`；不存在单独 matcher 二进制或 module 引用。

使用 `npx -y @gea-ai/cli@0.2.261030-alpha.1`，既有登录确认 musegea.com、tezign/default。
Worker `opengea-feishu-channel`：

- 回滚记录：v23，`01a17d3c-3f40-74ba-825b-f86e698d6644`（仅记录，未回滚）。
- 本次新部署：v24，`01a188f8-3324-733c-8282-347fced8bc24`，ready；targets.preview 已指向此 ID。
- push 约 6.91 秒后报 `Hosted workers/completeDeploymentUpload failed (503 Service Unavailable): Service Unavailable`。
- receiver 在部署前已为 failed / feishu_handshake，revision 17；部署后 02:43:09–02:48:09（中国标准时间）六次分钟采样均保持该状态并绑定 v23。
- 新旧部署日志完整查询覆盖 02:42:06–02:48:31：v24 两条 HTTP 200、v23 零条；窗口内未见 409/503/403 风暴。
- targets.production 为 null。没有重推、重启、set-enabled、改凭据或回滚。

服务端未给出 matcher 能力拒绝的具体错误，503 原因 UNKNOWN；新 Worker target 不等于 Channel 安装已切版。
远端 matcher 元数据与 receiver 就绪未得到确认，须先解决这次部分部署，再按飞书 README 的中文步骤试用。

本机脱敏日志位于 `/Users/zhuo/gea-tasks/opengea-matcher-preview-20261030/evidence/`，
最终观察、PR 与完整结论见同目录 `REPORT.md`。本次不合并、不发布 npm、不操作生产环境。
