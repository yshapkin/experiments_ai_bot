import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { loadConfig } from "../src/config.js";

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
