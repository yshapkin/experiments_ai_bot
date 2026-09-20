import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createLogger } from "../src/logger.js";

describe("logger", () => {
  it("logs startup with controlled metadata", () => {
    const lines: string[] = [];
    const logger = createLogger({
      log: (line) => lines.push(line),
      error: (line) => lines.push(line),
    });

    logger.info("bot_started");

    assert.deepEqual(JSON.parse(lines[0] ?? ""), {
      level: "info",
      event: "bot_started",
    });
  });

  it("does not disclose credentials, message text, or error messages", () => {
    const lines: string[] = [];
    const logger = createLogger({
      log: (line) => lines.push(line),
      error: (line) => lines.push(line),
    });
    const token = "secret-token-value";
    const messageText = "private message body";

    logger.processingFailure(
      42,
      new TypeError(`${token}: failed while processing ${messageText}`),
    );

    const output = lines.join("\n");
    assert.equal(output.includes(token), false);
    assert.equal(output.includes(messageText), false);
    assert.deepEqual(JSON.parse(output), {
      level: "error",
      event: "update_processing_failed",
      updateId: 42,
      errorType: "TypeError",
    });
  });
});
