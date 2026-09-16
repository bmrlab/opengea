import { env as workerEnv } from "cloudflare:workers";
import type { DurableObjectNamespace } from "@cloudflare/workers-types";
import type {
  LoginFlow,
  OAuthSession,
  ConversationRuns,
} from "./session-objects";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const secureUrl = z.url().refine((value) => {
  const url = new URL(value);
  return (
    !url.username &&
    !url.password &&
    !url.search &&
    !url.hash &&
    (url.protocol === "https:" ||
      (url.protocol === "http:" &&
        (["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
          url.hostname.endsWith(".localhost"))))
  );
}, "Use HTTPS, or HTTP on a local development host, without credentials or query parameters.");
// Build and type-check require no secrets; resolve configuration only at request time.
export function getEnv() {
  const env = createEnv({
    server: {
      APP_ORIGIN: secureUrl.refine((v) => new URL(v).origin === v),
      TOKEN_ENCRYPTION_KEY: z
        .string()
        .refine((v) => /^[A-Za-z0-9+/]{43}=$/.test(v) && atob(v).length === 32),
      OAUTH_ISSUER_URL: secureUrl.refine((v) => new URL(v).origin === v),
      OAUTH_CLIENT_ID: z.string().trim().min(1),
      OAUTH_CLIENT_SECRET: z.string().min(1),
      AGENT_ENVIRONMENT: z
        .enum(["preview", "production"])
        .default("production"),
    },
    runtimeEnv: {
      APP_ORIGIN: workerEnv.APP_ORIGIN,
      TOKEN_ENCRYPTION_KEY: workerEnv.TOKEN_ENCRYPTION_KEY,
      OAUTH_ISSUER_URL: workerEnv.OAUTH_ISSUER_URL,
      OAUTH_CLIENT_ID: workerEnv.OAUTH_CLIENT_ID,
      OAUTH_CLIENT_SECRET: workerEnv.OAUTH_CLIENT_SECRET,
      AGENT_ENVIRONMENT: workerEnv.AGENT_ENVIRONMENT,
    },
    emptyStringAsUndefined: true,
    onValidationError: () => {
      throw new Error(
        "Check the OAuth application's server environment configuration.",
      );
    },
  });
  // RPC serializes enumerable fields; pass a plain snapshot of the validated config.
  return { ...env };
}

export type AuthConfig = ReturnType<typeof getEnv>;

export interface WorkerBindings {
  APP_ORIGIN?: string;
  TOKEN_ENCRYPTION_KEY?: string;
  OAUTH_ISSUER_URL?: string;
  OAUTH_CLIENT_ID?: string;
  OAUTH_CLIENT_SECRET?: string;
  AGENT_ENVIRONMENT?: string;
  LOGIN_FLOWS: DurableObjectNamespace<LoginFlow>;
  OAUTH_SESSIONS: DurableObjectNamespace<OAuthSession>;
  CONVERSATION_RUNS: DurableObjectNamespace<ConversationRuns>;
}

// Environment and client identity are part of every stable object name.
export function storageScope(config: AuthConfig) {
  return JSON.stringify([
    config.APP_ORIGIN,
    config.OAUTH_ISSUER_URL,
    config.OAUTH_CLIENT_ID,
    config.AGENT_ENVIRONMENT,
  ]);
}
export { workerEnv };
