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

test('извлекает названия, постеры и ссылки', async () => {
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          results: [
            {
              title: 'Дорама 1',
              assets: {
                productPoster: 'https://img.example.com/{SIZE}/poster1.jpg',
              },
              webUrl: '/watch/1',
            },
            {
              title: 'Дорама 2',
              assets: {
                productPoster: 'https://img.example.com/{SIZE}/poster2.jpg',
              },
              webUrl: '/watch/2',
            },
          ],
        }),
        { status: 200 },
      ),
    )) as unknown as typeof fetch;

  const richSource: Source = {
    ...source,
    jsonPath: 'results.*.title',
    posterJsonPath: 'results.*.assets.productPoster',
    linkJsonPath: 'results.*.webUrl',
    linkBaseUrl: 'https://amediateka.ru',
  };

  const result = await fetchDramasFromSource(richSource);
  expect(result.dramas).toEqual([
    {
      title: 'Дорама 1',
      posterUrl: 'https://img.example.com/400x600/poster1.jpg',
      link: 'https://amediateka.ru/watch/1',
    },
    {
      title: 'Дорама 2',
      posterUrl: 'https://img.example.com/400x600/poster2.jpg',
      link: 'https://amediateka.ru/watch/2',
    },
  ]);
});

test('не смещает постеры и ссылки, если у дорамы в середине их нет', async () => {
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          results: [
            {
              title: 'Дорама 1',
              assets: {
                productPoster: 'https://img.example.com/{SIZE}/poster1.jpg',
              },
              webUrl: '/watch/1',
            },
            { title: 'Дорама 2' },
            {
              title: 'Дорама 3',
              assets: {
                productPoster: 'https://img.example.com/{SIZE}/poster3.jpg',
              },
              webUrl: '/watch/3',
            },
          ],
        }),
        { status: 200 },
      ),
    )) as unknown as typeof fetch;

  const richSource: Source = {
    ...source,
    jsonPath: 'results.*.title',
    posterJsonPath: 'results.*.assets.productPoster',
    linkJsonPath: 'results.*.webUrl',
    linkBaseUrl: 'https://amediateka.ru',
  };

  const result = await fetchDramasFromSource(richSource);
  expect(result.dramas).toEqual([
    {
      title: 'Дорама 1',
      posterUrl: 'https://img.example.com/400x600/poster1.jpg',
      link: 'https://amediateka.ru/watch/1',
    },
    { title: 'Дорама 2' },
    {
      title: 'Дорама 3',
      posterUrl: 'https://img.example.com/400x600/poster3.jpg',
      link: 'https://amediateka.ru/watch/3',
    },
  ]);
});

test('возвращает только названия без постеров и ссылок', async () => {
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
  expect(result.dramas).toEqual([{ title: 'Дорама 1' }, { title: 'Дорама 2' }]);
});

test('возвращает пустой список при ошибке HTTP', async () => {
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response('Not Found', { status: 404 }),
    )) as unknown as typeof fetch;

  const result = await fetchDramasFromSource(source);
  expect(result.dramas).toEqual([]);
});

test('возвращает пустой список при ошибке сети', async () => {
  globalThis.fetch = (() =>
    Promise.reject(new Error('network error'))) as unknown as typeof fetch;

  const result = await fetchDramasFromSource(source);
  expect(result.dramas).toEqual([]);
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
