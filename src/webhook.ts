import { timingSafeEqual } from "node:crypto";

import type { HttpRequest, HttpResponseInit } from "@azure/functions";
import { webhookCallback } from "grammy";

import { createBot } from "./bot.js";
import { loadWebhookConfig } from "./config.js";
import {
  createLogger,
  type Logger,
  type WebhookRejectionReason,
} from "./logger.js";

export const TELEGRAM_WEBHOOK_ROUTE = "telegram/webhook";

const TELEGRAM_SECRET_HEADER = "x-telegram-bot-api-secret-token";
const JSON_CONTENT_TYPE = "application/json";
const DEFAULT_MAX_REQUEST_BODY_BYTES = 256 * 1024;

const logger = createLogger();
const config = loadWebhookConfig();
const bot = createBot(config.telegramBotToken, { logger });
const handleWebhook = webhookCallback(bot, "azure-v4");

logger.info("webhook_runtime_ready");

export async function handleTelegramWebhook(
  request: HttpRequest,
  runtimeLogger: Logger = logger,
): Promise<HttpResponseInit> {
  try {
    const rejection = await validateTelegramWebhookRequest(
      request,
      config.telegramWebhookSecret,
    );

    if (rejection !== undefined) {
      runtimeLogger.webhookRejected(rejection.reason, rejection.status);
      return { status: rejection.status };
    }

    return await handleWebhook(request);
  } catch (error) {
    if (error instanceof SyntaxError) {
      runtimeLogger.webhookRejected("request_body_invalid", 400);
      return { status: 400 };
    }

    runtimeLogger.webhookFailure(error);
    return { status: 500 };
  }
}

interface WebhookRejection {
  reason: WebhookRejectionReason;
  status: number;
}

async function validateTelegramWebhookRequest(
  request: HttpRequest,
  expectedSecret: string,
  maxBodyBytes = DEFAULT_MAX_REQUEST_BODY_BYTES,
): Promise<WebhookRejection | undefined> {
  if (!hasExpectedSecretToken(request, expectedSecret)) {
    return { reason: "secret_token_invalid", status: 401 };
  }

  const contentType = request.headers.get("content-type");
  if (
    contentType === null ||
    contentType.split(";", 1)[0]?.trim().toLowerCase() !== JSON_CONTENT_TYPE
  ) {
    return { reason: "content_type_invalid", status: 415 };
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const parsedContentLength = Number.parseInt(contentLength, 10);

    if (
      !Number.isSafeInteger(parsedContentLength) ||
      parsedContentLength < 0 ||
      parsedContentLength.toString() !== contentLength
    ) {
      return { reason: "content_length_invalid", status: 400 };
    }

    if (parsedContentLength > maxBodyBytes) {
      return { reason: "request_body_too_large", status: 413 };
    }

    return undefined;
  }

  const bufferedBody = await request.clone().arrayBuffer();
  if (bufferedBody.byteLength > maxBodyBytes) {
    return { reason: "request_body_too_large", status: 413 };
  }

  return undefined;
}

function hasExpectedSecretToken(
  request: HttpRequest,
  expectedSecret: string,
): boolean {
  const receivedSecret = request.headers.get(TELEGRAM_SECRET_HEADER);
  if (receivedSecret === null) {
    return false;
  }

  const expected = Buffer.from(expectedSecret);
  const received = Buffer.from(receivedSecret);

  if (expected.length !== received.length) {
    return false;
  }

  return timingSafeEqual(expected, received);
}
