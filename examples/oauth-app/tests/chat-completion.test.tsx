// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { OAuthApp } from "../src/routes/-oauth-app";
import { TooltipProvider } from "../components/ui/tooltip";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("allows the next message while list refresh is pending and keeps its newer answer", async () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
  const conversation = { id: "chat", agent_id: "agent", title: "Chat" };
  let release!: () => void;
  const delayed = new Promise<void>((resolve) => {
    release = resolve;
  });
  let listReads = 0;
  let historyReads = 0;
  let runs = 0;
  vi.stubGlobal("fetch", async (input: string, init?: RequestInit) => {
    const url = new URL(input, "http://localhost");
    if (url.pathname === "/api/session")
      return Response.json({
        user: { sub: "user", name: "User" },
        organization: { id: "org", name: "Org", slug: "org" },
        scopes: [],
        expiresAt: null,
        environment: "preview",
        agents: [{ id: "agent", name: "Agent" }],
      });
    if (url.pathname === "/api/connections")
      return Response.json({ ready: true, items: [] });
    if (url.pathname === "/api/conversations") {
      if (++listReads === 2) {
        await delayed;
        return Response.json({
          items: [{ ...conversation, title: "Stale Chat" }],
          next_cursor: null,
        });
      }
      return Response.json({ items: [conversation], next_cursor: null });
    }
    if (url.pathname === "/api/artifacts")
      return Response.json({ items: [], next_cursor: null });
    if (url.pathname === "/api/chat" && init?.method !== "POST") {
      historyReads++;
      if (historyReads > 1) await delayed;
      return Response.json({
        conversation,
        messages: [],
        run: null,
        nextCursor: null,
      });
    }
    if (url.pathname === "/api/chat") {
      const text = ++runs === 1 ? "First answer" : "Newer answer";
      return new Response(
        [
          { type: "start", messageId: `answer-${runs}` },
          { type: "text-start", id: "text" },
          { type: "text-delta", id: "text", delta: text },
          { type: "text-end", id: "text" },
          { type: "finish", finishReason: "stop" },
        ]
          .map((event) => `data: ${JSON.stringify(event)}\n\n`)
          .join("") + "data: [DONE]\n\n",
      );
    }
    throw new Error(`Unexpected request ${url.pathname}`);
  });
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <TooltipProvider>
        <OAuthApp />
      </TooltipProvider>
    </QueryClientProvider>,
  );
  const message = await screen.findByRole("textbox", { name: "Message" });
  fireEvent.change(message, { target: { value: "First" } });
  await waitFor(() =>
    expect(
      (screen.getByRole("button", { name: "Send" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByText("First answer");
  fireEvent.change(message, { target: { value: "Second" } });
  await waitFor(() =>
    expect(
      (screen.getByRole("button", { name: "Send" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByText("Newer answer");
  await act(async () => {
    release();
    await delayed;
  });
  expect(screen.getByText("Newer answer")).toBeTruthy();
  expect(screen.queryByText("Stale Chat")).toBeNull();
  expect(historyReads).toBe(1);
});
