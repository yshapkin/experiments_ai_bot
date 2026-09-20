# Telegram Bot

**Last reviewed:** 2026-09-20

## Overview

Build a minimal Telegram bot with Node.js, TypeScript, and the grammY framework.
The first version welcomes users, demonstrates an inline keyboard, and echoes
plain-text messages.

## Goals

- Provide a working foundation for future bot features.
- Keep handlers small, typed, and independently testable.
- Support local development without committing credentials.

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
- Keep command, callback-query, and message handlers in separate modules and
  register them on the main bot instance.
- Log startup and processing failures without exposing the bot token or user
  message contents.
- Add unit tests for each acceptance criterion using mocked Telegram updates; the
  tests must not call the Telegram API.

## Limitations

- The first version supports only private-chat text messages.
- Media, edited messages, groups, channels, localization, and persistent user
  state are not supported.

## Out of scope

- Production hosting and infrastructure.
- Webhook configuration and horizontal scaling.
- Databases, sessions, authentication, and authorization.
- Rich media processing and external service integrations.
