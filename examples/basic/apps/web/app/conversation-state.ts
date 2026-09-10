import type { NewsMessage } from "@opengea/basic-agent/messages";

export type ConversationState = {
  messages: NewsMessage[];
  run: { id: string; chatId: string; status: string } | null;
  hasOlderMessages: boolean;
};
