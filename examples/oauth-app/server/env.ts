import "server-only";
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
      DATABASE_URL: z.string().min(1),
      TOKEN_ENCRYPTION_KEY: z
        .string()
        .refine((v) => /^[A-Za-z0-9+/]{43}=$/.test(v) && Buffer.from(v, "base64").length === 32),
      GEA_BASE_URL: secureUrl.refine((v) => new URL(v).origin === v),
      GEA_CLIENT_ID: z.string().trim().min(1),
      GEA_CLIENT_SECRET: z.string().min(1),
      GEA_ENVIRONMENT: z.enum(["preview", "production"]).default("production"),
    },
    runtimeEnv: process.env,
    emptyStringAsUndefined: true,
    onValidationError: () => {
      throw new Error("Check the OAuth application's server environment configuration.");
    },
  });
  return env;
}
