import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { verifyInitData } from "../src/telegram-init-data.js";
import { signedData, testToken, testNow } from "./helpers/signed-init-data.js";

describe("signed Telegram launch verification", () => {
  it("accepts a fresh signed user and rejects modified, expired, future and malformed data", () => {
    const valid = signedData();
    assert.deepEqual(verifyInitData(valid, testToken, testNow),
      { id: 100, username: "@valid_name", photoUrl: null });
    assert.equal(verifyInitData(valid, "wrong", testNow), null);
    assert.equal(verifyInitData(valid.replace("valid_name", "other_name"), testToken, testNow), null);
    assert.equal(verifyInitData(valid, testToken, testNow + 600_001), null);
    assert.equal(verifyInitData(valid, testToken, testNow - 60_001), null);
    assert.equal(verifyInitData(`${valid}&user=%7B%7D`, testToken, testNow), null);
    assert.equal(verifyInitData(`${valid}&auth_date=1`, testToken, testNow), null);
    assert.equal(verifyInitData(`${valid}&broken=%GG`, testToken, testNow), null);
    assert.equal(verifyInitData(signedData({ user: JSON.stringify({ id: "100" }) }), testToken, testNow), null);
    assert.equal(verifyInitData(signedData({ user: "{broken" }), testToken, testNow), null);
  });

  it("honors freshness boundaries and rejects invalid signed identities", () => {
    const valid = signedData();
    assert.equal(verifyInitData(valid, testToken, testNow + 600_000)?.id, 100);
    assert.equal(verifyInitData(valid, testToken, testNow - 60_000)?.id, 100);
    for (const user of [
      { id: 0 }, { id: -1 }, { id: "100" }, { id: 1.5 },
      { id: Number.MAX_SAFE_INTEGER + 1 },
    ]) {
      assert.equal(verifyInitData(signedData({ user: JSON.stringify(user) }), testToken, testNow), null);
    }
    assert.equal(verifyInitData(`auth_date=1&hash=${"0".repeat(64)}&hash=${"1".repeat(64)}`, testToken, testNow), null);
    assert.equal(verifyInitData(valid.repeat(900), testToken, testNow), null);
  });
});
