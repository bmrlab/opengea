import { readdir } from "node:fs/promises";
import { expect, it } from "vitest";

it("excludes local credentials and deployment configuration from the upload directories", async () => {
  // GEA packages every output file, including otherwise hidden local configuration.
  for (const directory of ["dist/server", "dist/client"]) {
    const files = await readdir(directory, { recursive: true });
    expect(
      files.filter((name) =>
        /(^|[/\\])(?:\.dev\.vars(?:\..*)?|\.env(?:\..*)?|wrangler\.json)$/.test(
          name,
        ),
      ),
    ).toEqual([]);
  }
});
