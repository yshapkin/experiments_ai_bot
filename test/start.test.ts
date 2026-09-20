import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createBotHarness,
  privateTextUpdate,
} from "./helpers/telegram.js";

describe("/start", () => {
  it("sends one welcome message with the Help button", async () => {
    const { bot, calls } = createBotHarness();

    await bot.handleUpdate(privateTextUpdate("/start"));

    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.method, "sendMessage");
    assert.match(String(calls[0]?.payload.text), /welcome/i);
    assert.match(String(calls[0]?.payload.text), /send.*text/i);
    assert.deepEqual(
      JSON.parse(JSON.stringify(calls[0]?.payload.reply_markup)),
      {
        inline_keyboard: [[{ text: "Help", callback_data: "help" }]],
      },
    );
  });
});
