function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}

export function createTelegramReadyNotifier(): (host: unknown) => void {
  let hasNotifiedTelegramReady = false;

  return (host: unknown): void => {
    if (hasNotifiedTelegramReady || !isObject(host) || !("Telegram" in host)) {
      return;
    }

    const telegram = host.Telegram;
    if (!isObject(telegram) || !("WebApp" in telegram)) {
      return;
    }

    const webApp = telegram.WebApp;
    if (!isObject(webApp) || !("ready" in webApp)) {
      return;
    }

    const ready = webApp.ready;
    if (typeof ready !== "function") {
      return;
    }

    hasNotifiedTelegramReady = true;
    Reflect.apply(ready, webApp, []);
  };
}
