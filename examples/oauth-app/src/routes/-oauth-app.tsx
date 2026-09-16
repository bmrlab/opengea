import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { type UIMessage } from "ai";
import {
  ArrowRightIcon,
  PanelLeftIcon,
  Settings2Icon,
  FolderIcon,
  SparklesIcon,
  CheckIcon,
  CodeIcon,
  DownloadIcon,
  LogOutIcon,
  MessageCircleIcon,
  PlusIcon,
  PaperclipIcon,
  RotateCcwIcon,
} from "lucide-react";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { ChatMessage } from "./-chat-message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
  PromptInputButton,
  PromptInputSubmit,
  PromptInputHeader,
} from "@/components/ai-elements/prompt-input";
import {
  Attachment,
  Attachments,
  AttachmentPreview,
  AttachmentInfo,
  AttachmentRemove,
} from "@/components/ai-elements/attachments";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Field, FieldLabel } from "@/components/ui/field";
import { fileDownloadPath, maxMessageFiles, maxUploadBytes } from "@/lib/files";
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
  readConnections,
  type SessionView,
} from "./-client-api";

const notices: Record<string, string> = {
  access_denied:
    "Authorization was cancelled. You can sign in whenever you're ready.",
  invalid_state:
    "This sign-in link expired or belongs to a different browser. Start again here.",
  oauth_failed:
    "GEA could not complete sign-in. Check the application registration and try again.",
  revoke_failed:
    "GEA has not confirmed revocation. API access is blocked; retry signing out below.",
};
const activeRun = (status: string | undefined) =>
  status !== undefined &&
  ["queued", "running", "pending", "streaming"].includes(status);

export function OAuthApp() {
  const [panel, setPanel] = useState<
    "navigation" | "settings" | "files" | null
  >(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
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
  const [conversationCursor, setConversationCursor] = useState<string | null>(
    null,
  );
  const [agentId, setAgentId] = useState("");
  const connections = useQuery({
    queryKey: [
      "connections",
      agentId,
      session?.user.sub,
      session?.organization.id,
      session?.environment,
    ],
    queryFn: ({ signal }) => readConnections(agentId, signal),
    enabled: Boolean(agentId && session),
    retry: false,
    refetchOnWindowFocus: "always",
  });
  const canChat =
    connections.isSuccess && !connections.isFetching && connections.data.ready;
  const musedam = connections.data?.items.find(
    (item) => item.key === "musedam",
  );
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
        if (
          !abort.signal.aborted &&
          !(e instanceof ApiError && e.status === 401)
        )
          setError(
            e instanceof Error ? e.message : "Could not restore this session.",
          );
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
        setError(
          e instanceof Error
            ? e.message
            : "Could not restore the conversation.",
        );
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
          ...page.items.filter(
            (item) => !current.some((c) => c.id === item.id),
          ),
        ]);
        setConversationCursor(page.next_cursor);
      } else if (kind === "artifacts" && chatId && artifactCursor) {
        const page = await readArtifacts(chatId, artifactCursor);
        setArtifacts((current) => [
          ...current,
          ...page.items.filter(
            (item) => !current.some((file) => file.id === item.id),
          ),
        ]);
        setArtifactCursor(page.next_cursor);
      } else if (kind === "messages" && chatId && messageCursor) {
        const page = await readHistory(chatId, undefined, messageCursor);
        setMessages((current) => [
          ...page.messages.filter(
            (item) => !current.some((m) => m.id === item.id),
          ),
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
    const conversation = await createConversation(
      agentId,
      title.slice(0, 80),
      signal,
    );
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
      const id = await prepareConversation(
        input.trim() || selected[0]!.name,
        abort.signal,
      );
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
    if (
      !canChat ||
      (!input.trim() && !files.length) ||
      inFlight.current ||
      (!chatId && !agentId)
    )
      return;
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
      setNotice(
        "Cancellation requested. Restore the conversation to read the final status.",
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not request cancellation.",
      );
    }
  }
  const agent = session?.agents.find((item) => item.id === agentId);
  const name = session?.user.name ?? "GEA user";
  const title =
    conversations.find((item) => item.id === chatId)?.title ||
    "New conversation";
  const navigation = (
    <div className="flex h-full min-h-0 flex-col gap-5 p-4">
      <a
        href="/"
        className="flex items-center gap-2.5 px-2 py-1 font-semibold tracking-tight"
      >
        <span className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          G
        </span>
        OpenGEA
        <span className="text-xs font-normal text-muted-foreground">
          / Chat
        </span>
      </a>
      <Button
        variant="outline"
        disabled={busy}
        className="justify-start"
        onClick={() => {
          selectId(null);
          setMessages([]);
          setRunStatus(undefined);
          setError(null);
          setNotice(null);
          setMessageCursor(null);
          setAgentId(session?.agents[0]?.id ?? "");
          setPanel(null);
        }}
      >
        <PlusIcon data-icon="inline-start" />
        New conversation
      </Button>
      <nav
        aria-label="Conversation history"
        className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto"
      >
        <p className="px-2 pb-2 text-xs font-medium text-muted-foreground">
          Recent conversations
        </p>
        {!conversations.length && (
          <p className="px-2 text-sm text-muted-foreground">
            Your conversations will appear here.
          </p>
        )}
        {conversations.map((item) => (
          <Button
            key={item.id}
            variant={item.id === chatId ? "secondary" : "ghost"}
            className="w-full shrink-0 justify-start"
            disabled={busy}
            aria-current={item.id === chatId ? "page" : undefined}
            onClick={() => {
              setPanel(null);
              void restore(item.id);
            }}
          >
            <MessageCircleIcon data-icon="inline-start" />
            <span className="truncate">
              {item.title || "Untitled conversation"}
            </span>
          </Button>
        ))}
        {conversationCursor && (
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => void loadMore("conversations")}
          >
            Load more conversations
          </Button>
        )}
      </nav>
      <div className="flex shrink-0 flex-col gap-2">
        <Button
          variant="ghost"
          className="justify-start"
          onClick={() => setPanel("settings")}
        >
          <Settings2Icon data-icon="inline-start" />
          MuseDAM
          <Badge variant="secondary" className="ml-auto">
            {canChat ? "Connected" : "Set up"}
          </Badge>
        </Button>
        <Separator />
        <Button
          variant="ghost"
          className="h-auto justify-start py-2"
          onClick={() => setPanel("settings")}
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs">
            {name.slice(0, 1)}
          </span>
          <span className="flex min-w-0 flex-col items-start">
            <span className="max-w-full truncate text-sm">{name}</span>
            <span className="max-w-full truncate text-xs font-normal text-muted-foreground">
              {session?.organization.name}
            </span>
          </span>
        </Button>
        <a
          href="https://github.com/bmrlab/opengea"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 px-3 text-xs text-muted-foreground"
        >
          <CodeIcon className="size-3.5" />
          Open source on GitHub
        </a>
      </div>
    </div>
  );
  const feedback = (notice || error || runStatus === "error") && (
    <Alert variant={error || runStatus === "error" ? "destructive" : "default"}>
      <AlertTitle>
        {error || runStatus === "error"
          ? "Request needs attention"
          : "Account update"}
      </AlertTitle>
      <AlertDescription>
        {error ??
          (runStatus === "error"
            ? "The last run could not finish. Your conversation is saved."
            : notice)}
        {chatId && error && (
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void restore()}
          >
            <RotateCcwIcon data-icon="inline-start" />
            Restore conversation
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
  return (
    <main className="flex h-dvh min-h-0 w-full overflow-hidden bg-background">
      {loading ? (
        <div
          className="m-auto flex items-center gap-3 text-sm text-muted-foreground"
          role="status"
        >
          <SparklesIcon className="size-5" />
          Restoring your session…
        </div>
      ) : !session ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <header className="flex items-center justify-between px-6 py-5">
            <a href="/" className="font-semibold">
              OpenGEA / MuseDAM Chat
            </a>
            <a
              href="https://github.com/bmrlab/opengea"
              className="text-sm text-muted-foreground"
            >
              Source code ↗
            </a>
          </header>
          <section className="m-auto flex w-full max-w-xl flex-col items-center gap-6 px-6 py-12 text-center">
            {feedback}
            <span className="flex size-16 items-center justify-center rounded-2xl bg-secondary">
              <SparklesIcon className="size-7" />
            </span>
            <Badge variant="secondary">
              Your creative library, in conversation
            </Badge>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              Find your next idea.
              <br />
              <span className="text-muted-foreground">
                Start with your assets.
              </span>
            </h1>
            <p className="max-w-md leading-7 text-muted-foreground">
              Search MuseDAM, explore your library, and bring images and files
              into the conversation.
            </p>
            <form action="/auth/login" method="post">
              <Button type="submit" size="lg">
                Continue with GEA
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
            </form>
            <p className="text-xs text-muted-foreground">
              Sign in securely. Your assets stay connected to your account.
            </p>
            <form action="/auth/logout" method="post">
              <Button variant="ghost" size="sm" type="submit">
                Clear session &amp; revoke access
              </Button>
            </form>
          </section>
        </div>
      ) : (
        <>
          {sidebarOpen && (
            <aside
              aria-label="Chat navigation"
              className="hidden w-64 shrink-0 border-r bg-sidebar text-sidebar-foreground md:block"
            >
              {navigation}
            </aside>
          )}
          <section
            aria-label="Agent conversation"
            className="flex min-h-0 min-w-0 flex-1 flex-col"
          >
            <header className="flex h-16 shrink-0 items-center gap-3 border-b px-3 sm:px-5">
              <Button
                variant="ghost"
                size="icon"
                className="hidden md:inline-flex"
                aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                <PanelLeftIcon />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="Open navigation"
                onClick={() => setPanel("navigation")}
              >
                <PanelLeftIcon />
              </Button>
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-sm font-semibold">{title}</h1>
                <p className="truncate text-xs text-muted-foreground">
                  {agent?.name || "No authorized Agent"}
                  <span aria-hidden="true"> · </span>
                  <span role="status">
                    {uploading
                      ? "Uploading…"
                      : busy
                        ? "Working…"
                        : activeRun(runStatus)
                          ? "Run in progress"
                          : runStatus === "error"
                            ? "Last run failed"
                            : "Ready"}
                  </span>
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Restore conversation"
                title="Restore conversation"
                disabled={busy || !chatId}
                onClick={() => void restore()}
              >
                <RotateCcwIcon />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Conversation files (${artifacts.length})`}
                title="Conversation files"
                onClick={() => setPanel("files")}
              >
                <FolderIcon />
              </Button>
              <Button
                variant="outline"
                size="sm"
                aria-label="Connection settings"
                onClick={() => setPanel("settings")}
              >
                <span className="hidden sm:inline">MuseDAM</span>
                {canChat ? <CheckIcon /> : <Settings2Icon />}
              </Button>
            </header>
            <Conversation className="min-h-0">
              <ConversationContent className="mx-auto w-full max-w-4xl gap-8 px-5 py-8 sm:px-10">
                {messageCursor && (
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() => void loadMore("messages")}
                  >
                    Load earlier messages
                  </Button>
                )}
                {!messages.length && (
                  <ConversationEmptyState className="min-h-[40dvh] gap-5">
                    <span className="flex size-14 items-center justify-center rounded-2xl bg-secondary">
                      <SparklesIcon className="size-6" />
                    </span>
                    <div className="flex flex-col gap-2">
                      <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                        What will you discover?
                      </h2>
                      <p className="max-w-md text-sm leading-6 text-muted-foreground">
                        Search your library, find visual inspiration, or bring
                        an idea into the conversation.
                      </p>
                    </div>
                    <div className="flex w-full max-w-lg flex-col gap-2 sm:flex-row">
                      {[
                        "Find assets for a new campaign",
                        "Help me explore my MuseDAM library",
                      ].map((prompt) => (
                        <Button
                          key={prompt}
                          variant="outline"
                          className="h-auto flex-1 whitespace-normal py-3 text-left"
                          disabled={busy || !agent}
                          onClick={() => {
                            setInput(prompt);
                            document.getElementById("message")?.focus();
                          }}
                        >
                          {prompt}
                          <ArrowRightIcon data-icon="inline-end" />
                        </Button>
                      ))}
                    </div>
                  </ConversationEmptyState>
                )}
                {messages.map((message, index) => (
                  <ChatMessage
                    key={message.id}
                    message={message}
                    agentName={agent?.name}
                    streaming={
                      busy &&
                      !uploading &&
                      index === messages.length - 1 &&
                      message.role === "assistant"
                    }
                  />
                ))}
              </ConversationContent>
              <ConversationScrollButton aria-label="Jump to latest message" />
            </Conversation>
            <div className="shrink-0 px-3 pb-3 pt-2 sm:px-6 sm:pb-5">
              <div className="mx-auto flex w-full max-w-4xl flex-col gap-3">
                {feedback}
                {!canChat && (
                  <div className="flex items-center justify-between gap-3 px-1 text-sm">
                    <p role="status" className="text-muted-foreground">
                      {connections.isFetching
                        ? "Checking MuseDAM…"
                        : connections.isError
                          ? "Could not check MuseDAM."
                          : "Connect MuseDAM to start chatting."}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPanel("settings")}
                    >
                      Set up connection
                      <ArrowRightIcon data-icon="inline-end" />
                    </Button>
                  </div>
                )}
                <PromptInput
                  onSubmit={(_message, event) => send(event)}
                  maxFiles={0}
                  onError={() =>
                    setError(
                      "Use Attach files to upload a file to this conversation.",
                    )
                  }
                >
                  {files.length > 0 && (
                    <PromptInputHeader>
                      <Attachments
                        variant="inline"
                        aria-label="Message attachments"
                      >
                        {files.map((file) => (
                          <Attachment
                            key={file.id}
                            data={{
                              id: file.id,
                              type: "file",
                              mediaType: file.media_type,
                              filename: file.filename,
                              url: fileDownloadPath(file.id),
                            }}
                            onRemove={() =>
                              setFiles((current) =>
                                current.filter((item) => item.id !== file.id),
                              )
                            }
                          >
                            <AttachmentPreview />
                            <AttachmentInfo />
                            <AttachmentRemove
                              disabled={busy}
                              aria-label={`Remove ${file.filename} from message`}
                            />
                          </Attachment>
                        ))}
                      </Attachments>
                    </PromptInputHeader>
                  )}
                  <PromptInputBody>
                    <PromptInputTextarea
                      id="message"
                      aria-label="Message"
                      value={input}
                      onChange={(event) => setInput(event.target.value)}
                      maxLength={8000}
                      disabled={busy || !agent || activeRun(runStatus)}
                      placeholder={
                        canChat
                          ? "Ask about your assets, or attach a file…"
                          : "Connect MuseDAM before sending…"
                      }
                      onPaste={(event) => {
                        const pasted = Array.from(event.clipboardData.files);
                        if (pasted.length) {
                          event.preventDefault();
                          void attach(pasted);
                        }
                      }}
                    />
                  </PromptInputBody>
                  <PromptInputFooter>
                    <PromptInputTools>
                      <input
                        ref={fileInput}
                        type="file"
                        multiple
                        className="sr-only"
                        aria-label="Choose files"
                        disabled={busy || !agent || activeRun(runStatus)}
                        onChange={(event) => {
                          const selected = Array.from(
                            event.currentTarget.files ?? [],
                          );
                          event.currentTarget.value = "";
                          void attach(selected);
                        }}
                      />
                      <PromptInputButton
                        type="button"
                        aria-label="Attach files"
                        tooltip="Attach files · up to 4 MiB each"
                        disabled={busy || !agent || activeRun(runStatus)}
                        onClick={() => fileInput.current?.click()}
                      >
                        <PaperclipIcon />
                      </PromptInputButton>
                      <span className="text-xs text-muted-foreground">
                        {uploading ? "Uploading…" : "10 files · 4 MiB each"}
                      </span>
                    </PromptInputTools>
                    <PromptInputSubmit
                      aria-label={activeRun(runStatus) ? "Stop run" : "Send"}
                      status={
                        activeRun(runStatus)
                          ? "streaming"
                          : busy
                            ? "submitted"
                            : "ready"
                      }
                      onStop={
                        activeRun(runStatus) ? () => void stop() : undefined
                      }
                      disabled={
                        activeRun(runStatus)
                          ? !chatId
                          : busy ||
                            !canChat ||
                            (!input.trim() && !files.length) ||
                            !agent
                      }
                    />
                  </PromptInputFooter>
                </PromptInput>
                <p className="text-center text-[11px] text-muted-foreground">
                  {canChat ? "Connected to your MuseDAM library. " : ""}AI can
                  make mistakes. Verify important details.
                </p>
              </div>
            </div>
          </section>
          <Sheet
            open={panel !== null}
            onOpenChange={(open) => {
              if (!open) setPanel(null);
            }}
          >
            <SheetContent
              side={panel === "navigation" ? "left" : "right"}
              className="flex w-80 max-w-[90vw] flex-col gap-0"
            >
              <SheetHeader>
                <SheetTitle>
                  {panel === "navigation"
                    ? "Your conversations"
                    : panel === "files"
                      ? "Conversation files"
                      : "Account & connections"}
                </SheetTitle>
                <SheetDescription>
                  {panel === "navigation"
                    ? "Pick up where you left off."
                    : panel === "files"
                      ? "Files generated in this conversation."
                      : "Manage your MuseDAM connection and signed-in account."}
                </SheetDescription>
              </SheetHeader>
              {panel === "navigation" ? (
                navigation
              ) : (
                <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4">
                  {panel === "files" ? (
                    <>
                      {" "}
                      {chatId && (
                        <section
                          aria-label="Session artifacts"
                          className="flex flex-col gap-3"
                        >
                          <div>
                            <h2 className="text-sm font-medium">Artifacts</h2>
                            <p className="text-xs text-muted-foreground">
                              Files generated in this conversation
                            </p>
                          </div>
                          {!artifacts.length && (
                            <p className="text-xs text-muted-foreground">
                              No generated files yet.
                            </p>
                          )}
                          <ul className="flex max-h-full flex-col gap-3 overflow-y-auto">
                            {artifacts.map((file) => (
                              <li
                                key={file.id}
                                className="flex flex-col gap-1 rounded-lg border p-3"
                              >
                                <span className="break-words text-sm font-medium">
                                  {file.title || file.filename}
                                </span>
                                <span className="break-all text-xs text-muted-foreground">
                                  {file.filename} ·{" "}
                                  {Math.max(1, Math.ceil(file.size / 1024))} KiB
                                </span>
                                <Button
                                  asChild
                                  variant="ghost"
                                  size="sm"
                                  className="justify-start"
                                >
                                  <a
                                    href={fileDownloadPath(file.id)}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
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
                      <p className="text-xs text-muted-foreground">
                        Uploaded attachments are available in their messages.
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="flex flex-col gap-1">
                        <p className="font-medium">{name}</p>
                        <p className="text-sm text-muted-foreground">
                          {session.organization.name}
                        </p>
                      </div>
                      {session.agents.length > 1 && !chatId && (
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
                      )}
                      {agent && (
                        <section
                          aria-label="Connections"
                          className="flex flex-col gap-3 rounded-lg border p-4"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <h2 className="font-medium">MuseDAM</h2>
                            {canChat && (
                              <Badge variant="secondary">
                                <CheckIcon data-icon="inline-start" />
                                Connected
                              </Badge>
                            )}
                          </div>
                          <p
                            className="text-sm text-muted-foreground"
                            role="status"
                          >
                            {connections.isFetching
                              ? "Checking your connection…"
                              : connections.isError
                                ? "Could not check your connection. Try again."
                                : canChat
                                  ? "Your account is ready. You can start chatting."
                                  : !musedam
                                    ? "This Agent does not declare MuseDAM. Publish the included Agent to this application."
                                    : musedam.status ===
                                          "administrator_configuration_required" ||
                                        musedam.owner !== "user"
                                      ? "Ask the Agent administrator to configure the personal MuseDAM Connector."
                                      : musedam.status ===
                                          "reauthorization_required"
                                        ? "MuseDAM needs your authorization again before chatting."
                                        : "Connect your MuseDAM account before sending a message."}
                          </p>
                          {!connections.isError &&
                            musedam?.owner === "user" &&
                            musedam.actions.includes("authorize") &&
                            !canChat && (
                              <form
                                action={`/api/connections/authorize?agentId=${encodeURIComponent(agentId)}&key=musedam`}
                                method="post"
                                target="_blank"
                                rel="noopener"
                              >
                                <Button
                                  type="submit"
                                  disabled={connections.isFetching}
                                  className="w-full"
                                >
                                  {musedam.status === "reauthorization_required"
                                    ? "Reconnect MuseDAM"
                                    : "Connect MuseDAM"}
                                  <ArrowRightIcon data-icon="inline-end" />
                                </Button>
                                <p className="mt-2 text-xs text-muted-foreground">
                                  Authorize in the new tab, then return here.
                                </p>
                              </form>
                            )}
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={connections.isFetching}
                            onClick={() => void connections.refetch()}
                          >
                            <RotateCcwIcon data-icon="inline-start" />
                            Check connection
                          </Button>
                        </section>
                      )}

                      <Separator />
                      <form action="/auth/logout" method="post">
                        <Button variant="outline" type="submit">
                          <LogOutIcon data-icon="inline-start" />
                          Sign out &amp; revoke
                        </Button>
                      </form>
                    </>
                  )}
                </div>
              )}
            </SheetContent>
          </Sheet>
        </>
      )}
    </main>
  );
}
