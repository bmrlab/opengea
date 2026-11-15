# 04 — Exa 接入准备

按用户确认，正式 Desk Research 沿用 Exa，由用户在本机配置凭据。00–03 的 social-search 探索保留原始源码和结果，不能用作 Exa 基线。

## 本轮改动

- `research-search` 使用 `defineApiConnector` 和 agent Connection，认证为 `x-api-key`。
- `search_sources` 调用 `/search`，返回最多 5 条来源、每条最多 6000 字符；`read_source` 调用 `/contents`，读取选定来源最多 12000 字符。
- 响应校验区分请求失败、HTTP 200 的逐项失败、无结果和缺失文本；不接受另一页面冒充请求的来源。达到文本上限标记可能截断，不声称全文完整。
- 研究指令保留文本澄清、引用、推断边界和关键来源核对，去掉社交搜索 60 字摘要的特定假设。
- 三个功能阶段、异步 KV、工作台与飞书挂载方式保留。18 题及 Judges 未改，Benchmark 摘要仍一致。

API 参数核对来源：[Exa Search](https://exa.ai/docs/reference/search)、[Exa Contents](https://exa.ai/docs/reference/get-contents)。

## 已检查

完整项目 11 项测试、类型检查通过；重新生成的 v1/v2/v3 各自锁定安装、类型检查及 5/9/9 项测试通过，0 跳过。源码校验、打包、12×3 单轮和 6×1 多轮 Benchmark 编译通过。中英文 Quick Start 同步，文档集合构建 42 篇。

`manifest.json` 锁定本轮 63 个文件；旧快照校验仍通过。这里是可运行代码和静态验收记录，尚无 Exa 搜索结果或 Eval 分数。

## 本机配置与下一轮

在当前示例目录执行：

```bash
gea agent connect --json '{"cwd":".","connectorKey":"research-search"}'
```

通过本机授权界面输入 key。仅设置 `EXA_API_KEY` 不等于已配置 GEA Connection。连接就绪后先验收搜索和来源读取，再用本轮源码运行 12 单轮 + 6 多轮新基线，逐题保留执行、Judge 和 CLI 状态。后续只根据该基线的真实失败与 Annotation 改进；不将更换服务前后的分数直接相减。
