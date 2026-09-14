import "server-only";
import { z } from "zod";
import { getEnv } from "./env";
import { getPool, hash, seal, transaction, unseal } from "./store";
import { HttpError, tokenRequest, tokenSchema, userInfo, userSchema, type Token } from "./gea";

export const sessionCookie = "opengea-oauth-session";
export const flowCookie = "opengea-oauth-flow";
export function cookieValue(request: Request, name: string) {
  const value = request.headers
    .get("cookie")
    ?.split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith(`${name}=`))
    ?.slice(name.length + 1);
  return value && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
}
export function setCookie(headers: Headers, name: string, value: string, maxAge: number) {
  headers.append(
    "set-cookie",
    `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${getEnv().APP_ORIGIN.startsWith("https:") ? "; Secure" : ""}`,
  );
}
export function sessionKey(request: Request) {
  const cookie = cookieValue(request, sessionCookie);
  if (!cookie) throw new HttpError(401, "sign_in_required", "Sign in to GEA to continue.");
  return hash(cookie);
}
export const payloadSchema = z.object({ token: tokenSchema, user: userSchema });
export type SessionRow = {
  session_key: string;
  payload: string;
  status: "active" | "reauth_required" | "logout_pending";
  token_expires_at: Date;
  expires_at: Date;
  chat_id: string | null;
  run_id: string | null;
};
export async function loadSession(request: Request) {
  const key = sessionKey(request);
  const current = await transaction(async (client) => {
    const { rows } = await client.query<SessionRow>(
      "SELECT * FROM oauth_example_sessions WHERE session_key = $1 AND expires_at > now() FOR UPDATE",
      [key],
    );
    const row = rows[0];
    if (!row || row.status !== "active") return null;
    let payload = payloadSchema.parse(unseal(row.payload, key));
    if (row.token_expires_at.getTime() <= Date.now() + 60000) {
      // Hold the shared row lock through refresh AND saving the rotated pair.
      // A failed/ambiguous exchange is never retried with the old refresh token.
      try {
        const next = await tokenRequest(
          new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: payload.token.refresh_token,
          }),
        );
        if (
          next.application.id !== payload.token.application.id ||
          next.authorization.id !== payload.token.authorization.id ||
          next.organization.id !== payload.token.organization.id
        )
          throw new Error("Changed OAuth grant identity");
        payload = { ...payload, token: next };
        row.token_expires_at = new Date(Date.now() + next.expires_in * 1000);
        await client.query(
          "UPDATE oauth_example_sessions SET payload = $2, token_expires_at = $3 WHERE session_key = $1",
          [key, seal(payload, key), row.token_expires_at],
        );
      } catch {
        await client.query(
          "UPDATE oauth_example_sessions SET status = 'reauth_required' WHERE session_key = $1",
          [key],
        );
        return null;
      }
    }
    return { key, row, ...payload };
  });
  if (!current)
    throw new HttpError(
      401,
      "sign_in_required",
      "Your session is unavailable. Sign out, then sign in again.",
    );
  return current;
}
export async function saveSession(key: string, token: Token) {
  const user = await userInfo(token.access_token);
  await getPool().query(
    "INSERT INTO oauth_example_sessions (session_key, payload, token_expires_at, expires_at) VALUES ($1,$2,$3,now() + interval '7 days')",
    [key, seal({ token, user }, key), new Date(Date.now() + token.expires_in * 1000)],
  );
}
