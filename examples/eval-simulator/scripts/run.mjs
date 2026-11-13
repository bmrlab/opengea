import { spawn } from "node:child_process";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { geaInstallation } from "@gea-ai/cli/runtime";

const root = fileURLToPath(new URL("../", import.meta.url));
// Resolve the pinned npm distribution, without local source/binary overrides.
const installation = geaInstallation({});
const environment = {
  ...process.env,
  GEA_CLI_DISTRIBUTION_ROOT: path.dirname(installation.cli),
  GEA_WORKER_RUNTIME_BINARY: installation.runtime,
  WORKER_RUNTIME_SYSTEM_WORKER_ROOT: installation.systemWorkers,
  GEA_CONFIG_DIR: path.join(root, ".gea/config"),
  GEA_APP_SERVER_STATE_DIR: path.join(root, ".gea/app-server"),
  GEA_LOCAL_API_AUTH: "0",
};
for (const key of [
  "GEA_APP_SERVER_API_URL",
  "GEA_APP_SERVER_API_TOKEN",
  "GEA_APP_SERVER_BINARY",
  "GEA_CLI_BINARY",
]) delete environment[key];

const child = spawn(
  installation.cli,
  [
    "agent",
    "eval",
    "--json",
    JSON.stringify({ cwd: root, modelSource: "local", trace: true, concurrency: 1 }),
  ],
  { cwd: root, env: environment, stdio: ["ignore", "pipe", "inherit"] },
);
let output = "";
child.stdout.setEncoding("utf8");
child.stdout.on("data", (chunk) => {
  output += chunk;
});
const interrupt = () => child.kill("SIGINT");
const terminate = () => child.kill("SIGTERM");
process.on("SIGINT", interrupt);
process.on("SIGTERM", terminate);
const timeout = setTimeout(() => {
  console.error("Eval exceeded the 8-minute budget; asking the CLI to cancel.");
  terminate();
}, 480_000);

try {
  await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => {
      if (code === 0) resolve();
      else {
        process.exitCode = code || 1;
        reject(
          new Error(`GEA CLI eval exited with ${signal || code}; see its error above.`),
        );
      }
    });
  });
  const result = JSON.parse(output);
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
    "模型传输：已发布 CLI 的本地模型入口；本次不采集旧程序化回调的请求边界记录。",
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
    JSON.stringify(result, null, 2) + "\n",
  );
  await writeFile(path.join(root, "results/latest.md"), lines.join("\n"));
  console.log(JSON.stringify(result, null, 2));
  console.log(`查看对话：${path.join(root, "results/latest.md")}`);
  if (
    artifact.run.conversation?.stopReason !== "simulator_done" ||
    result.summary.averageScore !== 1 ||
    result.summary.gate.status !== "passed"
  )
    process.exitCode = 1;
} catch (error) {
  console.error(error.message);
  process.exitCode ||= 1;
} finally {
  clearTimeout(timeout);
  process.off("SIGINT", interrupt);
  process.off("SIGTERM", terminate);
}
