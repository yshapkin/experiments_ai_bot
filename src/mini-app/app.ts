import { createTelegramReadyNotifier } from "./telegram.js";

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
