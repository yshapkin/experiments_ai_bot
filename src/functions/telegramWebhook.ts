import "../telemetry.js";

import { app, type HttpRequest, type HttpResponseInit } from "@azure/functions";

import { handleTelegramWebhook, TELEGRAM_WEBHOOK_ROUTE } from "../webhook.js";

async function telegramWebhook(request: HttpRequest): Promise<HttpResponseInit> {
  return handleTelegramWebhook(request);
}

app.http("telegramWebhook", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: TELEGRAM_WEBHOOK_ROUTE,
  handler: telegramWebhook,
});
