export type SourcePassage = { passageId: string; text: string };

// Every selectable passage is a contiguous slice of the returned text. Break
// near sentence/paragraph boundaries when possible; never join remote excerpts.
export async function sourcePassages(
  sourceId: string,
  text: string,
): Promise<SourcePassage[]> {
  const passages: SourcePassage[] = [];
  for (let start = 0; start < text.length;) {
    let end = Math.min(start + 400, text.length);
    if (end < text.length) {
      const window = text.slice(start, end);
      const boundary = Math.max(
        window.lastIndexOf("\n"),
        window.lastIndexOf("。"),
        window.lastIndexOf("；"),
      );
      if (boundary >= 160) end = start + boundary + 1;
    }
    const value = text.slice(start, end).trim();
    if (value) {
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(`${sourceId}\0${value}`),
      );
      const hash = Array.from(new Uint8Array(digest), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join("");
      passages.push({ passageId: `p_${hash.slice(0, 16)}`, text: value });
    }
    start = end;
  }
  return passages;
}
