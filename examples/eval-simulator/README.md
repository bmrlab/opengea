# 多轮 Eval User Simulator

一个背包顾问、一个 Case、一个独立代码 Judge。顾客边聊边明确需求，助手根据后续信息修正推荐。没有预录 transcript，助手回复、Simulator 用户消息和结构化 done 均由真实模型生成。

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
- 模型回调转发真实请求，不改 prompt 或回复；通过 provider 配置显式关闭 thinking，并在发送时校验。Simulator 原有 1024-token 输出上限保持不变，目标 Agent 输出预算为 4096。每次 Simulator 请求验证 `tools=[]`、`toolChoice={"type":"none"}`，并验证输入只有 `persona`、`goal`、`messages`。请求边界记录随可读结果保存，不含密钥。
- 独立代码 Judge 检查六项：足够的对话、主动澄清、逐步披露、初选及雨天成本、条件变化后的调整、最终方案。每项等权，全部满足才得 1 分并达到 gate；它不读取 Simulator done 来打分。

Judge 基于此小型中文场景的数字、型号、语义关键词和消息顺序做确定性检查；不是通用自然语言质量评估器。既要求至少 5 次用户输入，也要求不同阶段的真实新约束和对应助手反应，仅重复消息不能通过。

## Draft 与未发布依赖

**本例目前仅支持源码环境，PR 必须保持 draft。** SDK 尚未发布，manifest 和 lockfile 暂用 `link:../../../.runtime/packages/agent-sdk`；runner 也导入同一源码的本地 Eval 实现，并通过 `../../../.runtime/packages/orpc/node_modules/tsx/dist/loader.mjs` 加载 TypeScript。这不符合根 README 要求使用已发布公共包的贡献约定。待 npm 0.2 alpha 发布后，将依赖和 runner 改为正式包、更新 lockfile 并完成验证，再转为正式 PR；此处不声明任何已发布 SDK 版本。

历史成功运行使用 GEA 源码提交 `83ac3b044fd0e73860023b231c2c42ad76f3741a` 的独立导出、Node **24.16.0** 和 pnpm **12.8.1**。它不是仅安装 npm 依赖即可运行的示例，也不是已发布 CLI/npm 的验收。

## 准备本地 runtime

需要可访问上述提交的 GEA 源码 checkout，以及该提交对应的已安装依赖、SDK 所需 WASM 和匹配的原生 App Server / Worker Runtime。将源码导出到 **opengea 仓库的同级** `.runtime/`，不要改动原源码 checkout；不要把 `.runtime/` 加入 Git。目录布局如下：

```text
scratch/
├── .runtime/
│   ├── packages/agent-sdk/
│   ├── packages/orpc/node_modules/tsx/dist/loader.mjs
│   └── toolchain/
│       ├── gea-app-server
│       ├── gea-worker-runtime
│       └── system-workers/
└── opengea/examples/eval-simulator/
```

在 opengea 根目录执行以下准备命令。先将 `GEA_CHECKOUT` 设置为自己的 GEA 源码目录；`.runtime` 应为新目录。

```sh
export GEA_CHECKOUT=/path/to/gea-source
mkdir ../.runtime
git -C "$GEA_CHECKOUT" archive 83ac3b044fd0e73860023b231c2c42ad76f3741a \
  | tar -x -C ../.runtime
export SHARP_IGNORE_GLOBAL_LIBVIPS=1 VP_GIT_HOOKS=0 GIT_OPTIONAL_LOCKS=0
export GIT_CONFIG="$PWD/../.runtime/gitconfig"
touch "$GIT_CONFIG"
corepack pnpm@12.8.1 --dir ../.runtime install --frozen-lockfile
```

接着按照该 GEA 提交的构建说明准备 SDK 所需 WASM、原生二进制和 system workers，放到上面的路径。源码导出和依赖安装本身不会完成全部原生构建。也可以用 `GEA_APP_SERVER_BINARY`、`GEA_WORKER_RUNTIME_BINARY`、`WORKER_RUNTIME_SYSTEM_WORKER_ROOT` 指向匹配的构建产物。历史运行复用了经源码一致性核对的本机构建产物；本 PR 没有重新构建或验证全新环境安装。

## 运行

完成 runtime 准备后，从 opengea 根目录安装本例的本地链接：

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
node --env-file-if-exists=.gea/model.env \
  --import ../../../.runtime/packages/orpc/node_modules/tsx/dist/loader.mjs \
  scripts/run.mjs
```

每次运行都会调用真实模型，最多 10 次目标 Agent 输入，运行预算 8 分钟。运行状态限定在本例 `.gea/`，结束会关闭本次拥有的本地进程。只有 `stopReason=simulator_done`、Judge 平均分为 1、gate passed 且每轮都有 Simulator 请求边界记录时，命令才返回 0。如需保存命令输出，可追加 `> run.log 2>&1`。

历史运行中，原生 `modelSource=local` 在 Simulator 请求阶段两次返回内部错误，根因未定。因此本例通过已有的 `hostedModelRequest` 回调和 SDK 的 `createCatalogLanguageModel` 直连真实 Creative Reasoning API。`modelSource=hosted` 在这里选择模型代理协议；Agent/Simulator/Judge 都运行在本地，没有发布到托管环境。回调只转发真实模型请求和流式响应，没有硬编码对话或 Simulator 决策，也没有修改 GEA 源码。此例不能证明默认原生直连路径已经修复。多轮调试中还观察到一次 Simulator 的 1024-token 预算全部用于 provider reasoning、未产生 JSON 决策；因此模型适配器显式使用 `thinking.type=disabled`，并校验实际发送配置。这是本例的模型传输配置，不修改共享 runtime 或 Simulator Worker。

## 看结果

本轮真实验证 Run：`9e5da760-a98e-4d25-b4f2-43608df39434`。**7 次用户输入、7 次助手回复、7 次 Simulator 调用**；第 7 次 Simulator 返回结构化 done，`stopReason=simulator_done`，Judge 六项全过、得分 1、gate passed（1/1）。7 轮小于 `maxTurns=10`，不是靠上限终止。逐轮核对 Simulator 输入均为完整可见对话前缀，7 次请求均无工具；14 次实际模型请求均校验关闭 thinking。

真实对话中，顾客还把加雨罩后的超预算金额说成 20 元，助手纠正为 8 元；此后从城行22 调整为蓝色轻旅24（24L、780g、适配14英寸电脑、429元含防雨罩），回应了新增的周末用途、预算和重量要求。

本轮共有 4 次未通过的尝试：目标回复达到旧的 1024-token 上限；Simulator 提前结束导致 Judge 0.5；最终汇总不全且 Judge 漏识别费用确认的同义表述导致 0.5；Simulator 的预算被 provider reasoning 耗尽。分别修正本例预算/提示、同义词识别和传输配置后，第 5 次运行通过。六项语义要求和 `minScore=1` 未降低，未通过的运行没有计为成功；原始证据仅保留在本地。

- [results/latest.md](results/latest.md)：当前真实模型运行的完整对话、用户输入轮数、每轮 Simulator 决策、请求边界记录与 Judge 各项检查。具体 Run ID 和结果以该文件为准。
- 运行会刷新 `results/latest.md` 和本地 `results/latest.json`。Markdown 不输出本机结果目录或原始产物链接；JSON 可能包含绝对路径，已被忽略，不应提交。
- `.gea/evals/<时间戳>-<run>/` 内的 `cases/backpack/commute-weekend.json` 是完整 Case/Judge 证据，`simulator/*.json` 保存每次 Simulator 输入、输出与用量，`result.json` 为汇总。原始产物、traces 和 `*.log` 均留在本地，不随示例提交。

本例仅提交 `results/latest.md` 这一份可读结果。早期两轮版本曾因目标助手调用内置 `askUser` 而以 `target_waiting` 失败；因此目标指令使用普通文字提问。当前多轮版本实际运行结果和验证范围在上面的结果文件中披露，不把历史运行当成本次验证。
