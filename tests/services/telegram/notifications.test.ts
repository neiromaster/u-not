/**
 * Тесты отправки уведомлений через Telegram
 *
 * @module tests/services/telegram/notifications
 */

import { afterEach, describe, expect, mock, test } from 'bun:test';

const sendMessage = mock(
  async (
    _chatId: string,
    _message: string,
    _opts: { parse_mode: string },
  ) => ({}),
);
const sendPhoto = mock(
  async (
    _chatId: string,
    _photo: string,
    _opts: { caption: string; parse_mode: string },
  ) => ({}),
);

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

  test('отправляет текст, если фото не отправилось', async () => {
    sendPhoto.mockRejectedValueOnce(new Error('photo failed'));

    await sendTelegramNotification(
      { botToken: 'token', chatId: '-1001' },
      new Map([
        [
          'Okko',
          [
            {
              title: 'Дорама 1',
              posterUrl: 'https://img.example.com/poster1.jpg',
            },
          ],
        ],
      ]),
    );

    expect(sendPhoto).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith(
      '-1001',
      expect.stringContaining('Дорама 1'),
      { parse_mode: 'HTML' },
    );
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

  test('экранирует спецсимволы HTML в caption', async () => {
    await sendTelegramNotification(
      { botToken: 'token', chatId: '-1001' },
      new Map([
        [
          'Okko & Co',
          [
            {
              title: 'Дорама <1> & 2',
              posterUrl: 'https://img.example.com/poster.jpg',
              link: 'https://example.com/?a=1&b=2',
            },
          ],
        ],
      ]),
    );

    const callArgs = sendPhoto.mock.calls[0] as [
      string,
      string,
      { caption: string; parse_mode: string },
    ];
    const caption = callArgs[2].caption;

    expect(caption).toContain('<b>Дорама &lt;1&gt; &amp; 2</b>');
    expect(caption).toContain('<i>Okko &amp; Co</i>');
    expect(caption).toContain('href="https://example.com/?a=1&amp;b=2"');
  });

  test('отправляет в каждый чат', async () => {
    await sendTelegramNotification(
      { botToken: 'token', chatId: ['-1001', '-1002'] },
      new Map([['Okko', [{ title: 'Дорама 1' }]]]),
    );

    expect(sendMessage).toHaveBeenCalledTimes(2);
  });
});
