import "server-only";
import { z } from "zod";
import { getEnv } from "./env";

export const scopes = ["openid", "profile", "offline_access", "agents:invoke"];
export const tokenSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  token_type: z.string().refine((v) => v.toLowerCase() === "bearer"),
  expires_in: z.number().int().positive(),
  scope: z.string(),
  application: z.object({ id: z.uuid() }),
  authorization: z.object({ id: z.uuid() }),
  organization: z.object({
    id: z.uuid(),
    name: z.string().min(1),
    slug: z.string().min(1),
  }),
});
export const userSchema = z.object({
  sub: z.string().min(1),
  name: z.string().nullish(),
});
export type Token = z.infer<typeof tokenSchema>;

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
export function authorizationUrl(state: string, codeChallenge: string) {
  const env = getEnv();
  const url = new URL("/api/auth/oauth2/authorize", env.GEA_BASE_URL);
  url.search = new URLSearchParams({
    client_id: env.GEA_CLIENT_ID,
    redirect_uri: `${env.APP_ORIGIN}/auth/callback`,
    response_type: "code",
    scope: scopes.join(" "),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  }).toString();
  return url.href;
}
async function oauthPost(path: "token" | "revoke", body: URLSearchParams) {
  const env = getEnv();
  return fetch(`${env.GEA_BASE_URL}/api/auth/oauth2/${path}`, {
    method: "POST",
    body,
    headers: {
      authorization: `Basic ${Buffer.from(`${encodeURIComponent(env.GEA_CLIENT_ID)}:${encodeURIComponent(env.GEA_CLIENT_SECRET)}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    cache: "no-store",
    redirect: "error",
    credentials: "omit",
    signal: AbortSignal.timeout(15000),
  });
}
export async function tokenRequest(body: URLSearchParams) {
  const response = await oauthPost("token", body);
  if (!response.ok)
    throw new HttpError(
      502,
      "oauth_failed",
      "GEA could not complete authorization. Please sign in again.",
    );
  const token = tokenSchema.parse(await response.json());
  if (!scopes.every((scope) => token.scope.split(/\s+/).includes(scope)))
    throw new HttpError(
      403,
      "missing_scope",
      "The application needs all listed permissions. Update the GEA approval, then sign in again.",
    );
  return token;
}
export async function revokeRefreshToken(token: string) {
  const response = await oauthPost(
    "revoke",
    new URLSearchParams({ token, token_type_hint: "refresh_token" }),
  );
  if (!response.ok)
    throw new HttpError(
      502,
      "revoke_failed",
      "GEA could not confirm revocation. Retry signing out.",
    );
  await response.body?.cancel();
}
export async function userInfo(accessToken: string) {
  const response = await fetch(`${getEnv().GEA_BASE_URL}/api/auth/oauth2/userinfo`, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    redirect: "error",
    credentials: "omit",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new HttpError(
      response.status === 401 ? 401 : 502,
      "profile_failed",
      "Could not verify your GEA profile. Retry or sign in again.",
    );
  return userSchema.parse(await response.json());
}
export async function agentFetch(path: string, accessToken: string, init: RequestInit = {}) {
  return fetch(`${getEnv().GEA_BASE_URL}/api/v1${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${accessToken}`,
      ...(init.body instanceof FormData ? {} : { "content-type": "application/json" }),
    },
    cache: "no-store",
    redirect: init.redirect ?? "error",
    credentials: "omit",
    signal: init.signal ?? AbortSignal.timeout(25000),
  });
}
