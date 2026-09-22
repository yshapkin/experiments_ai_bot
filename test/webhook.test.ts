import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { after, beforeEach, describe, it, mock } from "node:test";

import { app } from "@azure/functions";

import type { Logger } from "../src/logger.js";
import { privateTextUpdate } from "./helpers/telegram.js";

const originalBotToken = process.env.TELEGRAM_BOT_TOKEN;
const originalWebhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
const webhookSecret = "test-webhook-secret";
const require = createRequire(import.meta.url);
const nodeFetch = require("node-fetch") as { default: typeof fetch };
const originalNodeFetch = nodeFetch.default;

process.env.TELEGRAM_BOT_TOKEN = "123456:test-only-token";
process.env.TELEGRAM_WEBHOOK_SECRET = webhookSecret;

let webhookModuleNonce = 0;

const noopLogger: Logger = {
  info: () => undefined,
  processingFailure: () => undefined,
  webhookRejected: () => undefined,
  webhookFailure: () => undefined,
};

after(() => {
  if (originalBotToken === undefined) {
    delete process.env.TELEGRAM_BOT_TOKEN;
  } else {
    process.env.TELEGRAM_BOT_TOKEN = originalBotToken;
  }

  if (originalWebhookSecret === undefined) {
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
  } else {
    process.env.TELEGRAM_WEBHOOK_SECRET = originalWebhookSecret;
  }
});

beforeEach(() => {
  mock.restoreAll();
  nodeFetch.default = originalNodeFetch;
});

async function loadWebhookHandler() {
  const module = await import(`../src/webhook.js?test=${webhookModuleNonce++}`);
  return module.handleTelegramWebhook;
}

async function registerWebhookFunctionModule() {
  await import(`../src/functions/telegramWebhook.js?test=${webhookModuleNonce++}`);
}

function installTelegramApiStub(fetchCalls: Array<{ url: string; body: string }>) {
  nodeFetch.default = async (input, init) => {
    const url = String(input);
    const body = String(init?.body ?? "");
    fetchCalls.push({ url, body });

    if (url.endsWith("/getMe")) {
      return {
        json: async () => ({
          ok: true,
          result: {
            id: 300,
            is_bot: true,
            first_name: "Echo Bot",
            username: "echo_test_bot",
            can_join_groups: false,
            can_read_all_group_messages: false,
            supports_inline_queries: false,
            can_connect_to_business: false,
            has_main_web_app: false,
            has_topics_enabled: false,
            allows_users_to_create_topics: false,
            can_manage_bots: false,
            supports_join_request_queries: false,
          },
        }),
      } as never;
    }

    return {
      json: async () => ({
        ok: true,
        result: {
          message_id: 900,
          date: 1_700_000_000,
          chat: { id: 200, type: "private", first_name: "Test" },
          text: JSON.parse(body).text,
        },
      }),
    } as never;
  };
}

describe("handleTelegramWebhook", () => {
  it("registers the Azure Function as POST-only and forwards to the webhook handler", async () => {
    const registrations: Array<{
      name: string;
      options: {
        methods: string[];
        authLevel: string;
        route: string;
        handler: (request: unknown) => Promise<unknown>;
      };
    }> = [];

    mock.method(
      app,
      "http",
      (
        name: string,
        options: {
          methods: string[];
          authLevel: string;
          route: string;
          handler: (request: unknown) => Promise<unknown>;
        },
      ) => {
      registrations.push({
        name,
        options: options as never,
      });
      },
    );

    await registerWebhookFunctionModule();

    assert.equal(registrations.length, 1);
    assert.equal(registrations[0]?.name, "telegramWebhook");
    assert.deepEqual(registrations[0]?.options.methods, ["POST"]);
    assert.equal(registrations[0]?.options.authLevel, "anonymous");
    assert.equal(registrations[0]?.options.route, "telegram/webhook");
    assert.deepEqual(
      await registrations[0]?.options.handler({ headers: new Headers() }),
      { status: 401 },
    );
  });

  it("processes a valid Telegram update with the actual bot handler", async () => {
    const fetchCalls: Array<{ url: string; body: string }> = [];
    installTelegramApiStub(fetchCalls);

    const handleTelegramWebhook = await loadWebhookHandler();
    const update = privateTextUpdate("echo this");
    const response = await handleTelegramWebhook(
      {
        headers: {
          get(name: string) {
            return (
              new Headers({
                "content-type": "application/json",
                "content-length": "1",
                "x-telegram-bot-api-secret-token": webhookSecret,
              }).get(name) ?? null
            );
          },
        },
        json: async () => update,
      } as never,
      noopLogger,
    );

    assert.deepEqual(response, { status: 204 });
    assert.equal(fetchCalls.length, 2);
    assert.match(
      fetchCalls[0]?.url ?? "",
      /https:\/\/api\.telegram\.org\/bot123456:test-only-token\/getMe$/,
    );
    assert.match(
      fetchCalls[1]?.url ?? "",
      /https:\/\/api\.telegram\.org\/bot123456:test-only-token\/sendMessage$/,
    );
    assert.equal(JSON.parse(fetchCalls[1]?.body ?? "{}").text, "echo this");
  });

  it("rejects a missing secret token before reading the request body", async () => {
    const handleTelegramWebhook = await loadWebhookHandler();
    let jsonCalls = 0;
    let cloneCalls = 0;

    const response = await handleTelegramWebhook(
      {
        headers: new Headers(),
        json: async () => {
          jsonCalls += 1;
          return {};
        },
        clone: () => {
          cloneCalls += 1;
          return {
            arrayBuffer: async () => new Uint8Array().buffer,
          };
        },
      } as never,
      noopLogger,
    );

    assert.deepEqual(response, { status: 401 });
    assert.equal(jsonCalls, 0);
    assert.equal(cloneCalls, 0);
  });

  it("rejects a wrong secret token before reading the request body", async () => {
    const handleTelegramWebhook = await loadWebhookHandler();
    let jsonCalls = 0;
    let cloneCalls = 0;

    const response = await handleTelegramWebhook(
      {
        headers: new Headers({
          "x-telegram-bot-api-secret-token": "wrong-secret-token",
          "content-type": "application/json",
        }),
        json: async () => {
          jsonCalls += 1;
          return {};
        },
        clone: () => {
          cloneCalls += 1;
          return {
            arrayBuffer: async () => new Uint8Array().buffer,
          };
        },
      } as never,
      noopLogger,
    );

    assert.deepEqual(response, { status: 401 });
    assert.equal(jsonCalls, 0);
    assert.equal(cloneCalls, 0);
  });

  it("rejects an unsupported content type", async () => {
    const handleTelegramWebhook = await loadWebhookHandler();
    const response = await handleTelegramWebhook(
      {
        headers: new Headers({
          "x-telegram-bot-api-secret-token": webhookSecret,
          "content-type": "text/plain",
        }),
        json: async () => {
          throw new Error("request.json should not be called");
        },
        clone: () => {
          throw new Error("request.clone should not be called");
        },
      } as never,
      noopLogger,
    );

    assert.deepEqual(response, { status: 415 });
  });

  it("rejects malformed content-length values", async () => {
    const handleTelegramWebhook = await loadWebhookHandler();
    const response = await handleTelegramWebhook(
      {
        headers: new Headers({
          "x-telegram-bot-api-secret-token": webhookSecret,
          "content-type": "application/json",
          "content-length": "01",
        }),
        json: async () => {
          throw new Error("request.json should not be called");
        },
        clone: () => {
          throw new Error("request.clone should not be called");
        },
      } as never,
      noopLogger,
    );

    assert.deepEqual(response, { status: 400 });
  });

  it("rejects oversized requests from content-length without parsing JSON", async () => {
    const handleTelegramWebhook = await loadWebhookHandler();
    const response = await handleTelegramWebhook(
      {
        headers: new Headers({
          "x-telegram-bot-api-secret-token": webhookSecret,
          "content-type": "application/json",
          "content-length": String(256 * 1024 + 1),
        }),
        json: async () => {
          throw new Error("request.json should not be called");
        },
        clone: () => {
          throw new Error("request.clone should not be called");
        },
      } as never,
      noopLogger,
    );

    assert.deepEqual(response, { status: 413 });
  });

  it("rejects oversized requests without content-length after measuring the body", async () => {
    const handleTelegramWebhook = await loadWebhookHandler();
    let jsonCalls = 0;
    let cloneCalls = 0;

    const response = await handleTelegramWebhook(
      {
        headers: new Headers({
          "x-telegram-bot-api-secret-token": webhookSecret,
          "content-type": "application/json",
        }),
        json: async () => {
          jsonCalls += 1;
          return {};
        },
        clone: () => {
          cloneCalls += 1;
          return {
            arrayBuffer: async () => new Uint8Array(256 * 1024 + 1).buffer,
          };
        },
      } as never,
      noopLogger,
    );

    assert.deepEqual(response, { status: 413 });
    assert.equal(cloneCalls, 1);
    assert.equal(jsonCalls, 0);
  });

  it("returns 400 for malformed JSON payloads", async () => {
    const fetchCalls: Array<{ url: string; body: string }> = [];
    installTelegramApiStub(fetchCalls);
    const handleTelegramWebhook = await loadWebhookHandler();
    const response = await handleTelegramWebhook(
      {
        headers: {
          get(name: string) {
            return (
              new Headers({
                "content-type": "application/json",
                "content-length": "1",
                "x-telegram-bot-api-secret-token": webhookSecret,
              }).get(name) ?? null
            );
          },
        },
        json: async () => {
          throw new SyntaxError("Unexpected end of JSON input");
        },
      } as never,
      noopLogger,
    );

    assert.deepEqual(response, { status: 400 });
    assert.equal(fetchCalls.length, 1);
    assert.match(
      fetchCalls[0]?.url ?? "",
      /https:\/\/api\.telegram\.org\/bot123456:test-only-token\/getMe$/,
    );
  });

  it("returns 500 when webhook processing throws a non-SyntaxError", async () => {
    const fetchCalls: Array<{ url: string; body: string }> = [];
    installTelegramApiStub(fetchCalls);
    const handleTelegramWebhook = await loadWebhookHandler();
    const response = await handleTelegramWebhook(
      {
        headers: new Headers({
          "x-telegram-bot-api-secret-token": webhookSecret,
          "content-type": "application/json",
          "content-length": "2",
        }),
        json: async () => {
          throw new TypeError("boom");
        },
      } as never,
      noopLogger,
    );

    assert.deepEqual(response, { status: 500 });
    assert.equal(fetchCalls.length, 1);
    assert.match(
      fetchCalls[0]?.url ?? "",
      /https:\/\/api\.telegram\.org\/bot123456:test-only-token\/getMe$/,
    );
  });
});
