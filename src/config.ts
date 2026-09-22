export interface Config {
  telegramBotToken: string;
}

export interface WebhookConfig extends Config {
  telegramWebhookSecret: string;
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

export function loadWebhookConfig(
  environment: NodeJS.ProcessEnv = process.env,
): WebhookConfig {
  const { telegramBotToken } = loadConfig(environment);
  const telegramWebhookSecret = environment.TELEGRAM_WEBHOOK_SECRET?.trim();

  if (!telegramWebhookSecret) {
    throw new Error(
      "TELEGRAM_WEBHOOK_SECRET must be set to a non-blank value",
    );
  }

  return {
    telegramBotToken,
    telegramWebhookSecret,
  };
}
