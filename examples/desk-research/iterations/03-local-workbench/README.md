# 03 — 完整本地工作台接入修复

> 历史探索：本轮使用 social-search，保留原始源码与结果。正式示例现使用 Exa；本轮不能作为 Exa 基线。

这是功能接入修复，不是新一轮研究质量涨分。与02源码逐文件对比，只改变 app/client.js、app/server.mjs、scripts/configure-app.mjs、tests/app.test.mjs；研究 Agent、Tools、Cases、Judges 未变。

## 真实问题与修改

- 查询本地 Agent 时传 environment=preview 返回400；去掉该参数，并按实际的 items 读取目录。
- 本地创建 Session 使用 environment=local。
- 消息列表使用 items，按本地最新在前的顺序反转展示。
- stream=false 返回202只表示Run已接收。工作台新增状态查询，等待finished后再刷新报告；错误、取消和超时明确显示，不自动重发写请求。
- 项目 API key 仍只由本地 Node 后端从文件读取；浏览器只访问同源工作台。

## 验证

新的本地API行为测试先复现400再通过。完整项目类型检查通过，11项测试通过、0跳过。

真实 Chromium 浏览器提交了“8元预算、无微波炉”的研究请求，经过实际模型/搜索/DO保存：页面显示2条对话、1条研究记录、6条来源链接；整页重新加载后仍显示2条消息和1条记录，pageerror为空。见 [浏览器结果](results/browser.json)。使用隔离浏览器，不使用或修改用户浏览器登录。截图和原始运行数据保留在私有.gea，不进入源码。

此验证覆盖本地浏览器、Node后端、Agents API、真实Agent与业务DO的链路；没有验证跨进程重启、多人隔离或飞书。测试后停止了本任务自己的开发服务。
