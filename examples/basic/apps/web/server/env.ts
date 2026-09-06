import "server-only";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

// Resolve at request time: build/typecheck requires no deployment credentials.
export function getEnv() {
  const env = createEnv({
    server: {
      APP_ORIGIN: z
        .url()
        .refine(
          (value) => new URL(value).origin === value,
          "Use an origin without a trailing slash",
        ),
      SESSION_SECRET: z.string().min(32),
      GEA_MODE: z.enum(["local", "hosted"]),
      GEA_AGENT_URL: z.url(),
      GEA_PROJECT_API_KEY: z.string().optional(),
    },
    runtimeEnv: process.env,
    emptyStringAsUndefined: true,
    onValidationError: () => {
      throw new Error(
        "Invalid server configuration. Check apps/web/.env.local.",
      );
    },
  });
  const url = new URL(env.GEA_AGENT_URL);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname.endsWith("/run")
  ) {
    throw new Error(
      "GEA_AGENT_URL must be an Agent base URL without /run or credentials.",
    );
  }
  if (env.GEA_MODE === "local") {
    if (
      url.protocol !== "http:" ||
      !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
    ) {
      throw new Error("Local Agent access requires a loopback HTTP URL.");
    }
    if (
      new URL(env.APP_ORIGIN).protocol !== "http:" ||
      !["127.0.0.1", "localhost", "[::1]"].includes(
        new URL(env.APP_ORIGIN).hostname,
      )
    ) {
      throw new Error("Local mode is for loopback development only.");
    }
  } else if (url.protocol !== "https:" || !env.GEA_PROJECT_API_KEY) {
    throw new Error(
      "Hosted mode requires an HTTPS Agent URL and Project API key.",
    );
  }
  return { ...env, GEA_AGENT_URL: url.href.replace(/\/$/, "") };
}
