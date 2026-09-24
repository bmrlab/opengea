import { afterEach, describe, expect, it, vi } from "vitest";
import { consume, openStream } from "../src/routes/-client-api";
afterEach(() => vi.unstubAllGlobals());
describe("HTTP conversation recovery", () => {
  it.each([
    [{ type: "finish", finishReason: "error" }, "error"],
    [{ type: "finish", finishReason: "length" }, "error"],
    [{ type: "finish", finishReason: "tool-calls" }, undefined],
    [{ type: "finish" }, undefined],
    [{ type: "abort" }, "aborted"],
  ])("preserves terminal status for %j", async (terminal, outcome) => {
    await expect(
      consume(
        new Response(
          `data: {"type":"start","messageId":"answer"}\n\ndata: ${JSON.stringify(terminal)}\n\ndata: [DONE]\n\n`,
        ),
        () => {},
      ),
    ).resolves.toBe(outcome);
  });
  it("returns the confirmed outcome only after consuming the whole stream", async () => {
    const body = [
      { type: "start", messageId: "answer" },
      { type: "finish", finishReason: "stop" },
    ]
      .map((event) => `data: ${JSON.stringify(event)}\n\n`)
      .join("");
    await expect(
      consume(new Response(body + "data: [DONE]\n\n"), () => {}),
    ).resolves.toBe("finished");
    await expect(
      consume(
        new Response(
          body + 'data: {"type":"error","errorText":"commit failed"}\n\n',
        ),
        () => {},
      ),
    ).rejects.toThrow("commit failed");
  });
  it("does not accept a truncated stream as a completed Run", async () => {
    await expect(
      consume(
        new Response('data: {"type":"start","messageId":"answer"}\n\n'),
        () => {},
      ),
    ).rejects.toThrow(/ended before/);
  });
  it("decodes real AI SDK stream frames into a visible assistant message", async () => {
    const events = [
      { type: "start", messageId: "answer" },
      { type: "text-start", id: "text" },
      { type: "text-delta", id: "text", delta: "Hello from GEA" },
      { type: "text-end", id: "text" },
      { type: "finish", finishReason: "stop" },
    ];
    const received: string[] = [];
    await consume(
      new Response(
        events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("") +
          "data: [DONE]\n\n",
      ),
      (message) => {
        received.push(
          message.parts
            .filter((p) => p.type === "text")
            .map((p) => p.text)
            .join(""),
        );
      },
    );
    expect(received.at(-1)).toBe("Hello from GEA");
  });
  it("replays from the GEA baseline without repeating existing partial text", async () => {
    const frames =
      ": gea-replay " +
      JSON.stringify({
        version: 1,
        chatId: "chat",
        runId: "run",
        message: {
          id: "answer",
          role: "assistant",
          parts: [{ type: "text", text: "Earlier turn. " }],
        },
      }) +
      "\n\n" +
      [
        { type: "start", messageId: "answer" },
        { type: "text-start", id: "new" },
        { type: "text-delta", id: "new", delta: "Recovered output" },
        { type: "text-end", id: "new" },
        { type: "finish", finishReason: "stop" },
      ]
        .map((e) => `data: ${JSON.stringify(e)}\n\n`)
        .join("") +
      "data: [DONE]\n\n";
    let answer = "Earlier turn. Recovered";
    await consume(
      new Response(frames),
      (message) => {
        answer = message.parts
          .filter((p) => p.type === "text")
          .map((p) => p.text)
          .join("");
      },
      { chatId: "chat", runId: "run" },
    );
    expect(answer).toBe("Earlier turn. Recovered output");
  });
  it("replays a Worker Run from the beginning without duplicating partial output", async () => {
    const frames = [
      { type: "start", messageId: "answer" },
      { type: "text-start", id: "text" },
      { type: "text-delta", id: "text", delta: "Recovered output" },
      { type: "text-end", id: "text" },
      { type: "finish", finishReason: "stop" },
    ]
      .map((event) => `data: ${JSON.stringify(event)}\n\n`)
      .join("");
    const messages = new Map<string, string>([["answer", "Recovered"]]);
    await consume(
      new Response(frames + "data: [DONE]\n\n", {
        headers: {
          "x-gea-agent-session-id": "chat",
          "x-gea-agent-run-id": "run",
        },
      }),
      (message) =>
        messages.set(
          message.id,
          message.parts
            .filter((part) => part.type === "text")
            .map((part) => part.text)
            .join(""),
        ),
      { chatId: "chat", runId: "run" },
    );
    expect([...messages.entries()]).toEqual([["answer", "Recovered output"]]);
  });
  it.each(["other", null])(
    "rejects a Worker replay with Run header %s before rendering",
    async (runId) => {
      const headers = new Headers({ "x-gea-agent-session-id": "chat" });
      if (runId) headers.set("x-gea-agent-run-id", runId);
      const output = vi.fn();
      await expect(
        consume(
          new Response('data: {"type":"start","messageId":"answer"}\n\n', {
            headers,
          }),
          output,
          {
            chatId: "chat",
            runId: "run",
          },
        ),
      ).rejects.toThrow(/identity/);
      expect(output).not.toHaveBeenCalled();
    },
  );
  it("rejects a replay belonging to another run before rendering", async () => {
    const response = new Response(
      ": gea-replay " +
        JSON.stringify({
          version: 1,
          chatId: "chat",
          runId: "other",
          message: { id: "answer", role: "assistant", parts: [] },
        }) +
        "\n\n",
    );
    const output = vi.fn();
    await expect(
      consume(response, output, { chatId: "chat", runId: "run" }),
    ).rejects.toThrow(/identity/);
    expect(output).not.toHaveBeenCalled();
  });
  it("treats a completed run's 204 response as an empty stream", async () => {
    const onMessage = vi.fn();
    await consume(new Response(null, { status: 204 }), onMessage);
    expect(onMessage).not.toHaveBeenCalled();
  });
  it("retries only a 503 attachment for the same chat", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    expect((await openStream("chat-1")).status).toBe(204);
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      "/api/chat/stream?chatId=chat-1",
      "/api/chat/stream?chatId=chat-1",
    ]);
  });
  it("does not retry authorization denial or arbitrary upstream failures", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);
    expect((await openStream("chat-1")).status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
