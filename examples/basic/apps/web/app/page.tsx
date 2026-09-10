import { NewsChat } from "./news-chat";
import { connection } from "next/server";
import { getEnv } from "../server/env";
import { z } from "zod";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ chat?: string }>;
}) {
  await connection();
  const chat = z
    .uuid()
    .optional()
    .safeParse((await searchParams).chat);
  return (
    <NewsChat
      mode={getEnv().GEA_MODE}
      initialChatId={chat.success ? chat.data : undefined}
    />
  );
}
