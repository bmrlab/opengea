import { expect, test } from "vitest";
import type { AgentToolApprovalContext } from "@gea-ai/agent-sdk";
import searchStories from "../../../packages/agent/tools/_search-stories";

test("search requires approval unless trusted Agent configuration disables it", async () => {
  const decide = (value?: string) => {
    const context = {
      env: { REQUIRE_SEARCH_APPROVAL: value },
    } as unknown as AgentToolApprovalContext;
    return typeof searchStories.approval === "function"
      ? searchStories.approval({ query: "TypeScript", limit: 3 }, context)
      : searchStories.approval;
  };
  expect(await decide("true")).toBe("user-approval");
  expect(await decide("false")).toBe("approved");
  expect(await decide()).toBe("user-approval");
  expect(await decide("")).toBe("user-approval");
});
