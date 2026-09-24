import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createLogger } from "../src/logger.js";

describe("createLogger", () => {
  it("logs secret rejection diagnostics without secret values", () => {
    const lines: string[] = [];
    const logger = createLogger({
      log: (line) => {
        lines.push(line);
      },
      error: () => undefined,
    });

    logger.webhookRejected("secret_token_invalid", 401, {
      expectedSecretByteLength: 32,
      expectedSecretIsKeyVaultReference: false,
      receivedSecretByteLength: 16,
      secretHeaderPresent: true,
    });

    assert.deepEqual(lines.map((line) => JSON.parse(line)), [
      {
        level: "info",
        event: "webhook_request_rejected",
        reason: "secret_token_invalid",
        status: 401,
        diagnostics: {
          expectedSecretByteLength: 32,
          expectedSecretIsKeyVaultReference: false,
          receivedSecretByteLength: 16,
          secretHeaderPresent: true,
        },
      },
    ]);
  });
});
