import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { getEnv } from "./env";

let pool: Pool | undefined;
export function getPool() {
  return (pool ??= new Pool({
    connectionString: getEnv().DATABASE_URL,
    max: 3,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
  }));
}
export const randomSecret = () => randomBytes(32).toString("base64url");
export const hash = (value: string) => createHash("sha256").update(value).digest("base64url");
export function seal(value: unknown, rowKey: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(
    "aes-256-gcm",
    Buffer.from(getEnv().TOKEN_ENCRYPTION_KEY, "base64"),
    iv,
  );
  cipher.setAAD(Buffer.from(rowKey));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}
export function unseal(value: string, rowKey: string): unknown {
  const bytes = Buffer.from(value, "base64");
  const cipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(getEnv().TOKEN_ENCRYPTION_KEY, "base64"),
    bytes.subarray(0, 12),
  );
  cipher.setAAD(Buffer.from(rowKey));
  cipher.setAuthTag(bytes.subarray(12, 28));
  return JSON.parse(
    Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString("utf8"),
  );
}
// PostgreSQL is the shared synchronization boundary for serverless instances.
export async function transaction<T>(work: (client: PoolClient) => Promise<T>) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
