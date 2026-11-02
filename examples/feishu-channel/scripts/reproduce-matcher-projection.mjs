// Offline regression against the published SDK and this example's real definition.
// No model, provider, hosted API, credentials, or remote state is accessed.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createAgentChannelApplicationFetch } from "@gea-ai/agent-sdk/agent-worker";
import agent from "../agent.ts";

const sdkEntry = import.meta.resolve("@gea-ai/agent-sdk/agent-worker");
const { createAgentChannelStableId } = await import(new URL("../../contract/dist/agent-channels.js", sdkEntry));
const { executeChannelBehavior } = await import(new URL("./agent-channel-author-runtime.js", sdkEntry));
const sdk = JSON.parse(await readFile(new URL("../package.json", sdkEntry), "utf8"));
assert.equal(sdk.version, "0.1.261102-alpha.1");
const archive = process.argv[2];
assert.ok(archive, "Pass the freshly packed .gea-agent.zip path");
const snapshot = JSON.parse(execFileSync("unzip", ["-p", archive, "definition/agents/feishu-assistant.json"], { encoding: "utf8" }));
const descriptor = snapshot.channels.find((channel) => channel.key === "feishu-bot");
assert.ok(descriptor.platformUserMatcher);
const definition = agent.extensions[0].extension.channels[0];
const application = createAgentChannelApplicationFetch({ agents: { "feishu-assistant": { definition: agent } } });
const address = {
  schemaVersion: "gea.channel-address/v1", agentKey: "feishu-assistant",
  channelKey: descriptor.key, environment: "preview", installationId: "offline-installation",
  providerLocalKey: "offline-conversation", principalId: "offline-sender",
  studioAgentId: "offline-agent", workspaceId: "offline-workspace",
};
const executionTarget = {
  schemaVersion: "gea.channel-execution-target/v1",
  channelDefinitionVersion: await createAgentChannelStableId("definition", descriptor),
  sessionId: await createAgentChannelStableId("session", address), stateVersion: descriptor.stateVersion,
  studioAgentVersionId: "offline-version", workerDeploymentId: "offline-deployment", workerId: "offline-worker",
};
const base = {
  protocolVersion: "gea.channel-command/v2", commandId: "offline-command", operationId: "offline-operation",
  addressId: await createAgentChannelStableId("address", address), channelPath: descriptor.path, address, executionTarget,
};
const event = {
  id: "offline-event", sequence: 1, operationId: base.operationId,
  runId: "00000000-0000-4000-8000-000000000001", attempt: 1,
  type: "input.accepted", data: {}, occurredAt: 1,
};
const commands = [
  { ...base, kind: "read_events", after: 0, limit: 64 },
  { ...base, kind: "project_events", events: [{ event, input: {
    operationId: base.operationId, principal: { principalType: "user", principalId: address.principalId },
    message: { role: "user", parts: [{ type: "text", text: "offline" }] },
    data: { messageId: "offline-message", chatId: "offline-chat" },
  } }] },
];
const identity = {
  organization: { id: "offline-org" }, workspace: { id: address.workspaceId },
  channel: {
    agentKey: address.agentKey, channelKey: address.channelKey, environment: address.environment,
    installationId: address.installationId, studioAgentId: address.studioAgentId, workspaceId: address.workspaceId,
    workerId: executionTarget.workerId, workerDeploymentId: executionTarget.workerDeploymentId,
    studioAgentVersionId: executionTarget.studioAgentVersionId,
    executionEpoch: "offline-execution", installationStatus: "active", mode: "internal",
  },
};

// Matches channel-host.ts's binding selection for read_events/project_events:
// identity is retained; tools and its capability handler are not registered.
const results = [];
for (const command of commands) {
  for (const capabilityMode of ["absent", "denied", "supported"]) {
    let sessionReads = 0, capabilityReads = 0;
    const environment = {
      IDENTITY: { async fetch() { return Response.json(identity); } },
      CHANNEL_SESSIONS: {
        idFromName: (name) => name,
        get: () => ({ async fetch() { sessionReads++; return Response.json({ events: [event], cursor: 1 }); } }),
      },
      ...(capabilityMode !== "absent" ? { TOOLS: { async fetch(path) {
        capabilityReads++;
        assert.equal(path, "/internal/agent-worker-host/v1/channel/initialize");
        if (capabilityMode === "denied") return new Response("Forbidden", { status: 403 });
        return Response.json({ environment: "preview", variables: {}, capabilities: ["channel-platform-user-matcher-v2"] });
      } } } : {}),
    };
    await executeChannelBehavior({ definition, command, environment, signal: new AbortController().signal });
    sessionReads = 0;
    capabilityReads = 0;
    const response = await application(new Request(`http://offline.invalid/_gea/channels/v2/${command.kind}`, {
      method: "POST", body: JSON.stringify(command),
    }), environment, {});
    const body = await response.json();
    assert.equal(response.status, 200, JSON.stringify(body));
    assert.equal(capabilityReads, 0, "internal commands must not request admission capabilities");
    if (command.kind === "project_events") assert.equal(body.intents[0].payload.kind, "reaction-add");
    results.push({ command: command.kind, capabilityMode, status: response.status,
      errorCode: body.error?.code, sessionReads, capabilityReads,
      intents: body.intents?.map((intent) => ({ kind: intent.payload.kind, lane: intent.policy?.lane })),
    });
  }
}
console.log(JSON.stringify({ sdk: sdk.version, realNetworkCalls: 0, results }, null, 2));
