import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createUserRepository } from "../src/users/repository.js";

describe("Table user repository (offline)", () => {
  it("creates an inactive row exactly once and preserves manually edited flags on conflicts", async () => {
    let row: Record<string, unknown> | undefined;
    let creates = 0;
    const users = createUserRepository({
      async createEntity(value) {
        creates++;
        if (row) throw { statusCode: 409 };
        row = { ...value };
        return {} as never;
      },
      async getEntity() {
        if (!row) throw { statusCode: 404 };
        return { ...row } as never;
      },
    });
    const initial = await users.register(100);
    assert.deepEqual(initial, {
      partitionKey: "user", rowKey: "100", telegramUserId: "100",
      createdAt: initial?.createdAt, isActive: false, isAdmin: false,
    });
    assert.ok(!Number.isNaN(Date.parse(initial!.createdAt)));
    row!.isActive = true;
    row!.isAdmin = true;
    const again = await users.register(100);
    assert.equal(creates, 2);
    assert.equal(again?.createdAt, initial?.createdAt);
    assert.equal(again?.isActive, true);
    assert.equal(again?.isAdmin, true);
    row!.isActive = false;
    assert.equal((await users.find(100))?.isActive, false);
  });

  it("fails closed for missing and malformed rows and propagates failures other than 409/404", async () => {
    let row: Record<string, unknown> = {
      partitionKey: "user", rowKey: "100", telegramUserId: "100",
      createdAt: "2026-01-01T00:00:00Z", isActive: "true", isAdmin: false,
    };
    const users = createUserRepository({
      async createEntity() { throw { statusCode: 409 }; },
      async getEntity() { return row as never; },
    });
    assert.equal(await users.find(100), null);
    row = { ...row, isActive: true, isAdmin: false, telegramUserId: "999" };
    assert.equal(await users.register(100), null);
    row = { ...row, rowKey: "999", telegramUserId: "999" };
    assert.equal(await users.find(100), null);
    const failing = createUserRepository({
      async createEntity() { throw { statusCode: 503 }; },
      async getEntity() { throw { statusCode: 503 }; },
    });
    await assert.rejects(failing.register(100), { statusCode: 503 });
    await assert.rejects(failing.find(100), { statusCode: 503 });
    assert.equal(await failing.find(0), null);
  });

  it("handles concurrent registrations through a 409 read-back without resetting the row", async () => {
    let stored: Record<string, unknown> | undefined;
    let creates = 0;
    const users = createUserRepository({
      async createEntity(entity) {
        creates++;
        await Promise.resolve();
        if (stored) throw { statusCode: 409 };
        stored = { ...entity };
        return {} as never;
      },
      async getEntity(partitionKey, rowKey) {
        assert.equal(partitionKey, "user");
        if (rowKey !== "100" || !stored) throw { statusCode: 404 };
        return { ...stored } as never;
      },
    });
    const [first, second] = await Promise.all([users.register(100), users.register(100)]);
    assert.equal(creates, 2);
    assert.deepEqual(second, first);
    assert.equal(first?.isActive, false);
    assert.equal(first?.isAdmin, false);
    assert.equal(await users.find(999), null);
  });

  it("rejects malformed status, keys, dates and IDs rather than authorizing a row", async () => {
    const good = {
      partitionKey: "user", rowKey: "100", telegramUserId: "100",
      createdAt: "2026-01-01T00:00:00.000Z", isActive: true, isAdmin: false,
    };
    let row: Record<string, unknown> = good;
    const users = createUserRepository({
      async createEntity() { throw { statusCode: 409 }; },
      async getEntity() { return row as never; },
    });
    for (const change of [
      { partitionKey: "other" }, { rowKey: "101" }, { telegramUserId: "101" },
      { createdAt: "not-a-date" }, { isActive: 1 }, { isAdmin: "false" },
    ]) {
      row = { ...good, ...change };
      assert.equal(await users.find(100), null);
    }
    for (const id of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, NaN]) {
      assert.equal(await users.register(id), null);
      assert.equal(await users.find(id), null);
    }
  });
});
