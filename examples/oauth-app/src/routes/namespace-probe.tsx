import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/namespace-probe")({ component: ProbePage });

function ProbePage() {
  const [started, setStarted] = useState(false);
  const [receipt, setReceipt] = useState("");
  async function create() {
    setStarted(true);
    try {
      const response = await fetch("/api/namespace-probe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const result = await response.json();
      setReceipt(JSON.stringify({ status: response.status, ...result }, null, 2));
    } catch {
      setReceipt("写入结果未确认。请保留此页面，不要重复发送。");
    }
  }
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <h1 className="text-2xl font-semibold">网页与 Agent 共享记录验证</h1>
      <p>先在此 Preview 应用登录，再创建一条唯一的合成记录。</p>
      <button className="rounded border px-4 py-2 disabled:opacity-50" disabled={started} onClick={create}>
        {started ? "已提交，请核对结果" : "创建合成记录"}
      </button>
      <pre className="overflow-auto whitespace-pre-wrap rounded border p-4" aria-label="写入结果">{receipt || "尚未写入"}</pre>
      <p>创建成功后，返回聊天并新建对话。让 Agent 调用 read_namespace_probe，只提供上面的 probeId。核对 Tool 返回的 marker 与对象 ID 前缀是否与本页一致。</p>
      <a className="underline" href="/">返回登录或聊天</a>
    </main>
  );
}
