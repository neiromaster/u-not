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

class InputFile {
  constructor(
    public file: unknown,
    public filename?: string,
  ) {}
}

mock.module('grammy', () => ({
  Bot: class {
    api = { sendMessage, sendPhoto };
  },
  InputFile,
}));

const originalFetch = globalThis.fetch;

const { sendTelegramNotification } = await import(
  '@/services/telegram/notifications'
);

afterEach(() => {
  sendMessage.mockClear();
  sendPhoto.mockClear();
  globalThis.fetch = originalFetch;
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
    globalThis.fetch = (() =>
      Promise.resolve(
        new Response(new Blob(['fake-image']), { status: 200 }),
      )) as unknown as typeof fetch;

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
    const callArgs = sendPhoto.mock.calls[0] as [
      string,
      unknown,
      { caption: string; parse_mode: string },
    ];
    expect(callArgs[0]).toBe('-1001');
    expect(callArgs[1]).toBeInstanceOf(InputFile);
    expect(callArgs[2]).toEqual(
      expect.objectContaining({
        parse_mode: 'HTML',
        caption: expect.stringContaining('Дорама 1'),
      }),
    );
    expect(sendMessage).not.toHaveBeenCalled();
  });

  test('отправляет текст, если фото не отправилось и постер не скачался', async () => {
    sendPhoto.mockRejectedValueOnce(new Error('photo failed'));
    globalThis.fetch = (() =>
      Promise.resolve(
        new Response('Not Found', { status: 404 }),
      )) as unknown as typeof fetch;

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

  test('скачивает постер и выгружает файлом, передавая User-Agent', async () => {
    let posterFetchHeaders: Record<string, string> | undefined;
    globalThis.fetch = ((_url: string, init?: RequestInit) => {
      posterFetchHeaders = init?.headers as Record<string, string> | undefined;
      return Promise.resolve(
        new Response(new Blob(['fake-image']), { status: 200 }),
      );
    }) as unknown as typeof fetch;

    await sendTelegramNotification(
      { botToken: 'token', chatId: '-1001' },
      new Map([
        [
          'ivi',
          [
            {
              title: 'Дорама 1',
              posterUrl: 'https://thumbs.example.com/poster1.jpg',
            },
          ],
        ],
      ]),
      'TestAgent/1.0',
    );

    expect(sendPhoto).toHaveBeenCalledTimes(1);
    const call = sendPhoto.mock.calls[0] as [string, unknown, unknown];
    expect(call[0]).toBe('-1001');
    expect(call[1]).toBeInstanceOf(InputFile);
    expect(sendMessage).not.toHaveBeenCalled();
    expect(posterFetchHeaders).toEqual({ 'User-Agent': 'TestAgent/1.0' });
  });

  test('пробует URL, если файл не прошёл, но постер скачался', async () => {
    sendPhoto.mockRejectedValueOnce(new Error('upload failed'));
    globalThis.fetch = (() =>
      Promise.resolve(
        new Response(new Blob(['fake-image']), { status: 200 }),
      )) as unknown as typeof fetch;

    await sendTelegramNotification(
      { botToken: 'token', chatId: '-1001' },
      new Map([
        [
          'ivi',
          [
            {
              title: 'Дорама 1',
              posterUrl: 'https://thumbs.example.com/poster1.jpg',
            },
          ],
        ],
      ]),
    );

    expect(sendPhoto).toHaveBeenCalledTimes(2);
    const firstCall = sendPhoto.mock.calls[0] as [string, unknown, unknown];
    const secondCall = sendPhoto.mock.calls[1] as [string, unknown, unknown];
    expect(firstCall[1]).toBeInstanceOf(InputFile);
    expect(secondCall[1]).toBe('https://thumbs.example.com/poster1.jpg');
    expect(sendMessage).not.toHaveBeenCalled();
  });

  test('отправляет текст, если постер не прошёл ни URL, ни файлом', async () => {
    sendPhoto.mockRejectedValueOnce(
      new Error('failed to get HTTP URL content'),
    );
    sendPhoto.mockRejectedValueOnce(new Error('upload failed'));
    globalThis.fetch = (() =>
      Promise.resolve(
        new Response(new Blob(['fake-image']), { status: 200 }),
      )) as unknown as typeof fetch;

    await sendTelegramNotification(
      { botToken: 'token', chatId: '-1001' },
      new Map([
        [
          'ivi',
          [
            {
              title: 'Дорама 1',
              posterUrl: 'https://thumbs.example.com/poster1.jpg',
            },
          ],
        ],
      ]),
    );

    expect(sendPhoto).toHaveBeenCalledTimes(2);
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
    globalThis.fetch = (() =>
      Promise.resolve(
        new Response(new Blob(['fake-image']), { status: 200 }),
      )) as unknown as typeof fetch;

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
