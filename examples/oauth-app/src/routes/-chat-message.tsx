import { useState } from "react";
import { isToolUIPart, type UIMessage } from "ai";
import { CheckIcon, CopyIcon } from "lucide-react";
import {
  Message,
  MessageContent,
  MessageResponse,
  MessageActions,
  MessageAction,
} from "@/components/ai-elements/message";
import {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
} from "@/components/ai-elements/reasoning";
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import {
  Attachment,
  Attachments,
  AttachmentPreview,
  AttachmentInfo,
} from "@/components/ai-elements/attachments";
import { messageFileDownloadPath } from "@/lib/files";

export function ChatMessage({
  message,
  agentName = "MuseDAM",
  streaming = false,
}: {
  message: UIMessage;
  agentName?: string;
  streaming?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const text = message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n\n");
  return (
    <Message from={message.role}>
      {message.role === "assistant" && (
        <p className="text-xs font-medium text-muted-foreground">{agentName}</p>
      )}
      <MessageContent>
        {message.parts.map((part, index) => {
          if (part.type === "text")
            return message.role === "assistant" ? (
              <MessageResponse
                key={index}
                isAnimating={streaming}
                mode={streaming ? "streaming" : "static"}
              >
                {part.text}
              </MessageResponse>
            ) : (
              <p
                key={index}
                className="whitespace-pre-wrap break-words leading-7"
              >
                {part.text}
              </p>
            );
          if (part.type === "reasoning")
            return (
              <Reasoning
                key={index}
                isStreaming={streaming && part.state === "streaming"}
                defaultOpen={false}
              >
                <ReasoningTrigger />
                <ReasoningContent>{part.text}</ReasoningContent>
              </Reasoning>
            );
          if (part.type === "file") {
            const url = messageFileDownloadPath(part.url);
            if (!url)
              return <p key={index}>{part.filename || "Attached file"}</p>;
            return (
              <Attachments key={index} variant="list">
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="block max-w-full"
                >
                  <Attachment
                    data={{ ...part, id: `${message.id}-${index}`, url }}
                  >
                    <AttachmentPreview />
                    <AttachmentInfo />
                  </Attachment>
                </a>
              </Attachments>
            );
          }
          if (isToolUIPart(part)) {
            const toolName =
              part.type === "dynamic-tool" ? part.toolName : part.type.slice(5);
            const title = toolName
              .replace(/^musedam__(musedam_)?/, "")
              .replaceAll("_", " ");
            return (
              <Tool key={index} defaultOpen={false}>
                <ToolHeader
                  type="dynamic-tool"
                  toolName={toolName}
                  title={title}
                  state={part.state}
                />
                <ToolContent>
                  {part.input !== undefined && <ToolInput input={part.input} />}
                  <ToolOutput output={part.output} errorText={part.errorText} />
                  {part.state === "approval-requested" && (
                    <p className="text-sm text-muted-foreground">
                      This tool needs approval. This demo does not submit tool
                      approvals.
                    </p>
                  )}
                </ToolContent>
              </Tool>
            );
          }
          return null;
        })}
        {message.role === "assistant" && !message.parts.length && (
          <p className="text-muted-foreground">
            {streaming ? "Thinking…" : "No output was saved for this turn."}
          </p>
        )}
      </MessageContent>
      {message.role === "assistant" && text && !streaming && (
        <MessageActions>
          <MessageAction
            label={copied ? "Copied" : "Copy response"}
            tooltip={copied ? "Copied" : "Copy response"}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(text);
                setCopied(true);
                setCopyError(false);
              } catch {
                setCopyError(true);
              }
            }}
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
          </MessageAction>
          {copyError && (
            <span role="status" className="text-xs text-muted-foreground">
              Could not copy. Select the text to copy it.
            </span>
          )}
        </MessageActions>
      )}
    </Message>
  );
}
