"use client";

import { useChat } from "@ai-sdk/react";
import { StudioAgentChatTransport } from "@gea-ai/agent-sdk/studio-client";
import type { NewsMessage } from "@opengea/basic-agent/messages";
import { useState } from "react";
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
            <ToolOutput output={part.output} errorText={part.errorText} />
          </ToolContent>
        </Tool>
      );
    default:
      return null;
  }
}

export function NewsChat() {
  const [conversation, setConversation] = useState(0);
  return (
    <ChatConversation
      key={conversation}
      onNewChat={() => setConversation((value) => value + 1)}
    />
  );
}

function ChatConversation({ onNewChat }: { onNewChat: () => void }) {
  const [transport] = useState(
    () => new StudioAgentChatTransport<NewsMessage>({ api: "/api/agent" }),
  );
  const { messages, sendMessage, status, error, stop } = useChat<NewsMessage>({
    transport,
  });
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState<string>();
  const busy = status === "submitted" || status === "streaming";
  const submit = async (text: string) => {
    if (!text.trim() || busy) return;
    setNotice(undefined);
    setDraft("");
    await sendMessage({ text });
  };
  const stopReceiving = () => {
    void stop();
    setNotice(
      "Stopped receiving this response. This does not confirm that the Agent execution was cancelled. Start a new chat if the previous turn is still running.",
    );
  };

  return (
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
        <Button variant="outline" size="sm" onClick={onNewChat} disabled={busy}>
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
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Response interrupted</AlertTitle>
            <AlertDescription>
              The Agent could not complete this response. Your message was not
              automatically retried. Check the Agent service and server
              configuration, then start a new chat or intentionally send another
              message.
            </AlertDescription>
          </Alert>
        ) : null}
        {notice ? (
          <p role="status" className="text-sm text-muted-foreground">
            {notice}
          </p>
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
            disabled={busy}
          />
          <PromptInputFooter>
            <span className="text-xs text-muted-foreground">
              {busy
                ? "Streaming from your Agent"
                : "Enter to send · Shift+Enter for a new line"}
            </span>
            <PromptInputSubmit
              status={status}
              onStop={stopReceiving}
              aria-label={busy ? "Stop receiving response" : "Send message"}
              disabled={!busy && !draft.trim()}
            />
          </PromptInputFooter>
        </PromptInput>
        <p className="text-center text-xs text-muted-foreground">
          Answers can be wrong. Check the linked sources. Refreshing starts a
          new conversation.
        </p>
      </footer>
    </main>
  );
}
