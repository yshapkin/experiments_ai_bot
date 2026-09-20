import type { Bot, Context } from "grammy";

export function registerTextHandler(bot: Bot<Context>): void {
  bot.chatType("private").on("message:text", async (context) => {
    const text = context.message.text;
    if (text.startsWith("/")) {
      return;
    }

    await context.reply(text);
  });
}
