import type { Bot, Context } from "grammy";

export function registerTextHandler(_bot: Bot<Context>): void {
  // Unknown commands and plain text are deliberately ignored.
}
