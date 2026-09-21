---
name: grammy
description: Create, modify, review, and validate grammY Telegram bot code for this Node.js/TypeScript repository. Use for bot instances, context typing, command/callback/message handlers, keyboards, middleware, error handling, polling vs. webhook hosting, and grammY-specific tests. Applies official grammY guidance and the repository's existing bot conventions.
---

# grammY

Use this workflow for every grammY planning, implementation, or review task.

## Sources of truth

1. Read the applicable functional requirements, `src/bot.ts`, existing handler
   modules under `src/handlers/`, `package.json`, and repository instructions
   before changing bot behavior.
2. Follow the installed grammY version (`grammy` in `package.json`). Do not
   silently upgrade, downgrade, or add grammY plugins unless the task requires
   it.
3. Use the [grammY guide](https://grammy.dev/guide/) and
   [grammY API reference](https://grammy.dev/ref/core/) as the primary
   references. Consult current documentation before relying on
   version-sensitive API behavior.
4. Do not use Telegraf, `node-telegram-bot-api`, or any other Telegram bot
   framework in this repository.
5. Prefer the repository's existing patterns (factory function, per-concern
   handler modules, typed harness) when they satisfy the requirement.

## Bot and context design

- Type the bot as `Bot<Context>` unless a task explicitly requires a custom
  context. If custom context properties are added, define and export an
  explicit `Context` extension type; never use `any` for `ctx` or its
  properties.
- Build the bot through a single factory (see `createBot` in
  [src/bot.ts](/Users/yuryshapkin/Work/experiments/experiments_ai_bot/src/bot.ts)) that accepts the token and optional
  `BotConfig<Context>`/logger, registers every handler, and installs
  `bot.catch`. Do not construct additional `Bot` instances elsewhere.
- Pass `botInfo` through `BotConfig` (or fetch it once) instead of relying on
  an implicit `getMe` call on every cold start, especially under
  webhook/serverless hosting.

## Handlers and middleware

- Keep each command, callback query, and message-type handler in its own
  module under `src/handlers/`, exporting a `register*Handler(bot)` function
  that attaches middleware and returns `void`.
- Scope handlers with `bot.chatType(...)`, `bot.command(...)`,
  `bot.callbackQuery(...)`, and `bot.on("message:...")` filters instead of
  branching on `ctx.chat.type` or `ctx.message` inside a catch-all handler.
- Order matters: register more specific filters (commands, callback queries)
  before general message handlers so they are not shadowed.
- Always `await` Bot API calls (`ctx.reply`, `ctx.answerCallbackQuery`, etc.);
  never leave a floating promise inside a handler.
- Use `InlineKeyboard`/`Keyboard` builders for reply markup instead of
  hand-written keyboard objects, and keep callback data short and stable
  since it round-trips through Telegram.
- Acknowledge every callback query with `ctx.answerCallbackQuery()` even when
  no visible message changes, so Telegram stops the client's loading
  indicator.

## Error handling

- Install exactly one `bot.catch((error) => ...)` on the bot instance (see
  `createBot`). Distinguish `error.error instanceof GrammyError` (Bot API
  rejection) from `HttpError` (network) when the response requires different
  handling; otherwise log a generic processing failure.
- Log `error.ctx.update.update_id` and the error, never the raw update,
  message text, or bot token.
- Do not swallow errors inside individual handlers unless a specific recovery
  path is defined; let unhandled errors reach `bot.catch`.

## Polling vs. webhook hosting

- Local/default hosting in this repository uses long polling via
  `bot.start(...)` (see `src/index.ts`). Preserve this entry point unless a
  task explicitly changes the hosting model.
- For webhook hosting (e.g., Azure Functions), use `webhookCallback(bot, ...)`
  from `grammy`, never call `bot.start()` in the same process, and validate
  Telegram's `secret_token` header before processing an update.
- Webhook handlers must be stateless per invocation: reuse a single `Bot`
  instance across invocations in the same process/instance, but do not assume
  in-memory state survives across scaled-out instances.
- Never log the webhook secret token or the bot token.

## Testing

- Add or update tests for every behavior change, following
  `test/helpers/telegram.ts`.
- Build a bot harness with a fixed `botInfo` and intercept outgoing calls via
  `bot.api.config.use(...)` instead of calling the live Telegram API.
- Drive handlers with `await bot.handleUpdate(update)` using minimal,
  explicitly typed `Update` fixtures; add a new fixture helper instead of
  inlining ad hoc update objects across tests.
- Assert on intercepted API calls (`method`, `payload`), including
  `reply_markup`, rather than on internal grammY state.
- Cover the relevant chat type (`private`, `group`, `channel`) and confirm
  handlers correctly ignore updates outside their intended scope.
- Do not add tests that require network access or a real bot token.

## Validation

Run the smallest applicable repository commands in this order:

1. Focused tests for the changed handler(s) or bot wiring.
2. `npm run typecheck`.
3. `npm run build` when production source or bot wiring changes.
4. The full test command when shared bot setup (`src/bot.ts`,
   `src/logger.ts`, `src/config.ts`) changes.

## Review checklist

- Handlers are scoped with the narrowest applicable filter and registered in
  the correct order.
- Every Bot API call is awaited; no floating promises remain.
- Callback queries are acknowledged; keyboards use grammY builders.
- `bot.catch` is the single error boundary and logs no sensitive content.
- Webhook code paths do not call `bot.start()` and validate the secret token.
- No `any` is used for context or update data; custom context properties are
  explicitly typed.
- Tests intercept the Bot API, use `bot.handleUpdate`, and avoid live network
  calls.
