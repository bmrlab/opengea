import { parseArgs } from "node:util";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";

const { values } = parseArgs({
  options: {
    "api-origin": { type: "string" },
    "worker-origin": { type: "string" },
    "api-key-file": { type: "string" },
  },
});
function localOrigin(value) {
  const url = new URL(value);
  if (
    url.protocol !== "http:" ||
    url.hostname !== "127.0.0.1" ||
    url.pathname !== "/" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error("Use the exact 127.0.0.1 origin from gea agent dev.");
  return url.origin;
}
const apiOrigin = localOrigin(values["api-origin"]);
const workerOrigin = localOrigin(values["worker-origin"]);
const apiKeyFile = resolve(values["api-key-file"]);
const key = (await readFile(apiKeyFile, "utf8")).trim();
const response = await fetch(
  new URL("/api/v1/agents?environment=preview&limit=100", apiOrigin),
  {
    redirect: "error",
    headers: { authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(10000),
  },
);
if (!response.ok) throw new Error(`Agent directory HTTP ${response.status}`);
const directory = z
  .object({ data: z.array(z.object({ id: z.uuid(), name: z.string() })) })
  .parse(await response.json());
const agents = directory.data.filter(
  (agent) => agent.name === "ProductResearch",
);
if (agents.length !== 1)
  throw new Error(
    "Expected exactly one local ProductResearch Agent. Check the selected project and API address.",
  );
await writeFile(
  new URL("../.gea/workbench.json", import.meta.url),
  JSON.stringify(
    { apiOrigin, workerOrigin, apiKeyFile, agentId: agents[0].id },
    null,
    2,
  ) + "\n",
  { mode: 0o600 },
);
process.stdout.write(
  "Workbench configured for the local ProductResearch Agent. No credentials were printed.\n",
);
