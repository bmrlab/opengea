"use client";

import { useChat } from "@ai-sdk/react";
import { StudioAgentChatTransport } from "@gea-ai/agent-sdk/studio-client";
import type { NewsMessage } from "@opengea/basic-agent/messages";
import {
  isToolUIPart,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from "ai";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ConversationState } from "./conversation-state";
import {
  ArrowUpRightIcon,
  CopyIcon,
  NewspaperIcon,
  PlusIcon,
} from "lucide-react";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { Suggestions, Suggestion } from "@/components/ai-elements/suggestion";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

type NewsPart = NewsMessage["parts"][number];

const ApprovalContext = createContext<{
  pending: Set<string>;
  disabled: boolean;
  respond: (id: string, approved: boolean) => Promise<void>;
} | null>(null);

function ToolApproval({ part }: { part: NewsPart }) {
  const approval = useContext(ApprovalContext);
  if (!isToolUIPart(part)) return null;
  if (part.state === "output-denied")
    return (
      <p className="text-sm text-muted-foreground">
        You declined this tool call.
      </p>
    );
  if (part.state === "approval-responded")
    return (
      <p role="status" className="text-sm text-muted-foreground">
        {part.approval.approved ? "Approved." : "Declined."} Waiting for the
        remaining decisions or the Agent response.
      </p>
    );
  if (part.state !== "approval-requested" || !approval) return null;
  const disabled = approval.disabled || !approval.pending.has(part.approval.id);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        Review the parameters above before allowing this tool call.
      </p>
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={disabled}
          onClick={() => void approval.respond(part.approval.id, true)}
        >
          Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => void approval.respond(part.approval.id, false)}
        >
          Decline
        </Button>
      </div>
    </div>
  );
}

function MessagePart({ part }: { part: NewsPart }) {
  switch (part.type) {
    case "text":
      return <MessageResponse>{part.text}</MessageResponse>;
    case "reasoning":
      return (
        <Reasoning isStreaming={part.state === "streaming"}>
          <ReasoningTrigger />
          <ReasoningContent>{part.text}</ReasoningContent>
        </Reasoning>
      );
    case "tool-searchStories":
      return (
        <Tool defaultOpen>
          <ToolHeader
            type={part.type}
            state={part.state}
            title="Search Hacker News"
          />
          <ToolContent>
            <ToolInput input={part.input} />
            <ToolApproval part={part} />
            {part.state === "output-available" ? (
              <div className="flex flex-col gap-3" aria-label="Search results">
                {part.output.stories.length === 0 ? (
                  <p>No stories matched this search.</p>
                ) : (
                  part.output.stories.map((story) => (
                    <article
                      key={story.discussionUrl}
                      className="rounded-lg border p-4"
                    >
                      <a
                        href={story.discussionUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {story.title}{" "}
                        <ArrowUpRightIcon className="inline size-4" />
                      </a>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {story.points} points · {story.comments} comments ·{" "}
                        {story.publishedAt.slice(0, 10)}
                      </p>
                    </article>
                  ))
                )}
              </div>
            ) : part.state === "output-error" ? (
              <ToolOutput output={undefined} errorText={part.errorText} />
            ) : null}
          </ToolContent>
        </Tool>
      );
    case "dynamic-tool":
      return (
        <Tool>
          <ToolHeader
            type={part.type}
            toolName={part.toolName}
            state={part.state}
          />
          <ToolContent>
            <ToolInput input={part.input} />
            <ToolApproval part={part} />
            <ToolOutput output={part.output} errorText={part.errorText} />
          </ToolContent>
        </Tool>
      );
    default:
      return null;
  }
}

export function NewsChat({
  mode,
  initialChatId,
}: {
  mode: "local" | "hosted";
  initialChatId?: string;
}) {
  const [conversation, setConversation] = useState(0);
  const [restored, setRestored] = useState<
    ConversationState & { chatId: string }
  >();
  const [loading, setLoading] = useState(Boolean(initialChatId));
  const [loadError, setLoadError] = useState<string>();
  const historyRequest = useRef<AbortController | null>(null);
  const load = useCallback(async (chatId: string) => {
    historyRequest.current?.abort();
    const controller = new AbortController();
    historyRequest.current = controller;
    const { signal } = controller;
    setLoading(true);
    setLoadError(undefined);
    try {
      const response = await fetch(
        `/api/agent/chats/${encodeURIComponent(chatId)}/state`,
        { signal },
      );
      if (!response.ok)
        throw new Error(
          "Could not load this conversation. Check the Agent service or start a new chat.",
        );
      const state: ConversationState = await response.json();
      if (signal.aborted) return;
      setRestored({ ...state, chatId });
      setConversation((value) => value + 1);
    } catch (error) {
      if (!signal.aborted)
        setLoadError(
          error instanceof Error
            ? error.message
            : "Could not load this conversation.",
        );
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => {
    // Restore the server-owned transcript selected by the browser's URL.
    if (initialChatId) void load(initialChatId);
    return () => historyRequest.current?.abort();
  }, [initialChatId, load]);
  const newChat = () => {
    historyRequest.current?.abort();
    window.history.replaceState(null, "", "/");
    setRestored(undefined);
    setLoadError(undefined);
    setLoading(false);
    setConversation((value) => value + 1);
  };
  if (loading || loadError)
    return (
      <main className="mx-auto flex max-w-4xl flex-col gap-4 p-8">
        <h1 className="font-semibold">Tech News</h1>
        {loadError ? (
          <Alert variant="destructive">
            <AlertTitle>Conversation unavailable</AlertTitle>
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        ) : (
          <p role="status">Loading your conversation…</p>
        )}
        <Button variant="outline" onClick={newChat}>
          New chat
        </Button>
      </main>
    );
  return (
    <ChatConversation
      key={conversation}
      mode={mode}
      restored={restored}
      onNewChat={newChat}
      onRecover={load}
    />
  );
}

function ChatConversation({
  mode,
  restored,
  onNewChat,
  onRecover,
}: {
  mode: "local" | "hosted";
  restored?: ConversationState & { chatId: string };
  onNewChat: () => void;
  onRecover: (chatId: string) => Promise<void>;
}) {
  const [runId, setRunId] = useState(restored?.run?.id);
  const [executionActive, setExecutionActive] = useState(
    Boolean(
      restored?.run && ["queued", "running"].includes(restored.run.status),
    ),
  );
  const [transport] = useState(
    () =>
      new StudioAgentChatTransport<NewsMessage>({
        api: "/api/agent",
        chatId: restored?.chatId,
        onRun(run) {
          setRunId(run.runId);
          setExecutionActive(true);
          if (mode === "hosted")
            window.history.replaceState(
              null,
              "",
              `/?chat=${encodeURIComponent(run.chatId)}`,
            );
        },
      }),
  );
  const {
    messages,
    sendMessage,
    status,
    error,
    stop,
    addToolApprovalResponse,
  } = useChat<NewsMessage>({
    transport,
    messages: restored?.messages,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    onFinish({ isAbort, isDisconnect, isError }) {
      if (!isAbort && !isDisconnect && !isError) setExecutionActive(false);
    },
  });
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState<string>();
  const [deciding, setDeciding] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelRequested, setCancelRequested] = useState<string>();
  const busy = status === "submitted" || status === "streaming";
  const awaitingExecution = mode === "hosted" && executionActive;
  const pending = new Set(
    messages
      .at(-1)
      ?.parts.flatMap((part) =>
        isToolUIPart(part) && part.state === "approval-requested"
          ? [part.approval.id]
          : [],
      ),
  );
  const approvalUnsent =
    messages.at(-1)?.role === "assistant" &&
    lastAssistantMessageIsCompleteWithApprovalResponses({ messages });
  const respond = async (id: string, approved: boolean) => {
    if (busy || awaitingExecution || deciding || !pending.has(id)) return;
    setDeciding(true);
    setNotice(undefined);
    try {
      await addToolApprovalResponse({ id, approved });
    } finally {
      setDeciding(false);
    }
  };
  const submit = async (text: string) => {
    if (
      !text.trim() ||
      busy ||
      awaitingExecution ||
      pending.size ||
      approvalUnsent
    )
      return;
    setNotice(undefined);
    setDraft("");
    await sendMessage({ text });
  };
  const stopReceiving = () => {
    void stop();
    setNotice(
      mode === "hosted"
        ? "Disconnected from the response. The Agent may still be running. Refresh the conversation to check its status, or request cancellation."
        : "Stopped receiving this response. This does not confirm that the Agent execution was cancelled. Start a new chat if the previous turn is still running.",
    );
  };
  const cancel = async () => {
    if (!transport.chatId || !runId || cancelling || cancelRequested === runId)
      return;
    setCancelling(true);
    try {
      const response = await fetch(
        `/api/agent/chats/${encodeURIComponent(transport.chatId)}/cancel`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ runId }),
        },
      );
      if (!response.ok)
        throw new Error(
          "Could not request cancellation. The Agent may still be running.",
        );
      const result: { status: "abort_requested" | "not_running" } =
        await response.json();
      if (result.status === "abort_requested") {
        setCancelRequested(runId);
        setNotice(
          "Cancellation requested. Refresh the conversation to check its final execution status.",
        );
      } else {
        await stop();
        await onRecover(transport.chatId);
      }
    } catch {
      setNotice(
        "Could not request cancellation. The Agent may still be running.",
      );
    } finally {
      setCancelling(false);
    }
  };

  return (
    <ApprovalContext.Provider
      value={{
        pending,
        disabled: busy || awaitingExecution || deciding,
        respond,
      }}
    >
      <main className="mx-auto flex h-dvh max-w-4xl flex-col px-4 sm:px-8">
        <header className="flex items-center justify-between gap-4 border-b py-5">
          <div className="flex items-center gap-3">
            <NewspaperIcon className="size-6" />
            <div>
              <h1 className="font-semibold">Tech News</h1>
              <p className="text-xs text-muted-foreground">
                OpenGEA · Hacker News research assistant
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onNewChat}
            disabled={busy}
          >
            <PlusIcon data-icon="inline-start" />
            New chat
          </Button>
        </header>
        <Conversation aria-label="Conversation">
          <ConversationContent>
            {messages.length === 0 ? (
              <ConversationEmptyState>
                <Badge variant="secondary">Live search · No sign-in</Badge>
                <h2 className="mt-3 text-2xl font-semibold">
                  What are you curious about?
                </h2>
                <p className="max-w-md text-sm text-muted-foreground">
                  Find stories, explore the discussion, and ask follow-up
                  questions. Results are live search metadata from Hacker News.
                </p>
              </ConversationEmptyState>
            ) : (
              messages.map((message) => (
                <Message key={message.id} from={message.role}>
                  <span className="text-xs text-muted-foreground">
                    {message.role === "user" ? "You" : "Tech News"}
                  </span>
                  <MessageContent>
                    {message.parts.map((part, index) => (
                      <MessagePart key={index} part={part} />
                    ))}
                  </MessageContent>
                  {message.role === "assistant" &&
                  !busy &&
                  message.parts.some((part) => part.type === "text") ? (
                    <MessageActions>
                      <MessageAction
                        label="Copy answer"
                        tooltip="Copy answer"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(
                              message.parts
                                .filter((part) => part.type === "text")
                                .map((part) => part.text)
                                .join("\n"),
                            );
                            setNotice("Answer copied.");
                          } catch {
                            setNotice(
                              "Could not copy. Select the answer text to copy it manually.",
                            );
                          }
                        }}
                      >
                        <CopyIcon />
                      </MessageAction>
                    </MessageActions>
                  ) : null}
                </Message>
              ))
            )}
            {status === "submitted" ? (
              <p
                role="status"
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <Spinner />
                Connecting to the Agent…
              </p>
            ) : null}
          </ConversationContent>
          <ConversationScrollButton aria-label="Scroll to latest message" />
        </Conversation>
        <footer className="flex flex-col gap-3 border-t py-4">
          {mode === "hosted" && transport.chatId ? (
            <div className="flex gap-2">
              {busy ? (
                <Button variant="outline" size="sm" onClick={stopReceiving}>
                  Disconnect stream
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void onRecover(transport.chatId!)}
                >
                  Refresh conversation
                </Button>
              )}
              {!busy && awaitingExecution ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={cancelling || cancelRequested === runId}
                  onClick={() => void cancel()}
                >
                  Cancel Agent execution
                </Button>
              ) : null}
            </div>
          ) : null}
          {!busy && awaitingExecution ? (
            <p role="status" className="text-sm text-muted-foreground">
              The Agent may still be running. Refresh to retrieve its latest
              messages and execution status.
            </p>
          ) : null}
          {restored?.run ? (
            <p className="text-sm text-muted-foreground">
              Last retrieved execution status: {restored.run.status}
            </p>
          ) : null}
          {restored?.hasOlderMessages ? (
            <p className="text-sm text-muted-foreground">
              Showing the most recent 100 messages.
            </p>
          ) : null}
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Response interrupted</AlertTitle>
              <AlertDescription>
                The Agent could not complete this response. Your message was not
                automatically retried. Check the Agent service and server
                configuration, then start a new chat or intentionally send
                another message.
              </AlertDescription>
            </Alert>
          ) : null}
          {notice ? (
            <p role="status" className="text-sm text-muted-foreground">
              {notice}
            </p>
          ) : null}
          {pending.size > 0 ? (
            <p role="status" className="text-sm text-muted-foreground">
              Review {pending.size} pending tool{" "}
              {pending.size === 1 ? "call" : "calls"} above to continue.
            </p>
          ) : null}
          {error && approvalUnsent ? (
            <Button
              variant="outline"
              onClick={() => void sendMessage()}
              disabled={busy || awaitingExecution}
            >
              Retry sending decisions
            </Button>
          ) : null}
          {messages.length === 0 ? (
            <Suggestions>
              {[
                "Find three stories about TypeScript",
                "What is interesting about SQLite?",
                "Search for local-first software",
              ].map((suggestion) => (
                <Suggestion
                  key={suggestion}
                  suggestion={suggestion}
                  disabled={busy}
                  onClick={(text) => void submit(text)}
                />
              ))}
            </Suggestions>
          ) : null}
          <PromptInput
            maxFiles={0}
            onError={() => setNotice("This Agent accepts text only.")}
            onSubmit={({ text, files }) => {
              if (files.length) {
                setNotice("This Agent accepts text only.");
                return;
              }
              return submit(text);
            }}
          >
            <PromptInputTextarea
              aria-label="Message"
              placeholder="Ask about a topic…"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              disabled={
                busy || awaitingExecution || pending.size > 0 || approvalUnsent
              }
            />
            <PromptInputFooter>
              <span className="text-xs text-muted-foreground">
                {busy
                  ? "Streaming from your Agent"
                  : "Enter to send · Shift+Enter for a new line"}
              </span>
              <PromptInputSubmit
                status={status}
                onStop={mode === "hosted" ? () => void cancel() : stopReceiving}
                aria-label={
                  busy
                    ? mode === "hosted"
                      ? "Cancel Agent execution"
                      : "Stop receiving response"
                    : "Send message"
                }
                disabled={
                  busy
                    ? mode === "hosted" &&
                      (!runId || cancelling || cancelRequested === runId)
                    : awaitingExecution ||
                      !draft.trim() ||
                      pending.size > 0 ||
                      approvalUnsent
                }
              />
            </PromptInputFooter>
          </PromptInput>
          <p className="text-center text-xs text-muted-foreground">
            Answers can be wrong. Check the linked sources.{" "}
            {mode === "hosted"
              ? "Refresh to restore this conversation while your session is valid."
              : "Local mode: refreshing starts a new conversation; stopping reception does not confirm cancellation."}
          </p>
        </footer>
      </main>
    </ApprovalContext.Provider>
  );
}
