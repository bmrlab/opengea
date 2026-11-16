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
export function parseSearchResponse(value: unknown) {
  const result = readResponse(value);
  const sources = result.results
    .slice(0, 5)
    .map((value) => source(value, 6000, "search-text"));
  return {
    retrievedAt: new Date().toISOString(),
    sourceIndex: sources.map(({ title, url, publishedAt }) => ({
      title,
      url,
      publishedAt,
    })),
    sourceLimit: 5,
    limitations,
    sources,
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
