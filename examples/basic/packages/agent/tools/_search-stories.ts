import { defineTool } from "@gea-ai/agent-sdk";
import { z } from "zod";
import hackerNews, { searchInput } from "../connectors/hacker-news";

const searchResponse = z.object({
  hits: z.array(
    z.object({
      objectID: z.string().regex(/^\d+$/),
      title: z.string().nullable(),
      url: z.string().nullable(),
      points: z.number().nullable(),
      num_comments: z.number().nullable(),
      created_at: z.string(),
    }),
  ),
});

export default defineTool({
  name: "searchStories",
  description:
    "Search live Hacker News stories by topic, ranked by relevance. Returns metadata, not article contents.",
  input: searchInput,
  connectors: { hackerNews },
  execute: async ({ query, limit }, context) => {
    // Network access goes through the SDK's declared Connector capability.
    const data = searchResponse.parse(
      await context.connectors.hackerNews.invoke("search", { query, limit }),
    );
    return {
      query,
      stories: data.hits.map((hit) => ({
        title: hit.title ?? "Untitled story",
        discussionUrl: `https://news.ycombinator.com/item?id=${hit.objectID}`,
        points: hit.points ?? 0,
        comments: hit.num_comments ?? 0,
        publishedAt: hit.created_at,
      })),
    };
  },
});
