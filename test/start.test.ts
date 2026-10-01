import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createBotHarness,
  privateTextUpdate,
} from "./helpers/telegram.js";

describe("/start", () => {
  it("registers pending users once and reflects manual activation on repeat", async () => {
    const harness = createBotHarness();
    const { bot, calls } = harness;

    await bot.handleUpdate(privateTextUpdate("/start"));
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.method, "sendMessage");
    assert.match(String(calls[0]?.payload.text), /pending/i);
    assert.equal(calls[0]?.payload.reply_markup, undefined);
    assert.equal(harness.row?.rowKey, "100");
    assert.equal(harness.row?.isAdmin, false);
    harness.row!.isActive = true;
    await bot.handleUpdate(privateTextUpdate("/start", 2));
    assert.equal(harness.registrations, 2);
    assert.equal(harness.row?.createdAt, "2026-01-01T00:00:00.000Z");
    assert.match(String(calls[1]?.payload.text), /active/i);
    assert.deepEqual(
      JSON.parse(JSON.stringify(calls[1]?.payload.reply_markup)),
      {
        inline_keyboard: [[{ text: "Open Mini App", web_app: { url: "https://example.test/mini-app" } }]],
      },
    );
  });

  it("fails closed on a repository error", async () => {
    const harness = createBotHarness();
    harness.fail = true;
    await harness.bot.handleUpdate(privateTextUpdate("/start"));
    assert.match(String(harness.calls[0]?.payload.text), /unavailable/i);
    assert.equal(harness.calls[0]?.payload.reply_markup, undefined);
  });
});
