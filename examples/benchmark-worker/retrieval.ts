import { z } from "zod";
export const inputSchema = z
  .object({
    query: z.string().min(1),
    documents: z
      .array(z.object({ id: z.string(), title: z.string(), text: z.string() }))
      .min(1),
  })
  .refine(
    (x) => new Set(x.documents.map((d) => d.id)).size === x.documents.length,
    "Duplicate document IDs",
  );
export const parametersSchema = z.object({
  algorithm: z.enum(["overlap", "bm25"]).default("bm25"),
  k: z.number().int().min(1).max(10).default(3),
});
export const outputSchema = z.object({
  query: z.string(),
  algorithm: z.enum(["overlap", "bm25"]),
  k: z.number().int().positive(),
  ranking: z.array(z.object({ id: z.string(), score: z.number().finite() })),
});
const tokens = (text: string): string[] =>
  text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
export function retrieve(raw: unknown, options: unknown) {
  const input = inputSchema.parse(raw);
  const { algorithm, k } = parametersSchema.parse(options);
  const query = [...new Set(tokens(input.query))];
  const documents = input.documents.map((d) => ({
    ...d,
    tokens: tokens(`${d.title} ${d.text}`),
  }));
  const averageLength =
    documents.reduce((n, d) => n + d.tokens.length, 0) / documents.length || 1;
  const ranking = documents
    .map((d) => ({
      id: d.id,
      score: query.reduce((score, term) => {
        const frequency = d.tokens.filter((t) => t === term).length;
        if (!frequency) return score;
        if (algorithm === "overlap") return score + 1;
        const df = documents.filter((doc) => doc.tokens.includes(term)).length;
        const idf = Math.log(1 + (documents.length - df + 0.5) / (df + 0.5));
        return (
          score +
          (idf * frequency * 2.2) /
            (frequency +
              1.2 * (0.25 + (0.75 * d.tokens.length) / averageLength))
        );
      }, 0),
    }))
    .filter((d) => d.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, k);
  return { query: input.query, algorithm, k, ranking };
}
export function metrics(ids: string[], relevant: string[], k: number) {
  const expected = new Set(relevant);
  if (!expected.size || expected.size !== relevant.length)
    throw new Error("Reference must contain unique relevant IDs");
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate ranked IDs");
  const hits = ids.slice(0, k).map((id) => expected.has(id));
  const first = hits.indexOf(true);
  const dcg = hits.reduce(
    (sum, hit, i) => sum + (hit ? 1 / Math.log2(i + 2) : 0),
    0,
  );
  const ideal = Array.from(
    { length: Math.min(k, expected.size) },
    (_, i) => 1 / Math.log2(i + 2),
  ).reduce((a, b) => a + b, 0);
  return {
    recall: hits.filter(Boolean).length / expected.size,
    reciprocalRank: first < 0 ? 0 : 1 / (first + 1),
    ndcg: dcg / ideal,
  };
}
