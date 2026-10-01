import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { initializeMiniApp } from "../src/mini-app/app.js";
import { copy } from "../src/mini-app/copy.js";
import { normalizeUserInfo } from "../src/mini-app/user-info.js";
import { FakeMiniAppView } from "./helpers/fake-mini-app-view.js";

const en = copy.en;
const config = { functionBaseUrl: "https://functions.example.test/" };

async function launch(
  status: string | null,
  user: unknown = { id: 42, username: "  sample_user  ", photo_url: "https://cdn.t.me/avatar.png" },
  bridge: unknown = { initData: "signed-fixture", initDataUnsafe: { user: { id: 666 } } },
  configValue: unknown = config,
): Promise<{ view: FakeMiniAppView; calls: Array<[string, RequestInit | undefined]> }> {
  const view = new FakeMiniAppView();
  const calls: Array<[string, RequestInit | undefined]> = [];
  const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push([String(input), init]);
    if (calls.length === 1) return { ok: true, json: async () => configValue };
    return { ok: true, json: async () => ({ status, user }) };
  }) as typeof fetch;
  await initializeMiniApp(bridge, view, fetcher);
  return { view, calls };
}

describe("Mini App signed access states", () => {
  it("renders only the server-approved profile using catalog strings", async () => {
    const { view, calls } = await launch("allowed");
    assert.deepEqual(view.visibleText().filter((text) => text !== en.avatarFallback),
      [en.profileHeading, en.userId, "42", en.username, "@sample_user"]);
    assert.equal(view.findByClass("profile-card__image")?.imageAlternative, en.avatarAlt);
    assert.equal(view.findByClass("profile-card__image")?.imageReferrerPolicy, "no-referrer");
    assert.equal(view.findByClass("profile-card__avatar-fallback")?.attributes.get("aria-label"), en.avatarUnavailable);
    assert.deepEqual(calls.map(([url]) => url), ["/config.json", "https://functions.example.test/api/mini-app/access"]);
    assert.equal(calls[0]?.[1]?.cache, "no-store");
    assert.equal(calls[1]?.[1]?.cache, "no-store");
    assert.equal(calls[1]?.[1]?.method, "POST");
    assert.deepEqual(JSON.parse(String(calls[1]?.[1]?.body)), { initData: "signed-fixture" });
    assert.equal(view.operations.some((entry) => entry.includes("666")), false);
    view.dispatchImageError();
    assert.equal(view.findByClass("profile-card__image")?.hidden, true);
    assert.equal(view.findByClass("profile-card__avatar-fallback")?.hidden, false);
  });

  it("uses catalog fallbacks for missing optional fields", async () => {
    const { view } = await launch("allowed", { id: 7 });
    assert.deepEqual(view.visibleText().filter((text) => text !== en.avatarFallback),
      [en.profileHeading, en.userId, "7", en.username, en.missingValue]);
  });

  it("denies unregistered, pending, invalid and unavailable responses without profile leakage", async () => {
    for (const status of ["unregistered", "pending", "invalid", "unavailable", "unknown"]) {
      const { view } = await launch(status);
      assert.deepEqual(view.visibleText(), [status in en ? en[status as keyof typeof en] : en.unavailable]);
      assert.equal(view.findByClass("profile-card"), undefined);
    }
  });

  it("fails closed without signed bridge, valid config, or valid allowed user", async () => {
    for (const bridge of [null, {}, { initDataUnsafe: { user: { id: 42 } } }]) {
      const { view, calls } = await launch("allowed", { id: 42 }, bridge);
      assert.deepEqual(view.visibleText(), [en.noTelegram]);
      assert.deepEqual(calls, []);
    }
    for (const badConfig of [null, {}, { functionBaseUrl: "http://remote.test/" }, { ...config, token: "secret" }]) {
      const { view, calls } = await launch("allowed", { id: 42 }, { initData: "signed-fixture" }, badConfig);
      assert.deepEqual(view.visibleText(), [en.unavailable]);
      assert.equal(calls.length, 1);
    }
    const { view } = await launch("allowed", { id: 0 });
    assert.deepEqual(view.visibleText(), [en.unavailable]);
  });

  it("shows loading before the authorization request resolves", async () => {
    const view = new FakeMiniAppView();
    let resolve!: (value: Response) => void;
    const fetcher = (async () => new Promise<Response>((done) => { resolve = done; })) as typeof fetch;
    const pending = initializeMiniApp({ initData: "signed" }, view, fetcher);
    assert.deepEqual(view.visibleText(), [en.loading]);
    resolve({ ok: false } as Response);
    await pending;
    assert.deepEqual(view.visibleText(), [en.unavailable]);
  });

  it("keeps the profile hidden when config or access fetch fails, returns non-OK, or sends malformed JSON", async () => {
    for (const failAt of [1, 2]) {
      for (const outcome of ["throw", "not-ok", "bad-json"]) {
        const view = new FakeMiniAppView();
        let calls = 0;
        const fetcher = (async (): Promise<Response> => {
          calls++;
          if (calls === failAt) {
            if (outcome === "throw") throw new Error("offline");
            if (outcome === "not-ok") return new Response(null, { status: 503 });
            return new Response("{invalid", { status: 200 });
          }
          return Response.json(calls === 1 ? config : {
            status: "allowed", user: { id: 42 },
          });
        }) as typeof fetch;
        await initializeMiniApp({ initData: "signed", initDataUnsafe: { user: { id: 666 } } }, view, fetcher);
        assert.deepEqual(view.visibleText(), [en.unavailable]);
        assert.equal(view.findByClass("profile-card"), undefined);
        assert.equal(calls, failAt);
      }
    }
  });
});

describe("profile normalization", () => {
  it("rejects malformed IDs, usernames and untrusted photo hosts", () => {
    for (const id of [0, -1, 1.5, "123", Number.MAX_SAFE_INTEGER + 1]) {
      assert.equal(normalizeUserInfo({ id }), null);
    }
    assert.deepEqual(normalizeUserInfo({ id: 1, username: "<img_onerror>", photo_url: "https://t.me.example.com/photo" }),
      { id: 1, username: null, photoUrl: null });
    assert.deepEqual(normalizeUserInfo({ id: 1, username: "@valid_name", photo_url: "https://t.me/photo" }),
      { id: 1, username: "@valid_name", photoUrl: "https://t.me/photo" });
  });
});
