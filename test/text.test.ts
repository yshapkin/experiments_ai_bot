import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  channelTextUpdate,
  createBotHarness,
  editedPrivateTextUpdate,
  groupTextUpdate,
  privatePhotoUpdate,
  privateTextUpdate,
} from "./helpers/telegram.js";

describe("text handler", () => {
  it("echoes private plain text unchanged", async () => {
    const { bot, calls } = createBotHarness();

    await bot.handleUpdate(privateTextUpdate("Hello"));

    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.method, "sendMessage");
    assert.equal(calls[0]?.payload.chat_id, 200);
    assert.equal(calls[0]?.payload.text, "Hello");
  });

  it("does not echo start or unsupported commands", async () => {
    const startHarness = createBotHarness();
    await startHarness.bot.handleUpdate(privateTextUpdate("/start"));
    assert.equal(startHarness.calls.length, 1);

    const unknownHarness = createBotHarness();
    await unknownHarness.bot.handleUpdate(privateTextUpdate("/unknown"));
    assert.deepEqual(unknownHarness.calls, []);
  });

  it("ignores groups, channels, media, and edited messages", async () => {
    const { bot, calls } = createBotHarness();

    await bot.handleUpdate(groupTextUpdate("group text"));
    await bot.handleUpdate(groupTextUpdate("/start"));
    await bot.handleUpdate(channelTextUpdate("channel text"));
    await bot.handleUpdate(privatePhotoUpdate());
    await bot.handleUpdate(editedPrivateTextUpdate("edited text"));

    assert.deepEqual(calls, []);
  });
});
