import { z } from "zod";
export const webUrl = z
  .url()
  .refine(
    (value) =>
      /^https?:\/\//u.test(value) &&
      !new URL(value).username &&
      !new URL(value).password,
  );
const envelope = z.object({
  ok: z.boolean(),
  status: z.number().int(),
  data: z.unknown().optional(),
});
const item = z.object({
  url: webUrl,
  title: z.string().nullish(),
  text: z.string().nullish(),
  publishedDate: z.string().nullish(),
});
const payload = z.object({
  results: z.array(item).max(100),
  statuses: z
    .array(z.object({ id: z.string(), status: z.string() }))
    .optional(),
});
function readResponse(value: unknown) {
  const response = envelope.parse(value);
  if (!response.ok || response.status < 200 || response.status >= 300)
    throw new Error(`Exa request failed (HTTP ${response.status}).`);
  return payload.parse(response.data);
}
function source(value: z.infer<typeof item>, limit: number, textScope: string) {
  return {
    title: value.title || "Untitled source",
    url: value.url,
    text: (value.text ?? "").slice(0, limit),
    truncated: (value.text?.length ?? 0) >= limit,
    textLimit: limit,
    publishedAt: value.publishedDate ?? null,
    sourceType: "web-page",
    textScope,
  };
}
const limitations =
  "仅使用服务实际返回的网页文本；提取有长度上限，不能保证全文、图片、评论或视频已读取。检索时间不是来源发表时间，公开资料不是代表性抽样。";
export const SEARCH_RESULT_LIMIT = 3;
export const SEARCH_TEXT_LIMIT = 600;
export function parseSearchResponse(value: unknown) {
  const result = readResponse(value);
  const sources = result.results
    .slice(0, SEARCH_RESULT_LIMIT)
    .map((value) => source(value, SEARCH_TEXT_LIMIT, "search-text"));
  return {
    retrievedAt: new Date().toISOString(),
    sourceIndex: sources.map(({ title, url, publishedAt }) => ({
      title,
      url,
      publishedAt,
    })),
    sourceLimit: SEARCH_RESULT_LIMIT,
    limitations,
    sources,
  };
}

// Keep each requested passage next to its source identity. Search previews are
// for choosing pages; this reader exposes exact captured text without forcing
// the model to retrieve repeated, whole multi-source tool payloads.
export function sourceWindow(
  result: ReturnType<typeof parseContentsResponse>,
  input: { offset?: number; query?: string },
) {
  const text = result.source.text;
  const match = input.query ? text.indexOf(input.query) : -1;
  const offset =
    input.query && match >= 0 ? Math.max(0, match - 200) : (input.offset ?? 0);
  if (offset > text.length)
    throw new Error("Requested offset is outside the captured text.");
  const end = Math.min(text.length, offset + 2000);
  return {
    ...result,
    ...(input.query ? { queryFound: match >= 0 } : {}),
    source: {
      ...result.source,
      text: text.slice(offset, end),
      textOffset: offset,
      nextOffset: end < text.length ? end : null,
      extractedCharacters: text.length,
      extractionLimit: result.source.textLimit,
      extractionTruncated: result.source.truncated,
      textLimit: 2000,
      truncated: result.source.truncated || offset > 0 || end < text.length,
    },
  };
}
export function parseContentsResponse(value: unknown, requestedUrl: string) {
  const url = webUrl.parse(requestedUrl);
  const result = readResponse(value);
  if (result.statuses?.some((value) => value.status !== "success"))
    throw new Error(
      "Exa could not retrieve the requested page; preserve the evidence gap.",
    );
  const found = result.results.find((value) => value.url === url);
  if (!found)
    throw new Error(
      "The requested URL was not returned; do not substitute another page as evidence.",
    );
  return {
    retrievedAt: new Date().toISOString(),
    limitations,
    source: source(found, 12000, "page-text"),
  };
}
