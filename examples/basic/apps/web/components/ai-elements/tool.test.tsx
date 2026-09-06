import { expect, test } from "vitest";
import { renderToString } from "react-dom/server";
import { ToolInput } from "./tool";
test("a Tool that has started streaming can render before its input arrives", () => {
  expect(renderToString(<ToolInput input={undefined} />)).toContain(
    "Waiting for tool input",
  );
});
