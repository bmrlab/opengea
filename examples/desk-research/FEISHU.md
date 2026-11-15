# 飞书接入

完整示例默认不启动 Channel。需要飞书演示时，从 `examples/desk-research` 生成独立的 v3 项目：

```bash
node scripts/materialize.mjs v3-feishu ../breakfast-feishu
cd ../breakfast-feishu
pnpm install --frozen-lockfile
pnpm type-check
pnpm test
```

v3 的 `agent.ts` 已挂载官方 Feishu Extension，并禁用本例不需要的飞书业务 Connector/Skill。它保留搜索、研究存储与指令；显式 `worker.ts` 导出 `geaWorkerRoutes`，供 CLI 检查 Channel 与业务路由。

## 本机配置

1. 在飞书创建独立测试应用，启用机器人与长连接，订阅 `im.message.receive_v1`，配置消息收发权限并发布测试版本。测试群需要加入机器人，群消息明确 @ 它。
2. 在启动 CLI 的本机进程环境中设置 `FEISHU_APP_ID`、`FEISHU_APP_SECRET`。不要把值写进源码、命令记录或提交；仅创建 `.env` 文件不会自动加载。
3. 设置 `FEISHU_ALLOWED_SENDERS` 为测试发送者列表的 JSON，例如 `[{"tenantKey":"TEST_TENANT_KEY","openId":"TEST_OPEN_ID"}]`。不要使用通配符代替测试名单。
4. 本地使用 `FEISHU_REQUIRE_PLATFORM_USER=false`。本例搜索使用 agent 类型的 Exa Connection；在此生成的项目目录按下列命令配置 GEA 登录、Workspace 和搜索授权。

```bash
gea login --json '{"baseUrl":"https://musegea.com"}'
gea workspace use --json '{"orgSlug":"YOUR_ORG","workspaceSlug":"YOUR_WORKSPACE"}'
gea agent connect --json '{"cwd":".","connectorKey":"research-search"}'
gea agent validate --json '{"cwd":"."}'
gea agent pack --json '{"cwd":"."}'
pnpm prepare:local
pnpm dev
```

CLI 必须继承已经配置的环境变量。模型登录、Exa Connection 与机器人凭据是不同配置；不得把外部飞书身份当成开发者个人授权。

## 验证

先私聊发起早餐研究，再在同一话题追加“办公室没有微波炉”。核对实际回复、约束保留和研究保存。按完整示例 README 在同一 Worker 上启动工作台，可以读取该 Worker 的研究记录；不承诺飞书和前端自动合并为同一个 Session。

托管 Preview 需要单独配置机器人环境变量和 Exa Connection。为本地和托管使用不同机器人，避免争抢长连接事件；本机凭据不会随 `agent push` 上传。真实收发是否已验证，以 [VALIDATION.md](./VALIDATION.md) 为准。
