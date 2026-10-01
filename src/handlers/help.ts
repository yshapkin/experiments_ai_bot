import { InlineKeyboard, type Bot, type Context } from "grammy";
import { messages } from "../messages.js";
import type { UserRepository } from "../users/repository.js";

export function registerHelpHandler(bot: Bot<Context>, users?: UserRepository, miniAppUrl?: string): void {
  bot.callbackQuery("help", async (context) => {
    if (context.chat?.type !== "private") return;
    await context.answerCallbackQuery();
    try {
      await context.editMessageReplyMarkup({ reply_markup: new InlineKeyboard() });
    } catch {
      // An old callback may refer to a message no longer editable.
    }
    let status: keyof Pick<typeof messages, "missing" | "active" | "pending" | "unavailable"> = "unavailable";
    try {
      const row = context.from?.id === undefined ? null : await users?.find(context.from.id);
      status = row === null ? "missing" : row?.isActive === true ? "active" : row ? "pending" : "unavailable";
    } catch {
      status = "unavailable";
    }
    await context.reply(messages[status], {
      ...(status === "active" && miniAppUrl
        ? { reply_markup: new InlineKeyboard().webApp(messages.open, miniAppUrl) } : {}),
    });
  });
}
