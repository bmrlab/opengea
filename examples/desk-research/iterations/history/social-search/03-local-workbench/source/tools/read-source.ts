import { defineTool } from "@gea-ai/agent-sdk";
import { z } from "zod";
import search from "../connectors/search";
import { noteIdFromUrl, parseSocialNoteResponse } from "../lib/evidence";
export default defineTool({
  name: "read_source",
  description:
    "读取 search_sources 已返回链接的笔记文本，以核对关键证据和营销性质。只支持无查询参数的小红书 explore 链接；不会读取图片、视频、评论，失败时保留资料缺口。",
  input: z.object({ url: z.string().max(300) }),
  connectors: { search },
  execute: async ({ url }, context) => {
    const id = noteIdFromUrl(url);
    const response = await context.connectors.search.invoke("request", {
      method: "GET",
      path: "/api/v1/xiaohongshu/app_v2/get_image_note_detail",
      query: { note_id: id },
    });
    return parseSocialNoteResponse(response, id);
  },
});
