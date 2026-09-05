/**
 * Тесты загрузки дорам из источников
 *
 * @module tests/drama/fetcher
 */

import { afterEach, expect, test } from 'bun:test';
import type { Source } from '@/core/config/schema';
import { fetchDramasFromSource } from '@/core/drama/fetcher';

const source: Source = {
  name: 'Okko',
  url: 'https://example.com/api',
  type: 'api',
  jsonPath: 'result.*.title',
};

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('извлекает названия дорам из ответа API', async () => {
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          result: [{ title: 'Дорама 1' }, { title: 'Дорама 2' }],
        }),
        { status: 200 },
      ),
    )) as unknown as typeof fetch;

  const result = await fetchDramasFromSource(source);
  expect(result.titles).toEqual(['Дорама 1', 'Дорама 2']);
});

test('возвращает пустой список при ошибке HTTP', async () => {
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response('Not Found', { status: 404 }),
    )) as unknown as typeof fetch;

  const result = await fetchDramasFromSource(source);
  expect(result.titles).toEqual([]);
});

test('возвращает пустой список при ошибке сети', async () => {
  globalThis.fetch = (() =>
    Promise.reject(new Error('network error'))) as unknown as typeof fetch;

  const result = await fetchDramasFromSource(source);
  expect(result.titles).toEqual([]);
});

test('передаёт User-Agent в заголовках запроса', async () => {
  let capturedInit: RequestInit | undefined;
  globalThis.fetch = ((_url: string, init?: RequestInit) => {
    capturedInit = init;
    return Promise.resolve(
      new Response(JSON.stringify({ result: [] }), { status: 200 }),
    );
  }) as unknown as typeof fetch;

  await fetchDramasFromSource(source, 'test-agent');
  const headers = capturedInit?.headers as Record<string, string>;
  expect(headers['User-Agent']).toBe('test-agent');
});
