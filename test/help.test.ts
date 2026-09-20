import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createBotHarness,
  helpCallbackUpdate,
} from "./helpers/telegram.js";

describe("Help callback", () => {
  it("acknowledges the callback before explaining echo behavior", async () => {
    const { bot, calls } = createBotHarness();

    await bot.handleUpdate(helpCallbackUpdate());

    assert.deepEqual(
      calls.map(({ method }) => method),
      ["answerCallbackQuery", "sendMessage"],
    );
    assert.equal(calls[0]?.payload.callback_query_id, "callback-2");
    assert.equal(calls[1]?.payload.chat_id, 200);
    assert.match(String(calls[1]?.payload.text), /plain-text/i);
    assert.match(String(calls[1]?.payload.text), /echo/i);
  });

  it("ignores unrelated callbacks", async () => {
    const { bot, calls } = createBotHarness();

    await bot.handleUpdate(helpCallbackUpdate("other"));

    assert.deepEqual(calls, []);
  });
});
