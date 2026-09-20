import { createBot } from "./bot.js";
import { loadConfig } from "./config.js";
import { createLogger } from "./logger.js";

const config = loadConfig();
const logger = createLogger();
const bot = createBot(config.telegramBotToken, { logger });

await bot.start({
  onStart: () => logger.info("bot_started"),
});
