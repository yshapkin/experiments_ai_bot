import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createBotHarness,
  helpCallbackUpdate,
  privateTextUpdate,
} from "./helpers/telegram.js";

describe("Help callback", () => {
  it("acknowledges, clears stale keyboard and prompts unregistered users", async () => {
    const { bot, calls } = createBotHarness();

    await bot.handleUpdate(helpCallbackUpdate());

    assert.deepEqual(
      calls.map(({ method }) => method),
      ["answerCallbackQuery", "editMessageReplyMarkup", "sendMessage"],
    );
    assert.equal(calls[0]?.payload.callback_query_id, "callback-2");
    assert.equal(calls[2]?.payload.chat_id, 200);
    assert.match(String(calls[2]?.payload.text), /start/i);
    assert.equal(calls[2]?.payload.reply_markup, undefined);
  });

  it("reflects current active status and fails closed after a read error", async () => {
    const harness = createBotHarness();
    await harness.bot.handleUpdate(privateTextUpdate("/start"));
    harness.row!.isActive = true;
    await harness.bot.handleUpdate(helpCallbackUpdate("help", 3));
    assert.match(String(harness.calls.at(-1)?.payload.text), /active/i);
    assert.ok(harness.calls.at(-1)?.payload.reply_markup);
    harness.fail = true;
    await harness.bot.handleUpdate(helpCallbackUpdate("help", 4));
    assert.match(String(harness.calls.at(-1)?.payload.text), /unavailable/i);
    assert.equal(harness.calls.at(-1)?.payload.reply_markup, undefined);
  });

  it("ignores unrelated callbacks", async () => {
    const { bot, calls } = createBotHarness();

    await bot.handleUpdate(helpCallbackUpdate("other"));

    assert.deepEqual(calls, []);
  });
});
