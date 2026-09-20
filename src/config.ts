export interface Config {
  telegramBotToken: string;
}

export function loadConfig(
  environment: NodeJS.ProcessEnv = process.env,
): Config {
  const token = environment.TELEGRAM_BOT_TOKEN?.trim();

  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN must be set to a non-blank value");
  }

  return { telegramBotToken: token };
}
