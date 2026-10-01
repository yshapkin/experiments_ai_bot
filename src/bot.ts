import { Bot, type BotConfig, type Context } from "grammy";

import { registerHelpHandler } from "./handlers/help.js";
import { registerStartHandler } from "./handlers/start.js";
import { registerTextHandler } from "./handlers/text.js";
import { createLogger, type Logger } from "./logger.js";
import type { UserRepository } from "./users/repository.js";

export interface CreateBotOptions {
  botConfig?: BotConfig<Context>;
  logger?: Logger;
  users?: UserRepository;
  miniAppUrl?: string;
}

export function createBot(
  token: string,
  options: CreateBotOptions = {},
): Bot<Context> {
  const bot = new Bot<Context>(token, options.botConfig);
  const logger = options.logger ?? createLogger();

  registerStartHandler(bot, options.users, options.miniAppUrl);
  registerHelpHandler(bot, options.users, options.miniAppUrl);
  registerTextHandler(bot);

  bot.catch((error) => {
    logger.processingFailure(error.ctx.update.update_id, error.error);
  });

  return bot;
}
