import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { geaInstallation } from "@gea-ai/cli/runtime";

test("published CLI compiles distinct programmatic, direct and hidden caller permissions", async () => {
  const { directory } = JSON.parse(
    execFileSync(
      geaInstallation().cli,
      ["agent", "build", "--json-file", "agent-project.json"],
      { cwd: fileURLToPath(new URL("..", import.meta.url)), encoding: "utf8" },
    ),
  );
  const snapshots = {};
  const manifest = JSON.parse(
    await readFile(join(directory, "gea.agent-package.json"), "utf8"),
  );
  for (const entry of manifest.agentApplication.agents) {
    snapshots[entry.key] = JSON.parse(
      await readFile(join(directory, entry.snapshotPath), "utf8"),
    );
  }

  const warehouse = snapshots["code-mode-warehouse"];
  assert.ok(warehouse.programmaticToolCalling);
  for (const name of ["listWarehouses", "readInventory"]) {
    assert.deepEqual(
      warehouse.tools.find((tool) => tool.name === name).allowedCallers,
      ["programmatic"],
    );
  }
  assert.deepEqual(
    warehouse.tools.find((tool) => tool.name === "privateCanary")
      .allowedCallers,
    [],
  );

  for (const key of ["orders-code", "orders-skill", "orders-direct"]) {
    const snapshot = snapshots[key];
    const caller = key === "orders-direct" ? "direct" : "programmatic";
    assert.equal(
      Boolean(snapshot.programmaticToolCalling),
      caller === "programmatic",
    );
    assert.deepEqual(
      snapshot.tools.find((tool) => tool.name === "getDiscountPolicy")
        .allowedCallers,
      [caller],
    );
    assert.deepEqual(
      snapshot.connectors.find((connector) => connector.alias === "orders")
        .allowedCallers,
      [caller],
    );
  }
});
