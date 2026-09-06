import { defineJudge } from "@gea-ai/agent-sdk/evals";
import type { NewsMessage } from "../../messages";

export default defineJudge<NewsMessage>(({ messages, output }) => {
  const searches = messages.flatMap((message) =>
    message.parts.flatMap((part) =>
      part.type === "tool-searchStories" && part.state === "output-available"
        ? [part]
        : [],
    ),
  );
  const stories = searches.flatMap((part) => part.output.stories);
  const cited = stories.some((story) => output.includes(story.discussionUrl));
  return {
    score: searches.length > 0 && stories.length > 0 && cited ? 1 : 0,
    reason: cited
      ? "Executed a real search and cited a returned discussion URL."
      : "Missing successful search results or a citation from those results.",
  };
});
