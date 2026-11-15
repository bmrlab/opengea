import { mkdir, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
await mkdir(new URL("../.gea/", import.meta.url), { recursive: true });
try {
  await writeFile(
    new URL("../.gea/view-token", import.meta.url),
    randomBytes(32).toString("hex"),
    { flag: "wx", mode: 0o600 },
  );
} catch (error) {
  if (error.code !== "EEXIST") throw error;
}
process.stdout.write(
  "Local research-view credential ready; existing credential preserved.\n",
);
