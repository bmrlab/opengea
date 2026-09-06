import { defineToolSet } from "@gea-ai/agent-sdk";
import searchStories from "./_search-stories";

// The CLI discovers this Tool Set. Underscore-prefixed implementation files are not rediscovered.
export default defineToolSet([searchStories]);
