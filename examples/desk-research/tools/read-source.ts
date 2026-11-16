import { defineTool } from "@gea-ai/agent-sdk";
import { z } from "zod";
import search from "../connectors/search";
import { webUrl, parseContentsResponse, sourceWindow } from "../lib/evidence";
import { captureSourceUrls } from "../lib/research";
export default defineTool({
  name: "read_source",
  description:
    "按完整URL读取该来源的真实正文片段，每次最多2000字符。可用query定位原文短语及邻近上下文，或用offset/nextOffset继续读；每次最多提取页面前12000字符，不保证全文。queryFound=false只表示本次提取未找到该短语；不得补写正文或把它解释为页面不存在。",
  input: z.object({
    url: webUrl.pipe(z.string().max(2048)),
    query: z.string().min(2).max(120).optional(),
    offset: z.number().int().nonnegative().max(12000).optional(),
  }),
  connectors: { search },
  execute: async ({ url, query, offset }, context) => {
    const result = parseContentsResponse(
      await context.connectors.search.invoke("request", {
        method: "POST",
        path: "/contents",
        body: { urls: [url], text: { maxCharacters: 12000 } },
      }),
      url,
    );
    await captureSourceUrls([result.source], context);
    return sourceWindow(result, { query, offset });
  },
});
