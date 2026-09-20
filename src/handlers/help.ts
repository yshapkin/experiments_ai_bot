import type { Bot, Context } from "grammy";

export function registerHelpHandler(bot: Bot<Context>): void {
  bot.callbackQuery("help", async (context) => {
    if (context.chat?.type !== "private") {
      return;
    }

    await context.answerCallbackQuery();
    await context.reply(
      "Send a plain-text message and I will echo it back unchanged.",
    );
  });
}
