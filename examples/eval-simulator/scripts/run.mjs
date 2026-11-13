import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { modelRequest } from "./model.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
// Temporary source runner while #1280 is not available in a published CLI/SDK.
const source = path.resolve(
  process.env.GEA_SOURCE_ROOT || path.join(root, "../../../.runtime"),
);
const load = (name) =>
  import(
    pathToFileURL(
      path.join(
        source,
        "packages/local-backend/src/commands/agent-packages",
        name,
      ),
    ).href
  );
process.env.GEA_CONFIG_DIR = path.join(root, ".gea/config");
process.env.GEA_APP_SERVER_STATE_DIR = path.join(root, ".gea/app-server");
process.env.GEA_LOCAL_API_AUTH = "0";
process.env.GEA_APP_SERVER_BINARY ||= path.join(
  source,
  "toolchain/gea-app-server",
);
process.env.GEA_WORKER_RUNTIME_BINARY ||= path.join(
  source,
  "toolchain/gea-worker-runtime",
);
process.env.WORKER_RUNTIME_SYSTEM_WORKER_ROOT ||= path.join(
  source,
  "toolchain/system-workers",
);
delete process.env.GEA_APP_SERVER_API_URL;
delete process.env.GEA_APP_SERVER_API_TOKEN;
const { connectLocalAppServerEnvironment, closeOwnedLocalAppServers } =
  await load("local-app-server-process.ts");
const { runAgentEvalProject } = await load("eval.ts");
const simulatorRequests = [];

try {
  const environment = await connectLocalAppServerEnvironment(process.env);
  if (!process.env.CREATIVE_REASONING_API_KEY)
    throw new Error("Set CREATIVE_REASONING_API_KEY or .gea/model.env");
  const result = await runAgentEvalProject(
    { cwd: root, modelSource: "hosted", trace: true, concurrency: 1 },
    {
      environment,
      hostedModelRequest: modelRequest(
        process.env.CREATIVE_REASONING_API_KEY,
        (receipt) => simulatorRequests.push(receipt),
      ),
      signal: AbortSignal.timeout(480_000),
    },
  );
  const artifact = JSON.parse(
    await readFile(
      path.join(result.resultDirectory, "cases/backpack/commute-weekend.json"),
      "utf8",
    ),
  );
  const lines = [
    "# 多轮 Eval User Simulator 实际运行结果",
    "",
    `Run: ${result.runId}`,
    `用户输入轮数：${artifact.run.messages.filter((message) => message.role === "user").length}`,
    "场景：从通勤初选到雨天成本、周末过夜、提高预算与重量限制，再确认含配件总价。",
    "模型传输：本次所有请求均校验 thinking.type=disabled；Simulator 原有 1024-token 上限不变。",
    "原始结果与 Simulator 输入/输出仅保存在运行机器，未提交。",
    "",
    "## 对话",
    "",
  ];
  for (const message of artifact.run.messages) {
    const text = message.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("");
    lines.push(`**${message.role === "user" ? "用户" : "助手"}**：${text}`, "");
  }
  const conversation = artifact.run.conversation;
  lines.push(
    "## Simulator 请求边界（本次实际模型请求）",
    "",
    "每条记录对应一次真实 Simulator 请求；只记录边界元数据，不保存密钥。",
    "",
    "```json",
    JSON.stringify(simulatorRequests, null, 2),
    "```",
    "",
  );
  lines.push("## Simulator 决策", "");
  for (const turn of conversation.turns) {
    lines.push(
      `第 ${turn.turn} 轮，目标 Run: ${turn.target.runId}`,
      "",
      "```json",
      JSON.stringify(turn.simulator?.decision ?? null, null, 2),
      "```",
      "",
    );
  }
  lines.push(
    "## Case/Judge",
    "",
    "```json",
    JSON.stringify(
      {
        stopReason: conversation.stopReason,
        baselineEligible: conversation.baselineEligible,
        intervened: conversation.intervened,
        judges: artifact.judges,
        summary: result.summary,
      },
      null,
      2,
    ),
    "```",
    "",
  );
  await mkdir(path.join(root, "results"), { recursive: true });
  await writeFile(
    path.join(root, "results/latest.json"),
    JSON.stringify({ ...result, simulatorRequests }, null, 2) + "\n",
  );
  await writeFile(path.join(root, "results/latest.md"), lines.join("\n"));
  console.log(JSON.stringify(result, null, 2));
  console.log(`查看对话：${path.join(root, "results/latest.md")}`);
  if (
    artifact.run.conversation?.stopReason !== "simulator_done" ||
    result.summary.averageScore !== 1 ||
    result.summary.gate.status !== "passed" ||
    simulatorRequests.length !== conversation.turns.length
  )
    process.exitCode = 1;
} finally {
  await closeOwnedLocalAppServers();
}
