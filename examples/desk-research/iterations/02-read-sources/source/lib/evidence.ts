import { z } from "zod";

export const webUrl = z.url().refine((value) => /^https?:\/\//u.test(value));
const envelope = z.object({
  ok: z.boolean(),
  data: z.object({
    ok: z.boolean(),
    status: z.number().int(),
    data: z.unknown().optional(),
  }),
});
const note = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]+$/u),
  title: z.string().nullish(),
  desc: z.string().nullish(),
  timestamp: z.number().int().nonnegative().nullish(),
});
const payload = z.object({
  code: z.literal(200),
  data: z.object({
    code: z.literal(0),
    success: z.literal(true),
    data: z.object({
      items: z.array(z.object({ note: note.optional() })).max(100),
    }),
  }),
});

export function parseSocialSearchResponse(value: unknown) {
  const response = envelope.parse(value);
  if (!response.ok || !response.data.ok)
    throw new Error(`Social Search failed (HTTP ${response.data.status}).`);
  const result = payload.parse(response.data.data);
  const notes = result.data.data.items.flatMap((item) =>
    item.note ? [item.note] : [],
  );
  const unique = [...new Map(notes.map((item) => [item.id, item])).values()];
  return {
    retrievedAt: new Date().toISOString(),
    sourceLimit: 5,
    availableNoteCount: unique.length,
    limitations:
      "仅为搜索返回的社交笔记摘录，未读取评论、图片或视频；不能代表目标人群总体。链接可能需要平台登录。",
    sources: unique.slice(0, 5).map((item) => ({
      title: item.title || "Untitled social post",
      url: `https://www.xiaohongshu.com/explore/${item.id}`,
      text: (item.desc ?? "").slice(0, 6000),
      truncated: (item.desc?.length ?? 0) > 6000,
      publishedAt: item.timestamp
        ? new Date(item.timestamp * 1000).toISOString()
        : null,
      sourceType: "social-post",
      textScope: "search-excerpt",
    })),
  };
}

const noteUrl = z
  .string()
  .regex(/^https:\/\/www\.xiaohongshu\.com\/explore\/([a-zA-Z0-9_-]+)$/u);
export function noteIdFromUrl(value: string) {
  return noteUrl.parse(value).split("/").at(-1)!;
}
const detailPayload = z.object({
  code: z.literal(200),
  data: z.object({
    code: z.literal(0),
    success: z.literal(true),
    data: z.array(
      z.object({
        note_list: z.array(
          z.object({
            id: z.string(),
            title: z.string().nullish(),
            desc: z.string().nullish(),
            time: z.number().int().nonnegative().nullish(),
          }),
        ),
      }),
    ),
  }),
});
export function parseSocialNoteResponse(value: unknown, requestedId: string) {
  const response = envelope.parse(value);
  if (!response.ok || !response.data.ok)
    throw new Error(
      `Social note detail failed (HTTP ${response.data.status}).`,
    );
  const result = detailPayload.parse(response.data.data);
  const item = result.data.data
    .flatMap((group) => group.note_list)
    .find((note) => note.id === requestedId);
  if (!item)
    throw new Error(
      "The requested note was not returned; do not use another note as evidence.",
    );
  return {
    retrievedAt: new Date().toISOString(),
    limitations:
      "仅取得服务返回的笔记文本，未读取图片、视频或评论；作者身份和营销性质需要从文本判断，不能视为真实用户访谈。",
    source: {
      title: item.title || "Untitled social post",
      url: `https://www.xiaohongshu.com/explore/${requestedId}`,
      text: (item.desc ?? "").slice(0, 6000),
      truncated: (item.desc?.length ?? 0) > 6000,
      publishedAt: item.time ? new Date(item.time * 1000).toISOString() : null,
      sourceType: "social-post",
      textScope: "note-text",
    },
  };
}
