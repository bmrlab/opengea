import { defineTool } from "@gea-ai/agent-sdk";
import { z } from "zod";
import search from "../connectors/search";
import { webUrl, parseContentsResponse } from "../lib/evidence";
import { captureSourceUrls } from "../lib/research";
export default defineTool({
  name: "read_source",
  description:
    "通过 Exa 读取 search_sources 已返回的关键来源，核对上下文、营销性质和反向信息。最多返回 12000 字符，不保证完整页面；失败时保留资料缺口。",
  input: z.object({ url: webUrl.pipe(z.string().max(2048)) }),
  connectors: { search },
  execute: async ({ url }, context) => {
    const result = parseContentsResponse(
      await context.connectors.search.invoke("request", {
        method: "POST",
        path: "/contents",
        body: { urls: [url], text: { maxCharacters: 12000 } },
      }),
      url,
    );
    await captureSourceUrls([result.source], context);
    return result;
  },
});
