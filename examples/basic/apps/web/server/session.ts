import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const claimsSchema = z.strictObject({
  sessionId: z.uuid(),
  expires: z.number().int(),
  chatId: z.uuid().optional(),
  runId: z.uuid().optional(),
  audience: z.string().optional(),
});
type Claims = z.infer<typeof claimsSchema>;
export const sessionCookie = "opengea-session";
export const chatCookie = (chatId: string) => `opengea-chat-${chatId}`;
export function newSession(): Claims {
  return {
    sessionId: randomUUID(),
    expires: Math.floor(Date.now() / 1000) + 86400,
  };
}
function signature(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest();
}
export function readClaims(
  cookie: string | undefined,
  secret: string,
): Claims | null {
  if (!cookie) return null;
  const [payload, mac, extra] = cookie.split(".");
  if (!payload || !mac || extra !== undefined) return null;
  const expected = signature(payload, secret);
  const actual = Buffer.from(mac, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    return null;
  // Verified cookie decoding is a browser-storage boundary, including old cookie formats.
  try {
    const parsed = claimsSchema.safeParse(
      JSON.parse(Buffer.from(payload, "base64url").toString()),
    );
    return parsed.success && parsed.data.expires > Date.now() / 1000
      ? parsed.data
      : null;
  } catch {
    return null;
  }
}
export function cookieValue(request: Request, name: string) {
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}
export function ownedChat(
  request: Request,
  chatId: string,
  env: { SESSION_SECRET: string; GEA_AGENT_URL: string },
) {
  const session = readClaims(
    cookieValue(request, sessionCookie),
    env.SESSION_SECRET,
  );
  const grant = readClaims(
    cookieValue(request, chatCookie(chatId)),
    env.SESSION_SECRET,
  );
  return session &&
    grant &&
    grant.sessionId === session.sessionId &&
    grant.chatId === chatId &&
    grant.audience === env.GEA_AGENT_URL
    ? grant
    : null;
}
export function setClaims(
  headers: Headers,
  name: string,
  claims: Claims,
  secret: string,
  secure: boolean,
) {
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const value = `${payload}.${signature(payload, secret).toString("base64url")}`;
  headers.append(
    "set-cookie",
    `${name}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.max(0, claims.expires - Math.floor(Date.now() / 1000))}${secure ? "; Secure" : ""}`,
  );
}
