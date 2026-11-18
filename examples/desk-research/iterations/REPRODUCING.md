# 运行与复现说明

三轮运行的 Agent、Judge 和 Simulator 均使用 `creative-reasoning-1.5`、`modelSource: "local"`，搜索使用 Exa。题目与 Judge 以 `4f4f51cdeb765027baa2cdf2be55ce93a33c5f02` 为基准。复现时，将该提交中六份多轮 `case.json` 的 Simulator 模型从 `gea-pro` 改为 `creative-reasoning-1.5`，三轮均使用这项覆盖。参数见 [protocol.json](protocol.json)。该文件记录比较条件，执行器不会自动读取它。

## 工具链与批次

首批用公开 `0.2.261114-alpha.0` CLI/SDK 执行三轮各四题，全部执行错误（共 12 个），评分在产生逐题结果前中断。这批失败如实保留在各轮 `published-execution-results.json`、`published-attempt.json` 与 [published-attempt-protocol.json](published-attempt-protocol.json)，不与任何分数混算。

之后的三轮成绩与预算题后续尝试都使用同一套未发布的本地候选工具链（CLI、App Server、SDK、contract），以及 [CR Catalog](../evaluation/cr-local.catalog.json)。候选构件未随示例分发，仅安装公开包不能精确复现该批次，这些结果也不能视为公开 npm 版本的端到端通过。执行预算见 [runtime-candidate.json](runtime-candidate.json)。

Agent 为 16 步 / 240 秒，Judge 为 12 步 / 300 秒，并发为 2；Catalog 总输出上限 4096、思考上限 1024，Simulator 自身输出上限 2048。详细配置步骤见 [evaluation](../evaluation/README.md#本次真实比较的运行条件)，执行与评分命令见 [README](../README.md#2-跑分)。新运行需单独保存，不能覆盖旧结果。

## 源码与结果对应

- Baseline 与第一次迭代的首批结果对应各自 `manifest.json`。
- 第二次迭代首批结果对应 `pre-fix-manifest.json`；预算题三次后续尝试依次对应 `budget-attempt-1-manifest.json`、`budget-attempt-2-manifest.json`、`budget-attempt-3-manifest.json`。
- 第二次迭代当前 `manifest.json` 对应后续读取策略修正后的源码。该版本只有已记录的离线验证，没有新的模型分数，不能将旧结果改标为当前源码的成绩。

`source/` 保存三轮的完整源码快照。为与对外示例一致，快照已移除与三轮质量比较无关的旧阶段与功能扩展文件（`versions/`、`scripts/materialize.mjs` 及对应 stages / materialize 测试）和未使用的扩展依赖；这些文件不参与 Agent 执行与评分。各 manifest 按移除后的文件重算 `sourceSha256`，执行时的原始哈希保留在 `executedSourceSha256`，与运行记录中的 `sourceSha256` 对应；移除前的完整快照见 main 上的 commit `5d6f385d014d6965e29b35e9eecb4951e19c7ad2`。根目录完整示例包含后续结构化观察能力，不能用它替代三轮源码。源码历史可通过 `provenance.json` 和 `changes.diff` 追溯：01、02 的 `changes.diff` 可在前一轮 `source/` 的副本中用 `git apply --unidiff-zero` 应用，结果与本轮 `source/` 一致；00 的 `changes.diff` 相对原始基线 `5b43037847ec8093ad5e5e4a7b24d23d59c5c547`（不含上面移除的文件）。[跨轮补丁测试](iteration-diffs.test.mjs) 会检查这一点。

在示例根目录校验快照：

```bash
node scripts/snapshot-iteration.mjs verify 00-baseline
node scripts/snapshot-iteration.mjs verify 01-result-focused
node scripts/snapshot-iteration.mjs verify 02-trace-focused
```

校验只证明源码未变，忽略生成的 `node_modules`、`.gea`、`dist`；它不验证实验条件或研究结论。

## 阅读结果

各轮 `results.json`、`multi-results.json` 保留分享版回答、Trace 和原始自动分数；`review-notes.json` 单独保留人工争议。`run-receipts.json` 保存运行身份与原生证据哈希；执行记录中的私有目录已移除或替换为用途占位符。分享版 Trace 已裁剪，缺少正文片段不能证明原始执行没有读到正文；完整原生记录未随示例分发。

Exa、网页内容和模型别名会变化。一次分数差异不证明稳定提升；改 Judge 时应对同一原生回答统一重评，并保留旧评分。预算题后续尝试独立展示，不与首批结果拼分。
