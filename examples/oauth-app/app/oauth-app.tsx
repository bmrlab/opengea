"use client";
import { useEffect, useRef, useState } from "react";
import { isToolUIPart, type UIMessage } from "ai";
import {
  ArrowRightIcon,
  ArrowUpIcon,
  CheckIcon,
  CodeIcon,
  DownloadIcon,
  FileIcon,
  LogOutIcon,
  MessageCircleIcon,
  PlusIcon,
  PaperclipIcon,
  RotateCcwIcon,
  SquareIcon,
  XIcon,
} from "lucide-react";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import {
  fileDownloadPath,
  messageFileDownloadPath,
  maxMessageFiles,
  maxUploadBytes,
} from "@/lib/files";
import {
  ApiError,
  checked,
  consume,
  openStream,
  readHistory,
  readConversations,
  readConversation,
  readArtifacts,
  createConversation,
  uploadFile,
  type ArtifactView,
  type FileView,
  type ConversationSummary,
  readSession,
  type SessionView,
} from "./client-api";

const notices: Record<string, string> = {
  access_denied: "Authorization was cancelled. You can sign in whenever you're ready.",
  invalid_state: "This sign-in link expired or belongs to a different browser. Start again here.",
  oauth_failed: "GEA could not complete sign-in. Check the application registration and try again.",
  revoke_failed:
    "GEA has not confirmed revocation. API access is blocked; retry signing out below.",
};
const activeRun = (status: string | undefined) =>
  status !== undefined && ["queued", "running", "pending", "streaming"].includes(status);

export function OAuthApp() {
  const [session, setSession] = useState<SessionView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messageCursor, setMessageCursor] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversationCursor, setConversationCursor] = useState<string | null>(null);
  const [agentId, setAgentId] = useState("");
  const [runStatus, setRunStatus] = useState<string | undefined>();
  const [files, setFiles] = useState<FileView[]>([]);
  const [artifacts, setArtifacts] = useState<ArtifactView[]>([]);
  const [artifactCursor, setArtifactCursor] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const controller = useRef<AbortController | null>(null);
  const inFlight = useRef(false);
  function upsert(message: UIMessage) {
    setMessages((current) =>
      current.some((m) => m.id === message.id)
        ? current.map((m) => (m.id === message.id ? message : m))
        : [...current, message],
    );
  }
  function selectId(id: string | null) {
    if (id !== chatId) {
      setFiles([]);
      setArtifacts([]);
      setArtifactCursor(null);
    }
    setChatId(id);
    const url = new URL(window.location.href);
    url.searchParams.delete("notice");
    if (id) url.searchParams.set("conversation", id);
    else url.searchParams.delete("conversation");
    window.history.replaceState(null, "", url);
  }
  function display(state: Awaited<ReturnType<typeof readConversation>>) {
    setMessages(state.messages);
    setMessageCursor(state.nextCursor);
    setRunStatus(state.run?.status);
    setAgentId(state.conversation.agent_id);
    setArtifacts(state.artifacts.items);
    setArtifactCursor(state.artifacts.next_cursor);
  }
  useEffect(() => {
    // Synchronize with the backend and the selected conversation URL on mount.
    const abort = new AbortController();
    const url = new URL(window.location.href);
    const code = url.searchParams.get("notice");
    setNotice(code && notices[code] ? notices[code] : null);
    void (async () => {
      try {
        const view = await readSession(abort.signal);
        if (abort.signal.aborted) return;
        setSession(view);
        setAgentId(view.agents[0]?.id ?? "");
        const page = await readConversations(null, abort.signal);
        if (abort.signal.aborted) return;
        setConversations(page.items);
        setConversationCursor(page.next_cursor);
        const id = url.searchParams.get("conversation") ?? page.items[0]?.id;
        if (id) {
          selectId(id);
          const state = await readConversation(id, abort.signal);
          if (!abort.signal.aborted) display(state);
        }
      } catch (e) {
        if (!abort.signal.aborted && !(e instanceof ApiError && e.status === 401))
          setError(e instanceof Error ? e.message : "Could not restore this session.");
      } finally {
        if (!abort.signal.aborted) setLoading(false);
      }
    })();
    return () => {
      abort.abort();
      controller.current?.abort();
    };
  }, []);
  async function refreshList(signal?: AbortSignal) {
    const page = await readConversations(null, signal);
    setConversations(page.items);
    setConversationCursor(page.next_cursor);
  }
  async function restore(id = chatId) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    const abort = new AbortController();
    controller.current = abort;
    try {
      if (id === chatId) await refreshList(abort.signal);
      if (id) {
        const state = await readConversation(id, abort.signal);
        selectId(id);
        display(state);
        if (activeRun(state.run?.status)) {
          // Reconnect uses the Run's baseline, never the already rendered partial output.
          await consume(await openStream(id, abort.signal), upsert, {
            chatId: id,
            runId: state.run!.id,
          });
          display(await readConversation(id, abort.signal));
        }
      }
    } catch (e) {
      if (!abort.signal.aborted)
        setError(e instanceof Error ? e.message : "Could not restore the conversation.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  async function loadMore(kind: "conversations" | "messages" | "artifacts") {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      if (kind === "conversations" && conversationCursor) {
        const page = await readConversations(conversationCursor);
        setConversations((current) => [
          ...current,
          ...page.items.filter((item) => !current.some((c) => c.id === item.id)),
        ]);
        setConversationCursor(page.next_cursor);
      } else if (kind === "artifacts" && chatId && artifactCursor) {
        const page = await readArtifacts(chatId, artifactCursor);
        setArtifacts((current) => [
          ...current,
          ...page.items.filter((item) => !current.some((file) => file.id === item.id)),
        ]);
        setArtifactCursor(page.next_cursor);
      } else if (kind === "messages" && chatId && messageCursor) {
        const page = await readHistory(chatId, undefined, messageCursor);
        setMessages((current) => [
          ...page.messages.filter((item) => !current.some((m) => m.id === item.id)),
          ...current,
        ]);
        setMessageCursor(page.nextCursor);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load history.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  async function prepareConversation(title: string, signal: AbortSignal) {
    if (chatId) return chatId;
    const conversation = await createConversation(agentId, title.slice(0, 80), signal);
    selectId(conversation.id);
    setConversations((current) => [
      conversation,
      ...current.filter((item) => item.id !== conversation.id),
    ]);
    return conversation.id;
  }
  async function attach(selected: File[]) {
    if (!selected.length || inFlight.current || !agentId) return;
    if (selected.length + files.length > maxMessageFiles) {
      setError("Attach at most 10 files to one message.");
      return;
    }
    if (selected.some((file) => file.size > maxUploadBytes)) {
      setError("Choose files no larger than 4 MiB each.");
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setUploading(true);
    setError(null);
    const abort = new AbortController();
    controller.current = abort;
    try {
      const id = await prepareConversation(input.trim() || selected[0]!.name, abort.signal);
      for (const file of selected) {
        const uploaded = await uploadFile(id, file, abort.signal);
        setFiles((current) => [...current, uploaded]);
      }
    } catch (error) {
      if (!abort.signal.aborted)
        setError(
          error instanceof Error
            ? error.message
            : "File upload failed. Successfully uploaded attachments remain in the draft.",
        );
    } finally {
      inFlight.current = false;
      setBusy(false);
      setUploading(false);
    }
  }
  async function send(event: React.FormEvent) {
    event.preventDefault();
    if ((!input.trim() && !files.length) || inFlight.current || (!chatId && !agentId)) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    setRunStatus(undefined);
    const message = input.trim();
    const abort = new AbortController();
    controller.current = abort;
    let id = chatId;
    try {
      id = await prepareConversation(
        message || files[0]?.filename || "New conversation",
        abort.signal,
      );
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "user",
          parts: [
            ...(message ? [{ type: "text" as const, text: message }] : []),
            ...files.map((file) => ({
              type: "file" as const,
              mediaType: file.media_type,
              filename: file.filename,
              url: `/api/v1/files/${file.id}/content`,
            })),
          ],
        },
      ]);
      setInput("");
      setFiles([]);
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message,
          chatId: id,
          fileIds: files.map((file) => file.id),
        }),
        signal: abort.signal,
      });
      id = response.headers.get("x-gea-agent-session-id") ?? id;
      if (id) selectId(id);
      if (response.ok) setRunStatus("running");
      await consume(response, upsert);
      if (id) display(await readConversation(id, abort.signal));
      await refreshList(abort.signal);
    } catch (e) {
      setRunStatus(undefined);
      if (!abort.signal.aborted)
        setError(
          e instanceof Error
            ? e.message
            : "Connection interrupted. Refresh history before sending again.",
        );
      // A lost Session or Run response may still have persisted on GEA.
      if (!abort.signal.aborted) {
        try {
          await refreshList(abort.signal);
        } catch {
          /* Keep the original error visible. */
        }
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  async function stop() {
    if (!chatId) return;
    try {
      await checked(
        await fetch("/api/chat/cancel", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ chatId }),
        }),
      );
      controller.current?.abort();
      setError(null);
      setRunStatus("abort_requested");
      setNotice("Cancellation requested. Restore the conversation to read the final status.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not request cancellation.");
    }
  }
  const agent = session?.agents.find((item) => item.id === agentId);
  const name = session?.user.name ?? "GEA user";
  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col px-5 md:px-10">
      <header className="flex items-center justify-between gap-4 py-6">
        <a href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            G
          </span>{" "}
          OpenGEA <span className="font-normal text-muted-foreground">/ OAuth Chat</span>
        </a>
        <a
          href="https://github.com/bmrlab/opengea"
          className="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <CodeIcon className="size-4" />
          <span className="hidden sm:inline">Source code</span>
        </a>
      </header>
      <Separator />
      {(notice || error || runStatus === "error") && (
        <Alert
          className="my-5"
          variant={error || runStatus === "error" ? "destructive" : "default"}
        >
          <AlertTitle>
            {error || runStatus === "error" ? "Request needs attention" : "Account update"}
          </AlertTitle>
          <AlertDescription>
            {error ??
              (runStatus === "error"
                ? "GEA could not complete the last run. The conversation is saved. Try another message or ask the Agent owner to check its runtime logs."
                : notice)}
          </AlertDescription>
        </Alert>
      )}
      {loading ? (
        <p role="status" className="py-20 text-center text-muted-foreground">
          Restoring your session…
        </p>
      ) : !session ? (
        <section className="mx-auto flex max-w-xl flex-1 flex-col items-center justify-center gap-7 py-20 text-center">
          <Badge variant="secondary">GEA · User authorization</Badge>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Your GEA.
            <br />
            <span className="text-muted-foreground">A new place to talk.</span>
          </h1>
          <p className="max-w-md text-base leading-7 text-muted-foreground">
            Sign in with your GEA account, choose your organization, and start a conversation with
            an authorized Agent.
          </p>
          <form action="/auth/login" method="post">
            <Button size="lg" type="submit">
              Continue with GEA <ArrowRightIcon data-icon="inline-end" />
            </Button>
          </form>
          <p className="max-w-sm text-xs leading-5 text-muted-foreground">
            GEA handles sign-in and consent. You control which organization this app can access.
          </p>
          <form action="/auth/logout" method="post">
            <Button variant="ghost" size="sm" type="submit">
              Clear session &amp; revoke access
            </Button>
          </form>
        </section>
      ) : (
        <div className="grid flex-1 gap-8 py-8 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <Badge variant="secondary">
                <CheckIcon data-icon="inline-start" />
                Connected to GEA
              </Badge>
              <h1 className="text-xl font-semibold">Hello, {name}.</h1>
              <p className="text-sm text-muted-foreground">Your organization</p>
              <p className="font-medium">{session.organization.name}</p>
              <p className="text-xs text-muted-foreground">{session.organization.slug}</p>
            </div>
            <Separator />
            <div className="flex flex-col gap-3">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Authorized Agent
              </p>
              {session.agents.length > 1 && !chatId ? (
                <Field>
                  <FieldLabel htmlFor="agent">Agent</FieldLabel>
                  <select
                    id="agent"
                    className="rounded-md border bg-background p-2 text-sm"
                    value={agentId}
                    disabled={busy}
                    onChange={(event) => setAgentId(event.target.value)}
                  >
                    {session.agents.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : (
                <p className="text-sm">{agent?.name ?? "No authorized Agent"}</p>
              )}
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  selectId(null);
                  setMessages([]);
                  setRunStatus(undefined);
                  setError(null);
                  setMessageCursor(null);
                  setAgentId(session.agents[0]?.id ?? "");
                }}
              >
                <PlusIcon data-icon="inline-start" />
                New conversation
              </Button>
              <Button variant="ghost" disabled={busy} onClick={() => void restore()}>
                <RotateCcwIcon data-icon="inline-start" />
                Restore conversation
              </Button>
            </div>
            <nav aria-label="Conversation history" className="flex flex-col gap-2">
              <p className="text-sm font-medium">Conversation history</p>
              {!conversations.length && (
                <p className="text-xs text-muted-foreground">No conversations on this page.</p>
              )}
              {conversations.map((item) => (
                <Button
                  key={item.id}
                  variant={item.id === chatId ? "secondary" : "ghost"}
                  className="justify-start"
                  disabled={busy}
                  aria-current={item.id === chatId ? "true" : undefined}
                  onClick={() => void restore(item.id)}
                >
                  <span className="truncate">{item.title ?? "Untitled conversation"}</span>
                </Button>
              ))}
              {conversationCursor && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => void loadMore("conversations")}
                >
                  Load more conversations
                </Button>
              )}
            </nav>
            {chatId && (
              <section aria-label="Session artifacts" className="flex flex-col gap-3">
                <div>
                  <h2 className="text-sm font-medium">Artifacts</h2>
                  <p className="text-xs text-muted-foreground">
                    Files generated in this conversation
                  </p>
                </div>
                {!artifacts.length && (
                  <p className="text-xs text-muted-foreground">No generated files yet.</p>
                )}
                <ul className="flex max-h-64 flex-col gap-3 overflow-y-auto">
                  {artifacts.map((file) => (
                    <li key={file.id} className="flex flex-col gap-1 rounded-lg border p-3">
                      <span className="break-words text-sm font-medium">
                        {file.title || file.filename}
                      </span>
                      <span className="break-all text-xs text-muted-foreground">
                        {file.filename} · {Math.max(1, Math.ceil(file.size / 1024))} KiB
                      </span>
                      <Button asChild variant="ghost" size="sm" className="justify-start">
                        <a href={fileDownloadPath(file.id)} target="_blank" rel="noreferrer">
                          <DownloadIcon data-icon="inline-start" />
                          Download
                        </a>
                      </Button>
                    </li>
                  ))}
                </ul>
                {artifactCursor && (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => void loadMore("artifacts")}
                  >
                    Load more artifacts
                  </Button>
                )}
              </section>
            )}
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">Verified account details</summary>
              <dl className="mt-4 flex flex-col gap-2 break-all">
                <dt>Organization ID</dt>
                <dd>{session.organization.id}</dd>
                <dt>Pairwise subject</dt>
                <dd>{session.user.sub}</dd>
                <dt>Granted scopes</dt>
                <dd>{session.scopes.join(", ")}</dd>
              </dl>
              <p className="mt-3">
                Profile read from GEA's userinfo API. Organization verified during token exchange.
              </p>
            </details>
            <form action="/auth/logout" method="post" className="mt-auto">
              <Button variant="ghost" type="submit">
                <LogOutIcon data-icon="inline-start" />
                Sign out &amp; revoke
              </Button>
            </form>
          </aside>
          <section
            className="flex h-[70dvh] min-h-[480px] flex-col rounded-2xl border bg-card"
            aria-label="Agent conversation"
          >
            <div className="flex items-center justify-between gap-4 border-b px-5 py-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <MessageCircleIcon className="size-4" />
                {agent?.name ?? "Conversation"}
              </div>
              <span role="status" className="text-xs text-muted-foreground">
                {busy
                  ? "Working…"
                  : activeRun(runStatus)
                    ? "Run in progress · Restore to reconnect"
                    : runStatus === "error"
                      ? "Last run failed"
                      : "Ready"}
              </span>
            </div>
            <Conversation>
              <ConversationContent>
                {messageCursor && (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => void loadMore("messages")}
                  >
                    Load earlier messages
                  </Button>
                )}
                {!messages.length && (
                  <ConversationEmptyState
                    title="What would you like to explore?"
                    description="Ask a question or pick up an idea. This conversation runs with your GEA permissions."
                    icon={<MessageCircleIcon className="size-7" />}
                  />
                )}
                {messages.map((message) => (
                  <Message key={message.id} from={message.role}>
                    <p className="text-xs text-muted-foreground">
                      {message.role === "user" ? "You" : agent?.name}
                    </p>
                    <MessageContent>
                      {message.role === "assistant" && message.parts.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                          No assistant output was saved for this turn.
                        </p>
                      )}
                      {message.parts.map((part, index) =>
                        part.type === "text" ? (
                          <p key={index} className="whitespace-pre-wrap leading-7">
                            {part.text}
                          </p>
                        ) : part.type === "reasoning" ? (
                          <details key={index}>
                            <summary className="cursor-pointer text-xs text-muted-foreground">
                              Reasoning
                            </summary>
                            <p className="whitespace-pre-wrap leading-6">{part.text}</p>
                          </details>
                        ) : part.type === "file" ? (
                          <p key={index} className="flex items-center gap-2 text-sm">
                            <FileIcon className="size-4 shrink-0" />
                            {messageFileDownloadPath(part.url) ? (
                              <a
                                className="break-all underline underline-offset-4"
                                href={messageFileDownloadPath(part.url)}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {part.filename || "Attached file"}
                              </a>
                            ) : (
                              <span>{part.filename || "Attached file"}</span>
                            )}
                          </p>
                        ) : isToolUIPart(part) ? (
                          <p key={index} className="text-xs text-muted-foreground">
                            {part.type === "dynamic-tool" ? part.toolName : part.type.slice(5)} ·{" "}
                            {part.state}
                            {part.state === "approval-requested"
                              ? " — this tool needs approval, which this example does not submit. Start a new conversation without this tool."
                              : ""}
                          </p>
                        ) : null,
                      )}
                    </MessageContent>
                  </Message>
                ))}
              </ConversationContent>
              <ConversationScrollButton aria-label="Jump to latest message" />
            </Conversation>
            <form onSubmit={send} className="flex flex-col gap-3 border-t p-4">
              {files.length > 0 && (
                <ul aria-label="Message attachments" className="flex flex-wrap gap-2">
                  {files.map((file) => (
                    <li
                      key={file.id}
                      className="flex min-w-0 max-w-full items-center gap-1 rounded-lg border px-2 py-1"
                    >
                      <FileIcon className="size-4 shrink-0" />
                      <a
                        className="truncate text-sm underline underline-offset-4"
                        href={fileDownloadPath(file.id)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {file.filename}
                      </a>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Remove ${file.filename} from message`}
                        disabled={busy}
                        onClick={() =>
                          setFiles((current) => current.filter((item) => item.id !== file.id))
                        }
                      >
                        <XIcon />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="message" className="sr-only">
                    Message
                  </FieldLabel>
                  <Textarea
                    id="message"
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder="Ask your Agent…"
                    maxLength={8000}
                    disabled={busy || !agent}
                    className="min-h-20 resize-none"
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" &&
                        !event.shiftKey &&
                        !event.nativeEvent.isComposing
                      ) {
                        event.preventDefault();
                        event.currentTarget.form?.requestSubmit();
                      }
                    }}
                  />
                </Field>
              </FieldGroup>
              <div className="flex items-center justify-between gap-3">
                <input
                  ref={fileInput}
                  type="file"
                  multiple
                  className="sr-only"
                  aria-label="Choose files"
                  disabled={busy || !agent || activeRun(runStatus)}
                  onChange={(event) => {
                    const selected = Array.from(event.currentTarget.files ?? []);
                    event.currentTarget.value = "";
                    void attach(selected);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || !agent || activeRun(runStatus)}
                  onClick={() => fileInput.current?.click()}
                >
                  <PaperclipIcon data-icon="inline-start" />
                  {uploading ? "Uploading…" : "Attach files"}
                </Button>
                <span className="text-xs text-muted-foreground">
                  {chatId ? "Saved in GEA · 4 MiB per file" : "Up to 10 files · 4 MiB each"}
                </span>
                {activeRun(runStatus) ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!chatId}
                    onClick={() => void stop()}
                  >
                    <SquareIcon data-icon="inline-start" />
                    Stop run
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={busy || (!input.trim() && !files.length) || !agent}
                  >
                    <ArrowUpIcon data-icon="inline-start" />
                    Send
                  </Button>
                )}
              </div>
            </form>
          </section>
        </div>
      )}
      <footer className="flex flex-wrap justify-between gap-3 border-t py-5 text-xs text-muted-foreground">
        <span>An open-source example from OpenGEA</span>
        <a href="https://musegea.com/developers">Built with the GEA HTTP API ↗</a>
      </footer>
    </main>
  );
}
