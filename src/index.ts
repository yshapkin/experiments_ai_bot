import "./telemetry.js";

import { createBot } from "./bot.js";
import { loadRuntimeConfig } from "./config.js";
import { createLogger } from "./logger.js";
import { connectUserRepository } from "./users/repository.js";

const config = loadRuntimeConfig();
const logger = createLogger();
const bot = createBot(config.telegramBotToken, { logger,
  users: connectUserRepository(config.tableEndpoint, config.managedIdentityClientId),
  miniAppUrl: config.miniAppUrl });

await bot.start({
  onStart: () => logger.info("bot_started"),
});
