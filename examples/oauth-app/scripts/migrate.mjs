import { readFile } from "node:fs/promises";
import pg from "pg";
if (!process.env.DATABASE_URL)
  throw new Error("Set DATABASE_URL to this application's PostgreSQL database.");
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
try {
  await db.query(await readFile(new URL("../server/schema.sql", import.meta.url), "utf8"));
  console.log("OAuth example schema is ready.");
} finally {
  await db.end();
}
