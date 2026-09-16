import { getEnv, storageScope, workerEnv } from "./env";
import { hash } from "./store";
import { HttpError, userInfo, type Token } from "./gea";

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
export function setCookie(
  headers: Headers,
  name: string,
  value: string,
  maxAge: number,
) {
  headers.append(
    "set-cookie",
    `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${getEnv().APP_ORIGIN.startsWith("https:") ? "; Secure" : ""}`,
  );
}
export function loginFlow(key: string) {
  return workerEnv.LOGIN_FLOWS.getByName(
    `${storageScope(getEnv())}:flow:${key}`,
  );
}
export function oauthSession(key: string) {
  return workerEnv.OAUTH_SESSIONS.getByName(
    `${storageScope(getEnv())}:session:${key}`,
  );
}
export async function loadSession(request: Request) {
  const cookie = cookieValue(request, sessionCookie);
  if (!cookie)
    throw new HttpError(401, "sign_in_required", "Sign in to GEA to continue.");
  const key = await hash(cookie);
  const current = await oauthSession(key).load(getEnv());
  if (!current)
    throw new HttpError(
      401,
      "sign_in_required",
      "Your session is unavailable. Sign out, then sign in again.",
    );
  return { key, ...current };
}
export async function saveSession(key: string, token: Token) {
  const user = await userInfo(token.access_token);
  await oauthSession(key).create({ token, user }, getEnv());
}
export function conversationRuns(
  current: Awaited<ReturnType<typeof loadSession>>,
) {
  const identity = JSON.stringify([
    current.token.application.id,
    current.token.organization.id,
    current.user.sub,
  ]);
  return workerEnv.CONVERSATION_RUNS.getByName(
    `${storageScope(getEnv())}:runs:${identity}`,
  );
}
