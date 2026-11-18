# Agent Builder Quick Start：五步做一轮迭代

从[完整项目](README.md)启动，或把下面任务交给 coding agent 建立 Baseline。Baseline 包含搜索、正文读取和 DO 存储。

## 建立 Baseline 的任务

```text
为当前 ProductResearch 增加保存和读取研究简报的能力。
保留 Exa 搜索与正文读取；用 ResearchStore Durable Object 保存研究范围、简报和来源。
按可信 Session/Chat ID 隔离，不接受模型传入其他会话 ID。
验证同一对话能读回、不同对话读不到；不要保存凭据或个人隐私。
交付代码、校验结果和未完成项，不用本地测试冒充真实研究验收。
```

## 1. 建题

按 [8 元预算例子](BENCHMARKS.md#1-建题从业务风险到-casejson)写 input、metadata.acceptance、judgeRules 和三份 Markdown Judge。acceptance 进入 Judge 上下文，不自动注入 Agent 用户消息。

## 2. 跑分

按 [启动说明](README.md#配置-cr-api-key)在本机进程注入 `CREATIVE_REASONING_API_KEY`，Agent / Judge / Simulator 均用 `creative-reasoning-1.5`、`modelSource: "local"`。Exa 使用独立 key，通过本地 Connector 环境变量提供。安装锁定依赖并执行 [唯一默认评测命令](README.md#2-跑分)，保存 Run、原始 Trace 和评分目录。

## 3. 定位失分

先读最终回答和 Judge 理由，写 Case、失败原句、证据和假设。第一次迭代只根据结果改输出要求；复跑后读搜索、正文读取和引用来源的 Trace。按 [分流表](evaluation/README.md#3-定位失分)区分质量、执行、评分和覆盖问题。

## 4. 改 Agent

复制对应轮次任务：[Baseline](iterations/00-baseline/README.md)、[第一次迭代（专注结果）](iterations/01-result-focused/README.md)、[第二次迭代（专注 Trace）](iterations/02-trace-focused/README.md)。一次只处理已定位的问题，保留原题、Judge、模型与预算。第二次迭代只加入过程与引用工具改动，不加入根目录结构化观察规则。

## 5. 再跑分

用同条件执行新版本，按 Case × Judge 对照改善、退化、未完成和人工争议。不要挑重跑结果、手工补分或将更换 Judge 算成 Agent 提升。复现条件与源码对应关系见[运行说明](iterations/REPRODUCING.md)。

[详细题集](BENCHMARKS.md) · [三轮结果](iterations/README.md)
