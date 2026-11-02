# CLI 261102 本地入站 WS：第一阶段分层定位

> 历史 alpha.0 阶段记录。当前 SDK alpha.1 的结果与未通过项见 [alpha.1 验证记录](VERIFICATION-261102-alpha1.md)。本次任务没有部署或访问 Preview/生产。

时间：2026-11-02 12:29–12:40（Asia/Shanghai）。状态：**根因已定位，产品修复未实施**。
本文先交付分层复现结论、最小修复边界及回归设计；没有修改 GEA 产品代码。

## 结论

这是 **GEA 本地 development proxy 的 Bun 运行时兼容性 bug**。
CLI `0.2.261102-alpha.0` 内嵌 **Bun 1.3.14**，`node:http` 的 upgrade socket
不能按真实 Node TCP socket 使用。GEA 将它用于 `socket.pipe(upstream).pipe(socket)`，
并用 `socket.end(rawHttpResponse)` 返回错误，导致正常握手响应被阻塞、拒绝响应被丢弃。

本轮发布 CLI 诊断明确观察到：

```text
客户端 raw TCP -> CLI /probe/socket -> Host 解析并签发本地调用 -> Runtime/连接对象
                                                         <- HTTP/1.1 101 (166 bytes)
客户端 <- 5 秒内 0 bytes <- Bun node:http upgrade socket / GEA proxyUpgrade
```

**Host 真的把 WS 交给了 Runtime；连接对象接受握手并返回 101。**
0 字节发生在代理下游，不能再归因为 Runtime 没有接受、缺少 capability、SDK 没挂 WS
或飞书 appId/appSecret 配置。这里的 101 不代表帧收发、跨部署保留或授权负例已验收。

## 现场与版本

- opengea 分支 `chore/sdk-261102-examples`；HEAD
  `3a16283ea1890f6670ba723426aef6de49475be7`。本会话未编辑既有升级文件。保全校验见下文。
- GEA `origin/main` 本地 ref：`55b8fe9da33a21dc0c0d5fc830a05c4ef72f7ee7`。
  本轮用 `git show 55b8fe9d:<path>` 读取该版本，没有切换现有 GEA checkout。
- 复用上一轮官方 npm 安装的 CLI，三个原生可执行文件哈希与原验收记录一致。
- 所有复现由隔离配置、全新 SQLite/项目、loopback 地址和合成 Channel 执行。
  子进程环境不继承模型、GEA 或飞书凭据；无代理环境；原始探针使用 `node:net`，不经 HTTP 代理/TLS。
- 未连接生产、部署、合并、推送或提交；没有操作 backup 分支及他人的进程。
- 证据目录 `/private/tmp/opengea-ws-debug-261102/` 为 0700，文件为 0600。
  各次脚本的独立 evidenceDirectory 含完整 CLI 日志及 SQLite，见原始输出。

版本与二进制指纹：

```json
{
  "time": "2026-11-02T12:37:12+08:00",
  "node": "v24.16.0",
  "cli": "0.2.261102-alpha.0",
  "sdk": "0.1.261102-alpha.0",
  "embeddedBun": "1.3.14",
  "sha256": {
    "gea-darwin-arm64": "c90ca9c6b2b70f46f4ed2c3450784ac89f8ec6c3820698272e2520c13829f64f",
    "gea-app-server": "6c679b3575e21d533118d5663985610092cc4f3687d318017a3bdba10816f963",
    "gea-worker-runtime": "03f55d5ce10e96cbd989aefde4362d5d6717731a5d936fe2fd5d88cdf38cdcd9"
  }
}
```

## 先复现：未修改原脚本与产品代码

第一条复现命令（从 opengea 根目录执行）：

```sh
GEA_CLI_BIN=/private/tmp/opengea-261102/toolchain/node_modules/.bin/gea   node examples/feishu-channel/scripts/reproduce-local-ws.mjs
```

原始 stdout、起止时间、退出码：

```text
start=2026-11-02T12:29:27.043827+08:00
command=GEA_CLI_BIN=/private/tmp/opengea-261102/toolchain/node_modules/.bin/gea node examples/feishu-channel/scripts/reproduce-local-ws.mjs
{
  "evidenceDirectory": "/var/folders/pn/68qblh2j0z903pjytnwjnv9c0000gn/T/opengea-channel-ws-261102-mu3XPd",
  "cli": "0.2.261102-alpha.0",
  "sdk": "0.1.261102-alpha.0",
  "results": {
    "firstEvent": {
      "status": 200,
      "body": {
        "decision": "rejected",
        "duplicate": false
      }
    },
    "repeatedEvent": {
      "status": 200,
      "body": {
        "decision": "rejected",
        "duplicate": true
      }
    },
    "declaredSocket": {
      "timedOut": true,
      "statusLine": "",
      "responseBytes": 0
    },
    "absentSocket": {
      "timedOut": false,
      "statusLine": "",
      "responseBytes": 0
    }
  },
  "failure": "declared WS route must complete its handshake",
  "remainingOwnedProcesses": 0
}

exit=1 end=2026-11-02T12:29:54.078649+08:00
```

### 稳定性、端口和初始化顺序

| 场景 | 客户端端口 | 已声明 WS | 未声明 WS | HTTP event |
| --- | --- | --- | --- | --- |
| 未修改原脚本、全新进程 | 53536 | 超时、0 字节 | EOF、0 字节 | 首次 false，重复 true |
| 全新进程/端口，先 absent 再 declared | 53901 | 5001 ms、0 字节 | 3 ms、0 字节 | 相同 |
| 发布 CLI 仅增加诊断 preload | 55144 | 5001 ms、0 字节 | 3 ms、0 字节 | 相同 |
| 全新进程/端口，WS 在 POST 预热之前 | 55767 | 冷 5002 ms、暖 5002 ms，均 0 字节 | 14 ms、0 字节 | 相同 |

共 4 次独立 CLI/App Server/Runtime 启动、5 次声明路由握手全部超时。
每次 `remainingOwnedProcesses: 0`。进程都由 CLI→App Server→Host/Runtime 的受支持启动链管理；
没有人为倒置父子进程。改变的是全新启动后的请求顺序与 Runtime/Channel 是否经 POST 预热，结果不变。

仪表化副本只增加时间、端口、原始头、原始响应及请求顺序，不改原仓库脚本。
再次执行：

```sh
export GEA_CLI_BIN=/private/tmp/opengea-261102/toolchain/node_modules/.bin/gea
PROBE_ORDER=absent-first node /private/tmp/opengea-ws-debug-261102/instrumented-repro.mjs
node /private/tmp/opengea-ws-debug-261102/cold-first-repro.mjs
```

完整原始握手与响应（`responseBytes` 是客户端 TCP data 事件累计的字节数；
`statusLine: ""` 表示没有收到 HTTP 状态码，**不是 HTTP 0**）：

```text
start=2026-11-02T12:30:28.148961+08:00
{
  "evidenceDirectory": "/var/folders/pn/68qblh2j0z903pjytnwjnv9c0000gn/T/opengea-channel-ws-261102-o2x6sP",
  "started": "2026-11-02T04:30:29.387Z",
  "port": 53901,
  "cli": "0.2.261102-alpha.0",
  "sdk": "0.1.261102-alpha.0",
  "results": {
    "firstEvent": {
      "status": 200,
      "body": {
        "decision": "rejected",
        "duplicate": false
      }
    },
    "repeatedEvent": {
      "status": 200,
      "body": {
        "decision": "rejected",
        "duplicate": true
      }
    },
    "absentSocket": {
      "route": "/absent",
      "requestText": "GET /absent HTTP/1.1\r\nHost: 127.0.0.1:53901\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n",
      "elapsedMs": 3,
      "rawResponse": "",
      "timedOut": false,
      "statusLine": "",
      "responseBytes": 0
    },
    "declaredSocket": {
      "route": "/probe/socket",
      "requestText": "GET /probe/socket HTTP/1.1\r\nHost: 127.0.0.1:53901\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n",
      "elapsedMs": 5001,
      "rawResponse": "",
      "timedOut": true,
      "statusLine": "",
      "responseBytes": 0
    }
  },
  "failure": "declared WS route must complete its handshake",
  "remainingOwnedProcesses": 0
}

exit=1
```

冷/暖顺序原始输出：

```json
{
  "evidenceDirectory": "/var/folders/pn/68qblh2j0z903pjytnwjnv9c0000gn/T/opengea-channel-ws-261102-A5ajcf",
  "started": "2026-11-02T04:35:19.456Z",
  "port": 55767,
  "cli": "0.2.261102-alpha.0",
  "sdk": "0.1.261102-alpha.0",
  "results": {
    "coldSocket": {
      "route": "/probe/socket",
      "requestText": "GET /probe/socket HTTP/1.1\r\nHost: 127.0.0.1:55767\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n",
      "elapsedMs": 5002,
      "rawResponse": "",
      "timedOut": true,
      "statusLine": "",
      "responseBytes": 0
    },
    "firstEvent": {
      "status": 200,
      "body": {
        "decision": "rejected",
        "duplicate": false
      }
    },
    "repeatedEvent": {
      "status": 200,
      "body": {
        "decision": "rejected",
        "duplicate": true
      }
    },
    "declaredSocket": {
      "route": "/probe/socket",
      "requestText": "GET /probe/socket HTTP/1.1\r\nHost: 127.0.0.1:55767\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n",
      "elapsedMs": 5002,
      "rawResponse": "",
      "timedOut": true,
      "statusLine": "",
      "responseBytes": 0
    },
    "absentSocket": {
      "route": "/absent",
      "requestText": "GET /absent HTTP/1.1\r\nHost: 127.0.0.1:55767\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n",
      "elapsedMs": 14,
      "rawResponse": "",
      "timedOut": false,
      "statusLine": "",
      "responseBytes": 0
    }
  },
  "failure": "declared WS route must complete its handshake",
  "remainingOwnedProcesses": 0
}
```

## 分层判断

| 层 | 本轮证据 | 判断 |
| --- | --- | --- |
| 示例 `WS()` | 最小声明为 `WS("/socket", {message(socket,data){socket.send("A:"+data)}})`，路径 `/probe/socket`，真实 SDK/SQLite | 声明有效；Runtime 已返回 101 |
| 飞书 `transport: "websocket"` | 发布 `channel/bot.js:54–63` 创建 managed receiver，`routes: []`；源码 `bot.ts:94–104` 相同 | 它是 Provider 出站托管连接，和自定义入站 `WS()` 是两条路径。不能把入站失败等同于飞书 receiver 已失败 |
| SDK 入站路由 | 发布 `agent-worker.js:1615–1626` 转发 unchanged URL 到 connection DO；`agent-channel-connection.js:321–355` 接受 server socket、返回 101 | 路由与连接对象接受已执行；不是旧 controller 协议残留造成此次超时 |
| Host/能力/身份 | 真实 Host 签发路径，Runtime 回来 101；HTTP 去重由真实 SDK 存储执行 | 当前握手未被能力或授权门禁阻断；负例仍未验证 |
| CLI 本地 upgrade 代理 | 已从真实 Runtime 收到 166 字节 101，但客户端 0 字节；无路由生成了 45 字节 404，但客户端 0 字节 | **失败层** |
| 本地代理/端口/证书 | 多随机端口、全新进程、冷/暖请求；裸 TCP + loopback + 无 TLS；同代码 Node 对照成功 | 无支持环境因素导致该现象的证据 |

### 真实发布 CLI 的 Runtime 响应证据

临时 preload 只包装 `net.connect` / `http.createServer` 记录状态行、字节数和路径，
不输出平台 capability、authorization、身份或配置值，不改变路由/SDK逻辑。
文件 `trace-preload.cjs` 通过 `trace-repro.mjs` 的子进程 `BUN_OPTIONS=--preload ...` 加载。

```sh
GEA_CLI_BIN=/private/tmp/opengea-261102/toolchain/node_modules/.bin/gea   node /private/tmp/opengea-ws-debug-261102/trace-repro.mjs
```

原始 CLI 日志中的相关行（仅过滤其他 200 响应）：

```text
[ws-debug] preload {"bun":"1.3.14"}
[ws-debug] preload {"bun":"1.3.14"}
[ws-debug] upgrade {"path":"/probe/socket","socketClass":"Socket"}
[ws-debug] upstream {"port":55182,"bytes":166,"status":"HTTP/1.1 101 Switching Protocols"}
[ws-debug] upgrade {"path":"/absent","socketClass":"Socket"}
[ws-debug] downstream-write {"bytes":45,"status":"HTTP/1.1 404 Not Found"}
```

完整日志：
`/var/folders/pn/68qblh2j0z903pjytnwjnv9c0000gn/T/opengea-channel-ws-261102-yNxg27/cli.log`。
Runtime 上游端口为 55182。该实验仍使用原发布二进制及原发布 SDK。

## 文件、行号与机制

以下行号均指 GEA **55b8fe9d**，不要用当前旧 checkout 的同名文件行号代替：

1. `packages/local-backend/src/commands/agent-packages/dev.ts:2142`：`proxyUpgrade`。
   `:2151` 起序列化原始 HTTP 头，`:2166` 用
   `input.socket.pipe(upstream).pipe(input.socket)` 将上游字节写进 `node:http` upgrade socket。
2. 同文件 `:2621`：`server.on("upgrade", ...)`；`:2633` 的拒绝、`:2642` 的未知路由
   用 `socket.end("HTTP/1.1 ...")`，`:2673` 把正常 Channel 交给 `proxyUpgrade`。
3. `packages/gea-cli/scripts/build-executables.mjs:62` 的 `Bun.build({compile: ...})`
   将该 Node 风格逻辑放进 Bun 可执行文件。发布二进制验证内嵌 Bun 为 1.3.14。
4. 发布二进制内可读的 Bun `node:http` 实现（已提取到 `published-bun-http-full.txt`）：
   `:12018–12020` 的 CONNECT 分支才启用 streaming；普通请求/Upgrade 经 `:12029` 关闭 streaming，
   `:12059` 发出 upgrade 事件，后续 `:12076` 对 socket cork。
   `:12171–12177` 的 streaming 方法负责设置 `handle.ondrain/ondata`；
   `:12330` 的 `_write` 仅在 `handle && handle.ondrain` 时调用 `handle.write`，否则回调成功但不写字节。
   因此该 socket 并不是可透明双向 pipe 的原始 TCP socket。
   这些是**从本地发布二进制提取文件的行号**，不是 Bun 上游仓库稳定行号。
5. 已声明路由的上游 101 卡在 Bun adapter 下游（观测到上游 data，未观测到对应下游 `_write`）；
   未声明路由走 `socket.end`，观测到 `_write(404)`，但客户端 EOF 且 0 字节。
   二者是同一兼容性误用的不同表象，不是一个 SDK 超时设置能解决的问题。

### 不含 GEA/SDK 的 Node 与发布 Bun 对照

`http-upgrade.mjs` 是 404 拒绝对照；`proxy-upgrade.mjs` 是 loopback 上游返回合法 101
后采用与 `proxyUpgrade` 相同 pipe 模式的对照。后者是合成 TCP 上游，
与上节真实 Runtime 的证据分别记录。

```sh
node /private/tmp/opengea-ws-debug-261102/http-upgrade.mjs
node /private/tmp/opengea-ws-debug-261102/proxy-upgrade.mjs
# BUN_BE_BUN 让同一发布可执行文件以其内嵌 Bun 解释器运行诊断脚本。
BUN_BE_BUN=1 /private/tmp/opengea-261102/toolchain/node_modules/@gea-ai/cli-darwin-arm64/gea-darwin-arm64   /private/tmp/opengea-ws-debug-261102/http-upgrade.mjs
BUN_BE_BUN=1 /private/tmp/opengea-261102/toolchain/node_modules/@gea-ai/cli-darwin-arm64/gea-darwin-arm64   /private/tmp/opengea-ws-debug-261102/proxy-upgrade.mjs
```

Node 的原始输出：

```text
{"event":"upgrade","url":"/sync","socketClass":"Socket"}
{"engine":"v24.16.0","route":"/sync","response":"HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n","bytes":45,"timeout":false}
{"event":"upgrade","url":"/async","socketClass":"Socket"}
{"engine":"v24.16.0","route":"/async","response":"HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n","bytes":45,"timeout":false}
{"upstreamRequest":"GET /socket HTTP/1.1\r\nhost: 127.0.0.1\r\nupgrade: websocket\r\nconnection: Upgrade\r\nsec-websocket-version: 13\r\nsec-websocket-key: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n"}
{"upstreamResponse":"HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=\r\n\r\n"}
{"engine":"v24.16.0","response":"HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=\r\n\r\n","bytes":129,"timeout":false}
```

发布 Bun 1.3.14 的原始输出：

```text
{"event":"upgrade","url":"/sync","socketClass":"Socket"}
{"engine":"1.3.14","route":"/sync","response":"","bytes":0,"timeout":false}
{"event":"upgrade","url":"/async","socketClass":"Socket"}
{"engine":"1.3.14","route":"/async","response":"","bytes":0,"timeout":false}
{"upstreamRequest":"GET /socket HTTP/1.1\r\nhost: 127.0.0.1\r\nupgrade: websocket\r\nconnection: Upgrade\r\nsec-websocket-version: 13\r\nsec-websocket-key: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n"}
{"upstreamResponse":"HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=\r\n\r\n"}
{"engine":"1.3.14","response":"","bytes":0,"timeout":true}
```

本机独立 Bun 1.3.8 也有同样结果（`http-bun.log` / `proxy-bun.log`）；结论依据是
上面的**发布 Bun 1.3.14**，不拿本机其他 Bun 版本替代。

## 发布包与源码对照

- 从发布 CLI 二进制按 `function proxyUpgrade(` 和其后的 `server.on("upgrade",` 提取
  `published-proxy.txt` / `published-upgrade.txt`。与 `git show 55b8fe9d:.../dev.ts`
  对照，握手序列化、pipe、404/end、身份头清理/签发及 Runtime target 相同。
  差异为 bundle 的局部变量改名、类型擦除和排版。**没发现该路径发布遗漏或代码漂移。**
- 发布 SDK/飞书扩展是真实 `examples/feishu-channel/node_modules/@gea-ai/*/dist`。
  `compare-published.cjs` 用 TypeScript 擦除类型、去注释、统一排版及相对 ESM 扩展名后比较。
  `channels/index`、`agent-channel-connection`、飞书 `channel`、`channel/bot` 内容一致。
- `agent-worker` 初次差异只有 `./channels` 的目录 index 解析和两处动态 import 的 `.js`
  后缀；按实际 ESM 发布路径解析后二者一致（`worker-comparison-final.json`）。
- 该对照覆盖上述五个关键模块及 CLI upgrade 路径；不是整个 npm 发布物的可重现构建证明，
  也不声称 native Rust 二进制整体等于 main 的重新构建结果。

```sh
node /private/tmp/opengea-ws-debug-261102/compare-published.cjs
```

```json
{"pkg":"agent-sdk","file":"channels/index","equal":true,"sourceHash":"e4e9301abf32083c393f986643e4451c01107dad8a3c51e4b1037a2a5882aa35","publishedHash":"e4e9301abf32083c393f986643e4451c01107dad8a3c51e4b1037a2a5882aa35"}
{"pkg":"agent-sdk","file":"agent-channel-connection","equal":true,"sourceHash":"266b61dfe58b6dc8534b610555369e84eae61f2f9170e114ce7efc772d53cac2","publishedHash":"266b61dfe58b6dc8534b610555369e84eae61f2f9170e114ce7efc772d53cac2"}
{"pkg":"agent-sdk","file":"agent-worker","equal":false,"sourceHash":"a5156b5fb2d3b84cf237e42a8d5c883c0d6c30a7d72f5a4334c04ffbcc38d833","publishedHash":"297c086dd8a4e91ede32b60f626180dec521fab7002fd8264bb724bc6b7bda52"}
{"pkg":"agent-extension-feishu","file":"channel","equal":true,"sourceHash":"19c2554a6e6dc941ae89ba205948e72d76072ac769c2b7c50ec8574e303b77a5","publishedHash":"19c2554a6e6dc941ae89ba205948e72d76072ac769c2b7c50ec8574e303b77a5"}
{"pkg":"agent-extension-feishu","file":"channel/bot","equal":true,"sourceHash":"8f810de72ece9f16a8ef5903b7497aca12fcea3e73fa5a85acafb276cc226df6","publishedHash":"8f810de72ece9f16a8ef5903b7497aca12fcea3e73fa5a85acafb276cc226df6"}
{
  "equalAfterRelativeModuleResolution": true,
  "normalization": [
    "./channels resolves to ./channels/index.js",
    "dynamic ./agent-core resolves to ./agent-core.js"
  ],
  "normalizedSha256": "297c086dd8a4e91ede32b60f626180dec521fab7002fd8264bb724bc6b7bda52"
}
```

## 最小修复方案（修代码之前的设计）

修复归属：`packages/local-backend` 的 development proxy upgrade 传输适配。
保留 Host 的 `resolveChannel`、精确 path/query 授权、`removeUnsafeProxyHeaders`、
`stripAuthorization`、deployment/worker/installation 身份和 SDK connection DO 路由。
无需修改示例、飞书 matcher、ADR-0009 协议或增加握手超时。

最小行为改动是替换 **Bun 环境下** 的原始 upgrade socket 写入/双向 pipe：
使用受支持的原生 HTTP upgrade 传输（Bun 原生升级及 WebSocket 帧桥接，或复用本地 Rust
HTTP upgrade/tunnel），在同一适配边界保留上游 HTTP 拒绝状态、子协议、文本/二进制、
关闭与断连清理。Node 的现有代理行为继续保留。选型必须先通过本报告中的独立线级探针。

不能作为修复提交的捷径：

- 访问 Bun 私有 symbol、强设 `ondrain/ondata` 或只 `uncork()`；这是不稳定内部接口，且不能证明读方向和关闭语义。
- 只把 `socket.end` 换成 `socket.write`；正常 101 pipe 已有独立失败证据。
- 只将上游换成 Bun `ws.WebSocket`，丢弃拒绝状态；发布 Bun 的 `ws` 适配明确未实现
  `unexpected-response` / `upgrade` 事件，不能因此把 Host 403/Runtime 409 变成无状态超时。
- 绕开连接对象、重启 Runtime、关闭授权或恢复旧 v4/controller-publication 路由。

**本轮停在修复前的结论交付，没有实施上述传输替换**；这不是已修复或升级验收通过。
若进入修复阶段，先执行以下隔离操作（以下命令尚未执行），从固定 origin/main 开分支：

```sh
git -C /Users/zhuo/dev/tezign/gea rev-parse origin/main
# 必须仍为 55b8fe9da33a21dc0c0d5fc830a05c4ef72f7ee7；若变化，先明确新的基线。
git -C /Users/zhuo/dev/tezign/gea worktree add -b fix/local-ws-bun-upgrade   /private/tmp/gea-local-ws-fix-261102 origin/main
cd /private/tmp/gea-local-ws-fix-261102
pnpm install --frozen-lockfile
```

### 回归设计与执行门槛

1. **先红后绿、必须跑发布用 Bun**：启动实际 `startAgentDevProxy`，原始 TCP 客户端验证
   101 + 完整头、404、Host 401/403、上游 409 `channel_object_moved` 的 HTTP 状态/正文；
   不用 Node-only suite 替代 Bun；冷/暖启动、随机端口均覆盖。
2. 正常双向帧：echo 文本、二进制、选定子协议、close；客户端断开后上游 socket 清理；
   上游握手失败、运行时断开不遗留连接。协议桥接实现必须覆盖首帧与握手同包、分片响应头。
3. 安全保持：伪造 `x-gea-worker-*` 不透传；custom provider authorization 保留，
   内置 Channel bearer 按现有规则清除；Host 精确路由/path/query 和 deployment 身份不变。
4. 使用原 `reproduce-local-ws.mjs` 对**重新编译的 CLI + 原发布 SDK**回归：
   firstEvent false、repeatedEvent true、declared 101、absent 404、无残留进程。
   再跑新 SDK fixture 的连接对象跨部署保持、下一帧切换、旧目标 409 和授权撤销用例。
5. 相关套件（以下是设计命令，**本轮未运行**）：

```sh
pnpm --dir packages/gea-cli exec vp test run tests/agent-dev.test.ts
pnpm --dir packages/agent-sdk exec vp test run src/agent-channel-connection.test.ts src/agent-channel-websocket.test.ts
cargo +1.94.1 test --locked --manifest-path crates/worker-runtime/Cargo.toml channel_connection_object_converges_with_open_socket_and_durable_binding -- --nocapture
pnpm type-check
```

还须把实际采用的 Bun adapter 回归加入 CLI 构建/发布 smoke gate。
现有 `packages/gea-cli/tests/agent-dev.test.ts:1296` 使用 Node 测试环境和合成上游，
能验证头传递，却覆盖不到编译后 Bun socket 的真实语义；这是本次缺陷的测试缺口。
若修复触及 Rust App Server，再追加对应 crate 的 focused cargo 套件；未改 Rust 不虚构 cargo 修复证据。

## 未验证与后续验收边界

- 真机飞书：**未验证**；本轮不需要读取飞书凭据，未调用 Provider。
- 入站帧 echo、跨部署保留、旧目标 409、授权伪造/吊销负例：未完成端到端验收。
- 本轮没有运行 cargo、vp、workspace type-check、CI，也没有生成修复版 CLI。
- 未改 opengea 现有升级文件、原验证记录、原复现脚本；未动 GEA checkout 或任何分支。
- 原先“socket 握手阻断”的状态仍成立，但失败层已经从泛指本地链路缩小到
  **GEA CLI 的 Bun HTTP upgrade 下游传输**。

## 证据索引

所有脚本、完整输出、二进制源码提取与对照文件：
`/private/tmp/opengea-ws-debug-261102/`。关键文件：

- `original-run.log`、`repeat-absent-first.log`、`cold-first-run.log`、`trace-run.log`。
- `instrumented-repro.mjs`、`cold-first-repro.mjs`、`trace-repro.mjs`、`trace-preload.cjs`。
- `http-upgrade.mjs`、`proxy-upgrade.mjs` 及 Node / Bun 1.3.8 / 发布 Bun 1.3.14 的六份原始输出。
- `published-proxy.txt`、`published-upgrade.txt`、`published-bun-http-full.txt`、`published-ws.txt`。
- `compare-published.cjs`、`package-comparison.log`、`worker-comparison-final.json`。
- `versions.json`、`initial-hashes.json`、`preservation-check.json`。

### 工作区保全校验的并发变化

启动时记录 38 个已修改跟踪文件的 SHA-256；结束时 37 个完全一致，
`examples/feishu-channel/README.md` 哈希发生变化，mtime 为 12:33:02 +0800。
本会话没有执行任何修改该 README 的命令；没有覆盖或回退它。当前内容包含另外一次 Preview
发布的叙述，**本报告不使用该叙述作为本轮证据，也未执行其中的发布动作**。
`preservation-check.json` 保留该差异，不将它误报成全部文件未变。
opengea HEAD/分支仍未变，GEA 的 `git status --short` 与起始一致（仅已有 `?? .gea/`）。
