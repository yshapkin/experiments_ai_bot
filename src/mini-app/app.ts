import { createTelegramReadyNotifier } from "./telegram.js";
import { normalizeUserInfo } from "./user-info.js";
import type { MiniAppView } from "./view.js";
import { renderFallback, renderProfile } from "./view.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function initializeMiniApp(
  bridgeCandidate: unknown,
  view: MiniAppView,
): void {
  const bridge = isRecord(bridgeCandidate) ? bridgeCandidate : null;
  const initDataUnsafe =
    bridge !== null && isRecord(bridge.initDataUnsafe)
      ? bridge.initDataUnsafe
      : null;
  const user = normalizeUserInfo(initDataUnsafe?.user);

  if (user === null) {
    renderFallback(view);
  } else {
    renderProfile(view, user);
  }

  const ready = bridge?.ready;
  if (typeof ready === "function") {
    try {
      ready.call(bridge);
    } catch {
      // Rendering is complete and remains usable if Telegram readiness fails.
    }
  }
}

export interface MiniAppInitialization {
  readonly host: unknown;
  readonly initializeScreen: () => void;
}

export function createMiniAppInitializer(): (
  initialization: MiniAppInitialization,
) => void {
  const notifyTelegramReady = createTelegramReadyNotifier();

  return ({ host, initializeScreen }: MiniAppInitialization): void => {
    initializeScreen();
    notifyTelegramReady(host);
  };
}
