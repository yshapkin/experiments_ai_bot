import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createMiniAppInitializer } from "../src/mini-app/app.js";

describe("createMiniAppInitializer", () => {
  it("initializes the screen before notifying Telegram readiness", () => {
    const events: string[] = [];
    const webApp = {
      ready(this: unknown): void {
        assert.equal(this, webApp);
        events.push("ready");
      },
    };
    const initializeMiniApp = createMiniAppInitializer();

    initializeMiniApp({
      host: { Telegram: { WebApp: webApp } },
      initializeScreen: () => {
        events.push("screen");
      },
    });

    assert.deepEqual(events, ["screen", "ready"]);
  });

  it("notifies readiness at most once while still initializing every screen", () => {
    const events: string[] = [];
    const initializeMiniApp = createMiniAppInitializer();
    const host = {
      Telegram: {
        WebApp: {
          ready: () => {
            events.push("ready");
          },
        },
      },
    };

    for (let call = 1; call <= 3; call += 1) {
      initializeMiniApp({
        host,
        initializeScreen: () => {
          events.push(`screen:${call}`);
        },
      });
    }

    assert.deepEqual(events, ["screen:1", "ready", "screen:2", "screen:3"]);
  });

  it("marks readiness before calling the bridge to prevent re-entrant notification", () => {
    const events: string[] = [];
    const initializeMiniApp = createMiniAppInitializer();
    const host = {
      Telegram: {
        WebApp: {
          ready: () => {
            events.push("ready");
            initializeMiniApp({
              host,
              initializeScreen: () => {
                events.push("re-entrant screen");
              },
            });
          },
        },
      },
    };

    initializeMiniApp({
      host,
      initializeScreen: () => {
        events.push("screen");
      },
    });

    assert.deepEqual(events, ["screen", "ready", "re-entrant screen"]);
  });

  it("treats absent, partial, malformed, and non-callable bridges as no-ops", () => {
    const invalidHosts: readonly unknown[] = [
      undefined,
      null,
      false,
      "host",
      {},
      { Telegram: null },
      { Telegram: "telegram" },
      { Telegram: {} },
      { Telegram: { WebApp: null } },
      { Telegram: { WebApp: "web-app" } },
      { Telegram: { WebApp: {} } },
      { Telegram: { WebApp: { ready: null } } },
      { Telegram: { WebApp: { ready: "ready" } } },
    ];

    for (const host of invalidHosts) {
      let screenInitializations = 0;
      const initializeMiniApp = createMiniAppInitializer();

      assert.doesNotThrow(() => {
        initializeMiniApp({
          host,
          initializeScreen: () => {
            screenInitializations += 1;
          },
        });
      });
      assert.equal(screenInitializations, 1);
    }
  });

  it("can notify a later valid bridge after malformed bridge shapes", () => {
    let readyCalls = 0;
    const initializeMiniApp = createMiniAppInitializer();

    initializeMiniApp({
      host: { Telegram: { WebApp: { ready: false } } },
      initializeScreen: () => {},
    });
    initializeMiniApp({
      host: {
        Telegram: {
          WebApp: {
            ready: () => {
              readyCalls += 1;
            },
          },
        },
      },
      initializeScreen: () => {},
    });

    assert.equal(readyCalls, 1);
  });

  it("isolates readiness state between initializer lifecycles", () => {
    let readyCalls = 0;
    const host = {
      Telegram: {
        WebApp: {
          ready: () => {
            readyCalls += 1;
          },
        },
      },
    };

    createMiniAppInitializer()({ host, initializeScreen: () => {} });
    createMiniAppInitializer()({ host, initializeScreen: () => {} });

    assert.equal(readyCalls, 2);
  });
});
