/**
 * Тесты отправки уведомлений через Telegram
 *
 * @module tests/services/telegram/notifications
 */

import { afterEach, describe, expect, mock, test } from 'bun:test';

const sendMessage = mock(async () => ({}));

mock.module('grammy', () => ({
  Bot: class {
    api = { sendMessage };
  },
}));

const { sendTelegramNotification } = await import(
  '@/services/telegram/notifications'
);

afterEach(() => {
  sendMessage.mockClear();
});

describe('sendTelegramNotification', () => {
  test('не отправляет уведомление без конфигурации Telegram', async () => {
    await sendTelegramNotification(undefined, new Map());
    expect(sendMessage).not.toHaveBeenCalled();
  });

  test('не отправляет уведомление при пустом chatId', async () => {
    await sendTelegramNotification(
      { botToken: 'token', chatId: [] },
      new Map([['Okko', [{ title: 'Дорама 1' }]]]),
    );
    expect(sendMessage).not.toHaveBeenCalled();
  });

  test('отправляет сообщение в каждый чат', async () => {
    await sendTelegramNotification(
      { botToken: 'token', chatId: ['-1001', '-1002'] },
      new Map([['Okko', [{ title: 'Дорама 1' }, { title: 'Дорама 2' }]]]),
    );

    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(sendMessage).toHaveBeenCalledWith(
      '-1001',
      expect.stringContaining('Okko'),
      { parse_mode: 'HTML' },
    );
    expect(sendMessage).toHaveBeenCalledWith(
      '-1002',
      expect.stringContaining('Дорама 1'),
      { parse_mode: 'HTML' },
    );
  });
});
