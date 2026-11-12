# 最小 Eval User Simulator

一个背包助手、一个 Case、一个代码 Judge。真实模型先询问颜色；Simulator 模拟喜欢蓝色的顾客回答，看到推荐和价格后输出 `{"done":true,"reason":"…"}`。Judge 检查完整对话以及最终的蓝色背包、199 元报价。done 只结束对话，合格与否由 Judge 判断。

Simulator 使用 GEA #1280 的无工具实现：只接收 persona、goal 和可见对话，不提供工具，也不传 Judge/预期答案。模型传输层额外检查 Simulator 请求的 `tools=[]`、`toolChoice=none`，并在日志输出检查结果。目标助手用普通文字提问；此例不演示 `askUser` 工具回填。

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

每次运行都会调用真实模型，最多 3 次目标 Agent 输入，运行预算 4 分钟。运行状态限定在本例 `.gea/`，结束会关闭本次拥有的本地进程。`stopReason=simulator_done` 且 Judge 平均分为 1 时命令返回 0。如需保存命令输出，可追加 `> run.log 2>&1`。

历史运行中，原生 `modelSource=local` 在 Simulator 请求阶段两次返回内部错误，根因未定。因此本例通过已有的 `hostedModelRequest` 回调和 SDK 的 `createCatalogLanguageModel` 直连真实 Creative Reasoning API。`modelSource=hosted` 在这里选择模型代理协议；Agent/Simulator/Judge 都运行在本地，没有发布到托管环境。回调只转发真实模型请求和流式响应，没有硬编码对话或 Simulator 决策，也没有修改 GEA 源码。此例不能证明默认原生直连路径已经修复。

## 看结果

- [results/latest.md](results/latest.md)：脱敏后的历史运行结果，Run `a1efdd61-0fa6-4a25-ab3c-40c3ed15613c`。两轮对话后 Simulator 返回 done，结束原因为 `simulator_done`，Judge `recommendation` 得分 1，gate passed（1/1）。历史请求日志记录 Simulator `tools=[]`、`toolChoice={"type":"none"}`。本轮整理 PR 未重跑真实模型。
- 复跑会刷新 `results/latest.md` 和本地 `results/latest.json`。Markdown 不输出本机结果目录或原始产物链接；JSON 可能包含绝对路径，已被忽略，不应提交。
- `.gea/evals/<时间戳>-<run>/` 内的 `cases/backpack/blue-backpack.json` 是完整 Case/Judge 证据，`simulator/*.json` 保存每次 Simulator 输入、输出与用量，`result.json` 为汇总。原始产物、traces 和 `*.log` 均留在本地，不随示例提交。

本例仅提交 `results/latest.md` 这一份可读结果。历史首次运行因目标助手调用内置 `askUser` 而以 `target_waiting` 失败；随后明确目标指令只用文字提问，未修改运行时或放宽 Judge。
