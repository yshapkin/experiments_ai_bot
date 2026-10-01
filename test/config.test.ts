import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { loadConfig, loadWebhookConfig, loadRuntimeConfig } from "../src/config.js";

describe("loadRuntimeConfig", () => {
  it("loads isolated runtime endpoint, origin and identity", () => {
    assert.deepEqual(loadRuntimeConfig({
      TELEGRAM_BOT_TOKEN: "test-token",
      USER_TABLE_ENDPOINT: "https://offline.table.core.windows.net/",
      MINI_APP_URL: "https://mini.example.test/app",
      AZURE_CLIENT_ID: "test-client",
    }), {
      telegramBotToken: "test-token",
      tableEndpoint: "https://offline.table.core.windows.net",
      miniAppUrl: "https://mini.example.test/app",
      miniAppOrigin: "https://mini.example.test",
      managedIdentityClientId: "test-client",
    });
  });
  it("rejects missing runtime values and non-HTTPS endpoint", () => {
    assert.throws(() => loadRuntimeConfig({ TELEGRAM_BOT_TOKEN: "token" }), /required/);
    assert.throws(() => loadRuntimeConfig({
      TELEGRAM_BOT_TOKEN: "token", USER_TABLE_ENDPOINT: "http://offline.test",
      MINI_APP_URL: "https://mini.example.test",
    }), /Invalid Table endpoint/);
  });
});

describe("loadConfig", () => {
  it("loads a configured token", () => {
    assert.deepEqual(loadConfig({ TELEGRAM_BOT_TOKEN: " test-token " }), {
      telegramBotToken: "test-token",
    });
  });

  it("rejects missing and blank tokens without disclosing a value", () => {
    for (const value of [undefined, "", "   "]) {
      assert.throws(
        () =>
          loadConfig(
            value === undefined ? {} : { TELEGRAM_BOT_TOKEN: value },
          ),
        {
          message: "TELEGRAM_BOT_TOKEN must be set to a non-blank value",
        },
      );
    }
  });
});

describe("loadWebhookConfig", () => {
  it("loads a configured token and webhook secret", () => {
    assert.deepEqual(
      loadWebhookConfig({
        TELEGRAM_BOT_TOKEN: " test-token ",
        TELEGRAM_WEBHOOK_SECRET: " webhook-secret ",
      }),
      {
        telegramBotToken: "test-token",
        telegramWebhookSecret: "webhook-secret",
      },
    );
  });

  it("rejects missing and blank webhook secrets without disclosing a value", () => {
    for (const value of [undefined, "", "   "]) {
      assert.throws(
        () =>
          loadWebhookConfig(
            value === undefined
              ? { TELEGRAM_BOT_TOKEN: "test-token" }
              : {
                  TELEGRAM_BOT_TOKEN: "test-token",
                  TELEGRAM_WEBHOOK_SECRET: value,
                },
          ),
        {
          message: "TELEGRAM_WEBHOOK_SECRET must be set to a non-blank value",
        },
      );
    }
  });
});
