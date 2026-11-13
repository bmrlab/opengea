# 多轮 Eval User Simulator

一个背包顾问、一个 Case、一个独立 LLM Judge。顾客边聊边明确需求，助手根据后续信息修正推荐。没有预录 transcript，助手回复、Simulator 用户消息和结构化 done 均由真实模型生成。

## 场景设计

这是虚构商品目录上的咨询例子，不是现实商品或购物建议。对话围绕以下自然的决策过程展开，预期约 5–8 次用户输入，具体以信息是否充分为准：

1. 顾客想换通勤背包；助手澄清随身物品，顾客说明 14 英寸电脑、饭盒、水杯，至少 20L。
2. 助手澄清预算和偏好；顾客先给出 350 元预算、喜欢蓝色，助手提出通勤初选。
3. 看到初选后，顾客补充骑车遇雨。助手需区分防泼水和防雨罩，并算清配件使原预算超支的成本。
4. 顾客想起周末过夜用途，把容量提高到至少 24L、预算提高到 500 元；助手需据此调整原方案。
5. 调整后顾客补充肩膀不舒服，要求空包不超过 800g，促使助手再核对重量。
6. 顾客主动确认防雨罩是否已包含在报价中、总共付多少钱；完整答复后 Simulator 返回结构化 done。

这些是顾客的偏好和披露时机，不是固定台词或按轮号播放的脚本。Simulator 不知道商品标准答案，消息根据当前可见对话生成；遇到矛盾继续澄清。`maxTurns=10` 只是防止对话无法结束的上限，不把到达轮数上限当成通过，也不要求模型拖到上限。

## 角色与评分边界

- 目标 Agent 只拿商品目录和咨询规则（`AGENTS.md`），不知道顾客尚未披露的限制。所有提问都用普通文字，不调用 `askUser`。
- Simulator 使用 GEA #1280 的无工具实现，只接收 persona、goal 和可见对话，不读取 Judge、评分规则或预期型号。返回 `{"done":false,"message":"…","reason":"…"}` 或 `{"done":true,"reason":"…"}`；done 只表示顾客结束交互，不表示质量达标。
- 模型请求由已发布 CLI 的 `modelSource=local` 入口处理；Simulator 原有 1024-token 输出上限和目标 Agent 的 4096-token 输出预算不变。公开 CLI 不接收旧 runner 的 `hostedModelRequest` JavaScript 回调，因此不再执行 `scripts/model.mjs` 中的传输适配、thinking 配置及请求边界观测；当前运行不能声称逐请求校验了 thinking、无工具和输入字段。
- Judge 直接使用已发布 SDK 的 Markdown LLM 评分能力：`benchmarks/judges/recommendation.judge.md` 由 CLI 发现，交给 `createAgentEvalWorker` 的 Markdown 路径。runner 显式设置 `judgeModel: "creative-reasoning-1.5"`，沿用公开 CLI 的本地模型配置，无需额外依赖或自写模型客户端。
- rubric 要求先用 `queryRun` 查询全部对话，必要时用 `readEvidence` 读取完整证据，再逐轮核对当时已披露的条件。它按六个维度评分：conversation、clarification、progressiveDisclosure、initialRecommendation、adjustment、finalFit。每项 0/1、等权平均，全部通过才达到原有 `minScore=1`。
- 初选核对城行22的329元、加雨罩后358元及超原预算8元；调整检查容量、预算和重量变化；最终核对蓝色轻旅24、24L、780g、14英寸电脑和429元含雨罩。更正按语义及阶段理解，最后答对不能补偿缺失的过程。
- Judge 用 `submitEvaluation` 返回 score、reason 和真实消息证据引用。rubric 约定 reason 为带六项分数、解释和消息 ID 的 JSON 字符串；SDK 校验顶层提交 schema、分数范围及证据引用，reason 内的六项明细和平均分一致性由 LLM 按 prompt 执行，并非额外代码校验。证据读取失败应返回 error，不能当作通过。

本例没有稳定的结构化购买方案/预算字段，因此保持纯 LLM 业务评分，不修改 Agent 输出契约，也没有另加确定性商品或预算检查。原有 `recommendation-facts.ts`、代码 Judge、否定/比较/金额绑定逻辑及 r3 大夹具已删除。LLM 可能误判；本例不承诺覆盖全部自然语言或否定/矛盾句式。

安装后运行 `corepack pnpm@12.8.1 test`：仅保留 **6 个离线用例**，包含 Markdown 入口/评分维度/gate 契约、历史14条消息回放、错误最终价格与拒绝调整两个清晰负例、越界分数拒绝、证据不足错误。测试通过公开 `createAgentEvalWorker` 运行证据查询和提交；模型传输完全 mock，不读取 key，不访问模型，不运行 CLI Eval，不写 `results/latest.md`。历史夹具保留原文，回放时仅补测试消息 ID。

这些分数是预设 mock 响应，验证 SDK 接口与错误传播，不证明 LLM 会给出相同分数。为在 Node 24 下执行 SDK WASM，测试命令开启 `--experimental-wasm-jspi`，测试内仅把 SDK WASM 编译为模块以适配 Node；实际 `pnpm eval` 仍由发布版 CLI 原生 Runtime 执行。

## 已发布依赖与 Draft 状态

本例使用精确版本 `@gea-ai/agent-sdk@0.2.261113-alpha.0` 和 `@gea-ai/cli@0.2.261113-alpha.0`，无需私有源码 checkout。Node **24.16.0**、pnpm **12.8.1**；该 CLI 版本发布的平台包为 macOS Apple Silicon。

`pnpm eval` 保留原来的 `scripts/run.mjs` 结果整理，通过公开的 `@gea-ai/cli/runtime` 定位已安装 npm 平台包，再启动其 `gea agent eval --json <payload>` 命令。payload 为 `{ cwd, modelSource: "local", judgeModel: "creative-reasoning-1.5", trace: true, concurrency: 1 }`。CLI 自带所需原生 Runtime 与 system workers，runner 不导入私有 Eval API 或 TypeScript loader。

PR 保持 draft。2026-11-13 的 CLI 接入验证通过安装和类型检查，实际启动 Eval 后因缺少 `CREATIVE_REASONING_API_KEY` 退出 1；尚未完成本地模型模式的真实多轮验证。本次 LLM Judge 修改只完成离线契约测试及轻量检查，未调用真实模型。下面保留的成功对话和旧 Judge 分数来自历史源码 runner，不是当前 CLI 或新 LLM Judge 验收结果。完整真实多轮 Eval 等 r5 复审 PASS 后再跑。

## 运行

从 opengea 根目录进入例子并安装已发布依赖：

```sh
cd examples/eval-simulator
corepack pnpm@12.8.1 install --frozen-lockfile
mkdir -p .gea
# 在 .gea/model.env 中填写 CREATIVE_REASONING_API_KEY=<your-api-key>
# 或从安全的环境配置中设置同名进程环境变量。
# 创建文件后限制权限：chmod 600 .gea/model.env
corepack pnpm@12.8.1 eval
```

不要提交真实密钥或 `.gea/model.env`；整个 `.gea/` 已被忽略。也可直接运行与 `eval` 脚本相同的命令：

```sh
node --env-file-if-exists=.gea/model.env scripts/run.mjs
```

每次运行都会调用真实模型，最多 10 次目标 Agent 输入，运行预算 8 分钟。运行状态限定在本例 `.gea/`；runner 将中断或超时交给 CLI 取消并清理其拥有的执行。只有 CLI 成功、`stopReason=simulator_done`、Judge 平均分为 1 且 gate passed 时，命令才返回 0。如需保存命令输出，可追加 `> run.log 2>&1`。

历史源码 runner 曾在 `modelSource=local` 的 Simulator 阶段遇到内部错误，后来通过自定义 hosted 模型回调绕过；也曾通过回调关闭 provider thinking，避免耗尽 Simulator 的 1024-token 预算。当前公开 CLI 接入不再使用该回调，本次缺 key 验证不能证明这两类历史问题已解决。有模型 key 后仍需完整运行确认，不应把下方历史成功记录视为当前入口的成功证据。

## 看结果与历史证据

历史源码 runner 验证 Run：`9e5da760-a98e-4d25-b4f2-43608df39434`。**7 次用户输入、7 次助手回复、7 次 Simulator 调用**；第 7 次 Simulator 返回结构化 done，`stopReason=simulator_done`，当时的旧规则 Judge 六项全过、得分 1、gate passed（1/1）。7 轮小于 `maxTurns=10`，不是靠上限终止。逐轮核对 Simulator 输入均为完整可见对话前缀，7 次请求均无工具；14 次实际模型请求均校验关闭 thinking。

真实对话中，顾客还把加雨罩后的超预算金额说成 20 元，助手纠正为 8 元；此后从城行22 调整为蓝色轻旅24（24L、780g、适配14英寸电脑、429元含防雨罩），回应了新增的周末用途、预算和重量要求。

该历史验证共有 4 次未通过的尝试：目标回复达到旧的 1024-token 上限；Simulator 提前结束导致 Judge 0.5；最终汇总不全且 Judge 漏识别费用确认的同义表述导致 0.5；Simulator 的预算被 provider reasoning 耗尽。分别修正本例预算/提示、同义词识别和传输配置后，第 5 次运行通过。六项语义要求和 `minScore=1` 未降低，未通过的运行没有计为成功；原始证据仅保留在本地。

- [results/latest.md](results/latest.md)：保留的历史源码运行完整对话、Simulator 决策、旧回调请求记录与 Judge 检查；本次缺 key 运行没有覆盖此文件。后续 CLI 成功运行会生成新对话与判分，不再生成旧回调请求记录。
- 运行会刷新 `results/latest.md` 和本地 `results/latest.json`。Markdown 不输出本机结果目录或原始产物链接；JSON 可能包含绝对路径，已被忽略，不应提交。
- `.gea/evals/<时间戳>-<run>/` 内的 `cases/backpack/commute-weekend.json` 是完整 Case/Judge 证据，`simulator/*.json` 保存每次 Simulator 输入、输出与用量，`result.json` 为汇总。原始产物、traces 和 `*.log` 均留在本地，不随示例提交。

本例仅提交 `results/latest.md` 这一份可读结果。早期两轮版本曾因目标助手调用内置 `askUser` 而以 `target_waiting` 失败；因此目标指令使用普通文字提问。历史多轮运行的结果和范围在上面的结果文件中披露，不把历史运行当成本次 CLI 验证。
