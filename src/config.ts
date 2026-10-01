export interface Config {
  telegramBotToken: string;
}

export interface WebhookConfig extends Config {
  telegramWebhookSecret: string;
}

export interface RuntimeConfig extends Config {
  tableEndpoint: string;
  managedIdentityClientId?: string;
  miniAppUrl: string;
  miniAppOrigin: string;
}

export function loadRuntimeConfig(environment: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const { telegramBotToken } = loadConfig(environment);
  const tableEndpoint = environment.USER_TABLE_ENDPOINT?.trim();
  const miniAppUrl = environment.MINI_APP_URL?.trim();
  const managedIdentityClientId = environment.AZURE_CLIENT_ID?.trim() || undefined;
  if (!tableEndpoint || !miniAppUrl) throw new Error("USER_TABLE_ENDPOINT and MINI_APP_URL are required");
  const table = new URL(tableEndpoint);
  const app = new URL(miniAppUrl);
  if (table.protocol !== "https:" || app.protocol !== "https:" ||
      table.username || table.password || app.username || app.password ||
      app.hash || app.search) throw new Error("Invalid Table endpoint or Mini App URL");
  return { telegramBotToken, tableEndpoint: table.origin,
    ...(managedIdentityClientId ? { managedIdentityClientId } : {}),
    miniAppUrl: app.href, miniAppOrigin: app.origin };
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
