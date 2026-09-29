import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { initializeMiniApp } from "../src/mini-app/app.js";
import { FakeMiniAppView } from "./helpers/fake-mini-app-view.js";

const FALLBACK = "Open this app in Telegram";

function initialize(
  user: unknown,
  ready?: () => void,
): FakeMiniAppView {
  const view = new FakeMiniAppView();
  const bridge: Record<string, unknown> = {
    initDataUnsafe: { user },
  };
  if (ready !== undefined) {
    bridge.ready = ready;
  }
  initializeMiniApp(bridge, view);
  return view;
}

function assertFallback(view: FakeMiniAppView): void {
  assert.deepEqual(view.visibleText(), [FALLBACK]);
  assert.equal(view.root[0]?.name, "p");
}

function assertProfileText(
  view: FakeMiniAppView,
  id: string,
  username: string,
): void {
  assert.deepEqual(
    view.visibleText().filter((text) => text !== "👤"),
    ["Telegram profile", "User ID", id, "Username", username],
  );
  assert.equal(view.root[0]?.name, "article");
}

describe("Mini App user information", () => {
  describe("profile rendering", () => {
    it("renders complete normalized data with exact labels and safe image attributes", () => {
      const view = initialize({
        id: 42,
        username: "  sample_user  ",
        photo_url: "https://cdn.t.me/avatar.png",
      });

      assertProfileText(view, "42", "@sample_user");
      const image = view.findByClass("profile-card__image");
      const avatar = view.findByClass("profile-card__avatar-fallback");
      assert.equal(image?.imageSource, "https://cdn.t.me/avatar.png");
      assert.equal(image?.imageAlternative, "Telegram profile photo");
      assert.equal(image?.imageReferrerPolicy, "no-referrer");
      assert.equal(avatar?.hidden, true);
      assert.ok(
        view.operations.indexOf("image-referrer:no-referrer") <
          view.operations.indexOf("image-source:https://cdn.t.me/avatar.png"),
      );
      assert.equal(
        view.operations.some((operation) => operation.includes("html")),
        false,
      );
    });

    it("renders deterministic optional-field fallbacks and normalizes one leading @", () => {
      for (const username of ["valid_name", "@valid_name"]) {
        const view = initialize({ id: 7, username });
        assertProfileText(view, "7", "@valid_name");
        assert.equal(view.findByClass("profile-card__image"), undefined);
        assert.equal(
          view.findByClass("profile-card__avatar-fallback")?.hidden,
          false,
        );
      }

      const partial = initialize({ id: 8 });
      assertProfileText(partial, "8", "Not available");
    });

    it("switches a failed image to the local neutral avatar without another source", () => {
      const view = initialize({
        id: 9,
        username: "valid_user",
        photo_url: "https://telegram.org/avatar",
      });
      const image = view.findByClass("profile-card__image");
      const avatar = view.findByClass("profile-card__avatar-fallback");
      const sourcesBefore = view.operations.filter((entry) =>
        entry.startsWith("image-source:")
      );

      view.dispatchImageError();

      assert.equal(image?.hidden, true);
      assert.equal(avatar?.hidden, false);
      assert.deepEqual(
        view.operations.filter((entry) => entry.startsWith("image-source:")),
        sourcesBefore,
      );
    });
  });

  describe("required ID validation", () => {
    it("rejects every malformed ID and preserves valid positive boundaries", async (t) => {
      const invalidIds: readonly [string, unknown][] = [
        ["zero", 0],
        ["negative", -1],
        ["fractional", 1.5],
        ["infinite", Number.POSITIVE_INFINITY],
        ["NaN", Number.NaN],
        ["unsafe", Number.MAX_SAFE_INTEGER + 1],
        ["string", "123"],
        ["absent", undefined],
        ["null", null],
        ["object", {}],
      ];
      for (const [name, id] of invalidIds) {
        await t.test(name, () => assertFallback(initialize({ id })));
      }

      assertProfileText(initialize({ id: 1 }), "1", "Not available");
      assertProfileText(
        initialize({ id: Number.MAX_SAFE_INTEGER }),
        String(Number.MAX_SAFE_INTEGER),
        "Not available",
      );
    });
  });

  describe("username policy and text safety", () => {
    it("accepts trimming and the 5- and 32-character boundaries", () => {
      const accepted = [
        ["  abc_5  ", "@abc_5"],
        ["@ABCDE", "@ABCDE"],
        ["a".repeat(32), `@${"a".repeat(32)}`],
      ] as const;
      for (const [username, expected] of accepted) {
        assertProfileText(initialize({ id: 1, username }), "1", expected);
      }
    });

    it("rejects malformed and markup-like usernames as text-only fallback", async (t) => {
      const rejected: readonly [string, unknown][] = [
        ["too short", "abcd"],
        ["too long", "a".repeat(33)],
        ["repeated @", "@@valid"],
        ["embedded @", "valid@name"],
        ["internal whitespace", "valid name"],
        ["Unicode", "válido"],
        ["markup", "<img_onerror>"],
        ["non-string", 12345],
      ];
      for (const [name, username] of rejected) {
        await t.test(name, () => {
          const view = initialize({ id: 15, username });
          assertProfileText(view, "15", "Not available");
          assert.equal(view.operations.some((entry) => entry.includes("<")), false);
          assert.equal(
            view.operations.some((entry) => entry.includes("html")),
            false,
          );
        });
      }
    });
  });

  describe("profile photo URL policy", () => {
    it("accepts only approved hosts and their subdomains", () => {
      for (const url of [
        "https://t.me/photo",
        "https://images.t.me/photo",
        "https://telegram.org/photo",
        "https://cdn.telegram.org/photo",
        "https://telesco.pe/photo",
        "https://media.telesco.pe/photo",
      ]) {
        assert.equal(
          initialize({ id: 1, photo_url: url })
            .findByClass("profile-card__image")?.imageSource,
          url,
        );
      }
    });

    it("rejects malformed, remote, deceptive, and overlength URLs", async (t) => {
      const rejected: readonly [string, unknown][] = [
        ["HTTP", "http://t.me/photo"],
        ["credentials", "https://user:pass@t.me/photo"],
        ["non-default port", "https://t.me:8443/photo"],
        ["IPv4", "https://127.0.0.1/photo"],
        ["IPv6", "https://[::1]/photo"],
        ["deceptive suffix", "https://t.me.example.com/photo"],
        ["deceptive prefix", "https://evilt.me.example/photo"],
        ["unapproved host", "https://example.com/photo"],
        ["fragment", "https://t.me/photo#fragment"],
        ["malformed", "not a url"],
        ["overlength", `https://t.me/${"a".repeat(2_049)}`],
        ["non-string", 42],
      ];
      for (const [name, photo_url] of rejected) {
        await t.test(name, () => {
          const view = initialize({ id: 2, photo_url });
          assert.equal(view.findByClass("profile-card__image"), undefined);
          assert.equal(
            view.findByClass("profile-card__avatar-fallback")?.hidden,
            false,
          );
        });
      }
    });
  });

  describe("bridge and readiness behavior", () => {
    it("renders fallback for absent and malformed bridge/user shapes", () => {
      for (const bridge of [
        undefined,
        null,
        "Telegram",
        {},
        { initDataUnsafe: null },
        { initDataUnsafe: {} },
        { initDataUnsafe: { user: null } },
      ]) {
        const view = new FakeMiniAppView();
        initializeMiniApp(bridge, view);
        assertFallback(view);
      }
    });

    it("does not require ready and calls it exactly once after profile rendering", () => {
      assertProfileText(initialize({ id: 3 }), "3", "Not available");

      const events: string[] = [];
      const view = new FakeMiniAppView(events);
      let calls = 0;
      initializeMiniApp(
        {
          initDataUnsafe: { user: { id: 3 } },
          ready() {
            calls += 1;
            events.push("ready");
          },
        },
        view,
      );
      assert.equal(calls, 1);
      assert.deepEqual(events, ["rendered", "ready"]);
    });

    it("calls ready only once when the same bridge initializes repeatedly", () => {
      const events: string[] = [];
      const bridge = {
        initDataUnsafe: { user: { id: 3 } },
        ready() {
          events.push("ready");
        },
      };

      initializeMiniApp(bridge, new FakeMiniAppView(events));
      initializeMiniApp(bridge, new FakeMiniAppView(events));

      assert.deepEqual(events, ["rendered", "ready", "rendered"]);
    });

    it("marks readiness before calling ready to prevent re-entrant calls", () => {
      const events: string[] = [];
      const view = new FakeMiniAppView(events);
      const bridge = {
        initDataUnsafe: { user: { id: 3 } },
        ready() {
          events.push("ready");
          initializeMiniApp(bridge, view);
        },
      };

      initializeMiniApp(bridge, view);

      assert.deepEqual(events, ["rendered", "ready", "rendered"]);
    });

    it("calls ready after fallback and keeps output when ready throws", () => {
      const events: string[] = [];
      const view = new FakeMiniAppView(events);
      initializeMiniApp(
        {
          initDataUnsafe: {},
          ready() {
            events.push("ready");
            throw new Error("Telegram unavailable");
          },
        },
        view,
      );

      assert.deepEqual(events, ["rendered", "ready"]);
      assertFallback(view);
    });
  });
});
