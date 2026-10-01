import { copy } from "./copy.js";
import { createTelegramReadyNotifier } from "./telegram.js";
import { normalizeUserInfo } from "./user-info.js";
import type { MiniAppView } from "./view.js";
import { renderProfile, renderStatus } from "./view.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
const readyBridges = new WeakSet<object>();

export async function initializeMiniApp(
  bridgeCandidate: unknown, view: MiniAppView,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const en = copy.en;
  renderStatus(view, en.loading);
  const bridge = isRecord(bridgeCandidate) ? bridgeCandidate : null;
  if (bridge && !readyBridges.has(bridge) && typeof bridge.ready === "function") {
    readyBridges.add(bridge);
    try { bridge.ready(); } catch { /* Best-effort readiness notification. */ }
  }
  if (!bridge || typeof bridge.initData !== "string" || !bridge.initData) {
    renderStatus(view, en.noTelegram);
    return;
  }
  try {
    const configResponse = await fetcher("/config.json", { cache: "no-store" });
    if (!configResponse.ok) throw new Error("config unavailable");
    const config: unknown = await configResponse.json();
    if (!isRecord(config) || Object.keys(config).length !== 1 ||
      typeof config.functionBaseUrl !== "string") throw new Error("invalid config");
    const base = new URL(config.functionBaseUrl);
    if ((base.protocol !== "https:" && !(base.protocol === "http:" && base.hostname === "localhost")) ||
      base.username || base.password || base.search || base.hash || base.pathname !== "/")
      throw new Error("invalid URL");
    const response = await fetcher(new URL("/api/mini-app/access", base).href, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData: bridge.initData }), cache: "no-store",
    });
    if (!response.ok) throw new Error("access unavailable");
    const result: unknown = await response.json();
    if (!isRecord(result) || typeof result.status !== "string") throw new Error("invalid response");
    if (result.status === "allowed") {
      const user = normalizeUserInfo(result.user);
      if (!user) throw new Error("invalid profile");
      renderProfile(view, user);
    } else if (result.status === "unregistered" || result.status === "pending" || result.status === "invalid") {
      renderStatus(view, en[result.status]);
    } else {
      renderStatus(view, en.unavailable);
    }
  } catch {
    renderStatus(view, en.unavailable);
  }
}

export interface MiniAppInitialization {
  readonly host: unknown;
  readonly initializeScreen: () => void;
}
export function createMiniAppInitializer(): (initialization: MiniAppInitialization) => void {
  const notifyTelegramReady = createTelegramReadyNotifier();
  return ({ host, initializeScreen }) => {
    initializeScreen();
    notifyTelegramReady(host);
  };
}
