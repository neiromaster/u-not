/**
 * Тесты отправки уведомлений через VK
 *
 * @module tests/services/vk/notifications
 */

import { afterEach, describe, expect, test } from 'bun:test';
import { sendVkNotification } from '@/services/vk/notifications';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('sendVkNotification', () => {
  test('не отправляет уведомление без конфигурации VK', async () => {
    let called = false;
    globalThis.fetch = (() => {
      called = true;
      return Promise.resolve(
        new Response(JSON.stringify({ response: 1 }), { status: 200 }),
      );
    }) as unknown as typeof fetch;

    await sendVkNotification(undefined, new Map());
    expect(called).toBe(false);
  });

  test('не отправляет уведомление при пустом peerId', async () => {
    let called = false;
    globalThis.fetch = (() => {
      called = true;
      return Promise.resolve(
        new Response(JSON.stringify({ response: 1 }), { status: 200 }),
      );
    }) as unknown as typeof fetch;

    await sendVkNotification(
      { accessToken: 'token', peerId: [] },
      new Map([['Okko', [{ title: 'Дорама 1' }]]]),
    );
    expect(called).toBe(false);
  });

  test('загружает постер и отправляет сообщение с attachment', async () => {
    let sendBody: URLSearchParams | undefined;
    globalThis.fetch = ((url: string, init?: RequestInit) => {
      if (url === 'https://img.example.com/poster1.jpg') {
        return Promise.resolve(
          new Response(new Blob(['fake-image']), { status: 200 }),
        );
      }
      if (url === 'https://upload.example.com/') {
        return Promise.resolve(
          new Response(
            JSON.stringify({ server: 1, photo: 'photo', hash: 'hash' }),
            { status: 200 },
          ),
        );
      }
      const body = init?.body as URLSearchParams;
      if (url.endsWith('photos.getMessagesUploadServer')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              response: { upload_url: 'https://upload.example.com/' },
            }),
            { status: 200 },
          ),
        );
      }
      if (url.endsWith('photos.saveMessagesPhoto')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              response: [{ owner_id: -1, id: 1, access_key: 'key' }],
            }),
            { status: 200 },
          ),
        );
      }
      if (url.endsWith('messages.send')) {
        sendBody = body;
        return Promise.resolve(
          new Response(JSON.stringify({ response: 1 }), { status: 200 }),
        );
      }
      return Promise.resolve(new Response('{}', { status: 200 }));
    }) as unknown as typeof fetch;

    await sendVkNotification(
      { accessToken: 'token', peerId: 2000000001 },
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

    expect(sendBody?.get('attachment')).toBe('photo-1_1_key');
    expect(sendBody?.get('message')).toContain('Дорама 1');
    expect(sendBody?.get('message')).toContain('https://example.com/watch/1');
    expect(sendBody?.get('random_id')).toBeTruthy();
  });

  test('отправляет текст без постера', async () => {
    let sendBody: URLSearchParams | undefined;
    globalThis.fetch = ((url: string, init?: RequestInit) => {
      if (url.endsWith('messages.send')) {
        sendBody = init?.body as URLSearchParams;
        return Promise.resolve(
          new Response(JSON.stringify({ response: 1 }), { status: 200 }),
        );
      }
      return Promise.resolve(new Response('{}', { status: 200 }));
    }) as unknown as typeof fetch;

    await sendVkNotification(
      { accessToken: 'token', peerId: 2000000001 },
      new Map([['Okko', [{ title: 'Дорама 1' }]]]),
    );

    expect(sendBody?.get('attachment')).toBeNull();
    expect(sendBody?.get('message')).toContain('Дорама 1');
  });

  test('отправляет текст без фото при ошибке аплоада', async () => {
    let sendBody: URLSearchParams | undefined;
    globalThis.fetch = ((url: string, init?: RequestInit) => {
      if (url === 'https://img.example.com/poster1.jpg') {
        return Promise.resolve(new Response('Not Found', { status: 404 }));
      }
      if (url.endsWith('messages.send')) {
        sendBody = init?.body as URLSearchParams;
        return Promise.resolve(
          new Response(JSON.stringify({ response: 1 }), { status: 200 }),
        );
      }
      return Promise.resolve(new Response('{}', { status: 200 }));
    }) as unknown as typeof fetch;

    await sendVkNotification(
      { accessToken: 'token', peerId: 2000000001 },
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

    expect(sendBody?.get('attachment')).toBeNull();
    expect(sendBody?.get('message')).toContain('Дорама 1');
  });

  test('передаёт access_token и версию API в messages.send', async () => {
    let sendBody: URLSearchParams | undefined;
    globalThis.fetch = ((url: string, init?: RequestInit) => {
      if (url.endsWith('messages.send')) {
        sendBody = init?.body as URLSearchParams;
        return Promise.resolve(
          new Response(JSON.stringify({ response: 1 }), { status: 200 }),
        );
      }
      return Promise.resolve(new Response('{}', { status: 200 }));
    }) as unknown as typeof fetch;

    await sendVkNotification(
      { accessToken: 'token', peerId: 2000000001 },
      new Map([['Okko', [{ title: 'Дорама 1' }]]]),
    );

    expect(sendBody?.get('access_token')).toBe('token');
    expect(sendBody?.get('v')).toBe('5.199');
  });

  test('не бросает ошибку при HTTP-ошибке 500', async () => {
    globalThis.fetch = (() =>
      Promise.resolve(
        new Response('Internal Server Error', { status: 500 }),
      )) as unknown as typeof fetch;

    await expect(
      sendVkNotification(
        { accessToken: 'token', peerId: 2000000001 },
        new Map([['Okko', [{ title: 'Дорама 1' }]]]),
      ),
    ).resolves.toBeUndefined();
  });

  test('не бросает ошибку при ответе API с ошибкой', async () => {
    globalThis.fetch = (() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            error: { error_code: 100, error_msg: 'Unknown method passed' },
          }),
          { status: 200 },
        ),
      )) as unknown as typeof fetch;

    await expect(
      sendVkNotification(
        { accessToken: 'token', peerId: 2000000001 },
        new Map([['Okko', [{ title: 'Дорама 1' }]]]),
      ),
    ).resolves.toBeUndefined();
  });

  test('нейтрализует VK-разметку в названии и источнике', async () => {
    let sendBody: URLSearchParams | undefined;
    globalThis.fetch = ((url: string, init?: RequestInit) => {
      if (url.endsWith('messages.send')) {
        sendBody = init?.body as URLSearchParams;
        return Promise.resolve(
          new Response(JSON.stringify({ response: 1 }), { status: 200 }),
        );
      }
      return Promise.resolve(new Response('{}', { status: 200 }));
    }) as unknown as typeof fetch;

    await sendVkNotification(
      { accessToken: 'token', peerId: 2000000001 },
      new Map([['Okko', [{ title: 'Дорама **Супер** [смотреть|тут]' }]]]),
    );

    const message = sendBody?.get('message') ?? '';
    expect(message).toContain('Дорама *Супер* (смотреть|тут)');
    expect(message).not.toContain('Дорама **Супер**');
  });

  test('отправляет текст без фото при HTTP-ошибке аплоада', async () => {
    let sendBody: URLSearchParams | undefined;
    globalThis.fetch = ((url: string, init?: RequestInit) => {
      if (url === 'https://img.example.com/poster1.jpg') {
        return Promise.resolve(
          new Response(new Blob(['fake-image']), { status: 200 }),
        );
      }
      if (url === 'https://upload.example.com/') {
        return Promise.resolve(new Response('Server Error', { status: 500 }));
      }
      if (url.endsWith('photos.getMessagesUploadServer')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              response: { upload_url: 'https://upload.example.com/' },
            }),
            { status: 200 },
          ),
        );
      }
      if (url.endsWith('messages.send')) {
        sendBody = init?.body as URLSearchParams;
        return Promise.resolve(
          new Response(JSON.stringify({ response: 1 }), { status: 200 }),
        );
      }
      return Promise.resolve(new Response('{}', { status: 200 }));
    }) as unknown as typeof fetch;

    await sendVkNotification(
      { accessToken: 'token', peerId: 2000000001 },
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

    expect(sendBody?.get('attachment')).toBeNull();
    expect(sendBody?.get('message')).toContain('Дорама 1');
  });

  test('передаёт User-Agent при скачивании постера', async () => {
    let posterHeaders: Record<string, string> | undefined;
    globalThis.fetch = ((url: string, init?: RequestInit) => {
      if (url === 'https://img.example.com/poster1.jpg') {
        posterHeaders = init?.headers as Record<string, string> | undefined;
        return Promise.resolve(
          new Response(new Blob(['fake-image']), { status: 200 }),
        );
      }
      if (url === 'https://upload.example.com/') {
        return Promise.resolve(
          new Response(
            JSON.stringify({ server: 1, photo: 'photo', hash: 'hash' }),
            { status: 200 },
          ),
        );
      }
      if (url.endsWith('photos.getMessagesUploadServer')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              response: { upload_url: 'https://upload.example.com/' },
            }),
            { status: 200 },
          ),
        );
      }
      if (url.endsWith('photos.saveMessagesPhoto')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              response: [{ owner_id: -1, id: 1, access_key: 'key' }],
            }),
            { status: 200 },
          ),
        );
      }
      if (url.endsWith('messages.send')) {
        return Promise.resolve(
          new Response(JSON.stringify({ response: 1 }), { status: 200 }),
        );
      }
      return Promise.resolve(new Response('{}', { status: 200 }));
    }) as unknown as typeof fetch;

    await sendVkNotification(
      { accessToken: 'token', peerId: 2000000001 },
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
      'TestAgent/1.0',
    );

    expect(posterHeaders).toEqual({ 'User-Agent': 'TestAgent/1.0' });
  });
});
