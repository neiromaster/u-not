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

test('извлекает названия, если jsonPath указывает прямо на массив строк', async () => {
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          titles: ['Дорама 1', 'Дорама 2'],
        }),
        { status: 200 },
      ),
    )) as unknown as typeof fetch;

  const stringArraySource: Source = {
    ...source,
    jsonPath: 'titles.*',
  };

  const result = await fetchDramasFromSource(stringArraySource);
  expect(result.dramas).toEqual([{ title: 'Дорама 1' }, { title: 'Дорама 2' }]);
});

test('извлекает постеры и ссылки с $-префиксными путями', async () => {
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          result: [
            {
              title: 'Дорама 1',
              assets: {
                productPoster: 'https://img.example.com/{SIZE}/poster1.jpg',
              },
              webUrl: '/watch/1',
            },
          ],
        }),
        { status: 200 },
      ),
    )) as unknown as typeof fetch;

  const richSource: Source = {
    ...source,
    jsonPath: '$.result.*.title',
    posterJsonPath: '$.result.*.assets.productPoster',
    linkJsonPath: '$.result.*.webUrl',
    linkBaseUrl: 'https://amediateka.ru',
  };

  const result = await fetchDramasFromSource(richSource);
  expect(result.dramas).toEqual([
    {
      title: 'Дорама 1',
      posterUrl: 'https://img.example.com/400x600/poster1.jpg',
      link: 'https://amediateka.ru/watch/1',
    },
  ]);
});

test('подставляет posterBaseUrl перед относительным URL постера', async () => {
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          items: [
            {
              name: 'Дорама 1',
              logo: '/images/poster1.jpg',
              slug: 'dorama-1',
            },
          ],
        }),
        { status: 200 },
      ),
    )) as unknown as typeof fetch;

  const richSource: Source = {
    ...source,
    jsonPath: '$.items.*.name',
    posterJsonPath: '$.items.*.logo',
    linkJsonPath: '$.items.*.slug',
    posterBaseUrl: 'https://images.example.com',
    linkBaseUrl: 'https://wink.example.com/series/',
  };

  const result = await fetchDramasFromSource(richSource);
  expect(result.dramas).toEqual([
    {
      title: 'Дорама 1',
      posterUrl: 'https://images.example.com/images/poster1.jpg',
      link: 'https://wink.example.com/series/dorama-1',
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

test('бросает ошибку при ошибке HTTP', async () => {
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response('Not Found', { status: 404 }),
    )) as unknown as typeof fetch;

  expect(fetchDramasFromSource(source)).rejects.toThrow(
    'Источник Okko (https://example.com/api): HTTP 404',
  );
});

test('бросает ошибку при ошибке сети', async () => {
  globalThis.fetch = (() =>
    Promise.reject(new Error('network error'))) as unknown as typeof fetch;

  expect(fetchDramasFromSource(source)).rejects.toThrow(
    'Источник Okko (https://example.com/api): network error',
  );
});

test('бросает ошибку, если список дорам пуст', async () => {
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response(JSON.stringify({ result: [] }), { status: 200 }),
    )) as unknown as typeof fetch;

  expect(fetchDramasFromSource(source)).rejects.toThrow('пустой список дорам');
});

test('передаёт User-Agent в заголовках запроса', async () => {
  let capturedInit: RequestInit | undefined;
  globalThis.fetch = ((_url: string, init?: RequestInit) => {
    capturedInit = init;
    return Promise.resolve(
      new Response(JSON.stringify({ result: [{ title: 'Дорама 1' }] }), {
        status: 200,
      }),
    );
  }) as unknown as typeof fetch;

  await fetchDramasFromSource(source, 'test-agent');
  const headers = capturedInit?.headers as Record<string, string>;
  expect(headers['User-Agent']).toBe('test-agent');
});

test('извлекает дорамы через FlareSolverr из HTML-обёртки', async () => {
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          solution: {
            response: `<html><body><pre>${JSON.stringify({
              result: [{ title: 'Дорама 1' }, { title: 'Дорама 2' }],
            })}</pre></body></html>`,
          },
        }),
        { status: 200 },
      ),
    )) as unknown as typeof fetch;

  const flareSource: Source = {
    ...source,
    flaresolverrUrl: 'http://localhost:8190',
  };

  const result = await fetchDramasFromSource(flareSource);
  expect(result.dramas).toEqual([{ title: 'Дорама 1' }, { title: 'Дорама 2' }]);
});

test('извлекает дорамы через FlareSolverr из чистого JSON', async () => {
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          solution: {
            response: JSON.stringify({ result: [{ title: 'Дорама 1' }] }),
          },
        }),
        { status: 200 },
      ),
    )) as unknown as typeof fetch;

  const flareSource: Source = {
    ...source,
    flaresolverrUrl: 'http://localhost:8190',
  };

  const result = await fetchDramasFromSource(flareSource);
  expect(result.dramas).toEqual([{ title: 'Дорама 1' }]);
});

test('передаёт X-Api-Key в запрос к FlareSolverr', async () => {
  let capturedUrl = '';
  let capturedInit: RequestInit | undefined;
  globalThis.fetch = ((url: string, init?: RequestInit) => {
    capturedUrl = url;
    capturedInit = init;
    return Promise.resolve(
      new Response(
        JSON.stringify({
          solution: {
            response: JSON.stringify({ result: [{ title: 'Дорама 1' }] }),
          },
        }),
        { status: 200 },
      ),
    );
  }) as unknown as typeof fetch;

  const flareSource: Source = {
    ...source,
    flaresolverrUrl: 'http://localhost:8190',
    flaresolverrApiKey: 'secret-key',
  };

  await fetchDramasFromSource(flareSource);
  expect(capturedUrl).toBe('http://localhost:8190/v1');
  const headers = capturedInit?.headers as Record<string, string>;
  expect(headers['X-Api-Key']).toBe('secret-key');
});

test('бросает ошибку, если FlareSolverr вернул пустой ответ', async () => {
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response(JSON.stringify({ solution: { response: '' } }), {
        status: 200,
      }),
    )) as unknown as typeof fetch;

  const flareSource: Source = {
    ...source,
    flaresolverrUrl: 'http://localhost:8190',
  };

  expect(fetchDramasFromSource(flareSource)).rejects.toThrow(
    'FlareSolverr вернул пустой ответ',
  );
});

test('бросает ошибку при ошибке HTTP от FlareSolverr', async () => {
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response('Bad Gateway', { status: 502 }),
    )) as unknown as typeof fetch;

  const flareSource: Source = {
    ...source,
    flaresolverrUrl: 'http://localhost:8190',
  };

  expect(fetchDramasFromSource(flareSource)).rejects.toThrow(
    'FlareSolverr HTTP 502',
  );
});
