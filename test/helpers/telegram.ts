import type { Bot } from "grammy";
import type { Context } from "grammy";
import type { Update, UserFromGetMe } from "grammy/types";

import { createBot } from "../../src/bot.js";

const user = {
  id: 100,
  is_bot: false,
  first_name: "Test",
} as const;

const privateChat = {
  id: 200,
  type: "private",
  first_name: "Test",
} as const;

export const botInfo: UserFromGetMe = {
  id: 300,
  is_bot: true,
  first_name: "Echo Bot",
  username: "echo_test_bot",
  can_join_groups: false,
  can_read_all_group_messages: false,
  supports_inline_queries: false,
  can_connect_to_business: false,
  has_main_web_app: false,
  has_topics_enabled: false,
  allows_users_to_create_topics: false,
  can_manage_bots: false,
  supports_join_request_queries: false,
};

export interface ApiCall {
  method: string;
  payload: Record<string, unknown>;
}

export interface BotHarness {
  bot: Bot<Context>;
  calls: ApiCall[];
}

export function createBotHarness(): BotHarness {
  const calls: ApiCall[] = [];
  const bot = createBot("123456:test-only-token", {
    botConfig: { botInfo },
  });

  bot.api.config.use(async (_previous, method, payload) => {
    calls.push({
      method,
      payload: payload as unknown as Record<string, unknown>,
    });

    const result =
      method === "sendMessage"
        ? {
            message_id: 900,
            date: 1_700_000_000,
            chat: privateChat,
            text: String(
              (payload as unknown as Record<string, unknown>).text ?? "",
            ),
          }
        : true;

    return { ok: true, result } as never;
  });

  return { bot, calls };
}

export function privateTextUpdate(
  text: string,
  updateId = 1,
): Update {
  const entities = text.startsWith("/")
    ? [{ type: "bot_command" as const, offset: 0, length: text.length }]
    : undefined;

  return {
    update_id: updateId,
    message: {
      message_id: updateId + 10,
      date: 1_700_000_000,
      chat: privateChat,
      from: user,
      text,
      ...(entities === undefined ? {} : { entities }),
    },
  };
}

export function helpCallbackUpdate(
  data = "help",
  updateId = 2,
): Update {
  return {
    update_id: updateId,
    callback_query: {
      id: `callback-${updateId}`,
      from: user,
      chat_instance: "stable-chat-instance",
      data,
      message: {
        message_id: 50,
        date: 1_700_000_000,
        chat: privateChat,
        text: "Welcome",
      },
    },
  };
}

export function groupTextUpdate(text: string): Update {
  const entities = text.startsWith("/")
    ? [{ type: "bot_command" as const, offset: 0, length: text.length }]
    : undefined;

  return {
    update_id: 3,
    message: {
      message_id: 13,
      date: 1_700_000_000,
      chat: { id: -400, type: "group", title: "Test Group" },
      from: user,
      text,
      ...(entities === undefined ? {} : { entities }),
    },
  };
}

export function channelTextUpdate(text: string): Update {
  return {
    update_id: 6,
    channel_post: {
      message_id: 16,
      date: 1_700_000_000,
      chat: { id: -500, type: "channel", title: "Test Channel" },
      text,
    },
  };
}

export function privatePhotoUpdate(): Update {
  return {
    update_id: 4,
    message: {
      message_id: 14,
      date: 1_700_000_000,
      chat: privateChat,
      from: user,
      photo: [
        {
          file_id: "test-file",
          file_unique_id: "test-unique-file",
          width: 1,
          height: 1,
        },
      ],
    },
  };
}

export function editedPrivateTextUpdate(text: string): Update {
  const original = privateTextUpdate(text, 5);
  if (original.message === undefined) {
    throw new Error("Test fixture invariant failed");
  }

  return {
    update_id: original.update_id,
    edited_message: {
      ...original.message,
      edit_date: 1_700_000_001,
    },
  };
}
