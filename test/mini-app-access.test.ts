import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { handleMiniAppAccess } from "../src/mini-app-access.js";
import type { UserRepository, UserRow } from "../src/users/repository.js";
import { signedData, testToken, testNow } from "./helpers/signed-init-data.js";

describe("Mini App access endpoint (offline)", () => {
  it("enforces signed identity and current active row for every request", async () => {
    const clock = mock.method(Date, "now", () => testNow);
    try {
      let active = false;
      let reads = 0;
      let missing = false;
      let failure = false;
      const users: UserRepository = {
        async register() { throw new Error("unexpected register"); },
        async find(id) {
          reads++;
          assert.equal(id, 100);
          if (failure) throw new Error("fake table unavailable");
          if (missing) return null;
          return { partitionKey: "user", rowKey: "100", telegramUserId: "100",
            createdAt: "2026-01-01T00:00:00Z", isActive: active, isAdmin: false } satisfies UserRow;
        },
      };
      const options = { token: testToken, origin: "https://mini.example.test", users };
      const request = (data: string, origin = options.origin) => ({
        method: "POST", headers: new Headers({ origin, "content-type": "application/json" }),
        text: async () => JSON.stringify({ initData: data }),
      }) as never;
      const access = (data = signedData()) => handleMiniAppAccess(request(data), options);
      assert.deepEqual((await access()).jsonBody, { status: "pending" });
      active = true;
      assert.deepEqual((await access()).jsonBody, { status: "allowed",
        user: { id: 100, username: "@valid_name", photo_url: null } });
      active = false;
      assert.deepEqual((await access()).jsonBody, { status: "pending" });
      assert.equal(reads, 3);
      missing = true;
      assert.deepEqual((await access()).jsonBody, { status: "unregistered" });
      failure = true;
      assert.deepEqual((await access()).jsonBody, { status: "unavailable" });
      assert.deepEqual((await access("fake")).jsonBody, { status: "invalid" });
      assert.equal(reads, 5);
      assert.equal((await handleMiniAppAccess(request(signedData(), "https://other.test"), options)).status, 403);
      assert.equal((await handleMiniAppAccess({ method: "OPTIONS",
        headers: new Headers({ origin: options.origin }) } as never, options)).status, 204);
      assert.equal((await handleMiniAppAccess({ method: "POST",
        headers: new Headers({ origin: options.origin, "content-type": "text/plain" }) } as never, options)).status, 400);
    } finally {
      clock.mock.restore();
    }
  });

  it("rejects oversized, malformed and non-POST requests before a Table lookup", async () => {
    let reads = 0;
    const users: UserRepository = {
      async register() { throw new Error("unexpected register"); },
      async find() { reads++; return null; },
    };
    const options = { token: testToken, origin: "https://mini.example.test", users };
    const request = (body: string, headers: Record<string, string> = {}, method = "POST") => ({
      method, headers: new Headers({ origin: options.origin, "content-type": "application/json", ...headers }),
      text: async () => body,
    }) as never;
    for (const body of ["{", "[]", "null", "{}", '{"initData":1}',
      '{"initData":"a","id":100}', JSON.stringify({ initData: "x".repeat(10_001) })]) {
      const result = await handleMiniAppAccess(request(body), options);
      assert.notEqual(result.jsonBody && (result.jsonBody as { status: string }).status, "allowed");
    }
    for (const req of [
      request("{}", { "content-length": "10001" }),
      request("{}", { "content-length": "-1" }),
      request("{}", {}, "GET"),
      request("{}", { origin: "https://other.test" }, "OPTIONS"),
    ]) {
      assert.notEqual((await handleMiniAppAccess(req, options)).status, 200);
    }
    assert.equal(reads, 0);
  });
});
