# Telegram Bot

**Last reviewed:** 2026-09-21

## Overview

Build a minimal Telegram bot with Node.js, TypeScript, and the grammY framework.
The first version welcomes users, demonstrates an inline keyboard, and echoes
plain-text messages.

## Goals

- Provide a working foundation for future bot features.
- Keep handlers small, typed, and independently testable.
- Support local development without committing credentials.
- Run statelessly behind an Azure Functions webhook in production while keeping
  local polling for development.

## Functional requirements

### Start command

- The bot must handle the `/start` command.
- It must reply with a welcome message that tells the user to send text.
- The reply must include an inline keyboard with a `Help` button.

**Acceptance criteria**

- Given a user sends `/start`, the bot sends one welcome message.
- The message includes a visible `Help` button with callback data `help`.

### Help action

- The bot must handle the `help` callback query.
- It must acknowledge the callback query and explain that plain-text messages
  are echoed.

**Acceptance criteria**

- Given a user selects `Help`, Telegram stops displaying the loading indicator.
- The bot sends a help message to the same chat.

### Text messages

- The bot must handle plain-text messages that are not commands.
- It must reply with exactly the received text.
- It must not echo commands.

**Acceptance criteria**

- Given a user sends `Hello`, the bot replies with `Hello`.
- Given a user sends `/start`, only the start-command response is sent.

## Technical requirements

- Use Node.js, TypeScript, and grammY. Do not use Telegraf or
  `node-telegram-bot-api`.
- Enable TypeScript `strict` mode. Do not use `any` in handlers or context
  extensions.
- Read the Telegram bot token from an environment variable. Fail startup with a
  clear error when it is missing.
- Read the Telegram webhook secret from an environment variable in production.
  Fail startup with a clear error when it is missing.
- Keep command, callback-query, and message handlers in separate modules and
  register them on the main bot instance.
- Log startup and processing failures without exposing the bot token or user
  message contents.
- Use an Azure Functions HTTP webhook entrypoint in production with a fixed,
  non-secret route and `grammy`'s `webhookCallback`.
- Validate the Telegram webhook secret header before parsing or processing the
  update body.
- Keep production workers stateless. Do not depend on in-memory sessions,
  queues, databases, or durable deduplication for V1.
- Do not start long polling in production.
- Add unit tests for each acceptance criterion using mocked Telegram updates; the
  tests must not call the Telegram API.

## Runtime requirements

- Local development continues to use long polling.
- Production uses an anonymous Azure Functions HTTP trigger at
  `/api/telegram/webhook`.
- Register the Telegram webhook as an operator action during deployment or
  secret rotation, not on every cold start.
- Treat webhook delivery as at-least-once. Telegram can retry non-2xx or lost
  deliveries, so duplicate updates are possible and accepted in V1.
- Reject malformed, oversized, or unauthorized webhook requests with controlled
  responses and without logging request bodies, headers, token values, or secret
  URLs.

## Limitations

- The first version supports only private-chat text messages.
- Media, edited messages, groups, channels, localization, and persistent user
  state are not supported.
- V1 does not provide durable duplicate suppression across retries or parallel
  workers.

## Out of scope

- Automatically registering, updating, or deleting the Telegram webhook at
  runtime.
- Databases, sessions, authentication, and authorization.
- Rich media processing and external service integrations.
