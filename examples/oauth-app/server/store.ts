const encoder = new TextEncoder();

function base64(bytes: Uint8Array) {
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""));
}
function bytes(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}
function base64url(value: Uint8Array) {
  return base64(value)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
export function randomSecret() {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}
export async function hash(value: string) {
  return base64url(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", encoder.encode(value)),
    ),
  );
}
export async function seal(value: unknown, rowKey: string, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey(
    "raw",
    bytes(secret),
    "AES-GCM",
    false,
    ["encrypt"],
  );
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(rowKey) },
    key,
    encoder.encode(JSON.stringify(value)),
  );
  return `${base64(iv)}.${base64(new Uint8Array(encrypted))}`;
}
export async function unseal(
  value: string,
  rowKey: string,
  secret: string,
): Promise<unknown> {
  const parts = value.split(".");
  if (parts.length !== 2) throw new Error("Invalid encrypted session record.");
  const key = await crypto.subtle.importKey(
    "raw",
    bytes(secret),
    "AES-GCM",
    false,
    ["decrypt"],
  );
  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: bytes(parts[0]!),
      additionalData: encoder.encode(rowKey),
    },
    key,
    bytes(parts[1]!),
  );
  return JSON.parse(new TextDecoder().decode(decrypted));
}
