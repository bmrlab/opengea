import { expect, it } from "vitest";
import { relay } from "../server/relay";

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((done, failed) => {
    resolve = done;
    reject = failed;
  });
  return { promise, resolve, reject };
}

it("relays the first bytes while saving the Run reference and waits for it before EOF", async () => {
  const saved = deferred();
  const response = await relay(
    new Response("data: first\n\n", {
      headers: { "x-gea-agent-run-id": "run" },
    }),
    saved.promise,
  );
  expect(response.headers.get("x-gea-agent-run-id")).toBe("run");
  const reader = response.body!.getReader();
  expect(new TextDecoder().decode((await reader.read()).value)).toBe(
    "data: first\n\n",
  );
  let ended = false;
  const end = reader.read().then((value) => {
    ended = true;
    return value;
  });
  await Promise.resolve();
  expect(ended).toBe(false);
  saved.resolve();
  expect((await end).done).toBe(true);
});

it("surfaces a failed Run reference save instead of a successful EOF", async () => {
  const saved = deferred();
  const response = await relay(new Response("answer"), saved.promise);
  const reader = response.body!.getReader();
  await reader.read();
  saved.reject(new Error("storage unavailable"));
  await expect(reader.read()).rejects.toThrow("storage unavailable");
});

it("retains the pending save and cancels upstream when the reader disconnects", async () => {
  const saved = deferred();
  let upstreamCancelled = false;
  const response = await relay(
    new Response(
      new ReadableStream({
        cancel() {
          upstreamCancelled = true;
        },
      }),
    ),
    saved.promise,
  );
  const reader = response.body!.getReader();
  const read = reader.read();
  let cancelled = false;
  const cancel = reader.cancel().then(() => {
    cancelled = true;
  });
  await Promise.resolve();
  expect(upstreamCancelled).toBe(true);
  expect(cancelled).toBe(false);
  saved.resolve();
  await cancel;
  expect((await read).done).toBe(true);
});
