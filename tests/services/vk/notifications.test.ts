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

  test('отправляет сообщение в каждый чат', async () => {
    const calls: string[] = [];
    globalThis.fetch = ((_url: string, init?: RequestInit) => {
      const body = init?.body as URLSearchParams;
      calls.push(body.get('peer_id') ?? '');
      return Promise.resolve(
        new Response(JSON.stringify({ response: 1 }), { status: 200 }),
      );
    }) as unknown as typeof fetch;

    await sendVkNotification(
      { accessToken: 'token', peerId: [2000000001, 2000000002] },
      new Map([['Okko', [{ title: 'Дорама 1' }, { title: 'Дорама 2' }]]]),
    );

    expect(calls).toEqual(['2000000001', '2000000002']);
  });

  test('передаёт access_token, версию API и текст сообщения', async () => {
    let capturedBody: URLSearchParams | undefined;
    globalThis.fetch = ((_url: string, init?: RequestInit) => {
      capturedBody = init?.body as URLSearchParams;
      return Promise.resolve(
        new Response(JSON.stringify({ response: 1 }), { status: 200 }),
      );
    }) as unknown as typeof fetch;

    await sendVkNotification(
      { accessToken: 'secret-token', peerId: 2000000001 },
      new Map([['Okko', [{ title: 'Дорама 1' }]]]),
    );

    expect(capturedBody?.get('access_token')).toBe('secret-token');
    expect(capturedBody?.get('v')).toBe('5.199');
    expect(capturedBody?.get('peer_id')).toBe('2000000001');
    expect(capturedBody?.get('message')).toContain('Okko');
    expect(capturedBody?.get('message')).toContain('Дорама 1');
    expect(capturedBody?.get('random_id')).toBeTruthy();
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

  test('не бросает ошибку при HTTP ошибке', async () => {
    globalThis.fetch = (() =>
      Promise.resolve(
        new Response('Server Error', { status: 500 }),
      )) as unknown as typeof fetch;

    await expect(
      sendVkNotification(
        { accessToken: 'token', peerId: 2000000001 },
        new Map([['Okko', [{ title: 'Дорама 1' }]]]),
      ),
    ).resolves.toBeUndefined();
  });
});
