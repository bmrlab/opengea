import {
  defineConnector,
  type AgentCustomConnectorContext,
} from "@gea-ai/agent-sdk";
import { z } from "zod";

export const searchInput = z.object({
  query: z.string().trim().min(1).max(200),
  limit: z.number().int().min(1).max(5).default(3),
});

const hackerNews = defineConnector({
  key: "hacker-news",
  name: "Hacker News Search",
  connection: { principalType: "agent" },
  networkHosts: ["hn.algolia.com"],
  operations: {
    search: {
      input: searchInput,
      execute: async (
        { query, limit }: z.output<typeof searchInput>,
        context: AgentCustomConnectorContext,
      ) => {
        const url = new URL("https://hn.algolia.com/api/v1/search");
        url.searchParams.set("tags", "story");
        url.searchParams.set("query", query);
        url.searchParams.set("hitsPerPage", String(limit));
        const response = await context.fetch(url, { signal: context.signal });
        if (!response.ok)
          throw new Error(
            `Hacker News search failed (HTTP ${response.status}).`,
          );
        const data: unknown = await response.json();
        return data;
      },
    },
  },
});
export default hackerNews.require({ exposeToModel: false });
