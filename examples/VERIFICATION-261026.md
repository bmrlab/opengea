# Published CLI verification, 2026-10-26 CST

时间：2026-10-26 12:41:52 CST。macOS arm64，Node 24.16.0。本轮重新安装并实测 CLI `0.2.261026-alpha.2`（npm `next`）。registry 复核 SDK / Contract / Feishu Extension 的最新版本仍为 `0.1.261025-alpha.2`，保持原依赖。

| 示例 | pnpm | install | frozen | CLI 版本 | type-check | test | validate | pack | 额外门禁 |
|---|---|---|---|---|---|---|---|---|---|
| agents-api | 12.1.0 | PASS | PASS | PASS | PASS | PASS (2 passed) | PASS | PASS | N/A |
| basic | 10.30.3 | PASS | PASS | PASS | PASS | PASS (20 passed) | PASS | PASS | build PASS |
| code-mode | 12.1.0 | PASS | PASS | PASS | PASS | PASS (1 passed) | PASS | PASS | test:package PASS |
| feishu-channel | 12.1.0 | PASS | PASS | PASS | PASS | PASS (18 passed) | PASS | PASS | N/A |
| memory-agent | 12.8.1 | PASS | PASS | PASS | PASS | N/A（无脚本） | PASS | PASS | N/A |
| oauth-app | 10.30.3 | PASS | PASS | PASS | PASS | FAIL (52 passed, 2 failed) | PASS | PASS | build PASS |
| observational-memory | 12.1.0 | PASS | PASS | PASS | PASS | PASS (11 passed) | PASS | PASS | N/A |
| subagent-limits | 12.1.0 | PASS | PASS | PASS | PASS | PASS (4 passed) | PASS | PASS | N/A |
| subagents | 12.1.0 | PASS | PASS | PASS | PASS | PASS (9 passed) | PASS | PASS | N/A |

表中命令为 `pnpm install --no-frozen-lockfile`、`pnpm install --frozen-lockfile`、`pnpm exec gea --version`、`pnpm type-check`、`pnpm test`、`pnpm agent:validate`、`pnpm agent:pack`。OAuth 使用 `pnpm worker:validate` / `pnpm worker:pack`，先执行 `pnpm build` 生成路由；完整测试使用 `GEA_VITE_OAUTH_E2E=1 pnpm test`，启用原生 Runtime / SQLite / 本地 HTTP fixture 的 Vite OAuth E2E。basic 另跑 `pnpm build`，code-mode 另跑 `pnpm test:package`。N/A 表示没有对应脚本。

四个 manifest 中的 CLI 与原生可选包都已实装并匹配目标版本。pnpm 将 `@gea-ai/cli-darwin-arm64` 安装到各自 `node_modules/.pnpm/@gea-ai+cli-darwin-arm64@0.2.261026-alpha.2/node_modules/@gea-ai/cli-darwin-arm64`，从本地 CLI 的依赖解析路径检查文件存在和包版本；根层 `node_modules/@gea-ai/cli-darwin-arm64` 不直接链接该间接依赖。其余五个示例不新增 CLI 依赖，测试通过任务目录独立安装的相同版本 CLI 加入 PATH。

## 云端只读命令

使用 memory-agent 示例本地安装的 alpha.2，清除大小写 HTTP/HTTPS/ALL 代理变量，仅运行下面三条只读命令。只保留输出字节数和首字符，不记录响应正文或凭据。三条命令未报告 -25293，也未因 Keychain 交互阻塞。

| 只读命令 | exit | stdout 字节数 | 首字符 |
|---|---|---|---|
| `pnpm exec gea org list` | 0 | 1074 | `{` |
| `pnpm exec gea worker list` | 0 | 21129 | `{` |
| `pnpm exec gea project list` | 0 | 2346 | `[` |

bmrlab/gea [#887](https://github.com/bmrlab/gea/pull/887) 修复 Bun 下云端只读命令空 stdout，本轮三条命令均返回非空 stdout。

## 门禁结果与安装说明

OAuth 完整测试有失败，`tests_pass=false`。Vite OAuth E2E 的 180000 ms 超时在此前任务记录中也出现；本轮另有 concurrent refreshes 集成用例失败，不能将全部失败归为已知基线。本轮未修改应用或测试源码，未延长超时或跳过测试，也未重新运行旧 CLI 对照，因此无法证明失败与此次升级无关。PR 以 draft 交付，完整 OAuth 验收尚未闭合。

```text
FAIL  tests/oauth.integration.test.ts > GEA OAuth HTTP application > serializes concurrent refreshes across requests and persists the replacement tokens
Error: Test timed out in 30000ms.
FAIL  tests/vite-oauth.e2e.test.ts > preserves two OAuth users through the packed local application
Error: Test timed out in 180000ms.
Test Files  2 failed | 6 passed (8)
Tests  2 failed | 52 passed (54)
```

更新 lockfile 时仅临时保留旧版本精确 release-age 条目以允许 pnpm 校验旧 lockfile；最终已移除旧条目，并用最终配置再次完成 frozen 安装。最终 allowlist 仅新增目标 CLI / 原生包的精确版本，没有关闭 release-age 门槛或扩大版本范围。

未执行云端写入、Preview 部署、飞书发送或 GEA 主仓 / Helm / Kubernetes 操作。本地测试与上述只读输出检查不代表真实模型、OAuth 用户或业务验收；PR 留待独立复审，不合并。
