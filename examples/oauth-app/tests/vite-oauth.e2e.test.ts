import { createHash, randomBytes } from "node:crypto";
import { once } from "node:events";
import {
  cp,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { geaInstallation } from "@gea-ai/cli/runtime";
import { expect, it } from "vitest";

// Real example Vite/Worker/OAuth cookies/SQLite -> packaged CLI/App Server -> Agent.
// Only the issuer/model and the Agent definition (no external MuseDAM) are fixtures.
it.runIf(process.env.GEA_VITE_OAUTH_E2E === "1")(
  "preserves two OAuth users through the packed local application",
  async () => {
    const root = await realpath(
      await mkdtemp(path.join(tmpdir(), "oauth-example-vite-")),
    );
    const configDir = path.join(root, "config");
    const identities: unknown[] = [];
    const grants = new Map<string, { user: string; challenge: string }>();
    const apiTokens: string[] = [];
    let user = "alice",
      revoked = false,
      unavailable = false;
    const id = "018f0000-0000-7000-8000-000000000001";
    let child: ChildProcess | undefined;
    let logs = "";
    let issuerOrigin = "";
    const issuer = createServer(async (request, response) => {
      const url = new URL(request.url!, issuerOrigin);
      const json = (body: unknown, status = 200) =>
        response
          .writeHead(status, { "content-type": "application/json" })
          .end(JSON.stringify(body));
      const token = request.headers.authorization?.slice(7) ?? "";
      if (url.pathname.endsWith("/authorize")) {
        const code = randomBytes(8).toString("hex");
        grants.set(code, {
          user,
          challenge: url.searchParams.get("code_challenge")!,
        });
        const callback = new URL(url.searchParams.get("redirect_uri")!);
        callback.searchParams.set("code", code);
        callback.searchParams.set("state", url.searchParams.get("state")!);
        response.writeHead(303, { location: callback.href }).end();
        return;
      }
      if (url.pathname.endsWith("/userinfo"))
        return void json({
          sub: token.endsWith("bob") ? "bob" : "alice",
          name: "Fixture user",
        });
      if (url.pathname.endsWith("/local-principal")) {
        apiTokens.push(token);
        if (unavailable) return void json({}, 503);
        if (revoked) return void json({}, 401);
        return void json({
          userId: token.endsWith("bob") ? "bob" : "alice",
          clientId: token.endsWith("wrong-client") ? "other" : "fixture-client",
          expiresAt: token.endsWith("expired")
            ? 1
            : Math.floor(Date.now() / 1000) + 3600,
          scopes: token.endsWith("no-scope") ? [] : ["agents:invoke"],
        });
      }
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const raw = Buffer.concat(chunks).toString();
      if (url.pathname.endsWith("/token")) {
        const params = new URLSearchParams(raw);
        const grant = grants.get(params.get("code")!);
        if (
          !grant ||
          createHash("sha256")
            .update(params.get("code_verifier")!)
            .digest("base64url") !== grant.challenge
        )
          return void json({}, 400);
        grants.delete(params.get("code")!);
        return void json({
          access_token: `gea_user_${grant.user}`,
          refresh_token: `synthetic-refresh-${grant.user}`,
          token_type: "Bearer",
          expires_in: 3600,
          scope: "openid profile offline_access agents:invoke",
          application: { id },
          authorization: { id },
          organization: { id, name: "Fixture org", slug: "fixture" },
        });
      }
      if (url.pathname.endsWith("/revoke")) {
        revoked = true;
        return void json({});
      }
      const body = JSON.parse(raw);
      for (const message of body.messages) {
        const identity =
          typeof message.content === "string" &&
          message.content.match(
            /<system-reminder>\n(.*?)\n<\/system-reminder>/s,
          )?.[1];
        if (identity) identities.push(JSON.parse(identity));
      }
      response.writeHead(200, { "content-type": "text/event-stream" });
      for (const [delta, finish_reason] of [
        [{ role: "assistant", content: "fixture-answer" }, null],
        [{}, "stop"],
      ])
        response.write(
          `data: ${JSON.stringify({ id: "fixture", object: "chat.completion.chunk", created: 1, model: body.model, choices: [{ index: 0, delta, finish_reason }] })}\n\n`,
        );
      response.end("data: [DONE]\n\n");
    });
    try {
      issuer.listen(0, "127.0.0.1");
      await once(issuer, "listening");
      const address = issuer.address();
      if (!address || typeof address === "string")
        throw new Error("No issuer listener");
      issuerOrigin = `http://127.0.0.1:${address.port}`;
      for (const name of [
        "agents",
        "components",
        "lib",
        "server",
        "src",
        "worker.ts",
        "gea.worker.json",
        "vite.config.ts",
        "tsconfig.json",
        "package.json",
      ])
        await cp(path.resolve(name), path.join(root, name), {
          recursive: true,
        });
      await symlink(
        path.resolve("node_modules"),
        path.join(root, "node_modules"),
        "dir",
      );
      await writeFile(
        path.join(root, "agents/musedam-chat/index.ts"),
        `import {defineAgent} from "@gea-ai/agent-sdk";export default defineAgent({name:"Fixture",slug:"musedam-chat",engine:"agent-core",model:"fixture-model",computer:{enabled:false},hooks:{beforeTurn:({identity,auth})=>({prepend:JSON.stringify({user:identity.user,principal:auth.current})})}});`,
      );
      const portProbe = createServer();
      portProbe.listen(0, "127.0.0.1");
      await once(portProbe, "listening");
      const appAddress = portProbe.address();
      if (!appAddress || typeof appAddress === "string")
        throw new Error("No app port");
      await new Promise<void>((resolve) => portProbe.close(() => resolve()));
      const origin = `http://127.0.0.1:${appAddress.port}`;
      const installation = geaInstallation();
      const launcher = path.join(root, "cli-fixture.mjs");
      await writeFile(
        launcher,
        `#!${process.execPath}\nimport {spawn} from "node:child_process";const args=process.argv.slice(2);const i=args.indexOf("--json")+1;args[i]=JSON.stringify({...JSON.parse(args[i]),modelSource:"local",trace:false});const c=spawn(${JSON.stringify(installation.cli)},args,{stdio:"inherit"});for(const s of ["SIGTERM","SIGINT"])process.on(s,()=>c.kill(s));c.on("exit",code=>process.exit(code??1));`,
        { mode: 0o755 },
      );
      const secret = "synthetic-example-client-secret";
      const encryptionKey = randomBytes(32).toString("base64");
      const variables = {
        APP_ORIGIN: origin,
        AGENT_ENVIRONMENT: "local",
        OAUTH_ISSUER_URL: issuerOrigin,
        OAUTH_CLIENT_ID: "fixture-client",
        OAUTH_CLIENT_SECRET: secret,
        TOKEN_ENCRYPTION_KEY: encryptionKey,
        GEA_CLI_BINARY: launcher,
        GEA_CONFIG_DIR: configDir,
        GEA_APP_SERVER_STATE_DIR: path.join(root, "state"),
        GEA_CREDENTIAL_STORE_KEY: randomBytes(32).toString("base64"),
        GEA_LOCAL_API_AUTH: "1",
        GEA_LOCAL_OAUTH_BASE_URL: issuerOrigin,
        GEA_LOCAL_OAUTH_CLIENT_ID: "fixture-client",
        LOCAL_AGENTS_API_TOKEN: "synthetic-never-use-service-token",
        TEST_AGENT_API_KEY: "synthetic-unused-model-key",
        TEST_AGENT_API_BASE_URL: `${issuerOrigin}/v1`,
        LLM_MODEL_CATALOG_JSON: JSON.stringify({
          default: "fixture-model",
          models: [{ id: "fixture-model", target: "test/fixture" }],
          pricing: {},
          providers: {
            test: {
              type: "openai-compatible",
              apiKeyEnv: "TEST_AGENT_API_KEY",
              baseURLEnv: "TEST_AGENT_API_BASE_URL",
            },
          },
        }),
      };
      await writeFile(
        path.join(root, ".dev.vars"),
        Object.entries(variables)
          .map(([key, value]) => `${key}='${value}'`)
          .join("\n"),
      );
      child = spawn(
        process.execPath,
        [
          path.resolve("node_modules/vite/bin/vite.js"),
          "--host",
          "127.0.0.1",
          "--port",
          String(appAddress.port),
        ],
        {
          cwd: root,
          env: { ...process.env, ...variables },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      for (const stream of [child.stdout, child.stderr])
        stream?.on("data", (chunk) => {
          logs += chunk;
        });
      const call = (route: string, cookie = "", body?: unknown) =>
        fetch(new URL(route, origin), {
          method: body === undefined ? "GET" : "POST",
          headers: {
            cookie,
            origin,
            ...(body instanceof FormData
              ? {}
              : { "content-type": "application/json" }),
          },
          body:
            body === undefined
              ? undefined
              : body instanceof FormData
                ? body
                : JSON.stringify(body),
          redirect: "manual",
        });
      await expect
        .poll(
          async () => {
            if (child?.exitCode !== null)
              throw new Error("Vite exited before ready");
            return fetch(origin)
              .then((r) => r.status)
              .catch(() => 0);
          },
          { timeout: 90000, interval: 500 },
        )
        .toBe(200);
      expect((await call("/api/session")).status).toBe(401);
      const cookies = (response: Response) =>
        response.headers
          .getSetCookie()
          .map((v) => v.split(";")[0])
          .filter((v) => !v.endsWith("="))
          .join("; ");
      async function login(name: string) {
        user = name;
        const begin = await call("/auth/login", "", {});
        expect(begin.status).toBe(303);
        const authorize = await fetch(begin.headers.get("location")!, {
          redirect: "manual",
        });
        const callback = await fetch(authorize.headers.get("location")!, {
          headers: { cookie: cookies(begin) },
          redirect: "manual",
        });
        expect(callback.headers.get("location")).toBe(`${origin}/`);
        expect(callback.headers.getSetCookie()).toHaveLength(2);
        return cookies(callback);
      }
      const alice = await login("alice"),
        bob = await login("bob");
      const publicBodies: string[] = [];
      const sessions: Record<string, string> = {};
      for (const [name, cookie] of [
        ["alice", alice],
        ["bob", bob],
      ]) {
        const response = await call("/api/session", cookie);
        expect(response.status, await response.clone().text()).toBe(200);
        const text = await response.text();
        publicBodies.push(text);
        const session = JSON.parse(text);
        expect(session.user.sub).toBe(name);
        expect(session.environment).toBe("local");
        const created = await call("/api/conversations", cookie, {
          agentId: session.agents[0].id,
          title: name,
        });
        expect(created.status).toBe(201);
        sessions[name] = (await created.json()).id;
      }
      const upload = new FormData();
      upload.set(
        "file",
        new File(["Alice private file"], "alice.txt", { type: "text/plain" }),
      );
      const uploaded = await call(
        `/api/files?chatId=${sessions.alice}`,
        alice,
        upload,
      );
      expect(uploaded.status, await uploaded.clone().text()).toBe(201);
      const file = await uploaded.json();
      const ownFile = await call(`/api/files/content?fileId=${file.id}`, alice);
      expect(ownFile.status).toBe(200);
      expect(await ownFile.text()).toBe("Alice private file");
      expect(
        (await call(`/api/files/content?fileId=${file.id}`, bob)).status,
      ).toBe(404);
      // Run the Session admitted by the real example backend. The MuseDAM UI gate
      // remains closed without a connection; this fixture makes no provider calls.
      const apiUrl = logs.match(
        /\[gea\] Agents API: (http:\/\/127\.0\.0\.1:\d+)\/api\/v1/,
      )?.[1];
      expect(apiUrl).toBeTruthy();
      const api = (route: string, token: string, body?: unknown) =>
        fetch(`${apiUrl}/api/v1${route}`, {
          method: body === undefined ? "GET" : "POST",
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
      for (const name of ["alice", "bob"]) {
        const run = await api(
          `/sessions/${sessions[name]}/runs`,
          `gea_user_${name}`,
          { input: "hello", stream: false },
        );
        expect(run.status).toBe(202);
        const { id: runId } = await run.json();
        await expect
          .poll(
            async () =>
              (await (await api(`/runs/${runId}`, `gea_user_${name}`)).json())
                .status,
            { timeout: 30000 },
          )
          .toBe("finished");
        const principalId = `gea:${createHash("sha256").update(issuerOrigin).digest("hex")}:${name}`;
        expect(identities).toContainEqual({
          user: { id: principalId },
          principal: { principalType: "user", principalId },
        });
        expect(
          (
            await api(
              `/runs/${runId}`,
              `gea_user_${name === "alice" ? "bob" : "alice"}`,
            )
          ).status,
        ).toBe(404);
      }
      expect(
        (await call(`/api/chat?chatId=${sessions.alice}`, bob)).status,
      ).toBe(404);
      expect(
        (
          await call("/api/chat", alice, {
            chatId: sessions.alice,
            message: "blocked without MuseDAM",
          })
        ).status,
      ).toBe(403);
      for (const [token, status] of [
        ["gea_user_expired", 401],
        ["gea_user_wrong-client", 401],
        ["gea_user_no-scope", 403],
      ] as const)
        expect((await api("/agents", token)).status).toBe(status);
      revoked = true;
      expect((await call("/api/session", alice)).status).toBe(401);
      revoked = false;
      unavailable = true;
      expect((await call("/api/session", alice)).status).toBe(503);
      unavailable = false;
      expect(apiTokens).toContain("gea_user_alice");
      expect(apiTokens).toContain("gea_user_bob");
      expect(apiTokens).not.toContain(variables.LOCAL_AGENTS_API_TOKEN);
      const assets: string[] = [];
      async function readAssets(directory: string) {
        for (const entry of await readdir(directory, { withFileTypes: true })) {
          const file = path.join(directory, entry.name);
          if (entry.isDirectory()) await readAssets(file);
          else assets.push(await readFile(file, "utf8"));
        }
      }
      await readAssets(path.join(root, "dist/client"));
      const browserOutput = [...publicBodies, ...assets, logs].join("\n");
      for (const marker of [
        secret,
        encryptionKey,
        variables.GEA_CREDENTIAL_STORE_KEY,
        variables.LOCAL_AGENTS_API_TOKEN,
        "gea_user_alice",
        "gea_user_bob",
        "synthetic-refresh-alice",
        "synthetic-unused-model-key",
      ])
        expect(
          browserOutput.includes(marker),
          "server credential leaked to client output/logs",
        ).toBe(false);
    } finally {
      if (child && child.exitCode === null) {
        child.kill("SIGTERM");
        await once(child, "exit");
      }
      issuer.closeAllConnections();
      await new Promise<void>((resolve) => issuer.close(() => resolve()));
      if (process.env.GEA_VITE_TEST_LOG)
        await writeFile(process.env.GEA_VITE_TEST_LOG, logs);
      await rm(root, { recursive: true, force: true });
    }
  },
  180000,
);
