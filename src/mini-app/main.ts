import { initializeMiniApp } from "./app.js";
import { createBrowserView } from "./view.js";
import { copy } from "./copy.js";

declare global {
  interface Window {
    Telegram?: unknown;
  }
}

function telegramWebAppCandidate(value: unknown): unknown {
  if (typeof value !== "object" || value === null || !("WebApp" in value)) {
    return undefined;
  }
  return value.WebApp;
}

const root = document.querySelector<HTMLElement>("#app");
if (root === null) {
  throw new Error("Mini App root element is missing");
}

document.title = copy.en.title;
void initializeMiniApp(
  telegramWebAppCandidate(window.Telegram),
  createBrowserView(root),
);
