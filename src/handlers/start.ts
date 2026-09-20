import { InlineKeyboard, type Bot, type Context } from "grammy";

const welcomeKeyboard = new InlineKeyboard().text("Help", "help");

export function registerStartHandler(bot: Bot<Context>): void {
  bot.chatType("private").command("start", async (context) => {
    await context.reply(
      "Welcome! Send me a plain-text message and I will echo it back.",
      { reply_markup: welcomeKeyboard },
    );
  });
}
