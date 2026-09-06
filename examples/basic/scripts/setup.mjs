import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
for (const [source, target] of [
  [".env.example", ".env"],
  ["apps/web/.env.example", "apps/web/.env.local"],
]) {
  if (existsSync(target)) continue;
  writeFileSync(
    target,
    readFileSync(source, "utf8").replace(
      "SESSION_SECRET=",
      `SESSION_SECRET=${randomBytes(32).toString("base64url")}`,
    ),
    { mode: 0o600 },
  );
}
console.log(
  "Add CREATIVE_REASONING_API_KEY to examples/basic/.env, then run pnpm dev. Existing files were preserved.",
);
