/**
 * Тесты отправки уведомлений через Telegram
 *
 * @module tests/services/telegram/notifications
 */

import { afterEach, describe, expect, mock, test } from 'bun:test';

const sendMessage = mock(async () => ({}));
const sendPhoto = mock(async () => ({}));

mock.module('grammy', () => ({
  Bot: class {
    api = { sendMessage, sendPhoto };
  },
}));

const { sendTelegramNotification } = await import(
  '@/services/telegram/notifications'
);

afterEach(() => {
  sendMessage.mockClear();
  sendPhoto.mockClear();
});

describe('sendTelegramNotification', () => {
  test('не отправляет уведомление без конфигурации Telegram', async () => {
    await sendTelegramNotification(undefined, new Map());
    expect(sendMessage).not.toHaveBeenCalled();
    expect(sendPhoto).not.toHaveBeenCalled();
  });

  test('не отправляет уведомление при пустом chatId', async () => {
    await sendTelegramNotification(
      { botToken: 'token', chatId: [] },
      new Map([['Okko', [{ title: 'Дорама 1' }]]]),
    );
    expect(sendMessage).not.toHaveBeenCalled();
  });

  test('отправляет фото с постером и caption', async () => {
    await sendTelegramNotification(
      { botToken: 'token', chatId: '-1001' },
      new Map([
        [
          'Okko',
          [
            {
              title: 'Дорама 1',
              posterUrl: 'https://img.example.com/poster1.jpg',
              link: 'https://example.com/watch/1',
            },
          ],
        ],
      ]),
    );

    expect(sendPhoto).toHaveBeenCalledTimes(1);
    expect(sendPhoto).toHaveBeenCalledWith(
      '-1001',
      'https://img.example.com/poster1.jpg',
      expect.objectContaining({
        parse_mode: 'HTML',
        caption: expect.stringContaining('Дорама 1'),
      }),
    );
    expect(sendMessage).not.toHaveBeenCalled();
  });

  test('отправляет текст без постера', async () => {
    await sendTelegramNotification(
      { botToken: 'token', chatId: '-1001' },
      new Map([['Okko', [{ title: 'Дорама 1' }]]]),
    );

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith(
      '-1001',
      expect.stringContaining('Дорама 1'),
      { parse_mode: 'HTML' },
    );
    expect(sendPhoto).not.toHaveBeenCalled();
  });

  test('отправляет в каждый чат', async () => {
    await sendTelegramNotification(
      { botToken: 'token', chatId: ['-1001', '-1002'] },
      new Map([['Okko', [{ title: 'Дорама 1' }]]]),
    );

    expect(sendMessage).toHaveBeenCalledTimes(2);
  });
});
