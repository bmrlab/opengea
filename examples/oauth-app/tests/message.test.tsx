import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ChatMessage } from "../src/routes/-chat-message";

it("renders assistant Markdown as headings, lists, links and code instead of syntax", () => {
  const html = renderToStaticMarkup(
    <ChatMessage
      message={{
        id: "answer",
        role: "assistant",
        parts: [
          {
            type: "text",
            text: "## Search results\n\n**Found** these assets:\n\n- First\n- Second\n\n[Source](https://example.com)\n\n```js\nconst count = 2;\n```",
          },
        ],
      }}
    />,
  );
  expect(html).toMatch(/<h2[^>]*>Search results<\/h2>/);
  expect(html).not.toContain("**Found**");
  expect(html).toMatch(/<li[^>]*>First<\/li>/);
  expect(html).toMatch(/<button[^>]*>Source<\/button>/);
  expect(html).toMatch(/<pre[\s>]/);
});

it("keeps user input literal and does not execute assistant HTML", () => {
  const html = renderToStaticMarkup(
    <ChatMessage
      message={{
        id: "user",
        role: "user",
        parts: [
          { type: "text", text: "**literal** <script>alert(1)</script>" },
        ],
      }}
    />,
  );
  expect(html).toContain("**literal**");
  expect(html).not.toContain("<script>");
  const assistant = renderToStaticMarkup(
    <ChatMessage
      message={{
        id: "answer",
        role: "assistant",
        parts: [{ type: "text", text: "<script>alert(1)</script>" }],
      }}
    />,
  );
  expect(assistant).not.toContain("<script>");
});
