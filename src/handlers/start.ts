import { InlineKeyboard, type Bot, type Context } from "grammy";
import { messages } from "../messages.js";
import type { UserRepository } from "../users/repository.js";

export async function userStatus(users: UserRepository | undefined, id: number | undefined) {
  if (!users || id === undefined) return "unavailable" as const;
  try {
    const row = await users.register(id);
    return row === null ? "unavailable" as const : row.isActive === true ? "active" as const : "pending" as const;
  } catch {
    return "unavailable" as const;
  }
}

export function registerStartHandler(bot: Bot<Context>, users?: UserRepository, miniAppUrl?: string): void {
  bot.chatType("private").command("start", async (context) => {
    const status = await userStatus(users, context.from?.id);
    const keyboard = status === "active" && miniAppUrl
      ? new InlineKeyboard().webApp(messages.open, miniAppUrl) : undefined;
    await context.reply(messages[status], keyboard ? { reply_markup: keyboard } : {});
  });
}
