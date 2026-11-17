const byId = (id) => document.getElementById(id);
let sessionId = localStorage.getItem("product-research-session");
let busy = false;
const notice = (value) => {
  byId("notice").textContent = value;
};
const label = () => {
  byId("session").textContent = sessionId
    ? `研究对话：${sessionId}`
    : "尚未创建对话";
};
async function api(path, body) {
  const response = await fetch(
    path,
    body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`);
  return data;
}
function textNode(tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}
async function refresh() {
  const data = await api("/api/research");
  const records = byId("records");
  records.replaceChildren();
  for (const item of data.items) {
    const card = document.createElement("article");
    card.append(
      textNode("h3", item.title),
      textNode(
        "p",
        `${item.status === "complete" ? "已完成" : "研究中"} · ${item.updatedAt}`,
      ),
      textNode("p", item.scope),
      textNode("pre", item.report || "尚未生成简报"),
    );
    for (const source of item.sources) {
      const link = document.createElement("a");
      if (!/^https?:\/\//u.test(source.url)) continue;
      link.href = source.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = source.title;
      card.append(link, textNode("blockquote", source.excerpt));
    }
    records.append(card);
  }
  if (!data.items.length)
    records.append(
      textNode("p", "还没有研究记录。Agent 首次保存后会显示在这里。"),
    );
  if (sessionId) {
    const messages = await api(`/api/sessions/${sessionId}/messages`);
    const container = byId("messages");
    container.replaceChildren();
    for (const message of [...messages.items].reverse()) {
      const text = (message.parts ?? [])
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("\n");
      if (text)
        container.append(
          textNode(
            "p",
            `${message.role === "user" ? "你" : "研究助手"}：${text}`,
          ),
        );
    }
  }
}
async function waitForRun(id) {
  const deadline = Date.now() + 300000;
  while (Date.now() < deadline) {
    const run = await api(`/api/runs/${id}`);
    if (run.status === "finished") return;
    if (["error", "aborted", "interrupted"].includes(run.status))
      throw new Error(
        `本轮未完成（${run.status}）。先刷新消息，检查原因后再提交。`,
      );
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(
    "仍未确认本轮结束。请先刷新消息和记录，不要重复提交研究要求。",
  );
}
byId("new").onclick = () => {
  if (busy) return;
  sessionId = null;
  localStorage.removeItem("product-research-session");
  byId("messages").replaceChildren();
  label();
  notice("下一次发送将创建新的研究。");
};
byId("refresh").onclick = () =>
  refresh()
    .then(() => notice("已刷新。"))
    .catch((error) => notice(error.message));
byId("form").onsubmit = async (event) => {
  event.preventDefault();
  if (busy) return;
  busy = true;
  byId("send").disabled = true;
  byId("new").disabled = true;
  notice("正在处理。不要重复提交；等待期间可以刷新研究记录。");
  try {
    if (!sessionId) {
      const session = await api("/api/sessions", {});
      if (typeof session.id !== "string")
        throw new Error("未取得 Session ID，请检查当前 CLI 的 API 响应。");
      sessionId = session.id;
      localStorage.setItem("product-research-session", sessionId);
      label();
    }
    const run = await api(`/api/sessions/${sessionId}/runs`, {
      input: byId("input").value,
    });
    if (typeof run.id !== "string")
      throw new Error("未取得 Run ID，请刷新消息确认状态，不要重复提交。");
    await waitForRun(run.id);
    await refresh();
    notice("本轮已完成。查看回复及研究记录；若助手正在澄清，可继续回答。");
  } catch (error) {
    notice(error.message);
  } finally {
    busy = false;
    byId("send").disabled = false;
    byId("new").disabled = false;
  }
};
label();
refresh().catch((error) => notice(error.message));
